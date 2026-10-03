import { normalizePlate, STATES, type SearchResult } from "./domain";

export const SEARCH_RESULT_KEY = "ticketsafe_search_result_v1";
export const SEARCH_NAVIGATION_KEY = "ticketsafe_search_navigation_v1";
type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SearchNavigation = {
  view: string;
  plate: string;
  state: string;
  plateType: string;
  history: boolean;
  filter: string;
  vehicleId: string;
  mapVehicleId: string;
  mapFilter: string;
  mapSelection: string;
  mapBoxMinimized: boolean;
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function read(storage: TabStorage, key: string, owner: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 4_500_000) return null;
    const saved: unknown = JSON.parse(raw);
    return object(saved) && saved.owner === owner ? saved.value : null;
  } catch {
    return null;
  }
}
export function readSearchResult(storage: TabStorage, owner: string): SearchResult | null {
  const result = read(storage, SEARCH_RESULT_KEY, owner);
  try {
    if (!object(result) || !object(result.query)) return null;
    normalizePlate(result.query);
    if (
      !Array.isArray(result.tickets) || !Array.isArray(result.sources) ||
      typeof result.checkedAt !== "string" || !Number.isFinite(Date.parse(result.checkedAt)) ||
      typeof result.complete !== "boolean" || typeof result.unavailable !== "boolean" ||
      !result.tickets.every((ticket: unknown) =>
        object(ticket) && typeof ticket.id === "string" && typeof ticket.description === "string" &&
        typeof ticket.plate === "string" && typeof ticket.state === "string" &&
        object(ticket.location) && typeof ticket.location.label === "string" &&
        object(ticket.vehicle) && object(ticket.provenance) && Array.isArray(ticket.sources) &&
        ["fine", "penalty", "interest", "reduction", "payments", "due"].every(
          key => ticket[key] === null || (typeof ticket[key] === "number" && Number.isFinite(ticket[key])),
        ),
      ) || !result.sources.every((source: unknown) => object(source) && typeof source.id === "string" && typeof source.name === "string")
    ) return null;
    return result as unknown as SearchResult;
  } catch {
    return null;
  }
}
export function readSearchNavigation(storage: TabStorage, owner: string): SearchNavigation | null {
  const value = read(storage, SEARCH_NAVIGATION_KEY, owner);
  if (
    !object(value) || typeof value.view !== "string" || !["garage", "search", "map", "account"].includes(value.view) ||
    typeof value.plate !== "string" || value.plate.length > 12 ||
    typeof value.state !== "string" || !STATES.includes(value.state) || typeof value.plateType !== "string" || !/^[A-Z0-9]{0,5}$/.test(value.plateType) ||
    typeof value.history !== "boolean" || typeof value.filter !== "string" || !["all", "open", "resolved"].includes(value.filter) ||
    typeof value.mapFilter !== "string" || !["all", "open", "address"].includes(value.mapFilter) || typeof value.mapBoxMinimized !== "boolean" ||
    ![value.vehicleId, value.mapVehicleId, value.mapSelection].every(id => typeof id === "string" && id.length <= 100)
  ) return null;
  return value as unknown as SearchNavigation;
}
function write(storage: TabStorage, key: string, owner: string, value: unknown) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ owner, value }));
    return true;
  } catch {
    // A failed replacement must not restore a different, older search instead.
    try { storage.removeItem(key); } catch {}
    return false;
  }
}
export function writeSearchResult(storage: TabStorage, owner: string, result: SearchResult | null) {
  // Only city search records; never persist temporary Mapbox matches or private annotations.
  const value = result && {
    ...result,
    tickets: result.tickets.map(ticket => {
      const publicTicket = { ...ticket };
      delete publicTicket.localStatus;
      return {
        ...publicTicket,
        location: /mapbox/i.test(ticket.location.resolvedBy || "")
          ? { label: ticket.location.label, precision: ticket.location.precision }
          : ticket.location,
      };
    }),
  };
  return write(storage, SEARCH_RESULT_KEY, owner, value);
}
export function writeSearchNavigation(storage: TabStorage, owner: string, navigation: SearchNavigation) {
  return write(storage, SEARCH_NAVIGATION_KEY, owner, navigation);
}
