"use client";
import { usePreferences } from "./preferences";
import type { Violation } from "@/lib/domain";
import { money } from "@/lib/domain";
import { plateTotals } from "@/lib/plate-totals";

export function PlateBalance({
  tickets,
  complete = false,
}: {
  tickets: Violation[];
  complete?: boolean;
}) {
  const { tr, detailMode } = usePreferences();

  const totals = plateTotals(tickets);
  return (
    <section
      className="plate-balance"
      aria-label={tr("Plate financial totals")}
    >
      <div className="plate-balance-grid">
        {[
          [tr("Balance owed"), totals.owed],
          [tr("Payments reported"), totals.paid],
          [tr("Assessed history"), totals.assessed],
        ].map(([label, raw]) => {
          const total = raw as typeof totals.owed;
          return (
            <div key={tr(label as string)}>
              <span>{label as string}</span>
              <strong>{tr(money(total.amount))}</strong>
              {detailMode === "geek" ? (
                <small>
                  {total.known}/{total.total} {tr("records with amounts")}
                  {!complete || total.known < total.total
                    ? tr(" · Partial")
                    : ""}
                </small>
              ) : (
                (!complete || total.known < total.total) && (
                  <small>{tr("Partial total")}</small>
                )
              )}
            </div>
          );
        })}
      </div>
      <p>
        {tr("Totals cover the records found. Missing amounts are excluded.")}
      </p>
      <details className="balance-method">
        <summary>{tr("About these totals")}</summary>
        <p>
          {tr(
            "History includes fines, penalties, and interest, less reductions, before payments. Plate history may include previous owners; it is not a lifetime total.",
          )}
        </p>
      </details>
    </section>
  );
}
