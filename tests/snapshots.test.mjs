import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { hasOnboarded, onboardingCookie } from "../lib/onboarding.ts";
const compiled = await build({
  entryPoints: ["lib/vehicle-snapshots.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { mergeSnapshot } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
// Isolated unit fixtures are never shown in the app or persisted to city snapshots.
const query = { plate: "UNIT1", state: "NY", plateType: "" };
const ticket = (id, due = 10) => ({
  id,
  ...query,
  sources: ["nc67-uf89"],
  provenance: {},
  location: { label: "", precision: "unknown" },
  vehicle: {},
  due,
  checkedAt: "2026-10-01",
});
const result = (tickets, extra = {}) => ({
  query,
  tickets,
  sources: [],
  checkedAt: "2026-10-01",
  complete: true,
  unavailable: false,
  ...extra,
});
test("switching identities never mixes histories across plate, state or type", () => {
  const old = result([ticket("older")]);
  for (const alternate of [
    { ...query, plate: "UNIT2" },
    { ...query, state: "NJ" },
    { ...query, plateType: "PAS" },
  ]) {
    const fresh = result([ticket("current")], { query: alternate });
    assert.equal(mergeSnapshot(old, fresh), fresh);
  }
});
test("disappearing records remain available and do not establish payment", () => {
  const merged = mergeSnapshot(
    result([ticket("older", 40)]),
    result([ticket("current", 20)]),
  );
  assert.equal(merged.tickets.length, 2);
  assert.equal(merged.tickets.find((t) => t.id === "older").due, 40);
  assert.equal(merged.complete, false);
  assert.equal(merged.snapshot.retainedRecords, 1);
});
test("successful financial updates replace old amounts without duplicate summons", () => {
  const merged = mergeSnapshot(
    result([ticket("same", 40)]),
    result([ticket("same", 0)]),
  );
  assert.equal(merged.tickets.length, 1);
  assert.equal(merged.tickets[0].due, 0);
  assert.equal(merged.complete, true);
});
test("outages preserve last successful history and partial checks stay partial", () => {
  const previous = result([ticket("same")]);
  assert.equal(
    mergeSnapshot(previous, result([], { unavailable: true, complete: false })),
    previous,
  );
  assert.equal(
    mergeSnapshot(previous, result([ticket("same")], { complete: false }))
      .complete,
    false,
  );
});
test("welcome cookie is exact, persistent, secure on HTTPS and contains no account data", () => {
  assert.equal(hasOnboarded("other=1; curbside_onboarding=1"), true);
  assert.equal(
    hasOnboarded("not_curbside_onboarding=1; curbside_onboarding=10"),
    false,
  );
  assert.equal(hasOnboarded(""), false);
  assert.match(
    onboardingCookie(true),
    /Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/,
  );
  assert.doesNotMatch(onboardingCookie(false), /Secure/);
});
