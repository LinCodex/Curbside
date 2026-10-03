import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
const compile = async (file) => {
  const result = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
};
const {
  emailDeliveryAvailable,
  signEmailUnsubscribe,
  verifyEmailUnsubscribe,
  loadEmailNotificationSettings,
  saveEmailNotificationSettings,
} = await compile("lib/email-notifications.ts");
const { detailedTicketEmail } = await compile("lib/ticket-email.ts");
const { dispatchTicketEmails } = await compile(
  "supabase/functions/email-notifications/delivery.ts",
);
const owner = "a9175af4-e1b0-4510-b261-8db6fdc67101",
  other = "a9175af4-e1b0-4510-b261-8db6fdc67102";
const revision = "a9175af4-e1b0-4510-b261-8db6fdc67200",
  lease = "a9175af4-e1b0-4510-b261-8db6fdc67300",
  jobID = "a9175af4-e1b0-4510-b261-8db6fdc67400";
const config = {
  enabled: "true",
  senderVerified: "true",
  apiKey: "synthetic-provider-key",
  from: "alert@example.invalid",
  signingSecret: "local-test-secret-32-characters-only",
  appOrigin: "https://tickets.example.invalid",
  supabaseUrl: "https://database.example.invalid",
};

test("notification preference operations reject an account switch before touching the database", async () => {
  let queries = 0;
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: other, email_confirmed_at: "2026-10-01" } },
        error: null,
      }),
    },
    from() {
      queries++;
      throw new Error("Unexpected database access");
    },
  };
  await assert.rejects(
    loadEmailNotificationSettings(client, owner),
    /Verified account required/,
  );
  await assert.rejects(
    saveEmailNotificationSettings(client, true, owner),
    /Verified account required/,
  );
  assert.equal(queries, 0);
});

test("notification preference reads and writes stay scoped to the confirmed account", async () => {
  const filters = [];
  const writes = [];
  let operation;
  const query = {
    select() {
      return this;
    },
    eq(column, id) {
      filters.push([column, id]);
      return this;
    },
    update(value) {
      operation = "update";
      writes.push(value);
      return this;
    },
    async maybeSingle() {
      return {
        data: operation === "update" ? { user_id: owner } : { enabled: true },
        error: null,
      };
    },
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: owner, email_confirmed_at: "2026-10-01" } },
        error: null,
      }),
    },
    from(table) {
      assert.equal(table, "curbside_email_settings");
      return query;
    },
  };
  assert.deepEqual(await loadEmailNotificationSettings(client, owner), {
    enabled: true,
  });
  await saveEmailNotificationSettings(client, false, owner);
  assert.deepEqual(filters, [
    ["user_id", owner],
    ["user_id", owner],
  ]);
  assert.deepEqual(writes, [{ enabled: false }]);
});

test("delivery requires explicit enablement, verified sender and private configuration; unsubscribe is signed and narrowly scoped", async () => {
  assert.equal(emailDeliveryAvailable(config), true);
  for (const patch of [
    { enabled: "false" },
    { senderVerified: "false" },
    { apiKey: "" },
    { from: "User <bad@example.invalid>" },
    { signingSecret: "short" },
    { appOrigin: "http://localhost:3000" },
  ])
    assert.equal(emailDeliveryAvailable({ ...config, ...patch }), false);
  const token = await signEmailUnsubscribe(
    owner,
    revision,
    Date.now() + 60_000,
    config.signingSecret,
  );
  assert.equal(
    (await verifyEmailUnsubscribe(token, config.signingSecret)).scope,
    "ticket-email",
  );
  assert.equal(
    await verifyEmailUnsubscribe(
      token.slice(0, -2) + "XX",
      config.signingSecret,
    ),
    null,
  );
  assert.equal(
    await verifyEmailUnsubscribe(
      token,
      "another-long-local-only-signing-secret",
    ),
    null,
  );
  assert.equal(
    await verifyEmailUnsubscribe(
      token,
      config.signingSecret,
      Date.now() + 120_000,
    ),
    null,
  );
  assert.equal(
    await verifyEmailUnsubscribe("x".repeat(1100), config.signingSecret),
    null,
  );
  for (const language of ["en", "zh"]) {
    const email = await detailedTicketEmail(
      2,
      language,
      "https://tickets.example.invalid/#garage",
      "https://database.example.invalid/unsubscribe",
      [],
    );
    assert.ok(email.text.includes("2"));
    assert.ok(!email.text.includes(owner));
    assert.ok(
      email.html.includes("TicketSafe") || email.html.includes("罚单卫士"),
    );
    assert.ok(
      email.html.includes("https://a836-citypay.nyc.gov/citypay/Parking") ||
        email.text.includes("https://a836-citypay.nyc.gov/citypay/Parking"),
    );
  }
});

