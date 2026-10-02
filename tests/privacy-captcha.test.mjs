import test from "node:test";
import assert from "node:assert/strict";
import { verifyHCaptcha } from "../lib/captcha-verification.ts";
import {
  publicAnalyticsURL,
  privateAnalyticsEvent,
} from "../lib/analytics-privacy.ts";

test("analytics allowlists public pages and strips plates, emails and ticket queries", () => {
  assert.equal(
    publicAnalyticsURL(
      "https://example.com/?view=search&plate=SECRET1&email=private@example.com&invite=private",
    ),
    "https://example.com/?view=search",
  );
  assert.equal(
    publicAnalyticsURL("https://example.com/?view=map&summons=private"),
    "https://example.com/?view=map",
  );
  assert.equal(
    publicAnalyticsURL("https://example.com/legal/privacy?unknown=private"),
    "https://example.com/legal/privacy",
  );
  for (const path of [
    "/",
    "/?plate=SECRET1",
    "/legal/messaging",
    "/legal/billing",
    "/?view=account",
    "/?view=garage",
    "/?view=ticket&summons=private",
    "/api/evidence?id=private",
    "/vehicle/SECRET1",
    "/sign-in",
    "/sign-up",
    "/?auth=recovery",
    "/?code=private",
    "/?access_token=private",
    "/#access_token=private",
  ])
    assert.equal(publicAnalyticsURL("https://example.com" + path), null);
  assert.equal(publicAnalyticsURL("https://user:secret@example.com/"), null);
  assert.equal(publicAnalyticsURL("file:///private"), null);
});

test("analytics respects GPC/DNT and rejects custom events", () => {
  const event = {
    type: "pageview",
    url: "https://example.com/?view=search&plate=SECRET1",
  };
  assert.deepEqual(privateAnalyticsEvent(event, {}), {
    type: "pageview",
    url: "https://example.com/?view=search",
  });
  assert.equal(privateAnalyticsEvent(event, { doNotTrack: "1" }), null);
  assert.equal(
    privateAnalyticsEvent(event, { globalPrivacyControl: true }),
    null,
  );
  assert.equal(privateAnalyticsEvent({ ...event, type: "event" }, {}), null);
});
test("hCaptcha requires server success, binds sitekey and never accepts an empty token", async () => {
  let called = false;
  const send = async (url, options) => {
    called = true;
    assert.equal(url, "https://api.hcaptcha.com/siteverify");
    assert.equal(options.body.get("sitekey"), "unit-site");
    assert.equal(options.body.get("response"), "unit-token");
    assert.equal(options.body.get("remoteip"), "203.0.113.1");
    return Response.json({ success: true });
  };
  const input = {
    secret: "unit-secret",
    sitekey: "unit-site",
    token: "unit-token",
    ip: "203.0.113.1",
  };
  assert.equal(await verifyHCaptcha({ ...input, token: "" }, send), false);
  assert.equal(called, false);
  assert.equal(await verifyHCaptcha(input, send), true);
  for (const success of [false, "true", undefined])
    assert.equal(
      await verifyHCaptcha(input, async () => Response.json({ success })),
      false,
    );
});
