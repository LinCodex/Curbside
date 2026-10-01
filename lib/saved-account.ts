import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "./legal";
import { vehicleInput } from "./saved-vehicles";
import { plateKey } from "./domain";
import { HttpError } from "./runtime";
export type AccountIdentity = {
  id: string;
  clerkId: string;
  email: string;
  legalAcceptedAt: number;
};
function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "23505")
    throw new HttpError(409, "This vehicle is already in your garage.");
  if (
    error.code === "P0001" &&
    error.message.startsWith("Saved vehicle capacity")
  )
    throw new HttpError(
      409,
      "Saved vehicle capacity reached. Please contact support.",
    );
  throw new HttpError(
    503,
    "Your saved cars could not be updated. Please try again.",
  );
}
function editableVehicle(input: Record<string, unknown>, editing = false) {
  try {
    return vehicleInput(input, editing);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
}
// Server-only adapter: every private read/write is scoped to the resolved Clerk account UUID.
export async function savedAccountRequest(
  client: SupabaseClient,
  user: AccountIdentity,
  path: string,
  method = "GET",
  input: Record<string, unknown> = {},
) {
  if (path === "me" && method === "GET") {
    // Clerk owns consent collection. Preserve its actual timestamp; never invent acceptance.
    const consent = await client.from("curbside_terms_acceptances").upsert(
      {
        user_id: user.id,
        version: LEGAL_VERSION,
        accepted_at: new Date(user.legalAcceptedAt).toISOString(),
      },
      { onConflict: "user_id,version", ignoreDuplicates: true },
    );
    check(consent.error);
    const cars = await client
      .from("curbside_vehicles")
      .select(
        "id,plate,state,plate_type,nickname,make,model,year,color,created_at",
      )
      .eq("user_id", user.id)
      .order("created_at");
    check(cars.error);
    const snapshots = cars.data?.length
      ? await client
          .from("curbside_vehicle_snapshots")
          .select("key,payload,checked_at,last_attempt_at,next_check_at,status")
          .in(
            "key",
            cars.data.map((car) =>
              plateKey({
                plate: car.plate,
                state: car.state,
                plateType: car.plate_type,
              }),
            ),
          )
      : null;
    check(snapshots?.error || null);
    return {
      user: {
        id: user.clerkId,
        email: user.email,
        role: "customer",
        plan: "free",
        legalAccepted: true,
        emailVerified: true,
      },
      vehicles: (cars.data || []).map((car) => {
        const snapshot = snapshots?.data?.find(
          (row) =>
            row.key ===
            plateKey({
              plate: car.plate,
              state: car.state,
              plateType: car.plate_type,
            }),
        );
        return {
          ...car,
          snapshot: snapshot?.payload || null,
          checked_at: snapshot?.checked_at,
          snapshot_status: snapshot?.status || "pending",
          next_check_at: snapshot?.next_check_at,
          last_attempt_at: snapshot?.last_attempt_at,
        };
      }),
      tickets: [],
      cases: [],
    };
  }
  if (path === "preferences" && method === "GET") {
    const result = await client
      .from("curbside_preferences")
      .select("theme,language,detail_mode")
      .eq("user_id", user.id)
      .maybeSingle();
    check(result.error);
    return result.data;
  }
  if (path === "preferences" && method === "PATCH") {
    if (
      !["system", "light", "dark"].includes(String(input.theme)) ||
      !["system", "en", "zh"].includes(String(input.language)) ||
      !["normal", "geek"].includes(String(input.detail_mode))
    )
      throw new HttpError(400, "Invalid display settings.");
    const result = await client.from("curbside_preferences").upsert({
      user_id: user.id,
      theme: input.theme,
      language: input.language,
      detail_mode: input.detail_mode,
    });
    check(result.error);
    return { ok: true };
  }
  if (path === "vehicles" && method === "POST") {
    const result = await client
      .from("curbside_vehicles")
      .insert({ ...editableVehicle(input), user_id: user.id })
      .select("id")
      .single();
    check(result.error);
    return result.data;
  }
  const match = /^vehicles\/([0-9a-f-]{36})$/i.exec(path);
  if (match && method === "PATCH") {
    const result = await client
      .from("curbside_vehicles")
      .update(editableVehicle(input, true))
      .eq("id", match[1])
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    check(result.error);
    if (!result.data) throw new HttpError(404, "Vehicle not found.");
    return result.data;
  }
  if (match && method === "DELETE") {
    const result = await client
      .from("curbside_vehicles")
      .delete()
      .eq("id", match[1])
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    check(result.error);
    if (!result.data) throw new HttpError(404, "Vehicle not found.");
    return { ok: true };
  }
  if (path === "garage" && method === "DELETE") {
    const result = await client
      .from("curbside_vehicles")
      .delete()
      .eq("user_id", user.id);
    check(result.error);
    return { ok: true };
  }
  throw new HttpError(404, "This account currently supports saved cars only.");
}
