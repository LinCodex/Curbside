"use client";
import { usePreferences } from "./preferences";
import type { Violation } from "@/lib/domain";

export default function VehicleData({ tickets }: { tickets: Violation[] }) {
  const { tr, locale } = usePreferences();
  const groups = new Map<
    string,
    {
      values: Violation["vehicle"];
      count: number;
    }
  >();
  for (const ticket of tickets) {
    const values = ticket.vehicle || {};
    if (!Object.values(values).some(Boolean)) continue;
    const key = JSON.stringify([
      values.make,
      values.year,
      values.color,
      values.body,
    ]);
    const previous = groups.get(key);
    groups.set(key, { values, count: (previous?.count || 0) + 1 });
  }
  return (
    <section
      className="vehicle-data"
      aria-label={tr("City-reported vehicle history")}
    >
      <h3>{tr("City-reported vehicle history")}</h3>
      <p className="small muted">
        {tr(
          "Attributes reported on tickets may describe previous vehicles using this plate.",
        )}
      </p>
      {groups.size ? (
        <div className="vehicle-history-list">
          {Array.from(groups.entries()).map(([key, { values, count }]) => (
            <div className="vehicle-history-row" key={key}>
              <div>
                {(["make", "year", "color", "body"] as const).map((field) => (
                  <span key={field}>
                    <small>{tr(field)}</small>
                    <strong>
                      {values[field]
                        ? tr(String(values[field]))
                        : tr("Not provided")}
                    </strong>
                  </span>
                ))}
              </div>
              <small>
                {count.toLocaleString(locale)} {tr("tickets")}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">
          {tr("No vehicle attributes were reported.")}
        </p>
      )}
    </section>
  );
}
