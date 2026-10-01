import test from "node:test";
import assert from "node:assert/strict";
import { publicAnalyticsURL } from "../lib/analytics-privacy.ts";
import { verifyHCaptcha } from "../lib/captcha-verification.ts";
test("analytics only allowlists public routes and strips plate, email, invite and ticket data", () => {
  assert.equal(
    publicAnalyticsURL(
      "https://example.com/?view=search&plate=SECRET1&email=private@example.com&invite=private",
    ),
    "https://example.com/?view=search",
  );
  assert.equal(
    publicAnalyticsURL("https://example.com/?view=ticket&summons=private"),
    "https://example.com/",
  );
  for (const path of [
    "/api/evidence?id=private",
    "/vehicle/SECRET1",
    "/?auth=recovery",
    "/?code=private",
    "/#access_token=private",
  ])
    assert.equal(publicAnalyticsURL("https://example.com" + path), null);
  assert.equal(
    publicAnalyticsURL("https://example.com/legal/privacy?unknown=private"),
    "https://example.com/legal/privacy",
  );
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
