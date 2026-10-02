import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../lib/client-ip.ts";
import { BoundedCache } from "../lib/ttl-cache.ts";
import { preferenceKey } from "../lib/preferences.ts";
test("Vercel ignores attacker-selected Cloudflare and real-IP headers", () => {
  for (const fake of ["1.1.1.1", "8.8.8.8"]) {
    const headers = new Headers({
      "cf-connecting-ip": fake,
      "x-real-ip": fake,
      "x-forwarded-for": fake,
      "x-vercel-forwarded-for": "203.0.113.1",
    });
    assert.equal(clientIp(headers, "vercel"), "203.0.113.1");
    assert.equal(clientIp(headers, "cloudflare"), fake);
  }
  assert.equal(
    clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "1.1.1.1" }), "vercel"),
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
