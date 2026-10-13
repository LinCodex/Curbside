"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  crmClientRequest,
  type CrmPage,
  type CrmTraffic,
  type CrmTrafficRange,
} from "@/lib/crm-client";

type Translate = (text: string) => string;
const RANGES: { id: CrmTrafficRange; label: string; previous: string }[] = [
  { id: "day", label: "Day", previous: "vs previous 24 hours" },
  { id: "week", label: "Week", previous: "vs previous 7 days" },
  { id: "month", label: "Month", previous: "vs previous 30 days" },
  { id: "year", label: "Year", previous: "vs previous 12 months" },
];
export const PAGE_LABELS: Record<CrmPage, string> = {
  garage: "Garage",
  search: "Search",
  map: "Map",
  timeline: "Timeline",
  account: "Account",
  legal: "Legal pages",
};
const W = 720;
const H = 220;

const intlLocale = (locale: string) => (locale === "zh" ? "zh-CN" : "en-US");
const count = (value: number, locale: string) =>
  new Intl.NumberFormat(intlLocale(locale)).format(value);

// Buckets are New York wall-clock times without an offset; format them as UTC
// so the viewer's own time zone never shifts the label.
function bucketLabel(
  start: string,
  unit: CrmTraffic["unit"],
  locale: string,
  long = false,
) {
  const date = new Date(start + "Z");
  const options: Intl.DateTimeFormatOptions =
    unit === "hour"
      ? long
        ? { weekday: "short", hour: "numeric" }
        : { hour: "numeric" }
      : unit === "day"
        ? long
          ? { weekday: "short", month: "short", day: "numeric" }
          : { month: "short", day: "numeric" }
        : long
          ? { month: "long", year: "numeric" }
          : { month: "short" };
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function niceCeiling(max: number) {
  if (max <= 4) return 4;
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw)! * power;
  return Math.ceil(max / step) * step;
}

export function relativeTime(
  value: string | null | undefined,
  locale: string,
  tr: Translate,
) {
  if (!value || !Number.isFinite(Date.parse(value))) return tr("Never");
  const seconds = (Date.parse(value) - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
    ["year", Infinity],
  ];
  let amount = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size)
      return unit === "second"
        ? tr("Just now")
        : format.format(Math.round(amount), unit);
    amount /= size;
  }
  return tr("Never");
}

