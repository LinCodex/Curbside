import type { Violation } from "./domain";

export function plateTotals(records: Violation[]) {
  const tickets = [...new Map(records.map((t) => [t.id, t])).values()];
  const sum = (values: (number | null)[]) => ({
    amount: values.some((v) => v !== null)
      ? values.reduce<number>((s, v) => s + Math.round((v ?? 0) * 100), 0) / 100
      : null,
    known: values.filter((v) => v !== null).length,
    total: values.length,
  });
  return {
    owed: sum(tickets.map((t) => t.due)),
    paid: sum(tickets.map((t) => t.payments)),
    assessed: sum(
      tickets.map((t) =>
        [t.fine, t.penalty, t.interest, t.reduction].every(
          (v) => v !== null && Number.isFinite(v),
        )
          ? Math.round(
              (t.fine! + t.penalty! + t.interest! - t.reduction!) * 100,
            ) / 100
          : null,
      ),
    ),
  };
}
