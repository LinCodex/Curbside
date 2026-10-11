import test from "node:test";
import assert from "node:assert/strict";
import {
  accountDeletedEmail,
  accountDeletionHandler,
} from "../lib/account-deletion.ts";
const origin = "https://example.com";
const id = "193a2604-3ba1-4b61-9e9a-5276512dc001";
const session = "193a2604-3ba1-4b61-9e9a-5276512dc002";
const token =
  "verified." +
  Buffer.from(JSON.stringify({ session_id: session })).toString("base64url") +
  ".token";
function fixture({
  confirmed = true,
  activeSession = true,
  anonymous = false,
  failure = false,
  notice,
} = {}) {
  const deleted = [];
  const admin = {
    auth: {
      getUser: async (value) => ({
        data: {
          user:
            value === token
              ? {
                  id,
                  email: "driver@example.com",
                  email_confirmed_at: confirmed ? "2026-01-01" : undefined,
                  is_anonymous: anonymous,
                }
              : null,
        },
        error: value === token ? null : new Error("invalid"),
      }),
      admin: {
        deleteUser: async (userId, soft) => {
          assert.equal(soft, false);
          deleted.push(userId);
          return {
            error: failure
              ? new Error("provider detail must remain private")
              : null,
          };
        },
      },
    },
    rpc: async (name, input) => {
      assert.equal(name, "curbside_can_delete_account");
      assert.deepEqual(input, { account_id: id, session_id: session });
      return { data: activeSession, error: null };
    },
  };
  return { handler: accountDeletionHandler(admin, [origin], notice), deleted };
}
const request = (
  body = { confirmation: "DELETE_ACCOUNT", userId: id },
  extra = {},
) =>
  new Request(origin + "/delete", {
    method: "POST",
    headers: {
      origin,
      authorization: "Bearer " + token,
      "content-type": "application/json",
      ...extra,
    },
    body: JSON.stringify(body),
  });
test("permanent deletion requires explicit confirmation and a live confirmed account session", async () => {
  for (const config of [
    { confirmed: false },
    { activeSession: false },
    { anonymous: true },
  ]) {
    const f = fixture(config);
    assert.equal((await f.handler(request())).status, 401);
    assert.deepEqual(f.deleted, []);
  }
  const f = fixture();
  for (const body of [
    { userId: id },
    { confirmation: "DELETE_ACCOUNT", userId: session },
  ])
    assert.equal((await f.handler(request(body))).status, 400);
  assert.equal(
    (await f.handler(request(undefined, { authorization: "Bearer forged" })))
      .status,
    401,
  );
  assert.equal(
    (
      await f.handler(
        request(undefined, { origin: "https://attacker.example" }),
      )
    ).status,
    403,
  );
  assert.deepEqual(f.deleted, []);
  assert.deepEqual(await (await f.handler(request())).json(), { ok: true });
  assert.deepEqual(f.deleted, [id]);
});
test("deletion failures never report success or expose provider details", async () => {
  const sent = [];
  const f = fixture({
    failure: true,
    notice: async () => async () => sent.push("mail"),
  });
  const response = await f.handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /provider detail/);
  assert.deepEqual(sent, []);
});
test("a confirmation email is prepared before deletion and sent only after it succeeds", async () => {
  const events = [];
  let f;
  f = fixture({
    notice: async (user, language) => {
      events.push(["prepare", user.email, language, [...f.deleted]]);
      return async () => events.push(["send", [...f.deleted]]);
    },
  });
  const body = { confirmation: "DELETE_ACCOUNT", userId: id, language: "zh" };
  assert.deepEqual(await (await f.handler(request(body))).json(), {
    ok: true,
    emailed: true,
  });
  assert.deepEqual(events, [
    ["prepare", "driver@example.com", "zh", []],
    ["send", [id]],
  ]);
  const failing = fixture({
    notice: async () => async () => {
      throw new Error("provider down");
    },
  });
  assert.deepEqual(
    await (await failing.handler(request({ ...body, language: "fr" }))).json(),
    { ok: true, emailed: false },
  );
  assert.deepEqual(failing.deleted, [id]);
});
test("the deletion email explains what was removed and what is kept", () => {
  const en = accountDeletedEmail("en", "driver@example.com", "help@example.com");
  assert.match(en.subject, /account was deleted/);
  assert.match(en.message, /driver@example\.com/);
  assert.match(en.message, /## What we removed[\s\S]*Saved cars/);
  assert.match(en.message, /## What stays[\s\S]*Public NYC ticket records/);
  assert.match(en.message, /\(mailto:help@example\.com\)/);
  const zh = accountDeletedEmail("zh", "driver@example.com", "help@example.com");
  assert.match(zh.subject, /账户已删除/);
  assert.match(zh.message, /## 已删除的内容[\s\S]*## 保留的内容/);
});
