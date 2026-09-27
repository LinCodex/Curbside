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
  const { tr } = usePreferences();

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
              <strong>{money(total.amount)}</strong>
              <small>
                {total.known}/{total.total} {tr("records with amounts")}
                {!complete || total.known < total.total ? tr(" · Partial") : ""}
              </small>
            </div>
          );
        })}
      </div>
      <p>
        {tr(
          "Returned records only. History = fines + penalties + interest − reductions, before payments. Missing amounts are excluded; this is not a lifetime total or proof of current ownership.",
        )}
      </p>
    </section>
  );
}
