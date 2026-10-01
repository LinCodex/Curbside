import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { clientIp } from "../lib/client-ip.ts";
import { BoundedCache } from "../lib/ttl-cache.ts";
import { preferenceKey } from "../lib/preferences.ts";
import {
  EVIDENCE_ADMISSION,
  EVIDENCE_UPDATE,
  RECEIPT_UPDATE,
} from "../lib/evidence-admission.ts";

test("Vercel ignores attacker-selected Cloudflare and real-IP headers", () => {
  for (const fake of ["1.1.1.1", "8.8.8.8"]) {
    const headers = new Headers({
      "cf-connecting-ip": fake,
      "x-real-ip": fake,
      "x-forwarded-for": "203.0.113.1",
    });
    assert.equal(clientIp(headers, "vercel"), "203.0.113.1");
    assert.equal(clientIp(headers, "cloudflare"), fake);
  }
  assert.equal(
    clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1" }), "vercel"),
    "unknown",
  );
});
test("cache evicts expired and oldest entries without caching oversized payloads", () => {
  const cache = new BoundedCache(2, 10);
  cache.set("a", "A", 10, 5, 0);
  cache.set("b", "B", 100, 5, 0);
  cache.set("c", "C", 100, 5, 11);
  assert.equal(cache.get("a", 11), null);
  assert.equal(cache.get("b", 11), "B");
  cache.set("d", "D", 100, 6, 11);
  assert.equal(cache.get("b", 11), null);
  assert.equal(cache.get("c", 11), null);
  assert.equal(cache.get("d", 11), "D");
  cache.set("huge", "H", 100, 11, 11);
  assert.equal(cache.get("huge", 11), null);
});
test("guest and different profile preference keys cannot collide", () => {
  assert.notEqual(preferenceKey(), preferenceKey("account-a"));
  assert.notEqual(preferenceKey("account-a"), preferenceKey("account-b"));
});
function database() {
  const d = new DatabaseSync(":memory:");
  for (const file of fs
    .readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    d.exec(fs.readFileSync("drizzle/" + file, "utf8"));
  d.prepare(
    "INSERT INTO cases(id,owner_id,vehicle_id,summons,created_at,updated_at) VALUES('case','owner','car','ticket',1,1)",
  ).run();
  return d;
}
function admit(
  d,
  {
    id,
    size = 1,
    version = 1,
    status = "draft",
    actor = "owner",
    receipt = false,
  },
) {
  d.exec("BEGIN");
  const inserted = d
    .prepare(EVIDENCE_ADMISSION)
    .run(
      id,
      id,
      "file.pdf",
      "application/pdf",
      size,
      "hash",
      1,
      "case",
      version,
      status,
      +receipt,
      actor,
      +receipt,
      actor,
      size,
    );
  if (receipt) d.prepare(RECEIPT_UPDATE).run(id, 2, "case", id);
  else d.prepare(EVIDENCE_UPDATE).run(2, "case", id);
  d.exec("COMMIT");
  return inserted.changes;
}
test("competing upload snapshots admit one file and never regress case stages", () => {
  const d = database();
  assert.equal(admit(d, { id: "a" }), 1);
  assert.equal(admit(d, { id: "b" }), 0);
  d.prepare(
    "UPDATE cases SET status='accepted',partner_id='partner' WHERE id='case'",
  ).run();
  assert.equal(admit(d, { id: "late", version: 2 }), 0);
  assert.equal(d.prepare("SELECT status FROM cases").get().status, "accepted");
  assert.equal(
    admit(d, { id: "wrong", receipt: true, version: 2, status: "accepted" }),
    0,
  );
  assert.equal(
    admit(d, {
      id: "receipt",
      receipt: true,
      actor: "partner",
      version: 2,
      status: "accepted",
    }),
    1,
  );
  assert.equal(
    d.prepare("SELECT receipt_key FROM cases").get().receipt_key,
    "receipt",
  );
  d.close();
});
test("commit-time byte and count quotas reject fresh and stale concurrent snapshots", () => {
  const d = database();
  assert.equal(admit(d, { id: "one", size: 10 * 1024 * 1024 }), 1);
  assert.equal(admit(d, { id: "two", size: 10 * 1024 * 1024, version: 2 }), 1);
  assert.equal(admit(d, { id: "over", version: 3 }), 0);
  d.exec("DELETE FROM evidence; UPDATE cases SET version=1");
  for (let i = 0; i < 10; i++)
    assert.equal(admit(d, { id: "file" + i, version: i + 1 }), 1);
  assert.equal(admit(d, { id: "eleven", version: 11 }), 0);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM evidence").get().n, 10);
  d.close();
});
test("phone verification compare-and-set cannot confirm a replaced number", () => {
  const d = database();
  d.prepare(
    "INSERT INTO users(id,email,phone,created_at) VALUES('user','email','+12125550100',1)",
  ).run();
  d.prepare(
    "UPDATE users SET phone='+12125550101',phone_verified=0,sms_consent=0 WHERE id='user'",
  ).run();
  const sql =
    "UPDATE users SET phone_verified=1,sms_consent=1,sms_stopped=0 WHERE id=? AND phone=?";
  assert.equal(d.prepare(sql).run("user", "+12125550100").changes, 0);
  assert.equal(
    d.prepare("SELECT phone_verified FROM users WHERE id='user'").get()
      .phone_verified,
    0,
  );
  assert.equal(d.prepare(sql).run("user", "+12125550101").changes, 1);
  d.close();
});
