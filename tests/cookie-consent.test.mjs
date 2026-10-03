import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_COOKIE,
  CONSENT_LIFETIME,
  createCookieConsent,
  cookieConsentHeader,
  readCookieConsent,
  analyticsConsentAllowed,
} from "../lib/cookie-consent.ts";
const now = 1_800_000_000_000;
const cookie = (value) =>
  `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`;
test("analytics requires explicit, current consent and respects browser privacy signals", () => {
  assert.equal(analyticsConsentAllowed(null, {}), false);
  assert.equal(
    analyticsConsentAllowed(createCookieConsent(false, now), {}),
    false,
  );
  assert.equal(
    analyticsConsentAllowed(createCookieConsent(true, now), {}),
    true,
  );
  assert.equal(
    analyticsConsentAllowed(createCookieConsent(true, now), {
      globalPrivacyControl: true,
    }),
    false,
  );
  assert.equal(
    analyticsConsentAllowed(createCookieConsent(true, now), {
      doNotTrack: "1",
    }),
    false,
  );
});
test("consent stores acceptance and refusal equally without personal identifiers", () => {
  for (const value of [false, true]) {
    const consent = createCookieConsent(value, now);
    assert.deepEqual(
      readCookieConsent("other=value; " + cookie(consent), now + 1000),
      consent,
    );
    const header = cookieConsentHeader(consent, true);
    assert.match(header, /Path=\/; Max-Age=15552000; SameSite=Lax; Secure$/);
    assert.deepEqual(Object.keys(consent), [
      "version",
      "analytics",
      "decidedAt",
    ]);
  }
  assert.doesNotMatch(
    cookieConsentHeader(createCookieConsent(false, now), false),
    /Secure/,
  );
});
test("missing, cleared, malformed, conflicting, old-purpose, expired and future consent fail closed", () => {
  const valid = createCookieConsent(true, now);
  for (const raw of [
    "",
    `${CONSENT_COOKIE}=%ZZ`,
    cookie({ ...valid, version: "old" }),
    cookie({ ...valid, analytics: "true" }),
    cookie({ ...valid, decidedAt: now + 1 }),
    cookie({ ...valid, decidedAt: now - CONSENT_LIFETIME }),
    `${cookie(valid)}; ${cookie(valid)}`,
  ])
    assert.equal(readCookieConsent(raw, now), null);
  assert.deepEqual(
    readCookieConsent(cookie(valid), now + CONSENT_LIFETIME - 1),
    valid,
  );
  assert.equal(readCookieConsent(cookie(valid), now + CONSENT_LIFETIME), null);
});
