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
create table public.curbside_vehicles(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),plate text,state text,plate_type text);
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
    await rpc(db, "support_delete", { messageId: inbox.messages[0].id });
    assert.equal((await rpc(db, "support_messages")).total, 0);
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
      /No saved ticket/,
    );
    await db.query(
      "insert into public.curbside_vehicles(user_id,plate,state,plate_type) values($1,'BYEBYE','NY','')",
      [customer],
    );
    const tickets = [
      { id: "older", issued: "2025-01-01" },
      { id: "latest", issued: "2026-10-01" },
    ];
    await db.query(
      "insert into public.curbside_vehicle_snapshots(plate,state,plate_type,payload) values('BYEBYE','NY','',$1)",
      [JSON.stringify({ tickets })],
    );
    const ticket = await rpc(db, "account_claim", {
      ...input,
      kind: "ticket_test",
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(ticket.ticket.id, "latest");
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

test("account reset sends verification without exposing links or repeating a provider send",async()=>{
 const db=await database();let sends=0,generated=0;
 try {
  const client={auth:{getUser:async()=>({data:{user:{id:master,email_confirmed_at:"2026-10-01",is_anonymous:false}},error:null}),admin:{generateLink:async input=>{generated++;assert.equal(input.type,"recovery");return {data:{properties:{action_link:"https://db.example.invalid/auth/v1/verify?token=private"}},error:null}}}},rpc:async(_name,args)=>{try{return {data:await rpc(db,args.action,args.input,args.actor_id,args.session_id),error:null}}catch(error){return {data:null,error}}}};
  const handler=crmAdminHandler(client,{enabled:"true",senderVerified:"true",apiKey:"test-not-live",from:"service@example.invalid",signingSecret:"s".repeat(32),appOrigin:"https://app.example.invalid",supabaseUrl:"https://db.example.invalid"},["https://app.example.invalid"],async(_url,options)=>{sends++;assert.equal(JSON.parse(options.body).to[0],"customer@example.invalid");return Response.json({id:"test-provider-id"})});
  const token="header."+Buffer.from(JSON.stringify({sub:master,session_id:session})).toString("base64url")+".signature";
  const input={action:"account_action",kind:"reset_password",userId:customer,idempotencyKey:key,confirm:true,notify:true};
  const request=()=>new Request("https://db.example.invalid/functions/v1/crm-admin",{method:"POST",headers:{Origin:"https://app.example.invalid",Authorization:"Bearer "+token},body:JSON.stringify(input)});
  const response=await handler(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,"completed");assert.equal(body.verificationPending,true);assert.ok(!JSON.stringify(body).includes("token=private"));assert.equal(sends,2);assert.equal(generated,1);
  assert.equal((await (await handler(request())).json()).replayed,true);assert.equal(sends,2);assert.equal(generated,1);
  assert.equal((await db.query("select attempts from public.ticketsafe_crm_budget")).rows[0].attempts,2);
 }finally{await db.close();}
});
