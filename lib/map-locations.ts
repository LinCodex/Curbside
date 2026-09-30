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
      fill: "#77aaf5",
      "fill-opacity": 0.07,
      stroke: "#77aaf5",
      "stroke-width": 1,
      "stroke-opacity": 0.5,
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
    /^(f\/o|o\/s|n\/s\/o|s\/s\/o|e\/s\/o|w\/s\/o|n\/s|s\/s|e\/s|w\/s|s\/e\/c|n\/e\/c|s\/w\/c|n\/w\/c|i\/c|c\/o|opp|acr|in\s+front\s+of|front\s+of|opposite|corner\s+of|across\s+from|across|near|nr)\s+/i,
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

/** Camera records split a single location across street and intersecting fields. */
export function reportedLocation(
  house: string,
  street: string,
  cross: string,
  borough: string | null,
  camera: boolean,
) {
  if (camera && !house && cross && street.includes("@")) {
    const separator = street.endsWith("@") ? " " : "";
    return {
      label: [street + separator + cross, borough].filter(Boolean).join(" "),
      precision: "intersection" as const,
    };
  }
  if (camera && !house && cross.startsWith("@")) {
    return {
      label: [street, cross, borough].filter(Boolean).join(" "),
      precision: "intersection" as const,
    };
  }
  return {
    label: street
      ? [house, street, cross ? "at " + cross : "", borough]
          .filter(Boolean)
          .join(" ")
      : "",
    precision:
      house && street
        ? ("address" as const)
        : cross && street
          ? ("intersection" as const)
          : street
            ? ("approximate" as const)
            : ("unknown" as const),
  };
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

// Validates NYC Planning Labs GeoSearch features with strict layer and accuracy checks
// to prevent placing false pins at borough, neighborhood, or coarse centroids.
export function geoSearchLocation(
  original: Location,
  feature: any,
): Location | null {
  if (!feature) return null;
  const p = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  )
    return null;
  const [lng, lat] = coordinates;
  const point = { lng, lat };
  if (!hasPoint({ ...original, ...point })) return null;

  // Never accept coarse borough, neighbourhood, or generic county matches
  const validLayers = ["address", "venue"];
  const isAddressOrVenue = validLayers.includes(p?.layer);
  const isIntersection =
    p?.layer === "street" &&
    (p?.accuracy === "intersection" ||
      (typeof p?.label === "string" &&
        (/\s+(&|and)\s+/i.test(p.label) || /\s+at\s+/i.test(p.label))));
  if (!isAddressOrVenue && !isIntersection) return null;

  // Require good confidence if provided
  if (typeof p?.confidence === "number" && p.confidence < 0.7) return null;

  // Verify borough match if original label specifies a borough
  const borough = original.label.match(
    /\b(Queens|Brooklyn|Manhattan|Bronx|Staten Island)\b/i,
  )?.[1];
  const labelText = [p?.label, p?.name, p?.borough, p?.county]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (borough && !labelText.includes(borough.toLowerCase())) return null;

  // PAD addresses often have confidence .8 and a neighborhood-only display
  // label. Validate the actual number/street instead of rejecting valid Queens
  // addresses or accepting a nearby numbered property as the same location.
  if (p?.housenumber || p?.street) {
    const input = cleanLocationLabel(original.label).replace(
      /\s+(Queens|Brooklyn|Manhattan|Bronx|Staten Island)\b.*$/i,
      "",
    );
    const address = input.match(/^(\d+(?:-\d+)?[A-Z]?)\s+(.+)$/i);
    const streetKey = (s: string) =>
      s
        .toLowerCase()
        .replace(
          /\b(blvd|ave|st|rd|dr|pl|ln|pkwy|hwy)\b/g,
          (part) =>
            ({
              blvd: "boulevard",
              ave: "avenue",
              st: "street",
              rd: "road",
              dr: "drive",
              pl: "place",
              ln: "lane",
              pkwy: "parkway",
              hwy: "highway",
            })[part]!,
        )
        .replace(/[^a-z0-9]/g, "");
    if (
      !address ||
      address[1].toLowerCase() !== String(p.housenumber).toLowerCase() ||
      streetKey(address[2]) !== streetKey(String(p.street))
    )
      return null;
  }

  const precision: Location["precision"] = isAddressOrVenue
    ? "address"
    : "intersection";
  const cleaned = cleanLocationLabel(original.label);

  return {
    ...original,
    label: cleaned || original.label,
    lng,
    lat,
    precision,
    matchedAddress: p?.label || p?.name || cleaned,
    resolvedBy: "NYC Planning GeoSearch",
  };
}
