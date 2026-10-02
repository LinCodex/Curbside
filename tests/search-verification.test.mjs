import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  createSearchVerification,
  searchVerificationHandler,
  SearchVerificationError,
} from "../lib/search-verification.ts";

const secret = "test-only-shared-secret-with-at-least-32-bytes";
const ledgerUrl = "https://project.invalid/functions/v1/search-verification";
const ip = "203.0.113.1";
const input = (challenge) => ({ ip, challenge });
const request = (cookie = "", agent = "Test browser") =>
  new Request("https://ticketsafe.invalid/api/search", {
    method: "POST",
    headers: { cookie, "user-agent": agent },
  });
const errorCode = (code, status) => (error) =>
  error instanceof SearchVerificationError &&
  error.code === code &&
  error.status === status;
const fixture = async () => {
  const db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role,anon,authenticated;",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261002153336_search_verification_ledger.sql",
      "utf8",
    ),
  );
  const consume = async (value) => {
    const result = await db.query(
      "select public.curbside_search_verification($1,$2,$3,$4,$5) as result",
      [
        value.action,
        value.actor,
        value.nonce,
        value.passId || null,
        value.expiresAt ? new Date(value.expiresAt).toISOString() : null,
      ],
    );
    return result.rows[0].result;
  };
  const handler = searchVerificationHandler(secret, consume);
  return {
    db,
    consume,
    handler,
    send: async (url, options) => handler(new Request(url, options)),
  };
};

test("unconfigured ledger always checks a fresh provider token and never mints a pass", async () => {
  let checks = 0;
  const service = createSearchVerification({});
  const check = async (challenge) => {
    assert.equal(challenge, "fresh");
    checks++;
  };
  assert.deepEqual(await service.verify(request(), input("fresh"), check), {});
  assert.deepEqual(
    await service.verify(request("copied=anything"), input("fresh"), check),
    {},
  );
  assert.equal(checks, 2);
  assert.deepEqual(await service.status(request(), { ip }), {
    verifiedUntil: null,
  });
  await assert.rejects(
    service.verify(request(), input("bad"), async () => false),
    errorCode("captcha_required", 403),
  );
});

test("partial, short-secret, insecure and unknown-IP ledger configurations fail closed", async () => {
  for (const options of [
    { secret },
    { ledgerUrl },
    { secret: "short", ledgerUrl },
    { secret, ledgerUrl: "http://insecure.invalid" },
  ]) {
    const service = createSearchVerification(options);
    await assert.rejects(
      service.verify(request(), input("fresh"), async () => {}),
      errorCode("verification_unavailable", 503),
    );
    await assert.rejects(
      service.status(request(), { ip }),
      errorCode("verification_unavailable", 503),
    );
  }
  const service = createSearchVerification({ secret, ledgerUrl });
  await assert.rejects(
    service.verify(
      request(),
      { ip: "unknown", challenge: "fresh" },
      async () => {},
    ),
    errorCode("verification_unavailable", 503),
  );
});

test("provider rejection or a failed durable ledger cannot create a pass", async () => {
  const f = await fixture();
  try {
    const service = createSearchVerification({
      secret,
      ledgerUrl,
      send: f.send,
    });
    await assert.rejects(
      service.verify(request(), input("bad"), async () => false),
      errorCode("captcha_required", 403),
    );
    assert.equal(
      (
        await f.db.query(
          "select count(*)::int as n from public.curbside_search_passes",
        )
      ).rows[0].n,
      0,
    );
    const down = createSearchVerification({
      secret,
      ledgerUrl,
      send: async () => new Response("", { status: 503 }),
    });
    let checks = 0;
    await assert.rejects(
      down.verify(request(), input("fresh"), async () => {
        checks++;
      }),
      errorCode("verification_unavailable", 503),
    );
    assert.equal(checks, 0);
  } finally {
    await f.db.close();
  }
});

