import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: ["lib/supabase-account.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { savedAccountRequest } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
const owner = "193a2604-3ba1-4b61-9e9a-5276512dc001";
const other = "193a2604-3ba1-4b61-9e9a-5276512dc002";
const mine = "193a2604-3ba1-4b61-9e9a-5276512dd001";
const theirs = "193a2604-3ba1-4b61-9e9a-5276512dd002";
function fixture() {
  let user = {
    id: owner,
    email: "one@example.invalid",
    email_confirmed_at: "2026-09-30",
  };
  const tables = {
    curbside_vehicles: [
      {
        id: mine,
        user_id: owner,
        plate: "FIRST1",
        state: "NY",
        plate_type: "",
        nickname: "Mine",
      },
      {
        id: theirs,
        user_id: other,
        plate: "SECOND2",
        state: "NY",
        plate_type: "",
        nickname: "Theirs",
      },
    ],
    curbside_terms_acceptances: [],
    curbside_vehicle_snapshots: [],
  };
  const invoked = [];
  let signedOut = false;
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async () => {
        signedOut = true;
        return { error: null };
      },
    },
    functions: {
      invoke: async (name, input) => {
        invoked.push([name, input]);
        return { data: { ok: true }, error: null };
      },
    },
    from(table) {
      const filters = [];
      let action = "read",
        input;
      const query = {
        select() {
          return query;
        },
        order() {
          return query;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return query;
        },
        insert(value) {
          action = "insert";
          input = value;
          return query;
        },
        upsert(value) {
          action = "upsert";
          input = value;
          return query;
        },
        update(value) {
          action = "update";
          input = value;
          return query;
        },
        delete() {
          action = "delete";
          return query;
        },
        single() {
          return execute(true);
        },
        maybeSingle() {
          return execute(false, true);
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };
      async function execute(single = false, optional = false) {
        let rows = tables[table].filter((row) =>
          filters.every((filter) => filter(row)),
        );
        if (action === "insert" || action === "upsert") {
          rows = [
            table === "curbside_vehicles"
              ? { id: mine, ...input }
              : { ...input },
          ];
          tables[table].push(rows[0]);
        }
        if (action === "update")
          rows.forEach((row) => Object.assign(row, input));
        if (action === "delete")
          tables[table] = tables[table].filter((row) => !rows.includes(row));
        return {
          data: single || optional ? rows[0] || null : rows,
          error:
            single && rows.length !== 1
              ? { code: "PGRST116", message: "Expected one row" }
              : null,
        };
      }
      return query;
    },
  };
  return {
    client,
    tables,
    invoked,
    get signedOut() {
      return signedOut;
    },
    setUser(value) {
      user = value;
    },
  };
}

test("Supabase browser adapter refuses signed-out and unconfirmed identities before mutations", async () => {
  for (const user of [null, { id: owner, email_confirmed_at: null }]) {
    const f = fixture();
    f.setUser(user);
    await assert.rejects(
      savedAccountRequest(f.client, "vehicles", "POST", {
        plate: "NEW1",
        state: "NY",
        nickname: "New",
      }),
    );
    assert.equal(f.tables.curbside_vehicles.length, 2);
  }
});
test("Supabase browser adapter scopes cars to the authenticated UUID and ignores forged ownership", async () => {
  const f = fixture();
  const me = await savedAccountRequest(f.client, "me");
  assert.equal(me.user.id, owner);
  assert.deepEqual(
    me.vehicles.map((car) => car.id),
    [mine],
  );
  await savedAccountRequest(f.client, "vehicles/" + mine, "PATCH", {
    nickname: "Renamed",
    user_id: other,
  });
  assert.equal(f.tables.curbside_vehicles[0].user_id, owner);
  assert.equal(f.tables.curbside_vehicles[0].nickname, "Renamed");
  for (const method of ["PATCH", "DELETE"])
    await assert.rejects(
      savedAccountRequest(f.client, "vehicles/" + theirs, method, {
        nickname: "Forged",
      }),
    );
  assert.equal(f.tables.curbside_vehicles[1].nickname, "Theirs");
  await savedAccountRequest(f.client, "garage", "DELETE");
  assert.deepEqual(
    f.tables.curbside_vehicles.map((car) => car.id),
    [theirs],
  );
});
test("consent writes retain the deployed contract version and account deletion uses the authenticated Edge Function", async () => {
  const f = fixture();
  for (const body of [
    { accepted: false, adult: true, version: "2026-09-27.1" },
    { accepted: true, adult: false, version: "2026-09-27.1" },
    { accepted: true, adult: true, version: "wrong" },
  ])
    await assert.rejects(savedAccountRequest(f.client, "legal", "POST", body));
  await savedAccountRequest(f.client, "legal", "POST", {
    accepted: true,
    adult: true,
    version: "2026-09-27.1",
    user_id: other,
    accepted_at: "forged",
  });
  assert.deepEqual(f.tables.curbside_terms_acceptances, [
    { user_id: owner, version: "2026-09-27.1" },
  ]);
  await assert.rejects(
    savedAccountRequest(f.client, "account", "DELETE", { confirmation: false }),
  );
  assert.equal(f.invoked.length, 0);
  await savedAccountRequest(f.client, "account", "DELETE", {
    confirmation: "DELETE_ACCOUNT",
    userId: other,
  });
  assert.deepEqual(f.invoked, [
    [
      "account-delete",
      { body: { confirmation: "DELETE_ACCOUNT", userId: owner } },
    ],
  ]);
  assert.equal(f.signedOut, true);
  for (const path of ["checkout", "billing", "phone/send", "cases"])
    await assert.rejects(savedAccountRequest(f.client, path, "POST", {}));
});
