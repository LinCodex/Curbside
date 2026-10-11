// A guest who taps "Save vehicle" must sign up and confirm by email first,
// often in another tab. Remember only that plate, briefly, to resume the save.
import { normalizePlate } from "./domain";

export const PENDING_SAVE_KEY = "ticketsafe.pendingSave.v1";
export const PENDING_SAVE_TTL = 24 * 60 * 60 * 1000;

export type PendingSave = {
  plate: string;
  state: string;
  plateType: string;
  at: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writePendingSave(
  storage: StorageLike,
  vehicle: { plate: string; state: string; plateType?: string },
  now = Date.now(),
) {
  try {
    storage.setItem(
      PENDING_SAVE_KEY,
      JSON.stringify({
        plate: vehicle.plate,
        state: vehicle.state,
        plateType: vehicle.plateType || "",
        at: now,
      }),
    );
  } catch {
    /* Without storage, the guest can save again after signing in. */
  }
}

export function takePendingSave(
  storage: StorageLike,
  now = Date.now(),
): PendingSave | null {
  try {
    const raw = storage.getItem(PENDING_SAVE_KEY);
    if (!raw) return null;
    storage.removeItem(PENDING_SAVE_KEY);
    const value = JSON.parse(raw);
    if (
      !Number.isSafeInteger(value?.at) ||
      value.at > now ||
      now - value.at > PENDING_SAVE_TTL ||
      typeof value.plate !== "string" ||
      typeof value.state !== "string" ||
      typeof value.plateType !== "string"
    )
      return null;
    return { ...normalizePlate(value), at: value.at };
  } catch {
    return null;
  }
}

export function clearPendingSave(storage: StorageLike) {
  try {
    storage.removeItem(PENDING_SAVE_KEY);
  } catch {
    /* Nothing to clear when storage is blocked. */
  }
}
