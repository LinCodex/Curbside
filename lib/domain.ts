export type Plate = { plate: string; state: string; plateType: string };
export type Location = {
  label: string;
  precision: "address" | "intersection" | "approximate" | "unknown";
  lat?: number;
  lng?: number;
  matchedAddress?: string;
  resolvedBy?: string;
};
export type Violation = {
  id: string;
  plate: string;
  state: string;
  plateType: string;
  description: string;
  code: string | null;
  issued: string | null;
  time: string | null;
  noticeDate: string | null;
  agency: string | null;
  location: Location;
  fine: number | null;
  penalty: number | null;
  interest: number | null;
  reduction: number | null;
  payments: number | null;
  due: number | null;
  status: string;
  image: string | null;
  vehicle: { make?: string; year?: string; color?: string; body?: string };
  sources: string[];
  provenance: Record<string, string>;
  checkedAt: string;
  actionDate: string | null;
  deadlineBasis: string | null;
  localStatus?: string;
};
export type SourceStatus = {
  id: string;
  name: string;
  ok: boolean;
  checkedAt: string;
  updatedAt: string | null;
  count: number;
  truncated: boolean;
  error?: string;
};
export type SearchResult = {
  query: Plate;
  tickets: Violation[];
  sources: SourceStatus[];
  checkedAt: string;
  complete: boolean;
  unavailable: boolean;
};
export const STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP AB BC MB NB NL NS NT NU ON PE QC SK YT".split(
    " ",
  );
export function normalizePlate(v: any): Plate {
  const plate = String(v.plate ?? "")
    .trim()
    .toUpperCase()
    .replace(/[ -]/g, "");
  const state = String(v.state ?? "").toUpperCase();
  const plateType = String(v.plateType ?? "")
    .trim()
    .toUpperCase();
  if (
    !/^[A-Z0-9]{1,10}$/.test(plate) ||
    !STATES.includes(state) ||
    !/^([A-Z0-9]{1,5})?$/.test(plateType)
  )
    throw new Error(
      "Enter a valid plate, registration state, and optional plate type.",
    );
  return { plate, state, plateType };
}
export const plateKey = (p: Plate) =>
  [p.state, p.plate, p.plateType || "*"].join(":");
export const money = (v: number | null | undefined) =>
  v == null
    ? "Not provided"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(v);
export function amount(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
export function dateOnly(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    [y, m, d] = s.slice(0, 10).split("-").map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    [m, d, y] = s.split("/").map(Number);
  } else return null;
  const x = new Date(Date.UTC(y, m - 1, d));
  return x.getUTCFullYear() === y &&
    x.getUTCMonth() === m - 1 &&
    x.getUTCDate() === d
    ? x.toISOString().slice(0, 10)
    : null;
}
export function plusDays(s: string, n: number) {
  const x = new Date(s + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function isCamera(t: Pick<Violation, "description" | "code">) {
  return (
    /camera|bus lane|bus stop|speed|red light|weigh.in.motion/i.test(
      t.description,
    ) || ["5", "7", "12", "36"].includes(String(Number(t.code)))
  );
}
export function applyDeadline(t: Violation) {
  const basis = isCamera(t) ? t.noticeDate : t.issued;
  t.actionDate = basis ? plusDays(basis, 30) : null;
  t.deadlineBasis = basis
    ? isCamera(t)
      ? "Notice of Liability date"
      : "Issue date"
    : null;
  return t;
}
export function mergeTickets(records: Violation[]) {
  const map = new Map<string, Violation>();
  for (const t of records) {
    const old = map.get(t.id);
    if (!old) {
      map.set(t.id, {
        ...t,
        provenance: { ...t.provenance },
        sources: [...t.sources],
      });
      continue;
    }
    const live = t.sources.includes("nc67-uf89");
    const merged = {
      ...old,
      sources: [...new Set([...old.sources, ...t.sources])],
    };
    for (const [k, v] of Object.entries(t)) {
      if (k === "sources" || k === "provenance") continue;
      if (k === "location") {
        if (t.location.label && t.location.precision !== "unknown") {
          merged.location = t.location;
          merged.provenance.location = t.sources[0];
        }
        continue;
      }
      if (k === "vehicle") {
        merged.vehicle = { ...old.vehicle, ...t.vehicle };
        continue;
      }
      if (
        v !== null &&
        v !== "" &&
        (live ||
          old[k as keyof Violation] == null ||
          old[k as keyof Violation] === "" ||
          old[k as keyof Violation] === "Unknown")
      ) {
        (merged as any)[k] = v;
        if (t.provenance[k]) merged.provenance[k] = t.provenance[k];
      }
    }
    map.set(t.id, applyDeadline(merged));
  }
  return [...map.values()].sort((a, b) =>
    (b.issued ?? "").localeCompare(a.issued ?? ""),
  );
}
export function discoveryKind(t: Violation, start: string) {
  return t.issued && t.issued < start.slice(0, 10) ? "history" : "new";
}
export function localDate(now: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function quietUntil(now: Date, tz = "America/New_York") {
  let x = new Date(now);
  for (let i = 0; i < 26 * 12; i++) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(x),
    );
    if (hour >= 8 && hour < 21) return x.toISOString();
    x = new Date(x.getTime() + 5 * 60_000);
  }
  throw new Error("Invalid quiet hours");
}
export function reminder(
  t: Violation,
  now: Date,
  tz: string,
  discovered: string,
) {
  if (t.localStatus || t.due === 0 || !t.actionDate) return null;
  const today = localDate(now, tz);
  const days = Math.round(
    (new Date(t.actionDate + "T12:00:00Z").getTime() -
      new Date(today + "T12:00:00Z").getTime()) /
      86400000,
  );
  if (days === 7 || days === 2) return "reminder-" + days;
  if (days < 2 && discovered.slice(0, 10) === today) return "late";
  return null;
}
export function smsSegments(body: string) {
  return /^[\x20-\x7e\r\n]*$/.test(body)
    ? Math.ceil(body.length / (body.length <= 160 ? 160 : 153))
    : Math.ceil(body.length / (body.length <= 70 ? 70 : 67));
}
export function activePlan(user: any, sponsor: any, now = Date.now()) {
  if (sponsor && sponsor.expires_at > now) return "sponsored";
  return user.plan === "plus" && user.plan_until > now ? "plus" : "free";
}
export function canReadCase(
  actor: { id: string; role: string },
  c: { owner_id: string; partner_id: string | null },
) {
  return (
    actor.id === c.owner_id ||
    (actor.role === "partner" && actor.id === c.partner_id)
  );
}
export function readyToFile(c: any) {
  return (
    !!c.partner_id &&
    c.status === "approved" &&
    c.approved_version === c.version
  );
}
