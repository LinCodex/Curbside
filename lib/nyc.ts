import { BoundedCache } from "./ttl-cache";
import { fetchCityPages } from "./city-pages";
import {
  type Plate,
  type Violation,
  type SearchResult,
  type SourceStatus,
  amount,
  dateOnly,
  mergeTickets,
  applyDeadline,
  plateKey,
} from "./domain";
import { config } from "./runtime";
import {
  geoSearchLocation,
  cleanLocationLabel,
  reportedLocation,
} from "./map-locations";
const historical = [
  ["pvqr-7yc4", "FY2027"],
  ["9mwx-gamw", "FY2026"],
  ["m5vz-tzqv", "FY2025"],
  ["8zf9-spf8", "FY2024"],
  ["869v-vr48", "FY2023"],
  ["7mxj-7a6y", "FY2022"],
  ["kvfd-bves", "FY2021"],
  ["p7t3-5i9s", "FY2020"],
  ["faiq-9dfq", "FY2019"],
  ["a5td-mswe", "FY2018"],
  ["2bnn-yakx", "FY2017"],
  ["kiv2-tbus", "FY2016"],
  ["c284-tqph", "FY2015"],
  ["jt7v-77mi", "FY2014"],
];
const boroughs: Record<string, string> = {
  NY: "Manhattan",
  MN: "Manhattan",
  NEWY: "Manhattan",
  K: "Brooklyn",
  BK: "Brooklyn",
  KINGS: "Brooklyn",
  Q: "Queens",
  QN: "Queens",
  QU: "Queens",
  QUEEN: "Queens",
  BX: "Bronx",
  BRONX: "Bronx",
  R: "Staten Island",
  RICH: "Staten Island",
  ST: "Staten Island",
};
const descriptions: Record<string, string> = {
  "14": "No standing",
  "21": "No parking — street cleaning",
  "20": "No parking",
  "38": "Expired meter",
  "40": "Fire hydrant",
  "46": "Double parking",
  "37": "Expired registration",
  "36": "School zone speed camera",
  "7": "Red light camera",
  "5": "Bus lane camera",
  "71": "Inspection sticker violation",
};
const safeImage = (v: any) => {
  const url = typeof v === "string" ? v : v?.url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      (u.hostname.endsWith(".nyc.gov") || u.hostname === "nyc.gov")
      ? u.href
      : null;
  } catch {
    return null;
  }
};
export function normalizeRow(
  r: any,
  source: string,
  checkedAt: string,
): Violation {
  const live = source === "nc67-uf89";
  const code = r.violation_code || null;
  const borough =
    boroughs[String(r.violation_county || r.county || "").toUpperCase()] ||
    null;
  const street = String(r.street_name || "").trim();
  const house = String(r.house_number || "").trim();
  const cross = String(r.intersecting_street || "").trim();
  const reported = reportedLocation(
    house,
    street,
    cross,
    borough,
    [5, 7, 36].includes(Number(code)),
  );
  const description =
    r.violation ||
    r.violation_description ||
    descriptions[String(Number(code))] ||
    (code ? "Violation " + code : "Violation details unavailable");
  const t: Violation = {
    id: String(r.summons_number),
    plate: r.plate || r.plate_id || "",
    state: r.state || r.registration_state || "",
    plateType: r.license_type || r.plate_type || "",
    description,
    code,
    issued: dateOnly(r.issue_date),
    time: r.violation_time || null,
    noticeDate: null,
    agency: r.issuing_agency || null,
    location: {
      ...reported,
    },
    fine: amount(r.fine_amount),
    penalty: amount(r.penalty_amount),
    interest: amount(r.interest_amount),
    reduction: amount(r.reduction_amount),
    payments: amount(r.payment_amount),
    due: amount(r.amount_due),
    status: live
      ? r.violation_status ||
        (amount(r.amount_due) === 0
          ? "No balance reported"
          : "Status not provided")
      : "Unknown",
    image: safeImage(r.summons_image),
    vehicle: Object.fromEntries(
      Object.entries({
        make: r.vehicle_make,
        year: r.vehicle_year,
        color: r.vehicle_color,
        body: r.vehicle_body_type,
      }).filter(([, v]) => v && v !== "0"),
    ),
    sources: [source],
    provenance: {},
    checkedAt,
    actionDate: null,
    deadlineBasis: null,
  };
  for (const [k, v] of Object.entries(t))
    if (v != null && v !== "") t.provenance[k] = source;
  return applyDeadline(t);
}
const memCache = new BoundedCache<unknown>(128, 16 * 1024 * 1024);