test("secure fixed-expiry cookie binds IP and user agent; changed, duplicate, expired and wrong-key cookies need captcha", async () => {
  const f = await fixture();
  try {
    let clock = Date.now();
    let checks = 0;
    const service = createSearchVerification({
      secret,
      ledgerUrl,
      send: f.send,
      now: () => clock,
    });
    const first = await service.verify(request(), input("fresh"), async () => {
      checks++;
    });
    const cookie = first.setCookie.split(";")[0];
    assert.match(first.setCookie, /^__Host-ticketsafe-search=/);
    assert.match(first.setCookie, /; Path=\//);
    assert.match(first.setCookie, /; HttpOnly/);
    assert.match(first.setCookie, /; Secure/);
    assert.match(first.setCookie, /; SameSite=Strict/);
    assert.doesNotMatch(first.setCookie, /Domain=/);
    assert.equal(first.verifiedUntil, clock + 300_000);
    assert.deepEqual(await service.status(request(cookie), { ip }), {
      verifiedUntil: first.verifiedUntil,
    });
    const reused = await service.verify(request(cookie), input(), async () => {
      throw new Error("Must not reverify an active pass");
    });
    assert.deepEqual(reused, { verifiedUntil: first.verifiedUntil });
    assert.equal(checks, 1);
    assert.deepEqual(
      await service.status(request(cookie, "Different browser"), { ip }),
      { verifiedUntil: null },
    );
    assert.deepEqual(
      await service.status(request(cookie), { ip: "203.0.113.2" }),
      { verifiedUntil: null },
    );
    const changed = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    for (const value of [
      changed,
      cookie + "; " + cookie,
      "__Host-ticketsafe-search=malformed",
      "__Host-ticketsafe-search=" + "a".repeat(1100),
    ])
      await assert.rejects(
        service.verify(request(value), input(), async () => {}),
        errorCode("captcha_required", 403),
      );
    const rotated = createSearchVerification({
      secret: secret + "rotated",
      ledgerUrl,
      send: f.send,
    });
    assert.deepEqual(await rotated.status(request(cookie), { ip }), {
      verifiedUntil: null,
    });
    clock += 300_000;
    assert.deepEqual(await service.status(request(cookie), { ip }), {
      verifiedUntil: null,
    });
  } finally {
    await f.db.close();
  }
});

test("ten-search pass budget survives replay of the original cookie and simultaneous requests", async () => {
  const f = await fixture();
  try {
    const service = createSearchVerification({
      secret,
      ledgerUrl,
      send: f.send,
    });
    const first = await service.verify(
      request(),
      input("fresh"),
      async () => {},
    );
    const cookie = first.setCookie.split(";")[0];
    for (let i = 0; i < 4; i++)
      await service.verify(request(cookie), input(), async () =>
        assert.fail("Fresh captcha should not be needed"),
      );
    await assert.rejects(
      service.verify(request(cookie), input(), async () => {}),
      errorCode("rate_limited", 429),
    );
    // Advancing stored search times models the second minute of the same five-minute pass.
    await f.db.exec(
      "update public.curbside_search_limits set searches = array(select t-interval '61 seconds' from unnest(searches)t)",
    );
    const parallel = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        service.verify(request(cookie), input(), async () => {}),
      ),
    );
    assert.equal(
      parallel.filter((result) => result.status === "fulfilled").length,
      5,
    );
    assert.equal(
      (await f.db.query("select uses from public.curbside_search_passes"))
        .rows[0].uses,
      10,
    );
    await f.db.exec(
      "update public.curbside_search_limits set searches = array(select t-interval '61 seconds' from unnest(searches)t)",
    );
    await assert.rejects(
      service.verify(request(cookie), input(), async () => {}),
      errorCode("captcha_required", 403),
    );
    // Replacing a pass requires provider verification, and does not reset the shared IP budget.
    const renewed = await service.verify(
      request(cookie),
      input("fresh-again"),
      async () => {},
    );
    assert.ok(renewed.setCookie);
    assert.equal(
      (
        await f.db.query(
          "select cardinality(searches) as n from public.curbside_search_limits",
        )
      ).rows[0].n,
      11,
    );
  } finally {
    await f.db.close();
  }
});

test("database caps hourly successful searches and attempt windows independently of cookies", async () => {
  const f = await fixture();
  try {
    let nonce = 0;
    const actor = "a".repeat(64);
    const call = (action, extras = {}) =>
      f.consume({
        action,
        actor,
        nonce: (++nonce).toString(16).padStart(32, "0"),
        ...extras,
      });
    for (let i = 0; i < 20; i++)
      assert.equal((await call("attempt")).status, "ok");
    assert.equal((await call("attempt")).status, "rate_limited");
    await f.db.exec(
      "update public.curbside_search_limits set attempts=array(select now()-interval '2 minutes' from generate_series(1,60)), searches=array(select now()-interval '2 minutes' from generate_series(1,30))",
    );
    assert.equal((await call("attempt")).status, "rate_limited");
    assert.equal(
      (
        await call("mint", {
          passId: "b".repeat(32),
          expiresAt: Date.now() + 300_000,
        })
      ).status,
      "rate_limited",
    );
  } finally {
    await f.db.close();
  }
});

test("service-only permissions prevent public clients touching ledger rows or RPC", async () => {
  const f = await fixture();
  try {
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec(`set role ${role}`);
      for (const table of [
        "curbside_search_limits",
        "curbside_search_passes",
        "curbside_search_requests",
      ])
        await assert.rejects(
          f.db.query(`select * from public.${table}`),
          /permission denied/,
        );
      await assert.rejects(
        f.consume({
          action: "attempt",
          actor: "a".repeat(64),
          nonce: "b".repeat(32),
        }),
        /permission denied/,
      );
      await f.db.exec("reset role");
    }
    await f.db.exec("set role service_role");
    assert.equal(
      (
        await f.consume({
          action: "attempt",
          actor: "a".repeat(64),
          nonce: "b".repeat(32),
        })
      ).status,
      "ok",
    );
  } finally {
    await f.db.close();
  }
});

test("Edge handler denies anonymous calls, changed bodies, stale signatures and signed request replay", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.handler(new Request(ledgerUrl, { method: "POST", body: "{}" })))
        .status,
      401,
    );
    assert.equal((await f.handler(new Request(ledgerUrl))).status, 405);
    assert.equal(
      (
        await f.handler(
          new Request(ledgerUrl, { method: "POST", body: "x".repeat(2049) }),
        )
      ).status,
      413,
    );
    let saved;
    const service = createSearchVerification({
      secret,
      ledgerUrl,
      send: async (url, options) => {
        if (!saved) saved = { url, options };
        return f.send(url, options);
      },
    });
    await service.verify(request(), input("fresh"), async () => {});
    const replay = await f.handler(new Request(saved.url, saved.options));
    assert.equal((await replay.json()).status, "replay");
    const changed = new Request(saved.url, {
      ...saved.options,
      body: saved.options.body + " ",
    });
    assert.equal((await f.handler(changed)).status, 401);
    const staleHandler = searchVerificationHandler(
      secret,
      () => assert.fail("Stale signature must not call DB"),
      () => Date.now() + 60_000,
    );
    assert.equal(
      (await staleHandler(new Request(saved.url, saved.options))).status,
      400,
    );
  } finally {
    await f.db.close();
  }
});
