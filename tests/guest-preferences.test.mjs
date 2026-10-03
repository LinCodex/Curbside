import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { PREFERENCE_KEY, preferenceKey } from "../lib/preferences.ts";

const compiled = await build({
  stdin: {
    contents:
      'export * from "./lib/browser-account"; export * from "./lib/account-preferences";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { confirmedAccount, verifyBrowserAccount, saveAccountPreferences } =
  await import(
    "data:text/javascript;base64," +
      Buffer.from(compiled.outputFiles[0].text).toString("base64")
  );
const user = {
  id: "owner",
  email_confirmed_at: "2026-10-02",
  is_anonymous: false,
};
const session = { access_token: "test-token", user };
const settings = { theme: "light", language: "zh", detailMode: "geek" };

test("guest, anonymous and unconfirmed browser sessions never call Auth user lookup", async () => {
  let requests = 0;
  const client = {
    auth: {
      getUser: () => {
        requests++;
        throw new Error("Unexpected request");
      },
    },
  };
  for (const candidate of [
    null,
    { ...session, access_token: "" },
    { ...session, user: { ...user, email_confirmed_at: null } },
    { ...session, user: { ...user, is_anonymous: true } },
  ])
    assert.equal(await verifyBrowserAccount(client, candidate), null);
  assert.equal(requests, 0);
  assert.equal(confirmedAccount({ ...user, is_anonymous: true }), null);
});

test("a stored account is exposed only after its exact token and identity are verified", async () => {
  let receivedToken;
  let identity = user;
  const client = {
    auth: {
      getUser: async (token) => {
        receivedToken = token;
        return { data: { user: identity }, error: null };
      },
    },
  };
  assert.deepEqual(await verifyBrowserAccount(client, session), user);
  assert.equal(receivedToken, session.access_token);
  identity = { ...user, id: "other" };
  assert.equal(await verifyBrowserAccount(client, session), null);
  identity = { ...user, is_anonymous: true };
  assert.equal(await verifyBrowserAccount(client, session), null);
});

test("rejected stale sessions are cleared locally once and become device-only guests", async () => {
  let current = session;
  let lookups = 0;
  const scopes = [];
  const client = {
    auth: {
      getUser: async () => {
        lookups++;
        return { data: { user: null }, error: { status: 403 } };
      },
      getSession: async () => ({ data: { session: current }, error: null }),
      signOut: async (options) => {
        scopes.push(options.scope);
        current = null;
        return { error: null };
      },
    },
  };
  assert.equal(await verifyBrowserAccount(client, current), null);
  assert.equal(await verifyBrowserAccount(client, current), null);
  assert.equal(lookups, 1);
  assert.deepEqual(scopes, ["local"]);
});

test("an old verification failure cannot sign out a newer account session", async () => {
  let signOuts = 0;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { status: 401 } }),
      getSession: async () => ({
        data: { session: { ...session, access_token: "new-token" } },
        error: null,
      }),
      signOut: async () => {
        signOuts++;
      },
    },
  };
  assert.equal(await verifyBrowserAccount(client, session), null);
  assert.equal(signOuts, 0);
});

test("temporary Auth failures do not discard a valid stored session", async () => {
  let signOuts = 0;
  const failure = Object.assign(new Error("Temporarily unavailable"), {
    status: 503,
  });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: failure }),
      signOut: async () => {
        signOuts++;
      },
    },
  };
  await assert.rejects(verifyBrowserAccount(client, session), failure);
  assert.equal(signOuts, 0);
});

test("guest preference saves make no Auth or database calls, even with a stale client", async () => {
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw new Error("Guest contacted Supabase");
      },
    },
  );
  assert.deepEqual(
    await saveAccountPreferences(forbidden, null, settings),
    settings,
  );
  assert.deepEqual(
    await saveAccountPreferences(null, null, settings),
    settings,
  );
  assert.equal(preferenceKey(null), PREFERENCE_KEY);
  assert.notEqual(preferenceKey(user.id), preferenceKey(null));
  assert.notEqual(preferenceKey("other"), preferenceKey(user.id));
});

test("account preferences reject anonymous, unconfirmed or switched identities before querying", async () => {
  let queries = 0;
  for (const identity of [
    null,
    { ...user, id: "other" },
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
  ]) {
    const client = {
      auth: {
        getUser: async () => ({ data: { user: identity }, error: null }),
      },
      from() {
        queries++;
        throw new Error("Unexpected database query");
      },
    };
    await assert.rejects(
      saveAccountPreferences(client, user.id, settings),
      /session changed/,
    );
  }
  assert.equal(queries, 0);
});

test("verified account settings retain cloud persistence under the correct owner", async () => {
  const writes = [];
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      assert.equal(table, "curbside_preferences");
      return {
        update(fields) {
          return {
            eq(field, owner) {
              return {
                select: async () => {
                  writes.push({ fields, field, owner });
                  return { data: [{ user_id: owner }], error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  assert.deepEqual(
    await saveAccountPreferences(client, user.id, settings),
    settings,
  );
  assert.deepEqual(writes, [
    {
      fields: { theme: "light", language: "zh", detail_mode: "geek" },
      field: "user_id",
      owner: user.id,
    },
  ]);
});