function deliveryFixture({
  current = true,
  due = 0,
  emailContent = null,
} = {}) {
  const calls = [];
  const job = {
    id: jobID,
    user_id: owner,
    setting_revision: revision,
    lease,
    recipient: "recipient@example.invalid",
    language: "en",
    ticket_count: 2,
    created_at: "2026-10-02T12:00:00Z",
    email_content: emailContent,
    ticket_details: [
      {
        id: "1000000001",
        plate: "FIRST1",
        state: "NY",
        nickname: "My car",
        description: "NO PARKING",
        due: 50,
        issued: "2026-10-02",
        location: { label: "", precision: "unknown" },
      },
    ],
  };
  return {
    calls,
    admin: {
      from() {
        return {
          select() {
            return { lte: async () => ({ count: due, error: null }) };
          },
        };
      },
      async rpc(name, args) {
        calls.push([name, args]);
        return {
          error: null,
          data:
            name === "curbside_freeze_email_content"
              ? args.content
              : name === "curbside_claim_email_jobs"
                ? [job]
                : name === "curbside_email_job_is_current"
                  ? current
                  : true,
        };
      },
    },
  };
}
test("retrying a frozen email reuses its Mapbox attachment without another map request", async () => {
  const frozen = {
    subject: "TicketSafe: new tickets for your saved vehicles",
    text: "Frozen ticket alert",
    html: '<img src="cid:ticketsafe-map" alt="Mapbox ticket map">',
    attachments: [
      {
        filename: "ticketsafe-ticket-locations.png",
        content: "frozen-map-content",
        content_type: "image/png",
        content_id: "ticketsafe-map",
      },
    ],
  };
  const fixture = deliveryFixture({ emailContent: frozen });
  let sends = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    await dispatchTicketEmails(
      fixture.admin,
      { ...config, mapboxToken: "test-mapbox-token" },
      async (url, input) => {
        assert.equal(url, "https://api.resend.com/emails");
        const body = JSON.parse(input.body);
        assert.deepEqual(body.attachments, frozen.attachments);
        sends++;
        return Response.json({ id: "provider-id" });
      },
    );
  }
  assert.equal(sends, 2);
  assert.equal(
    fixture.calls.filter(([name]) => name === "curbside_freeze_email_content")
      .length,
    0,
  );
});
test("worker freezes provider idempotency, retries ambiguous failures, suppresses opt-outs and makes no disabled provider calls", async () => {
  let sends = 0;
  const sent = [];
  const send = async (url, input) => {
    sends++;
    sent.push([url, input]);
    return new Response(JSON.stringify({ id: "provider-local-test" }), {
      status: 200,
    });
  };
  const disabled = deliveryFixture();
  assert.deepEqual(
    await dispatchTicketEmails(
      disabled.admin,
      { ...config, enabled: "false" },
      send,
    ),
    { available: false, accepted: 0 },
  );
  assert.equal(disabled.calls.length, 0);
  assert.equal(sends, 0);
  const pending = deliveryFixture({ due: 1 });
  await dispatchTicketEmails(pending.admin, config, send);
  assert.equal(sends, 0);
  const optedOut = deliveryFixture({ current: false });
  await dispatchTicketEmails(optedOut.admin, config, send);
  assert.equal(sends, 0);
  assert.equal(optedOut.calls.at(-1)[1].retryable, false);
  for (let i = 0; i < 2; i++) {
    const f = deliveryFixture();
    assert.equal(
      (await dispatchTicketEmails(f.admin, config, send)).accepted,
      1,
    );
  }
  assert.equal(
    sent[0][1].headers["Idempotency-Key"],
    `ticketsafe-new-tickets/${jobID}`,
  );
  assert.equal(sent[0][1].body, sent[1][1].body);
  const email = JSON.parse(sent[0][1].body);
  assert.deepEqual(email.to, ["recipient@example.invalid"]);
  assert.equal(
    email.headers["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );
  const failing = deliveryFixture();
  assert.equal(
    (
      await dispatchTicketEmails(failing.admin, config, async () => {
        throw new Error("timeout after possible acceptance");
      })
    ).accepted,
    0,
  );
  assert.equal(failing.calls.at(-1)[1].delivered, false);
  assert.equal(failing.calls.at(-1)[1].retryable, true);
  const invalid = deliveryFixture();
  await dispatchTicketEmails(
    invalid.admin,
    config,
    async () =>
      new Response(JSON.stringify({ name: "invalid_idempotent_request" }), {
        status: 409,
      }),
  );
  assert.equal(invalid.calls.at(-1)[1].retryable, false);
});

const read = (path) => fs.readFileSync(path, "utf8");
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema auth,public to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    grant select on auth.users to service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin return;end $$;`);
  for (const file of [
    "20260930192906_saved_vehicles.sql",
    "20261001152705_saved_vehicle_access_hardening.sql",
    "20261001182017_account_preferences.sql",
  ])
    await db.exec(read("supabase/migrations/" + file));
  await db.exec(
    read(
      "supabase/migrations/20261001184032_saved_vehicle_snapshots.sql",
    ).split("-- Dedicated cron credential")[0] + "commit;",
  );
  await db.exec(
    read(
      "supabase/migrations/20261002152642_email_ticket_notifications.sql",
    ).split("-- Scheduler infrastructure")[0] + "commit;",
  );
  await db.exec(
    read("supabase/migrations/20261002161702_email_ticket_details.sql"),
  );
  await db.exec(`insert into auth.users values('${owner}','owner@example.invalid',now(),false),('${other}','other@example.invalid',now(),false);
    insert into public.curbside_terms_acceptances(user_id,version) values('${owner}','2026-09-27.1'),('${other}','2026-09-27.1');
    insert into public.curbside_vehicles(user_id,plate,state,nickname) values('${owner}','FIRST1','NY','Existing car'),('${other}','FIRST1','NY','Shared subscriber');
    insert into public.curbside_email_settings(user_id,enabled) values('${owner}',true);
    insert into public.curbside_preferences(user_id,language) values('${owner}','zh');`);
  return db;
}
const observation = (ids, { complete = true } = {}) => ({
  complete,
  unavailable: false,
  tickets: ids.map((id) => ({ id, due: 10 })),
  sources: [{ ok: complete, truncated: false }],
  query: { plate: "FIRST1", state: "NY", plateType: "" },
});
async function finish(
  db,
  ids,
  { complete = true, full = true, stale = false } = {},
) {
  await db.exec(
    `reset role;update public.curbside_vehicle_snapshots set lease='${lease}',lease_until=now()+interval '1 minute' where key='NY:FIRST1:*';set role service_role;`,
  );
  const obs = observation(ids, { complete });
  const result = await db.query(
    "select public.curbside_finish_snapshot_with_email($1,$2,$3,$4,$5) as finished",
    ["NY:FIRST1:*", stale ? revision : lease, obs, full, obs],
  );
  await db.exec("reset role;");
  return result.rows[0].finished;
}
const count = async (db, table) =>
  (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;

test("database caps daily provider attempts and suppresses expired, removed-car and changed-email jobs", async () => {
  const db = await database();
  try {
    await db.exec(
      `insert into public.curbside_email_settings(user_id,enabled) values('${other}',true);`,
    );
    await finish(db, ["1000000001"]);
    await finish(db, ["1000000001", "1000000002"]);
    assert.equal(await count(db, "curbside_email_outbox"), 2);
    await db.exec(
      "insert into public.curbside_email_budget(day,attempts) values((now() at time zone 'UTC')::date,99);set role service_role;",
    );
    const first = (
      await db.query("select * from public.curbside_claim_email_jobs()")
    ).rows;
    assert.equal(first.length, 1, "last global budget slot only");
    assert.equal(
      (await db.query("select * from public.curbside_claim_email_jobs()")).rows
        .length,
      0,
      "daily cap is durable across invocations",
    );
    await db.exec(
      `reset role;update auth.users set email='changed@example.invalid' where id='${first[0].user_id}';set role service_role;`,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_email_job_is_current($1,$2) as ok",
          [first[0].id, first[0].lease],
        )
      ).rows[0].ok,
      false,
      "email change suppresses frozen recipient",
    );
    await db.exec(
      "reset role;update public.curbside_email_budget set attempts=0;update public.curbside_email_outbox set first_attempt_at=now()-interval '23 hours',lease_until=now()-interval '1 second' where attempts>0;set role service_role;",
    );
    const second = (
      await db.query("select * from public.curbside_claim_email_jobs()")
    ).rows;
    assert.equal(second.length, 1, "only unsent profile remains eligible");
    await db.exec("reset role;");
    const expired = (
      await db.query(
        "select status,recipient from public.curbside_email_outbox where id=$1",
        [first[0].id],
      )
    ).rows[0];
    assert.equal(expired.status, "cancelled");
    assert.equal(expired.recipient, null, "expired job removes frozen email");
    await db.exec(
      `delete from public.curbside_vehicles where user_id='${second[0].user_id}';set role service_role;`,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_email_job_is_current($1,$2) as ok",
          [second[0].id, second[0].lease],
        )
      ).rows[0].ok,
      false,
      "removed car cannot send queued alert",
    );
    await db.exec(
      "reset role;update public.curbside_email_outbox set lease_until=now()-interval '1 second';set role service_role;",
    );
    assert.equal(
      (await db.query("select * from public.curbside_claim_email_jobs()")).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("real Supabase notification migration enforces RLS, complete baselines, summons dedupe, durable leases and unsubscribe/deletion", async () => {
  const db = await database();
  try {
    assert.match(
      (await db.exec(read("supabase/tests/email-notifications.sql"))).at(-1)
        .rows[0].result,
      /^PASS:/,
    );
    assert.equal(await count(db, "curbside_email_outbox"), 0);
    assert.equal(await finish(db, ["1000000001"], { full: false }), true);
    assert.equal(await count(db, "curbside_email_baselines"), 0);
    assert.equal(await finish(db, ["1000000001"]), true);
    assert.equal(
      await count(db, "curbside_email_outbox"),
      0,
      "first full baseline must send nothing",
    );
    assert.equal(
      await finish(db, ["1000000001", "1000000002"], { complete: false }),
      true,
    );
    assert.equal(
      await count(db, "curbside_email_outbox"),
      0,
      "partial results cannot alert",
    );
    assert.equal(
      await finish(db, ["1000000001", "1000000002"], { stale: true }),
      false,
    );
    assert.equal(
      await count(db, "curbside_email_outbox"),
      0,
      "stale worker cannot enqueue",
    );
    assert.equal(
      await finish(db, [
        "1000000001",
        "1000000002",
        "1000000002",
        "undefined",
        "legacy-placeholder",
      ]),
      true,
    );
    assert.equal(await count(db, "curbside_email_events"), 1);
    assert.equal(await count(db, "curbside_email_outbox"), 1);
    await finish(db, ["1000000001", "1000000002", "1000000003"]);
    assert.equal(
      await count(db, "curbside_email_outbox"),
      1,
      "aggregate one daily summary",
    );
    assert.equal(await count(db, "curbside_email_events"), 2);
    await finish(db, ["1000000001", "1000000002", "1000000003"]);
    assert.equal(
      await count(db, "curbside_email_events"),
      2,
      "repeated IDs/balance updates must not alert",
    );
    await db.exec("set role service_role;");
    const first = (
      await db.query("select * from public.curbside_claim_email_jobs()")
    ).rows[0];
    assert.equal(first.ticket_count, 2);
    assert.equal(first.language, "zh");
    assert.equal(first.recipient, "owner@example.invalid");
    assert.equal(first.ticket_details.length, 2);
    assert.ok(
      first.ticket_details.every(
        (detail) =>
          detail.plate === "FIRST1" && detail.nickname === "Existing car",
      ),
    );
    const frozen = (
      await db.query(
        "select public.curbside_freeze_email_content($1,$2,$3) as content",
        [
          first.id,
          first.lease,
          { subject: "Frozen original", html: "original", text: "original" },
        ],
      )
    ).rows[0].content;
    const repeated = (
      await db.query(
        "select public.curbside_freeze_email_content($1,$2,$3) as content",
        [
          first.id,
          first.lease,
          { subject: "Changed retry", html: "changed", text: "changed" },
        ],
      )
    ).rows[0].content;
    assert.deepEqual(
      repeated,
      frozen,
      "provider retries must retain exactly the first message",
    );
    assert.equal(
      (await db.query("select * from public.curbside_claim_email_jobs()")).rows
        .length,
      0,
      "active lease cannot double-send",
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_email_job_is_current($1,$2) as ok",
          [first.id, first.lease],
        )
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_finish_email_job($1,$2,false,null,true) as ok",
          [first.id, revision],
        )
      ).rows[0].ok,
      false,
      "stale lease cannot finish",
    );
    await db.query(
      "select public.curbside_finish_email_job($1,$2,false,null,true)",
      [first.id, first.lease],
    );
    await db.exec(
      `reset role;update public.curbside_email_outbox set next_attempt_at=now();set role service_role;`,
    );
    const retry = (
      await db.query("select * from public.curbside_claim_email_jobs()")
    ).rows[0];
    assert.equal(retry.id, first.id);
    assert.equal(retry.ticket_count, 2);
    assert.equal(retry.recipient, first.recipient);
    assert.equal(retry.attempts, 2);
    assert.deepEqual(retry.email_content, frozen);
    await db.query(
      "select public.curbside_finish_email_job($1,$2,true,'accepted-local-only',true)",
      [retry.id, retry.lease],
    );
    await db.exec("reset role;");
    const sent = (await db.query("select * from public.curbside_email_outbox"))
      .rows[0];
    assert.equal(sent.status, "sent");
    assert.equal(sent.recipient, null);
    assert.equal(sent.email_content, null);
    assert.equal(sent.ticket_details, null);
    await finish(db, ["1000000001", "1000000002", "1000000003", "1000000004"]);
    assert.equal(
      await count(db, "curbside_email_outbox"),
      2,
      "later discoveries defer to next daily summary",
    );
    const settings = (
      await db.query(
        "select * from public.curbside_email_settings where user_id=$1",
        [owner],
      )
    ).rows[0];
    await db.exec("set role service_role;");
    await db.query("select public.curbside_unsubscribe_ticket_email($1,$2)", [
      owner,
      revision,
    ]);
    await db.exec("reset role;");
    assert.equal(
      (
        await db.query(
          "select enabled from public.curbside_email_settings where user_id=$1",
          [owner],
        )
      ).rows[0].enabled,
      true,
      "wrong revision cannot opt out",
    );
    await db.exec("set role service_role;");
    await db.query("select public.curbside_unsubscribe_ticket_email($1,$2)", [
      owner,
      settings.revision,
    ]);
    await db.exec("reset role;");
    assert.equal(
      (
        await db.query(
          "select enabled from public.curbside_email_settings where user_id=$1",
          [owner],
        )
      ).rows[0].enabled,
      false,
    );
    assert.equal(
      await count(db, "curbside_email_events"),
      0,
      "opt-out cancels pending events",
    );
    assert.equal(await count(db, "curbside_email_baselines"), 0);
    await db.exec(
      `update public.curbside_email_settings set enabled=true where user_id='${owner}';`,
    );
    await finish(db, [
      "1000000001",
      "1000000002",
      "1000000003",
      "1000000004",
      "1000000005",
    ]);
    assert.equal(
      await count(db, "curbside_email_events"),
      0,
      "re-enable establishes fresh baseline",
    );
    await db.exec(`delete from auth.users where id='${owner}';`);
    for (const table of [
      "curbside_email_settings",
      "curbside_email_outbox",
      "curbside_email_events",
      "curbside_email_baselines",
      "curbside_email_seen",
    ])
      assert.equal(await count(db, table), 0, table);
    assert.equal(
      await count(db, "curbside_vehicles"),
      1,
      "other subscriber preserved",
    );
    assert.equal(
      await count(db, "curbside_vehicle_snapshots"),
      1,
      "shared histories preserved",
    );
  } finally {
    await db.close();
  }
});
