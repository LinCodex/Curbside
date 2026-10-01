import test from "node:test";
import assert from "node:assert/strict";
import { verifyHCaptcha } from "../lib/captcha-verification.ts";
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
