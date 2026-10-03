import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
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
const { crmAdminHandler } = await compile(
  "supabase/functions/crm-admin/handler.ts",
);
const { validatedEmailInput, crmEmailHtml } = await compile("lib/crm.ts");
const master = "a9175af4-e1b0-4510-b261-8db6fdc67101",
  customer = "a9175af4-e1b0-4510-b261-8db6fdc67102",
  session = "a9175af4-e1b0-4510-b261-8db6fdc67201",
  session2 = "a9175af4-e1b0-4510-b261-8db6fdc67202",
  key = "a9175af4-e1b0-4510-b261-8db6fdc67301";
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;grant usage on schema auth,public to service_role,authenticated,anon;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,created_at timestamptz default now(),last_sign_in_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
create table public.curbside_vehicles(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),plate text);
create table public.curbside_email_settings(user_id uuid primary key references auth.users(id),enabled boolean default false);
create table public.curbside_email_outbox(user_id uuid,status text);
create table public.curbside_vehicle_snapshots(checked_at timestamptz);
insert into auth.users(id,email,email_confirmed_at) values('${master}','ylin20001@gmail.com',now()),('${customer}','customer@example.invalid',now());
insert into auth.sessions(id,user_id) values('${session}','${master}'),('${session2}','${customer}');`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003013822_crm_dashboard.sql",
      "utf8",
    ),
  );
  return db;
}
async function rpc(db, action, input = {}, actor = master, sid = session) {
  return (
    await db.query("select public.ticketsafe_crm_request($1,$2,$3,$4) result", [
      actor,
      sid,
      action,
      input,
    ])
  ).rows[0].result;
}
test("CRM access is bound to live sessions and immutable verified master; roles revoke immediately", async () => {
  const db = await database();
  try {
    assert.equal((await rpc(db, "me")).admin.role, "master");
    await assert.rejects(
      rpc(db, "stats", {}, customer, session2),
      /Administrator access/,
    );
    await assert.rejects(
      rpc(db, "role_remove", { userId: master }),
      /Master access/,
    );
    await rpc(db, "role_set", { userId: customer, role: "support" });
    assert.equal(
      (await rpc(db, "me", {}, customer, session2)).admin.role,
      "support",
    );
    await assert.rejects(
      rpc(
        db,
        "role_set",
        { userId: master, role: "admin" },
        customer,
        session2,
      ),
      /Only the master/,
    );
    await rpc(db, "role_remove", { userId: customer });
    await assert.rejects(
      rpc(db, "stats", {}, customer, session2),
      /Administrator access/,
    );
    await db.exec(`delete from auth.sessions where id='${session}';`);
    await assert.rejects(rpc(db, "me"), /session has ended/);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(rpc(db, "stats"), /permission denied/);
      await assert.rejects(
        db.query("select * from public.ticketsafe_crm_roles"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
test("CRM presence is bounded and announcement consent is independent of ticket alerts", async () => {
  const db = await database();
  try {
    await db.exec(
      `insert into public.curbside_email_settings values('${customer}',true);`,
    );
    assert.equal(
      (await rpc(db, "announcement_preferences", {}, customer, session2))
        .enabled,
      false,
    );
    await assert.rejects(
      rpc(
        db,
        "announcement_preferences_save",
        { enabled: true, expectedUserId: master },
        customer,
        session2,
      ),
      /account changed/,
    );
    await rpc(
      db,
      "announcement_preferences_save",
      { enabled: true, expectedUserId: customer },
      customer,
      session2,
    );
    await rpc(db, "presence", {}, customer, session2);
    const first = (
      await db.query("select last_seen_at from public.ticketsafe_crm_presence")
    ).rows[0].last_seen_at;
    await rpc(db, "presence", {}, customer, session2);
    assert.equal(
      (
        await db.query(
          "select last_seen_at from public.ticketsafe_crm_presence",
        )
      ).rows[0].last_seen_at.getTime(),
      first.getTime(),
    );
    assert.equal((await rpc(db, "stats")).onlineUsers, 1);
    assert.equal(
      (await rpc(db, "email_preview", { kind: "announcement" })).recipientCount,
      1,
    );
    const setting = (
      await db.query(
        `select revision from public.ticketsafe_announcement_settings where user_id='${customer}'`,
      )
    ).rows[0];
    await rpc(
      db,
      "announcement_preferences_save",
      { enabled: true, expectedUserId: customer },
      customer,
      session2,
    );
    assert.equal(
      (
        await db.query(
          "select ticketsafe_unsubscribe_announcement($1,$2) result",
          [customer, setting.revision],
        )
      ).rows[0].result,
      false,
      "old links cannot remove a later opt-in",
    );
    assert.equal(
      (await rpc(db, "announcement_preferences", {}, customer, session2))
        .enabled,
      true,
    );
  } finally {
    await db.close();
  }
});
test("CRM delivery claims enforce durable caps, consent checks and idempotency without replaying ambiguous sends", async () => {
  const db = await database();
  try {
    await rpc(
      db,
      "announcement_preferences_save",
      { enabled: true, expectedUserId: customer },
      customer,
      session2,
    );
    const input = {
      kind: "announcement",
      subject: "Update",
      message: "Announcement",
      fingerprint: "synthetic-fingerprint",
      idempotencyKey: key,
      confirm: true,
    };
    const created = await rpc(db, "email_create", input);
    assert.equal(
      (await rpc(db, "email_create", input)).campaignId,
      created.campaignId,
    );
    await assert.rejects(
      rpc(db, "email_create", { ...input, fingerprint: "different" }),
      /different content/,
    );
    await db.exec(
      "insert into public.ticketsafe_crm_budget values(current_date,99)",
    );
    const claim = await rpc(db, "email_claim", created);
    assert.equal(claim.deliveries.length, 1);
    assert.equal(
      (await rpc(db, "email_claim", created)).deliveries.length,
      0,
      "uncertain delivery never gets reclaimed",
    );
    assert.equal((await rpc(db, "email_progress", created)).status, "review");
    await rpc(db, "email_result", {
      deliveryId: claim.deliveries[0].id,
      status: "sent",
      providerId: "synthetic-id",
    });
    assert.equal((await rpc(db, "email_progress", created)).sent, 1);
    await rpc(db, "email_result", {
      deliveryId: claim.deliveries[0].id,
      status: "failed",
    });
    assert.equal(
      (await rpc(db, "email_progress", created)).sent,
      1,
      "completed delivery immutable on repeated callbacks",
    );
    const second = await rpc(db, "email_create", {
      ...input,
      idempotencyKey: "a9175af4-e1b0-4510-b261-8db6fdc67302",
    });
    assert.equal(
      (await rpc(db, "email_claim", second)).deliveries.length,
      0,
      "global provider limit persists",
    );
    await db.exec("update public.ticketsafe_crm_budget set attempts=0");
    await rpc(
      db,
      "announcement_preferences_save",
      { enabled: false, expectedUserId: customer },
      customer,
      session2,
    );
    assert.equal(
      (await rpc(db, "email_claim", second)).deliveries.length,
      0,
      "withdrawn consent cancelled before provider call",
    );
  } finally {
    await db.close();
  }
});
test("CRM edge rejects foreign origins, invalid sessions and oversized bodies before privileged work", async () => {
  let auth = 0,
    rpcs = 0;
  const client = {
    auth: {
      getUser: async () => {
        auth++;
        return {
          data: {
            user: {
              id: master,
              email_confirmed_at: "2026-10-01",
              is_anonymous: false,
            },
          },
          error: null,
        };
      },
    },
    rpc: async () => {
      rpcs++;
      return { data: { admin: { role: "master" } }, error: null };
    },
  };
  const handler = crmAdminHandler(
    client,
    { appOrigin: "https://app.example.invalid" },
    ["https://app.example.invalid"],
  );
  const token =
    "header." +
    Buffer.from(JSON.stringify({ sub: master, session_id: session })).toString(
      "base64url",
    ) +
    ".signature";
  const request = (body, origin = "https://app.example.invalid", jwt = token) =>
    new Request("https://db.example.invalid/functions/v1/crm-admin", {
      method: "POST",
      headers: { Origin: origin, Authorization: "Bearer " + jwt },
      body,
    });
  assert.equal(
    (
      await handler(
        request('{"action":"stats"}', "https://evil.example.invalid"),
      )
    ).status,
    403,
  );
  assert.equal(auth, 0);
  assert.equal(
    (await handler(request('{"action":"stats"}', undefined, "bad-token")))
      .status,
    401,
  );
  assert.equal(rpcs, 0);
  assert.equal(
    (
      await handler(
        request(
          JSON.stringify({ action: "stats", padding: "x".repeat(21000) }),
        ),
      )
    ).status,
    413,
  );
  assert.equal(rpcs, 0);
  assert.equal((await handler(request('{"action":"me"}'))).status, 200);
  assert.equal(rpcs, 1);
});
test("CRM email inputs reject header injection and templates escape administrator content", () => {
  assert.throws(() =>
    validatedEmailInput({
      kind: "service",
      userId: customer,
      subject: "Hello\r\nBcc: x",
      message: "Hi",
    }),
  );
  assert.throws(() =>
    validatedEmailInput({ kind: "service", subject: "Hello", message: "Hi" }),
  );
  const html = crmEmailHtml(
    '<img src=x onerror="x">',
    "<script>alert(1)</script>\nHello",
    "https://app.example.invalid",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("TicketSafe"));
});
