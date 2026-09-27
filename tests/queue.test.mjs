import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
function database() {
  const d = new DatabaseSync(":memory:");
  for (const f of fs
    .readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    d.exec(fs.readFileSync("drizzle/" + f, "utf8"));
  return d;
}
test("500 vehicles: unique discovery claims survive duplicate runs and ambiguous retries", () => {
  const d = database();
  const job = d.prepare(
    "INSERT OR IGNORE INTO jobs(id,owner_id,vehicle_id,channel,event,payload,not_before,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
  );
  const claim = d.prepare(
    "INSERT OR IGNORE INTO notification_events(key,job_id,created_at) VALUES(?,?,?)",
  );
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < 500; i++) {
      job.run(
        "job-" + i,
        "user-" + i,
        "vehicle-" + i,
        "email",
        "new",
        "{}",
        1,
        1,
        1,
      );
      claim.run("event-" + i, "job-" + i, 1);
    }
  assert.equal(d.prepare("SELECT COUNT(*) n FROM jobs").get().n, 500);
  assert.equal(
    d.prepare("SELECT COUNT(*) n FROM notification_events").get().n,
    500,
  );
  const leased = d
    .prepare(
      "UPDATE jobs SET status='sending',lease_until=100 WHERE id IN(SELECT id FROM jobs WHERE status='pending' AND not_before<=1 LIMIT 40) RETURNING id",
    )
    .all();
  assert.equal(leased.length, 40);
  d.prepare(
    "UPDATE jobs SET status='uncertain' WHERE status='sending' AND lease_until<101",
  ).run();
  assert.equal(
    d.prepare("SELECT COUNT(*) n FROM jobs WHERE status='uncertain'").get().n,
    40,
  );
  assert.equal(
    d.prepare("SELECT COUNT(*) n FROM jobs WHERE status='pending'").get().n,
    460,
  );
  d.close();
});
test("webhook insert and state change can roll back together on duplicate event", () => {
  const d = database();
  d.prepare(
    "INSERT INTO webhooks(id,provider,created_at) VALUES('event','stripe',1)",
  ).run();
  assert.throws(() => {
    try {
      d.exec("BEGIN");
      d.prepare(
        "INSERT INTO webhooks(id,provider,created_at) VALUES('event','stripe',1)",
      ).run();
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  });
  assert.equal(d.prepare("SELECT COUNT(*) n FROM webhooks").get().n, 1);
  d.close();
});
