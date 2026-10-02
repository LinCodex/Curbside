import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
const read = (path) => fs.readFileSync(path, "utf8");

test("Supabase schemas preserve existing UUIDs, cars and consent; real RLS isolates profiles and shared histories", async () => {
  const db = new PGlite();
  try {
    // Supabase's auth schema/claim helpers are platform infrastructure. These
    // local fixtures expose the same claim API; JWT validation is separately
    // tested at the account-deletion boundary and handled by Supabase in use.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;`);
    await db.exec(
      read("supabase/migrations/20260930192906_saved_vehicles.sql"),
    );
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
      ('${owner}','one@example.invalid',now()),('${other}','two@example.invalid',now());
      insert into public.curbside_vehicles(user_id,plate,state,nickname) values
      ('${owner}','FIRST1','NY','Original car'),('${other}','FIRST1','NY','Shared subscriber');
      insert into public.curbside_terms_acceptances(user_id,version,accepted_at)
      values('${owner}','2026-09-27.1','2026-09-30T12:00:00Z');`);
    // The host event-trigger helper is unrelated platform DDL infrastructure.
    await db.exec(
      "create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin return; end $$;",
    );
    await db.exec(
      read(
        "supabase/migrations/20261001152705_saved_vehicle_access_hardening.sql",
      ),
    );
    await db.exec(
      read("supabase/migrations/20261001182017_account_preferences.sql"),
    );
    await db.exec(
      `insert into public.curbside_preferences(user_id,theme,language) values('${owner}','dark','zh');`,
    );
    // Exercise actual snapshot triggers and service-only lease RPCs. Vault,
    // outbound HTTP and pg_cron are not available in this isolated database.
    await db.exec(
      read(
        "supabase/migrations/20261001184032_saved_vehicle_snapshots.sql",
      ).split("-- Dedicated cron credential")[0] + "commit;",
    );
    await db.exec(
      read(
        "supabase/migrations/20261001185525_saved_history_followup.sql",
      ).split("select cron.alter_job")[0] + "commit;",
    );
    await db.exec(
      read("supabase/migrations/20261001211000_account_deletion_session.sql"),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_vehicles",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select nickname,user_id from public.curbside_vehicles where user_id=$1",
          [owner],
        )
      ).rows[0].nickname,
      "Original car",
    );
    assert.equal(
      (
        await db.query(
          "select accepted_at from public.curbside_terms_acceptances where user_id=$1",
          [owner],
        )
      ).rows[0].accepted_at.toISOString(),
      "2026-09-30T12:00:00.000Z",
    );
    assert.equal(
      (
        await db.query(
          "select theme,language from public.curbside_preferences where user_id=$1",
          [owner],
        )
      ).rows[0].language,
      "zh",
    );
    const fk = (
      await db.query(
        "select confrelid::regclass::text as parent from pg_constraint where conname='curbside_vehicles_user_id_fkey'",
      )
    ).rows[0];
    assert.equal(fk.parent, "auth.users");

    const saved = await db.exec(read("supabase/tests/saved-cars.sql"));
    assert.equal(saved.at(-1).rows[0].fixtures_rolled_back, true);
    assert.equal(saved.at(-1).rows[0].rls_enabled, true);
    // Only the Vault credential check is omitted locally; all real queue,
    // browser privilege, capacity and last-subscriber tests run unchanged.
    const queue = read("supabase/tests/snapshot-queue.sql").replace(
      /^\s*if public\.curbside_verify_snapshot_cron\(repeat\('x',64\)\).*$/m,
      "",
    );
    assert.match((await db.exec(queue)).at(-1).rows[0].result, /^PASS:/);

    await db.exec(`insert into auth.sessions values('${session}','${owner}',now()+interval '1 hour');
      set role authenticated;`);
    await assert.rejects(
      db.query("select public.curbside_can_delete_account($1,$2)", [
        owner,
        session,
      ]),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role;");
    assert.equal(
      (
        await db.query(
          "select public.curbside_can_delete_account($1,$2) as allowed",
          [owner, session],
        )
      ).rows[0].allowed,
      true,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_can_delete_account($1,$2) as allowed",
          [other, session],
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec("reset role;");
    for (const authState of [
      "email_confirmed_at=null",
      "email_confirmed_at=now(),is_anonymous=true",
    ]) {
      await db.exec(
        `update auth.users set ${authState} where id='${owner}'; set role service_role;`,
      );
      assert.equal(
        (
          await db.query(
            "select public.curbside_can_delete_account($1,$2) as allowed",
            [owner, session],
          )
        ).rows[0].allowed,
        false,
      );
      await db.exec("reset role;");
    }
    await db.exec(
      `update auth.users set email_confirmed_at=now(),is_anonymous=false where id='${owner}';
       update auth.sessions set not_after=now()-interval '1 second' where id='${session}'; set role service_role;`,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_can_delete_account($1,$2) as allowed",
          [owner, session],
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec(
      `reset role; delete from auth.sessions where id='${session}'; set role service_role;`,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_can_delete_account($1,$2) as allowed",
          [owner, session],
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec(`reset role; update public.curbside_vehicle_snapshots set payload='{"history":["retained"]}' where key='NY:FIRST1:*';
      delete from auth.users where id='${owner}';`);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_preferences where user_id=$1",
          [owner],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_terms_acceptances where user_id=$1",
          [owner],
        )
      ).rows[0].n,
      0,
    );
    assert.deepEqual(
      (
        await db.query(
          "select payload from public.curbside_vehicle_snapshots where key='NY:FIRST1:*'",
        )
      ).rows[0].payload,
      { history: ["retained"] },
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_vehicles where user_id=$1",
          [other],
        )
      ).rows[0].n,
      1,
    );
    await db.exec(`delete from auth.users where id='${other}';`);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_vehicle_snapshots",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
