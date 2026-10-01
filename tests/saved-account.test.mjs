import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({ entryPoints: ["lib/saved-account.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { savedAccountRequest } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const owner = "193a2604-3ba1-4b61-9e9a-5276512dc001";
const other = "193a2604-3ba1-4b61-9e9a-5276512dc002";
const mine = "193a2604-3ba1-4b61-9e9a-5276512dd001";
const theirs = "193a2604-3ba1-4b61-9e9a-5276512dd002";
const identity = { id: owner, clerkId: "user_one", email: "one@example.com", legalAcceptedAt: Date.parse("2026-09-30T12:00:00Z") };
function fixture() {
  const tables = { curbside_vehicles: [{ id: mine, user_id: owner, plate: "FIRST1", state: "NY", plate_type: "", nickname: "Mine" },
    { id: theirs, user_id: other, plate: "SECOND2", state: "NY", plate_type: "", nickname: "Theirs" }],
    curbside_vehicle_snapshots: [{ key: "NY:FIRST1:*", payload: { tickets: [] } }, { key: "NY:SECOND2:*", payload: { tickets: [{ id: "other-ticket" }] } }],
    curbside_terms_acceptances: [], curbside_preferences: [] };
  const requests = [];
  const client = { from(table) {
    const filters = []; let action = "read", input;
    const query = {
      select() { return query; }, order() { return query; },
      eq(column, value) { filters.push(row => row[column] === value); requests.push([table, column, value]); return query; },
      in(column, values) { filters.push(row => values.includes(row[column])); requests.push([table, column, values]); return query; },
      upsert(value) { action = "upsert"; input = value; return query; },
      update(value) { action = "update"; input = value; return query; },
      delete() { action = "delete"; return query; },
      maybeSingle() { return execute(true); }, single() { return execute(true); },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    async function execute(single = false) {
      let rows = tables[table].filter(row => filters.every(filter => filter(row)));
      if (action === "upsert") { tables[table].push(input); rows = [input]; }
      if (action === "update") rows.forEach(row => Object.assign(row, input));
      if (action === "delete") tables[table] = tables[table].filter(row => !rows.includes(row));
      return { data: single ? rows[0] || null : rows, error: null };
    }
    return query;
  } };
  return { client, tables, requests };
}
test("garage queries preserve legacy ownership and only request that owner's history keys", async () => {
  const f = fixture(); const result = await savedAccountRequest(f.client, identity, "me");
  assert.equal(result.user.id, "user_one"); assert.deepEqual(result.vehicles.map(car => car.id), [mine]);
  assert.deepEqual(f.requests.find(request => request[0] === "curbside_vehicle_snapshots"), ["curbside_vehicle_snapshots", "key", ["NY:FIRST1:*"]]);
  assert.equal(f.tables.curbside_terms_acceptances[0].accepted_at, "2026-09-30T12:00:00.000Z");
});
test("a forged ownership field cannot transfer a car, and another owner's car cannot be edited or deleted", async () => {
  const f = fixture();
  await savedAccountRequest(f.client, identity, "vehicles/" + mine, "PATCH", { nickname: "Renamed", user_id: other, clerkId: "user_other" });
  assert.equal(f.tables.curbside_vehicles[0].user_id, owner);
  assert.equal(f.tables.curbside_vehicles[0].nickname, "Renamed");
  for (const method of ["PATCH", "DELETE"])
    await assert.rejects(savedAccountRequest(f.client, identity, "vehicles/" + theirs, method, { nickname: "Forged" }), error => error.status === 404);
  assert.equal(f.tables.curbside_vehicles[1].nickname, "Theirs");
  await savedAccountRequest(f.client, identity, "garage", "DELETE");
  assert.deepEqual(f.tables.curbside_vehicles.map(car => car.id), [theirs]);
});
test("unsupported paid routes and malformed preferences cannot perform writes", async () => {
  const f = fixture();
  for (const path of ["checkout", "billing", "legal", "phone/send", "cases"])
    await assert.rejects(savedAccountRequest(f.client, identity, path, "POST", {}), error => error.status === 404);
  await assert.rejects(savedAccountRequest(f.client, identity, "preferences", "PATCH", { theme: "neon" }), error => error.status === 400);
  assert.equal(f.tables.curbside_preferences.length, 0);
});
