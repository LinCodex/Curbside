import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("Postgres cutover preserves existing accounts and revokes old browser grants including column grants", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth; create table auth.users(id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;`);
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20260930192906_saved_vehicles.sql",
        "utf8",
      ),
    );
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261001182017_account_preferences.sql",
        "utf8",
      ),
    );
    // Exercise the real subscriptions/leases; Vault, pg_net and pg_cron are
    // deployment infrastructure and are intentionally outside this local test.
    const snapshots = fs.readFileSync(
      "supabase/migrations/20261001184032_saved_vehicle_snapshots.sql",
      "utf8",
    );
    await db.exec(
      snapshots.split("-- Dedicated cron credential")[0] + "commit;",
    );
    await db.exec(`
      insert into auth.users values ('193a2604-3ba1-4b61-9e9a-5276512dc001',now(),false),('193a2604-3ba1-4b61-9e9a-5276512dc002',now(),false);
      insert into public.curbside_vehicles(user_id,plate,state,nickname) values ('193a2604-3ba1-4b61-9e9a-5276512dc001','FIRST1','NY','First'),('193a2604-3ba1-4b61-9e9a-5276512dc002','SECOND2','NY','Second'),('193a2604-3ba1-4b61-9e9a-5276512dc002','FIRST1','NY','Shared subscriber');
      update public.curbside_vehicle_snapshots set payload='{"complete":true,"history":["preserved"]}'::jsonb, status='ready' where key='NY:FIRST1:*';
      insert into public.curbside_preferences(user_id,theme) values ('193a2604-3ba1-4b61-9e9a-5276512dc001','light');
      insert into public.curbside_terms_acceptances(user_id,version,accepted_at) values ('193a2604-3ba1-4b61-9e9a-5276512dc001','2026-09-27.1','2026-09-30T12:00:00Z');`);
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261001221612_clerk_accounts.sql",
        "utf8",
      ),
    );
    const cars = await db.query(
      "select plate,user_id from public.curbside_vehicles order by plate",
    );
    assert.equal(cars.rows.length, 3);
    assert.ok(
      cars.rows.some(
        (car) =>
          car.plate === "FIRST1" &&
          car.user_id === "193a2604-3ba1-4b61-9e9a-5276512dc001",
      ),
    );
    assert.equal(
      (await db.query("select theme from public.curbside_preferences")).rows[0]
        .theme,
      "light",
    );
    assert.equal(
      (
        await db.query(
          "select accepted_at from public.curbside_terms_acceptances",
        )
      ).rows[0].accepted_at.toISOString(),
      "2026-09-30T12:00:00.000Z",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      for (const table of [
        "curbside_accounts",
        "curbside_deleted_identities",
        "curbside_vehicles",
        "curbside_preferences",
        "curbside_terms_acceptances",
        "curbside_vehicle_snapshots",
      ])
        await assert.rejects(
          db.query("select * from public." + table),
          /permission denied/,
        );
      await assert.rejects(
        db.query(
          "insert into public.curbside_vehicles(user_id,plate,state,nickname) values ('193a2604-3ba1-4b61-9e9a-5276512dc001','ATTACK','NY','Bad')",
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into public.curbside_deleted_identities(clerk_user_id) values ('user_attack')",
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.curbside_delete_clerk_account('user_one')"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec(
      "set role service_role; update public.curbside_accounts set clerk_user_id='user_one' where id='193a2604-3ba1-4b61-9e9a-5276512dc001'; select public.curbside_delete_clerk_account('user_one'); select public.curbside_delete_clerk_account('user_one'); reset role;",
    );
    assert.deepEqual(
      (
        await db.query(
          "select plate from public.curbside_vehicles order by plate",
        )
      ).rows,
      [{ plate: "FIRST1" }, { plate: "SECOND2" }],
    );
    assert.deepEqual(
      (
        await db.query(
          "select payload from public.curbside_vehicle_snapshots where key='NY:FIRST1:*'",
        )
      ).rows[0].payload,
      { complete: true, history: ["preserved"] },
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_preferences",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_terms_acceptances",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from auth.users")).rows[0].n,
      2,
    );
    await db.exec("set role service_role;");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_deleted_identities where clerk_user_id='user_one'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into public.curbside_accounts(clerk_user_id) values ('user_one')",
      ),
      /identity has been deleted/,
    );
    await assert.rejects(
      db.query(
        "update public.curbside_accounts set clerk_user_id='user_one' where id='193a2604-3ba1-4b61-9e9a-5276512dc002'",
      ),
      /identity has been deleted/,
    );
    const lease = (
      await db.query(
        "select * from public.curbside_claim_snapshots('NY:FIRST1:*')",
      )
    ).rows[0];
    assert.ok(lease.lease);
    assert.equal(
      (
        await db.query(
          "select * from public.curbside_claim_snapshots('NY:FIRST1:*')",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_finish_snapshot($1,gen_random_uuid(),null,false) as finished",
          [lease.key],
        )
      ).rows[0].finished,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select public.curbside_finish_snapshot($1,$2,null,false) as finished",
          [lease.key, lease.lease],
        )
      ).rows[0].finished,
      true,
    );
    const retry = (
      await db.query(
        "select status,next_check_at>now() as delayed,payload from public.curbside_vehicle_snapshots where key=$1",
        [lease.key],
      )
    ).rows[0];
    assert.equal(retry.status, "retry");
    assert.equal(retry.delayed, true);
    assert.deepEqual(retry.payload, { complete: true, history: ["preserved"] });
    await db.exec(
      "delete from public.curbside_accounts where id='193a2604-3ba1-4b61-9e9a-5276512dc002'; reset role;",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_vehicle_snapshots",
        )
      ).rows[0].n,
      0,
    );
    // Execute the checked-in post-cutover SQL regression scripts against this
    // real local database, including all 500 capacity slots and rollback checks.
    for (const script of ["saved-cars.sql", "snapshot-queue.sql"]) {
      const results = await db.exec(
        fs.readFileSync("supabase/tests/" + script, "utf8"),
      );
      assert.match(results.at(-1).rows[0].result, /^PASS:/);
    }
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.curbside_accounts",
        )
      ).rows[0].n,
      0,
    );
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