export function CrmTrafficPanel({
  client,
  tr,
  locale,
}: {
  client: SupabaseClient;
  tr: Translate;
  locale: string;
}) {
  const [range, setRange] = useState<CrmTrafficRange>("week");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: CrmTraffic;
    error?: string;
  } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const key = `${range}:${revision}`;
  useEffect(() => {
    let alive = true;
    void crmClientRequest<CrmTraffic>(client, "traffic", { range }).then(
      (data) => {
        if (alive) setState({ key, data });
      },
      (error) => {
        if (alive)
          setState((current) => ({
            key,
            data: current?.data,
            error:
              error instanceof Error ? error.message : "CRM unavailable.",
          }));
      },
    );
    return () => {
      alive = false;
    };
  }, [client, range, key]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible")
        setRevision((value) => value + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const loading = state?.key !== key;
  const data = state?.data?.range === range ? state.data : undefined;
  const buckets = data?.buckets || [];
  const ceiling = niceCeiling(Math.max(0, ...buckets.map((b) => b.views)));
  const x = (i: number) =>
    buckets.length < 2 ? W / 2 : (i / (buckets.length - 1)) * W;
  const y = (value: number) => H - (value / ceiling) * H;
  const line = buckets
    .map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.views).toFixed(1)}`)
    .join("");
  const area = buckets.length
    ? `${line}L${x(buckets.length - 1).toFixed(1)},${H}L${x(0).toFixed(1)},${H}Z`
    : "";
  const signedLine = buckets
    .map(
      (b, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.signedIn).toFixed(1)}`,
    )
    .join("");
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const change =
    data && data.previous > 0
      ? (data.total - data.previous) / data.previous
      : null;
  const point = hover !== null ? buckets[hover] : undefined;
  const pick = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !buckets.length) return;
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    setHover(Math.round(ratio * (buckets.length - 1)));
  };
  const rangeInfo = RANGES.find((item) => item.id === range)!;
  const topPage = Math.max(1, ...(data?.pages || []).map((p) => p.views));
  return (
    <section className="crm-traffic" aria-labelledby="crm-traffic-title">
      <header className="crm-traffic-head">
        <div>
          <h2 id="crm-traffic-title">{tr("Page views")}</h2>
          <p>
            {tr(
              "Counted in the app without cookies. Visitors with Do Not Track or Global Privacy Control are not counted.",
            )}
          </p>
        </div>
        <div className="crm-traffic-controls">
          <div className="crm-range" role="tablist" aria-label={tr("Period")}>
            {RANGES.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={range === item.id}
                className={range === item.id ? "active" : ""}
                onClick={() => {
                  setHover(null);
                  setRange(item.id);
                }}
              >
                {tr(item.label)}
              </button>
            ))}
          </div>
          <button
            className="crm-mail-icon"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
            aria-label={tr("Refresh")}
            title={tr("Refresh")}
          >
            <RefreshCw size={16} className={loading ? "crm-spinner" : ""} />
          </button>
        </div>
      </header>
      {state?.error && !data && (
        <div className="crm-feedback crm-error">
          {state.error}
          <button
            className="crm-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            {tr("Try again")}
          </button>
        </div>
      )}
      <div className={"crm-traffic-summary" + (loading ? " loading" : "")}>
        <div>
          <span>
            <Eye size={15} />
            {tr("Total views")}
          </span>
          <strong>{data ? count(data.total, locale) : "—"}</strong>
          {data && (
            <small
              className={
                change === null ? "" : change >= 0 ? "up" : "down"
              }
            >
              {change === null ? (
                tr("No earlier data")
              ) : (
                <>
                  {change >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  {(change >= 0 ? "+" : "") + Math.round(change * 100) + "%"}{" "}
                  {tr(rangeInfo.previous)}
                </>
              )}
            </small>
          )}
        </div>
        <div>
          <span>
            <span className="crm-traffic-key signed" />
            {tr("Signed-in views")}
          </span>
          <strong>{data ? count(data.signedIn, locale) : "—"}</strong>
          {data && data.total > 0 && (
            <small>
              {Math.round((data.signedIn / data.total) * 100)}%{" "}
              {tr("of all views")}
            </small>
          )}
        </div>
        <div>
          <span>
            <Users size={15} />
            {tr("Active customers")}
          </span>
          <strong>{data ? count(data.activeCustomers, locale) : "—"}</strong>
          <small>{tr("Signed in and viewed a page")}</small>
        </div>
      </div>
      <div className="crm-traffic-chart">
        <div className="crm-traffic-axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((share) => (
            <span key={share}>{count(Math.round(ceiling * share), locale)}</span>
          ))}
        </div>
        <div
          className="crm-traffic-plot"
          ref={plot}
          onPointerMove={(event) => pick(event.clientX)}
          onPointerDown={(event) => pick(event.clientX)}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={
            data
              ? `${tr("Page views")}: ${count(data.total, locale)}`
              : tr("Page views")
          }
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="crm-traffic-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-fill)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent-fill)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((share) => (
              <line
                key={share}
                x1="0"
                x2={W}
                y1={H * share}
                y2={H * share}
                className="crm-traffic-grid"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {area && <path d={area} fill="url(#crm-traffic-fill)" />}
            {line && (
              <path
                d={line}
                className="crm-traffic-line"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {signedLine && (
              <path
                d={signedLine}
                className="crm-traffic-line signed"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1="0"
                y2={H}
                className="crm-traffic-cursor"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {point && data && hover !== null && (
            <>
              <span
                className="crm-traffic-dot"
                style={{
                  left: `${(x(hover) / W) * 100}%`,
                  top: `${(y(point.views) / H) * 100}%`,
                }}
              />
              <div
                className={
                  "crm-traffic-tooltip" +
                  (x(hover) > W * 0.7 ? " flip" : "")
                }
                style={{ left: `${(x(hover) / W) * 100}%` }}
              >
                <strong>{bucketLabel(point.start, data.unit, locale, true)}</strong>
                <span>
                  {count(point.views, locale)} {tr("views")}
                </span>
                <span className="signed">
                  {count(point.signedIn, locale)} {tr("signed in")}
                </span>
              </div>
            </>
          )}
          {data && !data.total && !loading && (
            <div className="crm-traffic-empty">
              {tr("No page views in this period yet.")}
            </div>
          )}
        </div>
        <div className="crm-traffic-labels" aria-hidden="true">
          {data &&
            buckets.map((bucket, i) =>
              i % labelEvery === 0 || i === buckets.length - 1 ? (
                <span
                  key={bucket.start}
                  style={{ left: `${(x(i) / W) * 100}%` }}
                  className={
                    i === buckets.length - 1
                      ? "last"
                      : i === 0
                        ? "first"
                        : ""
                  }
                >
                  {bucketLabel(bucket.start, data.unit, locale)}
                </span>
              ) : null,
            )}
        </div>
      </div>
      {data && data.pages.length > 0 && (
        <div className="crm-traffic-pages">
          <h3>{tr("Top pages")}</h3>
          <ul>
            {data.pages.map((item) => (
              <li key={item.page}>
                <span>{tr(PAGE_LABELS[item.page] || item.page)}</span>
                <span className="crm-traffic-bar">
                  <span style={{ width: `${(item.views / topPage) * 100}%` }} />
                </span>
                <strong>{count(item.views, locale)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function CrmActivityBars({
  daily,
  tr,
  locale,
}: {
  daily: { day: string; views: number }[];
  tr: Translate;
  locale: string;
}) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const label = (day: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(day + "T00:00:00Z"));
  return (
    <div className="crm-activity-bars" role="img" aria-label={tr("Page views, last 30 days")}>
      {daily.map((d) => (
        <span
          key={d.day}
          title={`${label(d.day)}: ${count(d.views, locale)} ${tr("views")}`}
          style={{ height: `${Math.max(d.views ? 8 : 2, (d.views / max) * 100)}%` }}
          className={d.views ? "" : "crm-activity-bar-empty"}
        />
      ))}
    </div>
  );
}
