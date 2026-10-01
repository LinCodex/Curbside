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
import { requestEmailChange } from "../lib/account-details.ts";

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
test("email editing rejects removal, invalid addresses, unconfirmed users and profile switches before mutation", async () => {
  let updates = 0;
  let user = {
    id: "owner",
    email: "old@example.com",
    email_confirmed_at: "2026-01-01",
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      updateUser: async () => {
        updates++;
        return { data: { user }, error: null };
      },
    },
  };
  for (const email of ["", "invalid", "old@example.com"])
    await assert.rejects(
      requestEmailChange(client, "owner", email, "https://example.com"),
    );
  user = { ...user, email_confirmed_at: null };
  await assert.rejects(
    requestEmailChange(
      client,
      "owner",
      "new@example.com",
      "https://example.com",
    ),
  );
  user = { ...user, email_confirmed_at: "2026-01-01", id: "other" };
  await assert.rejects(
    requestEmailChange(
      client,
      "owner",
      "new@example.com",
      "https://example.com",
    ),
  );
  assert.equal(updates, 0);
});
test("email editing uses the authenticated SDK and exact account redirect, preserving the confirmed identity until confirmation", async () => {
  const user = {
    id: "owner",
    email: "old@example.com",
    new_email: "new@example.com",
    email_confirmed_at: "2026-01-01",
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      updateUser: async (attributes, options) => {
        assert.deepEqual(attributes, { email: "new@example.com" });
        assert.equal(
          options.emailRedirectTo,
          "https://curbside-eta.vercel.app/?view=account",
        );
        return { data: { user }, error: null };
      },
    },
  };
  const updated = await requestEmailChange(
    client,
    "owner",
    " New@Example.com ",
    "https://curbside-eta.vercel.app",
  );
  assert.equal(updated.email, "old@example.com");
  assert.equal(updated.new_email, "new@example.com");
});
