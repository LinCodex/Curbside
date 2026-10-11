// Last server-confirmed email choices, shown immediately after a refresh while
// the server is asked again. Keys are per account and hold only a boolean.
export type SettingKind = "announcements" | "ticket-alerts";

export function settingCacheKey(kind: SettingKind, userId: string) {
  return `ticketsafe.setting.${kind}.${userId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readCachedSetting(
  kind: SettingKind,
  userId: string | undefined,
  storage: StorageLike | null = browserStorage(),
): boolean | undefined {
  if (!userId || !storage) return undefined;
  try {
    const value = storage.getItem(settingCacheKey(kind, userId));
    return value === "1" ? true : value === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedSetting(
  kind: SettingKind,
  userId: string | undefined,
  enabled: boolean,
  storage: StorageLike | null = browserStorage(),
) {
  if (!userId || !storage) return;
  try {
    storage.setItem(settingCacheKey(kind, userId), enabled ? "1" : "0");
  } catch {
    /* Storage can be blocked; the server answer still arrives. */
  }
}
