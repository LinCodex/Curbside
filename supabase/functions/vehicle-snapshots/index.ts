import { createClient } from "@supabase/supabase-js";
import {
  normalizePlate,
  plateKey,
  type SearchResult,
} from "../../../lib/domain";
import { searchNYC } from "../../../lib/nyc";
import { mergeSnapshot } from "../../../lib/vehicle-snapshots";

// The deployed bundle uses Supabase's runtime-supplied server credential only.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };
const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
type SnapshotRow = {
  key: string;
  plate: string;
  state: string;
  plate_type: string;
  payload: SearchResult | null;
  lease: string;
  full_checked_at: string | null;
};
async function refresh(row: SnapshotRow) {
  const deep =
    !row.payload ||
    !row.full_checked_at ||
    Date.now() - Date.parse(row.full_checked_at) > 7 * 86400_000;
  let result: SearchResult | null = null;
  let completeHistory = false;
  try {
    const current = await searchNYC(
      { plate: row.plate, state: row.state, plateType: row.plate_type },
      deep,
      true,
    );
    if (!current.unavailable) {
      result = mergeSnapshot(row.payload, current);
      completeHistory = deep && current.complete;
    }
  } catch {
    /* Leave the last usable snapshot intact; the durable lease will retry. */
  }
  const { error } = await admin.rpc("curbside_finish_snapshot", {
    snapshot_key: row.key,
    lease_id: row.lease,
    result,
    full_history: completeHistory,
  });
  if (error) console.error("Snapshot completion failed", error.code);
}
function reply(value: unknown, status: number, origin: string | null) {
  const allowed =
    origin &&
    (origin === "https://curbside-eta.vercel.app" ||
      /^http:\/\/localhost:\d+$/.test(origin));
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowed
        ? origin!
        : "https://curbside-eta.vercel.app",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
    },
  });
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return reply({}, 200, origin);
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405, origin);
  try {
    // Read a bounded stream rather than trusting Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing request" }, 400, origin);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2048) {
        await reader.cancel();
        return reply({ error: "Request too large" }, 413, origin);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset);
      offset += chunk.length;
    });
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (body.mode === "lookup") {
      const plate = normalizePlate(body);
      const { data, error } = await admin
        .from("curbside_vehicle_snapshots")
        .select("payload,status,next_check_at,last_attempt_at")
        .eq("key", plateKey(plate))
        .maybeSingle();
      if (error)
        return reply({ error: "History temporarily unavailable" }, 503, origin);
      // Public city records only: no customer IDs, subscriptions, leases, or car details.
      const result = data?.payload
        ? {
            ...data.payload,
            snapshot: {
              ...data.payload.snapshot,
              retainedRecords: data.payload.snapshot?.retainedRecords || 0,
              status: data.status,
              nextCheckAt: data.next_check_at,
              lastAttemptAt: data.last_attempt_at,
            },
          }
        : null;
      return reply({ result }, 200, origin);
    }
    let target: string | null = null;
    if (body.mode === "cron") {
      const candidate = request.headers.get("x-curbside-cron") || "";
      if (candidate.length !== 64)
        return reply({ error: "Unauthorized" }, 401, origin);
      const { data, error } = await admin.rpc("curbside_verify_snapshot_cron", {
        candidate,
      });
      if (error || data !== true)
        return reply({ error: "Unauthorized" }, 401, origin);
    } else if (body.mode === "refresh") {
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply({ error: "Sign in required" }, 401, origin);
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (error || !user?.email_confirmed_at || user.is_anonymous)
        return reply({ error: "Verified account required" }, 401, origin);
      if (!/^[0-9a-f-]{36}$/i.test(body.vehicleId || ""))
        return reply({ error: "Invalid vehicle" }, 400, origin);
      const { data: car, error: carError } = await admin
        .from("curbside_vehicles")
        .select("plate,state,plate_type")
        .eq("id", body.vehicleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (carError || !car)
        return reply({ error: "Vehicle not found" }, 404, origin);
      target = plateKey({
        plate: car.plate,
        state: car.state,
        plateType: car.plate_type,
      });
    } else return reply({ error: "Invalid request" }, 400, origin);
    const { data: rows, error } = await admin.rpc("curbside_claim_snapshots", {
      target_key: target,
    });
    if (error)
      return reply({ error: "History temporarily unavailable" }, 503, origin);
    EdgeRuntime.waitUntil(
      Promise.all(((rows as SnapshotRow[]) || []).map(refresh)),
    );
    return reply({ queued: rows?.length || 0 }, 202, origin);
  } catch {
    return reply({ error: "Invalid request" }, 400, origin);
  }
});