async function cached(key: string) {
  return memCache.get(key);
}
async function put(key: string, payload: unknown, ttl: number) {
  memCache.set(
    key,
    payload,
    ttl,
    new TextEncoder().encode(JSON.stringify(payload)).byteLength,
  );
}
async function fetchDataset(id: string, name: string, p: Plate, force = false) {
  const key = "source:" + id + ":" + plateKey(p);
  if (!force) {
    const c = await cached(key);
    if (c) return c;
  }
  const live = id === "nc67-uf89";
  const checkedAt = new Date().toISOString();
  const clauses = [
    (live ? "plate" : "plate_id") + "='" + p.plate + "'",
    (live ? "state" : "registration_state") + "='" + p.state + "'",
  ];
  if (p.plateType)
    clauses.push(
      (live ? "license_type" : "plate_type") + "='" + p.plateType + "'",
    );
  const url = new URL("https://data.cityofnewyork.us/resource/" + id + ".json");
  url.searchParams.set("$where", clauses.join(" AND "));
  url.searchParams.set("$limit", "1000");
  url.searchParams.set("$order", "summons_number");
  const headers: Record<string, string> = {};
  if (config().SOCRATA_APP_TOKEN)
    headers["X-App-Token"] = config().SOCRATA_APP_TOKEN!;
  try {
    const pageResult = await fetchCityPages(url, headers);
    const rows = pageResult.rows;
    let meta = (await cached("meta:" + id)) as {
      updatedAt: string | null;
    } | null;
    if (!meta) {
      try {
        const m = await fetch(
          "https://data.cityofnewyork.us/api/views/" + id + ".json",
          { signal: AbortSignal.timeout(5000) },
        );
        if (m.ok) {
          const j: any = await m.json();
          meta = {
            updatedAt: j.rowsUpdatedAt
              ? new Date(j.rowsUpdatedAt * 1000).toISOString()
              : null,
          };
          await put("meta:" + id, meta, 6 * 3600_000);
        }
      } catch {}
    }
    const result = {
      tickets: rows
        .filter((r: any) => r.summons_number)
        .map((r: any) => normalizeRow(r, id, checkedAt)),
      source: {
        id,
        name,
        ok: pageResult.ok,
        checkedAt,
        updatedAt: meta?.updatedAt ?? null,
        count: rows.length,
        truncated: pageResult.truncated,
        ...(!pageResult.ok ? { error: "Source temporarily unavailable" } : {}),
      } satisfies SourceStatus,
    };
    await put(
      key,
      result,
      !pageResult.ok || pageResult.truncated
        ? 120000
        : live
          ? 6 * 3600_000
          : id === "pvqr-7yc4"
            ? 24 * 3600_000
            : 7 * 86400_000,
    );
    return result;
  } catch {
    return {
      tickets: [],
      source: {
        id,
        name,
        ok: false,
        checkedAt,
        updatedAt: null,
        count: 0,
        truncated: false,
        error: "Source temporarily unavailable",
      } satisfies SourceStatus,
    };
  }
}
export async function searchNYC(
  p: Plate,
  deep = false,
  forceLive = false,
): Promise<SearchResult> {
  const definitions = [
    ["nc67-uf89", "Open parking & camera violations"],
    ...historical.slice(0, deep ? historical.length : 3),
  ];
  const results: any[] = [];
  for (let i = 0; i < definitions.length; i += 4) {
    results.push(
      ...(await Promise.all(
        definitions
          .slice(i, i + 4)
          .map(([id, name]) =>
            fetchDataset(id, name, p, id === "nc67-uf89" && forceLive),
          ),
      )),
    );
  }
  const sources: SourceStatus[] = results.map((r) => r.source);
  const tickets = mergeTickets(results.flatMap((r) => r.tickets));
  return {
    query: p,
    tickets,
    sources,
    checkedAt: new Date().toISOString(),
    complete: sources.every((s) => s.ok && !s.truncated),
    unavailable: sources.every((s) => !s.ok),
  };
}
export async function geocode(t: Violation) {
  if (!t.location.label) return t;
  const key = "geo:" + t.location.label;
  let geo = await cached(key);
  if (
    !geo &&
    !config().NYC_GEOCLIENT_KEY &&
    t.location.precision === "address"
  ) {
    try {
      const url = new URL("https://geosearch.planninglabs.nyc/v2/search");
      url.searchParams.set("text", cleanLocationLabel(t.location.label));
      url.searchParams.set("size", "1");
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const j: any = await r.json();
        const f = j.features?.[0];
        const match = geoSearchLocation(t.location, f);
        if (match) {
          geo = match;
          await put(key, geo, 90 * 86400_000);
        }
      }
    } catch {}
  }
  if (!geo && config().NYC_GEOCLIENT_KEY) {
    try {
      const url = new URL("https://api.nyc.gov/geo/geoclient/v2/search.json");
      url.searchParams.set("input", t.location.label);
      const r = await fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": config().NYC_GEOCLIENT_KEY! },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const j: any = await r.json();
        const match = j.results?.[0];
        const p = match?.response;
        if (
          j.results?.length === 1 &&
          p &&
          Number(p.latitude) &&
          Number(p.longitude)
        ) {
          geo = { lat: Number(p.latitude), lng: Number(p.longitude) };
          await put(key, geo, 90 * 86400_000);
        }
      }
    } catch {}
  }
  return geo ? { ...t, location: { ...t.location, ...geo } } : t;
}
