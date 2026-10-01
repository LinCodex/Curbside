import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: ["lib/garage-history.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { combinedGarageHistory } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
import { plateTotals } from "../lib/plate-totals.ts";

const ticket = (id, plate, due, checkedAt) => ({
  id,
  plate,
  state: "NY",
  plateType: "PAS",
  description: "Violation",
  issued: "2026-01-01",
  due,
  fine: due,
  penalty: 0,
  interest: 0,
  reduction: 0,
  payments: 0,
  checkedAt,
  location: { label: "", precision: "unknown" },
  sources: ["nc67-uf89"],
  provenance: {},
  vehicle: {},
});
test("combined garage totals deduplicate summons and prefer the latest city observation", () => {
  const old = ticket("100", "A", 50, "2026-01-01T00:00:00Z");
  const fresh = ticket("100", "A", 0, "2026-01-02T00:00:00Z");
  const other = ticket("200", "B", 65, "2026-01-02T00:00:00Z");
  const result = combinedGarageHistory([
    { id: "types", snapshot: { tickets: [fresh], complete: true } },
    { id: "all", snapshot: { tickets: [old], complete: true } },
    { id: "other", snapshot: { tickets: [other], complete: true } },
  ]);
  assert.equal(result.tickets.length, 2);
  assert.equal(plateTotals(result.tickets).owed.amount, 65);
  assert.equal(result.ready, 3);
  assert.equal(result.complete, true);
  assert.equal(old.due, 50);
});
test("combined garage excludes removed vehicles and labels missing or partial snapshots incomplete", () => {
  const result = combinedGarageHistory(
    [
      { id: "ready", snapshot: { tickets: [], complete: false } },
      { id: "pending" },
    ],
    [{ ...ticket("100", "A", 50, ""), vehicleId: "removed" }],
  );
  assert.deepEqual(result.tickets, []);
  assert.equal(result.ready, 1);
  assert.equal(result.complete, false);
});
