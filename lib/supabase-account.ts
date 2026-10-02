import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "./legal";
import { vehicleInput } from "./saved-vehicles";

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (
    error.code === "P0001" &&
    error.message.startsWith("Saved vehicle capacity")
  )
    throw new Error("Saved vehicle capacity reached. Please contact support.");
  if (error.code === "23505")
    throw new Error("This vehicle is already in your garage.");
  if (["42P01", "PGRST205"].includes(error.code || ""))
    throw new Error(
      "Vehicle storage is awaiting setup. Please try again later.",
    );
  throw new Error("Your saved cars could not be updated. Please try again.");
}

// This adapter uses the customer's token and RLS, never a service-role key.
export async function savedAccountRequest(
  client: SupabaseClient,
  path: string,
  method = "GET",
  input: Record<string, unknown> = {},
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Please sign in to save cars.");
  if (!user.email_confirmed_at)
    throw new Error("Verify your email before saving cars.");
  if (path === "me" && method === "GET") {
    const [cars, consent] = await Promise.all([
      client
        .from("curbside_vehicles")
        .select(
          "id,plate,state,plate_type,nickname,make,model,year,color,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at"),
      client
        .from("curbside_terms_acceptances")
        .select("version")
        .eq("user_id", user.id)
        .eq("version", LEGAL_VERSION)
        .maybeSingle(),
    ]);
    check(cars.error);
    check(consent.error);
    const snapshots = cars.data?.length
      ? await client
          .from("curbside_vehicle_snapshots")
          .select(
            "key,plate,state,plate_type,payload,checked_at,last_attempt_at,next_check_at,status",
          )
      : null;
    check(snapshots?.error || null);
    const vehicles = (cars.data || []).map((car) => {
      const snapshot = snapshots?.data?.find(
        (row) =>
          row.plate === car.plate &&
          row.state === car.state &&
          row.plate_type === car.plate_type,
      );
      return {
        ...car,
        snapshot: snapshot?.payload || null,
        checked_at: snapshot?.checked_at,
        snapshot_status: snapshot?.status || "pending",
        next_check_at: snapshot?.next_check_at,
        last_attempt_at: snapshot?.last_attempt_at,
      };
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        role: "customer",
        plan: "free",
        legalAccepted: !!consent.data,
        emailVerified: true,
      },
      vehicles,
      tickets: [],
      cases: [],
    };
  }
  if (path === "legal" && method === "POST") {
    if (
      input.accepted !== true ||
      input.adult !== true ||
      input.version !== LEGAL_VERSION
    )
      throw new Error("Review and accept the current terms to continue.");
    const result = await client
      .from("curbside_terms_acceptances")
      .upsert(
        { user_id: user.id, version: LEGAL_VERSION },
        { onConflict: "user_id,version", ignoreDuplicates: true },
      );
    check(result.error);
    return { ok: true };
  }
  if (path === "vehicles" && method === "POST") {
    const result = await client
      .from("curbside_vehicles")
      .insert({ ...vehicleInput(input), user_id: user.id })
      .select("id")
      .single();
    check(result.error);
    // The server verifies ownership and claims a durable job; clients never upload city results.
    if (result.data)
      await client.functions
        .invoke("vehicle-snapshots", {
          body: { mode: "refresh", vehicleId: result.data.id },
        })
        .catch(() => {});
    return result.data;
  }
  const match = /^vehicles\/([0-9a-f-]{36})$/i.exec(path);
  if (match && method === "PATCH") {
    const result = await client
      .from("curbside_vehicles")
      .update(vehicleInput(input, true))
      .eq("id", match[1])
      .eq("user_id", user.id)
      .select("id")
      .single();
    check(result.error);
    return result.data;
  }
  if (match && method === "DELETE") {
    const result = await client
      .from("curbside_vehicles")
      .delete()
      .eq("id", match[1])
      .eq("user_id", user.id)
      .select("id")
      .single();
    check(result.error);
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
  if (path === "account" && method === "DELETE") {
    if (input.confirmation !== "DELETE_ACCOUNT")
      throw new Error("Confirm account deletion before continuing.");
    const result = await client.functions.invoke("account-delete", {
      body: { confirmation: "DELETE_ACCOUNT", userId: user.id },
    });
    if (result.error || result.data?.ok !== true)
      throw new Error(
        "Your account could not be deleted. It remains active. Please try again or contact support.",
      );
    await client.auth.signOut({ scope: "local" });
    return { ok: true };
  }
  throw new Error("This account currently supports saved cars only.");
}
