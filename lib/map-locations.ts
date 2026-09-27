import type { Location } from "./domain";

// A visual neighborhood context, not a city-provided accuracy radius.
export function contextRadius(location: Location) {
  return location.precision === "address"
    ? 75
    : location.precision === "intersection"
      ? 150
      : 300;
}
export function locationRing(location: Location) {
  if (!hasPoint(location)) return null;
  const radius = contextRadius(location),
    lat = location.lat!,
    lng = location.lng!;
  const coordinates = Array.from({ length: 33 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 32;
    return [
      Number(
        (
          lng +
          (radius * Math.cos(angle)) /
            (111320 * Math.cos((lat * Math.PI) / 180))
        ).toFixed(6),
      ),
      Number((lat + (radius * Math.sin(angle)) / 111320).toFixed(6)),
    ];
  });
  return {
    type: "Feature" as const,
    properties: {
      fill: "#91b8ec",
      "fill-opacity": 0.14,
      stroke: "#b1cbed",
      "stroke-width": 1,
      "stroke-opacity": 0.7,
    },
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

export function hasPoint(location: Location) {
  return (
    Number.isFinite(location.lng) &&
    Number.isFinite(location.lat) &&
    location.lng! >= -74.3 &&
    location.lng! <= -73.65 &&
    location.lat! >= 40.45 &&
    location.lat! <= 40.95
  );
}
// Clean enforcement shorthand and normalize address string for geocoding & autocorrect
export function cleanLocationLabel(label: string): string {
  if (!label) return "";
  let s = label.trim();
  // Strip highway directional prefix (NB, SB, EB, WB)
  s = s.replace(/^(NB|SB|EB|WB)\s+/i, "");
  // Strip enforcement shorthand prefixes (F/O, O/S, N/S, S/S, E/S, W/S, I/C, C/O, OPP, ACR, FRONT OF, etc.)
  s = s.replace(
    /^(f\/o|o\/s|n\/s|s\/s|e\/s|w\/s|i\/c|c\/o|opp|acr|in\s+front\s+of|front\s+of|opposite|corner\s+of|across\s+from|across)\s+/i,
    "",
  );
  // Replace intersection markers with " and "
  s = s.replace(/\s+at\s+@\s*/gi, " and ");
  s = s.replace(/\s*@\s*/g, " and ");
  s = s.replace(/\s*\/\s*/g, " and ");
  s = s.replace(/\s*&\s*/g, " and ");
  s = s.replace(
    /\s+at\s+[NSEW](?=\s+(Queens|Brooklyn|Manhattan|Bronx|Staten Island)\b)/gi,
    "",
  );
  s = s.replace(/\s+at\s+/gi, " and ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function autocorrectAddress(label: string): {
  suggested: string;
  changed: boolean;
} {
  if (!label) return { suggested: "", changed: false };
  const cleaned = cleanLocationLabel(label);
  const changed = cleaned.toLowerCase() !== label.trim().toLowerCase();
  return {
    suggested: cleaned,
    changed,
  };
}

// Preserve the city's display label; normalize only the provider query.
export function locationQuery(label: string) {
  return cleanLocationLabel(label) + ", New York, USA";
}
export function mapboxLocation(
  original: Location,
  feature: any,
): Location | null {
  const p = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== "Point" || !Array.isArray(coordinates))
    return null;
  const point = { lng: coordinates[0], lat: coordinates[1] };
  if (!hasPoint({ ...original, ...point })) return null;
  const borough = original.label.match(
    /\b(Queens|Brooklyn|Manhattan|Bronx|Staten Island)\b/i,
  )?.[1];
  const context =
    JSON.stringify(p?.context || {}) + " " + (p?.full_address || "");
  if (borough && !context.toLowerCase().includes(borough.toLowerCase()))
    return null;
  let precision: Location["precision"];
  if (
    p?.feature_type === "street" &&
    p.coordinates?.accuracy === "intersection"
  )
    precision = "intersection";
  else if (
    p?.feature_type === "address" &&
    ["exact", "high"].includes(p.match_code?.confidence) &&
    p.match_code?.street === "matched" &&
    p.match_code?.address_number === "matched"
  ) {
    precision = ["rooftop", "parcel", "point"].includes(p.coordinates?.accuracy)
      ? "address"
      : "approximate";
  } else return null; // Never pin the center of a whole street, borough, or postcode.
  return {
    ...original,
    ...point,
    precision,
    matchedAddress: p.full_address || p.name,
    resolvedBy: "Mapbox address lookup",
  };
}
