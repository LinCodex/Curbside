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
const { validatedEmailInput, crmEmailHtml, crmMessageText } =
  await compile("lib/crm.ts");
const { CRM_TEMPLATES, unfilledPlaceholders } = await compile(
  "lib/crm-templates.ts",
);

test("CRM templates are complete, within limits and flag unfilled fields", () => {
  for (const template of CRM_TEMPLATES)
    for (const language of ["en", "zh"]) {
      const { subject, message } = template.content[language];
      assert.ok(subject && subject.length <= 160 && !/[\r\n]/.test(subject));
      assert.ok(message && message.length <= 10000);
    }
  assert.deepEqual(
    unfilledPlaceholders("On [date] see [docs](/x)\n[button: Go](/) [date]"),
    ["[date]"],
  );
});
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
create table public.curbside_vehicles(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),plate text,state text,plate_type text,nickname text);
create table public.curbside_email_settings(user_id uuid primary key references auth.users(id),enabled boolean default false);
create table public.curbside_email_outbox(user_id uuid,status text);
create table public.curbside_vehicle_snapshots(checked_at timestamptz,plate text,state text,plate_type text,payload jsonb);
create table public.curbside_preferences(user_id uuid,language text);
insert into auth.users(id,email,email_confirmed_at) values('${master}','ylin20001@gmail.com',now()),('${customer}','customer@example.invalid',now());
insert into auth.sessions(id,user_id) values('${session}','${master}'),('${session2}','${customer}');`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003013822_crm_dashboard.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003162622_crm_support_account_actions.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003180000_force_account_actions.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003193000_support_email_reply.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003200001_durable_support_replies.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261011170000_restrict_support_deletes.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261011180000_crm_portal_tools.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261011200000_crm_conversations.sql",
      "utf8",
    ),
  );
  await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261011210000_page_views.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261013172117_crm_customer_session_permissions.sql",
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
test("master can open and manage customer profiles without direct access to auth sessions", async () => {
  const db = await database();
  try {
    await db.query(
      "insert into auth.sessions(id,user_id,not_after) values($1,$2,now()-interval '1 minute')",
      [crypto.randomUUID(), customer],
    );
    await db.exec("set role service_role");
    await assert.rejects(
      db.query("select * from auth.sessions"),
      /permission denied/,
    );
    const listed = await rpc(db, "users", { search: "customer@" });
    assert.equal(listed.users[0].id, customer);
    const detail = await rpc(db, "user", { userId: customer });
    assert.equal(detail.user.email, "customer@example.invalid");
    assert.equal(Number(detail.activity.activeSessions), 1);
    await rpc(db, "notes_save", {
      userId: customer,
      notes: "Support follow-up",
      tags: ["review"],
    });
    const saved = await rpc(db, "user", { userId: customer });
    assert.equal(saved.notes, "Support follow-up");
    assert.deepEqual(saved.tags, ["review"]);
    await assert.rejects(
      rpc(db, "user", { userId: master }, customer, session2),
      /Administrator access/,
    );
    await assert.rejects(
      rpc(db, "user", { userId: customer }, master, session2),
      /session has ended/,
    );
    await assert.rejects(
      db.query("select ticketsafe_private.customer_profile_request($1,$2,$3)", [
        customer, session2, { userId: master },
      ]),
      /Administrator access/,
    );
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(rpc(db, "user", { userId: customer }), /permission denied/);
      await assert.rejects(
        db.query("select ticketsafe_private.customer_profile_request($1,$2,$3)", [
          master, session, { userId: customer },
        ]),
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
      "insert into public.ticketsafe_crm_budget values(current_date,79)",
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
      "campaign share of the provider limit persists",
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
    (
      await handler(
        request(
          '{"action":"stats"}',
          "https://curbside-bdq06p422-yangs-projects-008730dc.vercel.app",
          "bad-token",
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handler(
        request(
          '{"action":"stats"}',
          "https://curbside-yangs-projects-008730dc.vercel.app",
          "bad-token",
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handler(
        request('{"action":"stats"}', "http://localhost:3000", "bad-token"),
      )
    ).status,
    401,
  );
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
          JSON.stringify({ action: "stats", padding: "x".repeat(49000) }),
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

test("CRM email formatting renders a safe subset and plain-text fallbacks", () => {
  const origin = "https://app.example.invalid";
  const html = crmEmailHtml(
    "News",
    "## Hello <b>\n- **one**\n- two\n[docs](https://example.com/a?b=1&c=2) [bad](javascript:alert(1))\n[button: Open garage](/?view=garage)",
    origin,
  );
  assert.ok(html.includes("<h2"));
  assert.ok(html.includes("Hello &lt;b&gt;"));
  assert.ok(html.includes("<li style=\"margin:0 0 6px\"><strong>one</strong></li>"));
  assert.ok(html.includes('href="https://example.com/a?b=1&amp;c=2"'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes(`href="${origin}/?view=garage"`));
  assert.ok(!html.includes("Open TicketSafe"));
  assert.ok(crmEmailHtml("Hi", "Plain", origin).includes("Open TicketSafe"));
  const zh = crmEmailHtml("公告", "您好", origin, "https://u.example.invalid");
  assert.ok(zh.includes('lang="zh-CN"') && zh.includes("退订产品公告"));
  assert.equal(
    crmMessageText("## Hi\n**Bold** [docs](/help)\n[button: Go](/)", origin),
    `Hi\nBold docs (${origin}/help)\nGo: ${origin}/`,
  );
});

test("support messages require the current confirmed profile; CRM inbox is private, rate-limited, and deletable", async () => {
  const db = await database();
  try {
    await assert.rejects(
      rpc(
        db,
        "support_create",
        {
          expectedUserId: master,
          kind: "support",
          subject: "Question",
          message: "Help",
        },
        customer,
        session2,
      ),
      /account changed/,
    );
    await rpc(
      db,
      "support_create",
      {
        expectedUserId: customer,
        kind: "feedback",
        subject: "Suggestion",
        message: "Improve map",
      },
      customer,
      session2,
    );
    await assert.rejects(
      rpc(
        db,
        "support_create",
        {
          expectedUserId: customer,
          kind: "support",
          subject: "Again",
          message: "Too soon",
        },
        customer,
        session2,
      ),
      /Please wait/,
    );
    await assert.rejects(
      rpc(db, "support_messages", {}, customer, session2),
      /Administrator access/,
    );
    const inbox = await rpc(db, "support_messages");
    assert.equal(inbox.total, 1);
    assert.equal(inbox.messages[0].kind, "feedback");
    assert.equal((await rpc(db, "support_messages", { kind: "bug" })).total, 0);
    await rpc(db, "role_set", { userId: customer, role: "support" });
    await assert.rejects(
      rpc(
        db,
        "support_delete",
        { messageId: inbox.messages[0].id },
        customer,
        session2,
      ),
      /Only admins/,
    );
    assert.equal((await rpc(db, "support_messages")).total, 1);
    await assert.rejects(
      rpc(db, "support_delete", { messageId: master }),
      /Message not found/,
    );
    await rpc(db, "support_delete", { messageId: inbox.messages[0].id });
    assert.equal((await rpc(db, "support_messages")).total, 0);
    const audit = (
      await db.query(
        "select actor_id,target_id,detail from public.ticketsafe_crm_audit where action='support_delete'",
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, master);
    assert.equal(audit[0].target_id, customer);
    assert.equal(audit[0].detail.kind, "feedback");
    assert.equal(audit[0].detail.replied, false);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from public.ticketsafe_support_messages"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
test("support email replies stay with CRM staff and keep the original message", async () => {
  const db = await database();
  try {
    await rpc(
      db,
      "support_create",
      {
        expectedUserId: customer,
        kind: "feedback",
        subject: "Suggestion",
        message: "Improve map",
      },
      customer,
      session2,
    );
    const inbox = await rpc(db, "support_messages");
    const messageId = inbox.messages[0].id;
    await assert.rejects(
      rpc(
        db,
        "support_reply",
        { messageId, confirm: true },
        customer,
        session2,
      ),
      /Administrator access/,
    );
    await assert.rejects(
      rpc(db, "support_reply", { messageId }),
      /Confirm this reply first/,
    );
    const prepared = await rpc(db, "support_reply", {
      messageId,
      confirm: true,
    });
    assert.equal(prepared.email, "customer@example.invalid");
    assert.equal(prepared.subject, "Suggestion");
    assert.equal(prepared.message, "Improve map");
    assert.equal(
      (
        await db.query(
          "select attempts from public.ticketsafe_crm_budget where day=current_date",
        )
      ).rows[0].attempts,
      1,
    );
    await rpc(db, "role_set", { userId: customer, role: "support" });
    await rpc(
      db,
      "support_reply_record",
      { messageId, reply: "We can help." },
      customer,
      session2,
    );
    const stored = await rpc(db, "support_messages");
    assert.equal(stored.messages[0].reply, "We can help.");
    assert.ok(stored.messages[0].replied_at);
    await assert.rejects(
      rpc(
        db,
        "account_claim",
        {
          kind: "set_password",
          userId: master,
          confirm: true,
          fingerprint: "blocked",
          idempotencyKey: crypto.randomUUID(),
        },
        customer,
        session2,
      ),
      /Support access/,
    );
  } finally {
    await db.close();
  }
});
test("account actions bind idempotency to content and restrict privileges; test tickets use real snapshots", async () => {
  const db = await database();
  try {
    const input = {
      kind: "reset_password",
      userId: customer,
      confirm: true,
      idempotencyKey: key,
      fingerprint: "a",
    };
    const op = await rpc(db, "account_claim", input);
    assert.equal(op.claimed, true);
    assert.equal((await rpc(db, "account_claim", input)).claimed, false);
    await assert.rejects(
      rpc(db, "account_claim", { ...input, fingerprint: "b" }),
      /different content/,
    );
    await rpc(db, "account_result", {
      operationId: op.operationId,
      status: "completed",
      mailStatus: "accepted",
    });
    assert.equal((await rpc(db, "account_claim", input)).status, "completed");
    await assert.rejects(
      rpc(db, "account_claim", {
        ...input,
        userId: master,
        idempotencyKey: crypto.randomUUID(),
      }),
      /administrator accounts/,
    );
    await assert.rejects(
      rpc(db, "account_claim", {
        ...input,
        kind: "ticket_test",
        idempotencyKey: crypto.randomUUID(),
      }),
      /Select a saved vehicle/,
    );
    const selected = await db.query(
      "insert into public.curbside_vehicles(user_id,plate,state,plate_type,nickname) values($1,'BYEBYE','NY','','Daily') returning id",
      [customer],
    );
    await db.query(
      "insert into public.curbside_vehicles(user_id,plate,state,plate_type) values($1,'OTHER1','NY','')",
      [customer],
    );
    await db.query(
      "insert into public.curbside_vehicle_snapshots(plate,state,plate_type,payload) values('BYEBYE','NY','',$1),('OTHER1','NY','',$2)",
      [
        JSON.stringify({
          tickets: [
            { id: "1485300001", issued: "2025-01-01", description: "Older" },
            {
              id: "1485300002",
              issued: "2026-10-01",
              description: "No standing",
              due: 65,
            },
          ],
        }),
        JSON.stringify({
          tickets: [{ id: "1485300099", issued: "2026-12-01" }],
        }),
      ],
    );
    const ticket = await rpc(db, "account_claim", {
      ...input,
      kind: "ticket_test",
      vehicleId: selected.rows[0].id,
      idempotencyKey: crypto.randomUUID(),
      fingerprint: "selected-car",
    });
    assert.equal(ticket.ticket.id, "1485300002");
    assert.equal(ticket.ticket.plate, "BYEBYE");
    assert.equal(ticket.ticket.nickname, "Daily");
    assert.equal(
      (await db.query("select count(*) n from public.curbside_email_outbox"))
        .rows[0].n,
      0,
    );
    await rpc(db, "role_set", { userId: customer, role: "support" });
    await assert.rejects(
      rpc(
        db,
        "account_claim",
        { ...input, userId: master },
        customer,
        session2,
      ),
      /Support access/,
    );
  } finally {
    await db.close();
  }
});

test("account changes apply immediately and email the customer without repeating a send", async () => {
  const db = await database();
  const sent = [];
  const updates = [];
  const deleted = [];
  let failDelete = false;
  let failReplyRecord = false;
  const sendKeys = [];
  try {
    const client = {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: master,
              email_confirmed_at: "2026-10-01",
              is_anonymous: false,
            },
          },
          error: null,
        }),
        admin: {
          updateUserById: async (id, attrs) => {
            updates.push({ id, attrs });
            return { data: { user: { id } }, error: null };
          },
          deleteUser: async (id) => {
            if (failDelete)
              return { data: {}, error: new Error("Deletion rejected") };
            deleted.push(id);
            return { data: {}, error: null };
          },
        },
      },
      rpc: async (_name, args) => {
        if (args.action === "support_delivery_result" && failReplyRecord) {
          failReplyRecord = false;
          return { data: null, error: new Error("Recording unavailable") };
        }
        try {
          return {
            data: await rpc(
              db,
              args.action,
              args.input,
              args.actor_id,
              args.session_id,
            ),
            error: null,
          };
        } catch (error) {
          return { data: null, error };
        }
      },
    };
    const handler = crmAdminHandler(
      client,
      {
        enabled: "true",
        senderVerified: "true",
        apiKey: "test-not-live",
        from: "service@example.invalid",
        signingSecret: "s".repeat(32),
        appOrigin: "https://app.example.invalid",
        supabaseUrl: "https://db.example.invalid",
      },
      ["https://app.example.invalid"],
      async (_url, options) => {
        const body = JSON.parse(options.body);
        if (/account was deleted/.test(body.subject))
          assert.ok(
            deleted.includes(customer),
            "deletion must succeed before the notice",
          );
        sendKeys.push(options.headers["Idempotency-Key"]);
        sent.push(body);
        assert.ok(!JSON.stringify(body).includes("NewPass1a"));
        return Response.json({ id: "test-provider-id" });
      },
    );
    const token =
      "header." +
      Buffer.from(
        JSON.stringify({ sub: master, session_id: session }),
      ).toString("base64url") +
      ".signature";
    const request = (input) =>
      new Request("https://db.example.invalid/functions/v1/crm-admin", {
        method: "POST",
        headers: {
          Origin: "https://app.example.invalid",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(input),
      });
    const password = await handler(
      request({
        action: "account_action",
        kind: "set_password",
        userId: customer,
        password: "NewPass1a",
        idempotencyKey: key,
        confirm: true,
      }),
    );
    assert.equal(password.status, 200);
    assert.equal((await password.json()).status, "completed");
    assert.equal(updates[0].attrs.password, "NewPass1a");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0], "customer@example.invalid");
    assert.match(sent[0].subject, /password was changed/);
    assert.equal(
      (
        await (
          await handler(
            request({
              action: "account_action",
              kind: "set_password",
              userId: customer,
              password: "NewPass1a",
              idempotencyKey: key,
              confirm: true,
            }),
          )
        ).json()
      ).replayed,
      true,
    );
    assert.equal(sent.length, 1);
    const changed = await handler(
      request({
        action: "account_action",
        kind: "change_email",
        userId: customer,
        newEmail: "next@example.invalid",
        idempotencyKey: crypto.randomUUID(),
        confirm: true,
      }),
    );
    assert.equal((await changed.json()).status, "completed");
    assert.equal(updates.at(-1).attrs.email, "next@example.invalid");
    assert.equal(updates.at(-1).attrs.email_confirm, true);
    assert.deepEqual(
      sent.slice(1).map((message) => message.to[0]),
      ["customer@example.invalid", "next@example.invalid"],
    );
    failDelete = true;
    const beforeFailedDelete = sent.length;
    const failedDelete = await handler(
      request({
        action: "account_action",
        kind: "delete_account",
        userId: customer,
        idempotencyKey: crypto.randomUUID(),
        confirm: true,
      }),
    );
    assert.equal((await failedDelete.json()).status, "review");
    assert.equal(
      sent.length,
      beforeFailedDelete,
      "failed deletion must not send a success notice",
    );
    failDelete = false;
    const removed = await handler(
      request({
        action: "account_action",
        kind: "delete_account",
        userId: customer,
        idempotencyKey: crypto.randomUUID(),
        confirm: true,
      }),
    );
    assert.equal((await removed.json()).status, "completed");
    assert.equal(deleted[0], customer);
    assert.equal(sent.at(-1).to[0], "customer@example.invalid");
    assert.match(sent.at(-1).text, /deleted your TicketSafe account/);
    assert.ok(sent.length > deleted.length);
    const vehicle = await db.query(
      "insert into public.curbside_vehicles(user_id,plate,state,plate_type,nickname) values($1,'BYEBYE','NY','','Daily') returning id",
      [customer],
    );
    await db.query(
      "insert into public.curbside_vehicle_snapshots(plate,state,plate_type,payload) values('BYEBYE','NY','',$1)",
      [
        JSON.stringify({
          tickets: [
            {
              id: "1485300002",
              issued: "2026-10-01",
              description: "No standing",
              due: 65,
            },
          ],
        }),
      ],
    );
    const before = sent.length;
    const ticket = await handler(
      request({
        action: "ticket_test",
        userId: customer,
        vehicleId: vehicle.rows[0].id,
        idempotencyKey: crypto.randomUUID(),
        confirm: true,
      }),
    );
    assert.equal((await ticket.json()).status, "completed");
    assert.equal(
      sent[before].subject,
      "TicketSafe: new tickets for your saved vehicles",
    );
    assert.match(sent[before].text, /1485300002/);
    assert.match(sent[before].text, /BYEBYE/);
    assert.equal(sent[before].to[0], "customer@example.invalid");
    assert.doesNotMatch(sent[before].subject, /TEST/);
    assert.equal(
      (await db.query("select count(*) n from public.curbside_email_outbox"))
        .rows[0].n,
      0,
    );
    await rpc(
      db,
      "support_create",
      {
        expectedUserId: customer,
        kind: "support",
        subject: "Map question",
        message: "Where is the blur?",
      },
      customer,
      session2,
    );
    const inbox = await rpc(db, "support_messages");
    const mailed = sent.length;
    const supportReply = await handler(
      request({
        action: "support_reply",
        messageId: inbox.messages[0].id,
        reply: "The fade lifts at the end of the list.",
        confirm: true,
      }),
    );
    assert.equal((await supportReply.json()).mailStatus, "accepted");
    const body = sent[mailed];
    assert.equal(body.from, "TicketSafe Support <support@ezrefillny.net>");
    assert.equal(body.reply_to, "support@ezrefillny.net");
    assert.equal(body.to[0], "customer@example.invalid");
    assert.equal(body.subject, "Re: Map question");
    assert.match(body.text, /Where is the blur\?/);
    assert.match(body.text, /The fade lifts at the end of the list\./);
    assert.equal(body.from.includes("service@example.invalid"), false);
    const stored = await rpc(db, "support_messages");
    assert.equal(
      stored.messages[0].reply,
      "The fade lifts at the end of the list.",
    );
    const followup = {
      action: "support_reply",
      messageId: inbox.messages[0].id,
      reply: "A second verified reply.",
      confirm: true,
    };
    failReplyRecord = true;
    const first = await handler(request(followup));
    assert.equal(first.status, 503);
    assert.match((await first.json()).error, /needs review/);
    const firstBody = sent.at(-1),
      firstKey = sendKeys.at(-1),
      attempts = sent.length;
    const concurrent = await handler(request(followup));
    assert.equal(concurrent.status, 503);
    assert.equal(
      sent.length,
      attempts,
      "an active lease prevents duplicate concurrent sends",
    );
    await db.exec(
      "update public.ticketsafe_crm_deliveries set support_lease_until=now()-interval '1 second' where status='sending'",
    );
    const retried = await handler(request(followup));
    assert.equal((await retried.json()).mailStatus, "accepted");
    assert.deepEqual(sent.at(-1), firstBody);
    assert.equal(
      sendKeys.at(-1),
      firstKey,
      "reconciliation reuses the provider idempotency key",
    );
    const count = sent.length;
    const replayed = await handler(request(followup));
    assert.equal((await replayed.json()).replayed, true);
    assert.equal(sent.length, count, "a recorded send is never repeated");
    const recorded = (
      await db.query(
        "select provider_id,status from public.ticketsafe_crm_deliveries where support_first_attempt_at is not null order by sent_at desc",
      )
    ).rows[0];
    assert.equal(recorded.provider_id, "test-provider-id");
    assert.equal(recorded.status, "sent");
  } finally {
    await db.close();
  }
});

test("CRM portal tools: inbox status and search, shared templates, activity log and permissions", async () => {
  const db = await database();
  try {
    await rpc(
      db,
      "support_create",
      {
        expectedUserId: customer,
        kind: "bug",
        subject: "Map broken",
        message: "The map is blank",
      },
      customer,
      session2,
    );
    let inbox = await rpc(db, "support_messages", { status: "open" });
    assert.equal(inbox.total, 1);
    assert.equal(inbox.open, 1);
    assert.equal((await rpc(db, "support_messages", { status: "replied" })).total, 0);
    assert.equal((await rpc(db, "support_messages", { search: "CUSTOMER@" })).total, 1);
    assert.equal((await rpc(db, "support_messages", { search: "blank" })).total, 1);
    assert.equal((await rpc(db, "support_messages", { search: "nothing" })).total, 0);
    await db.query(
      "update public.ticketsafe_support_messages set reply='Fixed',replied_at=now()",
    );
    inbox = await rpc(db, "support_messages", { status: "replied" });
    assert.equal(inbox.total, 1);
    assert.equal(inbox.open, 0);

    const saved = await rpc(db, "template_save", {
      kind: "service",
      name: "Hello",
      subject: "Hi",
      message: "Body",
    });
    await rpc(db, "template_save", {
      kind: "service",
      name: "hello",
      subject: "Hi again",
      message: "Body 2",
    });
    let templates = (await rpc(db, "templates")).templates;
    assert.equal(templates.length, 1);
    assert.equal(templates[0].id, saved.id);
    assert.equal(templates[0].subject, "Hi again");
    await assert.rejects(
      rpc(db, "template_save", { kind: "service", name: "Bad", subject: "a\nb", message: "x" }),
      /size limits/,
    );

    await rpc(db, "role_set", { userId: customer, role: "support" });
    assert.equal((await rpc(db, "templates", {}, customer, session2)).templates.length, 1);
    for (const [action, input] of [
      ["template_save", { kind: "service", name: "X", subject: "X", message: "X" }],
      ["template_delete", { templateId: saved.id }],
      ["audit", {}],
      ["delivery_review", {}],
    ])
      await assert.rejects(rpc(db, action, input, customer, session2), /Only admins/);
    assert.equal((await rpc(db, "support_messages", {}, customer, session2)).total, 1);

    await rpc(db, "template_delete", { templateId: saved.id });
    templates = (await rpc(db, "templates")).templates;
    assert.equal(templates.length, 0);
    await assert.rejects(rpc(db, "template_delete", { templateId: saved.id }), /not found/);

    const all = await rpc(db, "audit");
    const actions = all.entries.map((entry) => entry.action);
    assert.ok(actions.includes("template_save") && actions.includes("template_delete"));
    assert.ok(actions.includes("role_set"));
    const access = await rpc(db, "audit", { filter: "access" });
    assert.ok(access.entries.every((entry) => entry.action === "role_set" || entry.action === "role_remove"));
    assert.equal(access.entries[0].actor_email, "ylin20001@gmail.com");
    assert.equal(access.entries[0].target_email, "customer@example.invalid");
  } finally {
    await db.close();
  }
});

test("CRM uncertain deliveries can be settled once, and campaigns keep a reserve for support replies", async () => {
  const db = await database();
  try {
    await rpc(
      db,
      "support_create",
      { expectedUserId: customer, kind: "support", subject: "Q", message: "Help" },
      customer,
      session2,
    );
    const message = (await rpc(db, "support_messages")).messages[0];
    const campaign = (
      await db.query(
        `insert into public.ticketsafe_crm_campaigns(actor_id,idempotency_key,fingerprint,kind,subject,message,support_context)
         values($1,$2,'f','service','Q','Our answer',$3) returning id`,
        [master, key, { messageId: message.id }],
      )
    ).rows[0].id;
    const delivery = (
      await db.query(
        `insert into public.ticketsafe_crm_deliveries(campaign_id,user_id,recipient,status)
         values($1,$2,'customer@example.invalid','sending') returning id`,
        [campaign, customer],
      )
    ).rows[0].id;
    const review = await rpc(db, "delivery_review");
    assert.equal(review.deliveries.length, 1);
    assert.equal(review.deliveries[0].support_reply, true);
    await assert.rejects(
      rpc(db, "delivery_resolve", { deliveryId: delivery, outcome: "sent" }),
      /Confirm/,
    );
    await rpc(db, "delivery_resolve", {
      deliveryId: delivery,
      outcome: "sent",
      confirm: true,
      providerId: "re_123",
    });
    const row = (
      await db.query("select status,provider_id,sent_at from public.ticketsafe_crm_deliveries where id=$1", [delivery])
    ).rows[0];
    assert.equal(row.status, "sent");
    assert.equal(row.provider_id, "re_123");
    assert.ok(row.sent_at);
    assert.equal((await rpc(db, "support_messages")).messages[0].reply, "Our answer");
    await assert.rejects(
      rpc(db, "delivery_resolve", { deliveryId: delivery, outcome: "failed", confirm: true }),
      /no longer needs review/,
    );
    assert.equal((await rpc(db, "delivery_review")).deliveries.length, 0);
    assert.equal((await rpc(db, "audit", { filter: "email" })).entries[0].action, "delivery_resolve");

    await db.query("update auth.users set email_confirmed_at=now()");
    await db.query(
      "insert into public.ticketsafe_announcement_settings(user_id,enabled) values($1,true),($2,true)",
      [master, customer],
    );
    const created = await rpc(db, "email_create", {
      kind: "announcement",
      subject: "News",
      message: "Hello",
      confirm: true,
      idempotencyKey: "a9175af4-e1b0-4510-b261-8db6fdc67302",
      fingerprint: "x",
    });
    await db.query(
      "insert into public.ticketsafe_crm_budget(day,attempts) values(current_date,80) on conflict(day) do update set attempts=80",
    );
    assert.deepEqual(
      (await rpc(db, "email_claim", { campaignId: created.campaignId })).deliveries,
      [],
    );
    const progress = await rpc(db, "email_progress", { campaignId: created.campaignId });
    assert.equal(progress.remaining, 2);
    assert.equal(progress.budgetUsed, 80);
    assert.equal(progress.campaignLimit, 80);
    await db.query("update public.ticketsafe_crm_budget set attempts=79");
    assert.equal(
      (await rpc(db, "email_claim", { campaignId: created.campaignId })).deliveries.length,
      1,
    );
    assert.equal((await rpc(db, "emails")).budgetUsed, 80);
  } finally {
    await db.close();
  }
});

const inbound = async (db, payload) =>
  (await db.query("select public.ticketsafe_crm_inbound($1) r", [payload]))
    .rows[0].r;

test("support messages and email replies become threaded conversations", async () => {
  const db = await database();
  try {
    await rpc(
      db,
      "support_create",
      { expectedUserId: customer, kind: "support", subject: "Map question", message: "Where is the pin?" },
      customer,
      session2,
    );
    let list = await rpc(db, "threads");
    assert.equal(list.total, 1);
    assert.equal(list.needsReply, 1);
    const threadId = list.threads[0].id;
    assert.equal(list.threads[0].kind, "support");
    assert.equal(list.threads[0].unread, true);
    const opened = await rpc(db, "thread", { threadId });
    assert.equal(opened.messages[0].body, "Where is the pin?");
    assert.equal((await rpc(db, "threads")).unread, 0);

    const tokened = await inbound(db, {
      providerId: "recv-1",
      threadId,
      fromEmail: "Customer@Example.invalid",
      fromName: "Pat",
      subject: "Re: Map question",
      body: "Thanks, found it.\n\nOn Mon, TicketSafe wrote:\n> old",
      messageId: "<abc@mail.example>",
      attachments: [{ filename: "shot.png", size: 10, contentType: "image/png" }],
    });
    assert.equal(tokened.threadId, threadId);
    assert.deepEqual(
      await inbound(db, { providerId: "recv-1", fromEmail: "customer@example.invalid", body: "again" }),
      { duplicate: true },
    );
    const grouped = await inbound(db, {
      providerId: "recv-2",
      fromEmail: "customer@example.invalid",
      subject: "RE: Fwd: map question",
      body: "One more thing.",
    });
    assert.equal(grouped.threadId, threadId, "a matching subject from the same sender joins the thread");
    const fresh = await inbound(db, {
      providerId: "recv-3",
      fromEmail: "stranger@example.invalid",
      subject: "回复：Hello",
      body: "Who is this?",
    });
    assert.notEqual(fresh.threadId, threadId);
    list = await rpc(db, "threads", { filter: "all" });
    assert.equal(list.total, 2);
    const stranger = list.threads.find((item) => item.id === fresh.threadId);
    assert.equal(stranger.subject, "Hello");
    assert.equal(stranger.kind, "email");
    assert.equal(stranger.has_account, false);
    const full = await rpc(db, "thread", { threadId });
    assert.equal(full.messages.length, 3);
    assert.equal(full.messages[1].from_email, "customer@example.invalid");
    assert.equal(full.messages[1].attachments[0].filename, "shot.png");
    assert.equal((await rpc(db, "threads", { search: "found it" })).total, 1);

    const key = crypto.randomUUID();
    const prepared = await rpc(db, "thread_reply_prepare", { threadId, reply: "Glad to help.", idempotencyKey: key });
    assert.equal(prepared.recipient, "customer@example.invalid");
    assert.equal(prepared.inReplyTo, "<abc@mail.example>");
    assert.equal(
      (await rpc(db, "thread_reply_prepare", { threadId, reply: "Glad to help.", idempotencyKey: key })).messageId,
      prepared.messageId,
      "the same send key never creates a second reply",
    );
    await assert.rejects(
      rpc(db, "thread_reply_prepare", { threadId, reply: "Different", idempotencyKey: key }),
      /different content/,
    );
    const claim = await rpc(db, "thread_reply_claim", {
      threadId,
      messageId: prepared.messageId,
      content: { subject: "Re: Map question", html: "<p>x</p>", text: "x" },
    });
    assert.equal(claim.claimed, true);
    assert.equal(
      (await rpc(db, "thread_reply_claim", { threadId, messageId: prepared.messageId, content: {} })).status,
      "review",
      "an active lease blocks a duplicate send",
    );
    await rpc(db, "thread_reply_result", { threadId, messageId: prepared.messageId, providerId: "sent-1" });
    assert.equal((await rpc(db, "thread", { threadId })).thread.status, "replied");
    const support = await rpc(db, "support_messages");
    assert.equal(support.messages[0].reply, "Glad to help.");

    await rpc(db, "thread_status", { threadId, status: "closed" });
    assert.equal((await rpc(db, "threads", { filter: "closed" })).total, 1);
    await inbound(db, { providerId: "recv-4", threadId, fromEmail: "customer@example.invalid", body: "Reopen please" });
    assert.equal((await rpc(db, "thread", { threadId })).thread.status, "open");

    await rpc(db, "role_set", { userId: customer, role: "support" });
    assert.equal((await rpc(db, "threads", { filter: "all" }, customer, session2)).total, 2);
    await assert.rejects(
      rpc(db, "thread_delete", { threadId }, customer, session2),
      /Only admins/,
    );
    await rpc(db, "thread_delete", { threadId });
    assert.equal((await rpc(db, "threads", { filter: "all" })).total, 1);
    assert.equal((await rpc(db, "support_messages")).total, 0);
    const audit = await rpc(db, "audit");
    assert.equal(audit.entries[0].action, "thread_delete");
  } finally {
    await db.close();
  }
});

test("thread replies send in-thread with a conversation reply-to address", async () => {
  const db = await database();
  const sent = [];
  try {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: master, email_confirmed_at: "2026-10-01", is_anonymous: false } },
          error: null,
        }),
      },
      rpc: async (_name, args) => {
        try {
          return {
            data: await rpc(db, args.action, args.input, args.actor_id, args.session_id),
            error: null,
          };
        } catch (error) {
          return { data: null, error };
        }
      },
    };
    let fail = true;
    const handler = crmAdminHandler(
      client,
      {
        enabled: "true",
        senderVerified: "true",
        apiKey: "test-not-live",
        from: "service@example.invalid",
        signingSecret: "s".repeat(32),
        appOrigin: "https://app.example.invalid",
        supabaseUrl: "https://db.example.invalid",
        inboundDomain: "reply.example.invalid",
        inboundConfigured: true,
      },
      ["https://app.example.invalid"],
      async (_url, options) => {
        sent.push({ body: JSON.parse(options.body), key: options.headers["Idempotency-Key"] });
        if (fail) {
          fail = false;
          throw new Error("network");
        }
        return Response.json({ id: "provider-" + sent.length });
      },
    );
    const token =
      "header." +
      Buffer.from(JSON.stringify({ sub: master, session_id: session })).toString("base64url") +
      ".signature";
    const request = (input) =>
      new Request("https://db.example.invalid/functions/v1/crm-admin", {
        method: "POST",
        headers: { Origin: "https://app.example.invalid", Authorization: "Bearer " + token },
        body: JSON.stringify(input),
      });
    const { threadId } = await inbound(db, {
      providerId: "recv-10",
      fromEmail: "pat@example.invalid",
      subject: "Refund?",
      body: "Can I get help?",
      messageId: "<m1@example.invalid>",
    });
    const listed = await (await handler(request({ action: "threads" }))).json();
    assert.equal(listed.receiving, true);
    assert.equal(listed.threads[0].id, threadId);
    const draft = { action: "thread_reply", threadId, reply: "**Yes**, here is how.", idempotencyKey: crypto.randomUUID() };
    const failed = await handler(request(draft));
    assert.equal(failed.status, 503);
    const pending = (await rpc(db, "thread", { threadId })).messages.at(-1);
    assert.equal(pending.status, "sending");
    await db.exec("update public.ticketsafe_crm_thread_messages set lease_until=now()-interval '1 second' where status='sending'");
    assert.equal((await rpc(db, "thread", { threadId })).messages.at(-1).needs_review, true);
    const retried = await handler(request({ action: "thread_reply", threadId, retryMessageId: pending.id }));
    assert.equal((await retried.json()).status, "completed");
    assert.equal(sent.length, 2);
    assert.equal(sent[0].key, sent[1].key, "a retry reuses the provider idempotency key");
    const body = sent[1].body;
    assert.deepEqual(body.to, ["pat@example.invalid"]);
    assert.equal(body.reply_to, `support+${threadId}@reply.example.invalid`);
    assert.equal(body.subject, "Re: Refund?");
    assert.equal(body.headers["In-Reply-To"], "<m1@example.invalid>");
    assert.match(body.html, /<strong>Yes<\/strong>/);
    const replayed = await (await handler(request(draft))).json();
    assert.equal(replayed.replayed, true);
    assert.equal(sent.length, 2, "a sent reply is never repeated");
    assert.equal((await rpc(db, "thread", { threadId })).thread.status, "replied");
  } finally {
    await db.close();
  }
});

test("page views are hourly totals plus per-account activity", async () => {
  const db = await database();
  const asUser = (id) =>
    db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`);
  const view = (page) => db.query("select public.ticketsafe_page_view($1)", [page]);
  try {
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
    await view("search");
    await view("nope");
    await asUser(customer);
    await view("map");
    await view("map");
    const rows = (
      await db.query("select page, views, signed_in_views from public.ticketsafe_page_views order by page")
    ).rows;
    assert.deepEqual(
      rows.map((row) => [row.page, Number(row.views), Number(row.signed_in_views)]),
      [
        ["map", 2, 2],
        ["search", 1, 0],
      ],
    );
    const activity = (
      await db.query("select page_views, last_page from public.ticketsafe_customer_activity where user_id=$1", [customer])
    ).rows[0];
    assert.equal(Number(activity.page_views), 2);
    assert.equal(activity.last_page, "map");
    const listed = await rpc(db, "users", { search: "customer@" });
    assert.equal(Number(listed.users[0].page_views), 2);
    const detail = await rpc(db, "user", { userId: customer });
    assert.equal(Number(detail.activity.pageViews), 2);
    assert.equal(detail.activity.lastPage, "map");
    assert.equal(Number(detail.activity.views7d), 2);
    assert.equal(detail.activity.daily.length, 30);
    const week = await rpc(db, "traffic", { range: "week" });
    assert.equal(week.buckets.length, 7);
    assert.equal(Number(week.total), 3);
    assert.equal(Number(week.signedIn), 2);
    assert.equal(week.pages[0].page, "map");
    assert.equal((await rpc(db, "traffic", { range: "day" })).buckets.length, 24);
    assert.equal((await rpc(db, "traffic", { range: "year" })).buckets.length, 12);
    await assert.rejects(rpc(db, "traffic", { range: "decade" }), /day, week, month or year/);
    await assert.rejects(rpc(db, "traffic", {}, customer, session2), /Administrator access/);
  } finally {
    await db.close();
  }
});
