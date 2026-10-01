import type { SupabaseClient } from "@supabase/supabase-js";
import { plateKey } from "./domain";
import { searchNYC } from "./nyc";
import { mergeSnapshot } from "./vehicle-snapshots";
export async function refreshSavedSnapshot(
  database: SupabaseClient,
  car: { plate: string; state: string; plate_type: string },
) {
  const { data: rows, error } = await database.rpc("curbside_claim_snapshots", {
    target_key: plateKey({
      plate: car.plate,
      state: car.state,
      plateType: car.plate_type,
    }),
  });
  if (error) return;
  for (const row of rows || []) {
    const deep =
      !row.payload ||
      !row.full_checked_at ||
      Date.now() - Date.parse(row.full_checked_at) > 7 * 86400_000;
    let result = null;
    let fullHistory = false;
    try {
      const current = await searchNYC(
        { plate: row.plate, state: row.state, plateType: row.plate_type },
        deep,
        true,
      );
      if (!current.unavailable) {
        result = mergeSnapshot(row.payload, current);
        fullHistory = deep && current.complete;
      }
    } catch {
      /* Keep previous results and allow the durable lease to retry. */
    }
    await database.rpc("curbside_finish_snapshot", {
      snapshot_key: row.key,
      lease_id: row.lease,
      result,
      full_history: fullHistory,
    });
  }
}
