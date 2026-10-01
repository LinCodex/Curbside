import { mergeTickets, type SearchResult, type Violation } from "./domain";

export type GarageVehicle = {
  id: string;
  snapshot?: SearchResult | null;
};

export function combinedGarageHistory(
  vehicles: GarageVehicle[],
  legacyTickets: (Violation & { vehicleId?: string })[] = [],
) {
  const owned = new Set(vehicles.map((vehicle) => vehicle.id));
  const records = vehicles.flatMap(
    (vehicle) => vehicle.snapshot?.tickets || [],
  );
  records.push(
    ...legacyTickets.filter((ticket) => owned.has(ticket.vehicleId || "")),
  );
  // A summons may appear in both an all-types snapshot and a specific-type snapshot.
  // Merge oldest observations first so the freshest city financial fields win.
  records.sort((a, b) => (a.checkedAt || "").localeCompare(b.checkedAt || ""));
  return {
    tickets: mergeTickets(records),
    ready: vehicles.filter((vehicle) => !!vehicle.snapshot).length,
    complete: vehicles.every((vehicle) => vehicle.snapshot?.complete === true),
  };
}
