import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({ entryPoints: ["lib/search-session.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { SEARCH_RESULT_KEY, SEARCH_NAVIGATION_KEY, readSearchResult, readSearchNavigation, writeSearchResult, writeSearchNavigation } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"),
);
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
// Unit-only fixtures never enter the app, account data or public city snapshots.
const result = {
  query: { plate: "UNIT1", state: "NY", plateType: "" },
  tickets: [], sources: [], checkedAt: "2026-10-03T12:00:00Z", complete: false, unavailable: false,
};
const navigation = {
  view: "map", plate: "UNIT1", state: "NY", plateType: "", history: true,
  filter: "open", vehicleId: "", mapVehicleId: "search", mapFilter: "address", mapSelection: "summons", mapBoxMinimized: true,
};
test("refresh retains the view, filters, ticket selection and original source freshness", () => {
  const tab = storage();
  assert.ok(writeSearchResult(tab, "guest", result));
  assert.ok(writeSearchNavigation(tab, "guest", navigation));
  assert.deepEqual(readSearchResult(tab, "guest"), result);
  assert.deepEqual(readSearchNavigation(tab, "guest"), navigation);
  assert.equal(readSearchResult(tab, "guest").complete, false);
});
test("profile changes cannot restore another user's search and clearing results removes it", () => {
  const tab = storage();
  writeSearchResult(tab, "first-profile", result);
  writeSearchNavigation(tab, "first-profile", navigation);
  assert.equal(readSearchResult(tab, "second-profile"), null);
  assert.equal(readSearchNavigation(tab, "guest"), null);
  writeSearchResult(tab, "first-profile", null);
  assert.equal(tab.getItem(SEARCH_RESULT_KEY), null);
});
test("malformed saved data and blocked storage cannot crash refresh", () => {
  const tab = storage();
  tab.setItem(SEARCH_RESULT_KEY, "not json");
  assert.equal(readSearchResult(tab, "guest"), null);
  tab.setItem(SEARCH_RESULT_KEY, JSON.stringify({ owner: "guest", value: { ...result, tickets: [{}] } }));
  assert.equal(readSearchResult(tab, "guest"), null);
  tab.setItem(SEARCH_NAVIGATION_KEY, JSON.stringify({ owner: "guest", value: { ...navigation, view: "unknown" } }));
  assert.equal(readSearchNavigation(tab, "guest"), null);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readSearchResult(blocked, "guest"), null);
  assert.equal(writeSearchResult(blocked, "guest", result), false);
  writeSearchResult(tab, "guest", result);
  assert.equal(writeSearchResult({ ...tab, setItem() { throw new Error("quota"); } }, "guest", { ...result, query: { ...result.query, plate: "UNIT2" } }), false);
  assert.equal(tab.getItem(SEARCH_RESULT_KEY), null);
});
test("restoration excludes temporary Mapbox matches and private annotations", () => {
  const tab = storage();
  const ticket = {
    id: "unit-summons", plate: "UNIT1", state: "NY", description: "Unit fixture",
    location: { label: "Unit fixture", precision: "address", lat: 40.7, lng: -73.9, resolvedBy: "Mapbox" },
    vehicle: {}, provenance: {}, sources: [], fine: null, penalty: null, interest: null, reduction: null, payments: null, due: null,
    localStatus: "paid",
  };
  writeSearchResult(tab, "guest", { ...result, tickets: [ticket] });
  const restored = readSearchResult(tab, "guest").tickets[0];
  assert.equal(restored.localStatus, undefined);
  assert.deepEqual(restored.location, { label: "Unit fixture", precision: "address" });
});
