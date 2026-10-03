import test from "node:test";
import assert from "node:assert/strict";
import { beginEmailConfirmation, confirmationOutcome, parseConfirmationCallback, snapshotEmailConfirmation, pendingEmailConfirmation, readConfirmationEvidence, CONFIRMATION_KEY } from "../lib/email-confirmation.ts";

const requestId = "a9886316-01ba-43fd-8861-5ebd2c00b010";
const callback = { requestId, errorCode: "", hasCredentials: true, supported: true };
const user = { id: "account-a", email: "owner@example.com", email_confirmed_at: "2026-10-02T00:00:00Z", is_anonymous: false };
const pending = { requestId, email: user.email, createdAt: Date.now() };
const receipt = { requestId, userId: user.id, createdAt: Date.now() };

test("confirmation requires a server-verified confirmed account, not callback credentials alone", () => {
  assert.equal(confirmationOutcome(callback, null, pending, null), "unavailable");
  assert.equal(confirmationOutcome(callback, { ...user, email_confirmed_at: null }, pending, null), "unavailable");
  assert.equal(confirmationOutcome(callback, { ...user, is_anonymous: true }, pending, null), "unavailable");
  assert.equal(confirmationOutcome(callback, user, pending, null), "verified");
});

test("a different signed-in account cannot verify the pending email", () => {
  assert.equal(confirmationOutcome(callback, { ...user, id: "account-b", email: "other@example.com" }, pending, null), "unavailable");
});

test("used and expired Supabase links remain ambiguous without evidence", () => {
  const expired = { ...callback, errorCode: "otp_expired", hasCredentials: false };
  assert.equal(confirmationOutcome(expired, null, pending, null), "unavailable");
  assert.equal(confirmationOutcome(expired, null, pending, receipt), "already");
  assert.equal(confirmationOutcome(expired, user, pending, null), "already");
  assert.equal(confirmationOutcome(expired, { ...user, id: "account-b", email: "other@example.com" }, pending, receipt), "unavailable");
  assert.equal(confirmationOutcome(expired, null, pending, { ...receipt, requestId: "another-request" }), "unavailable");
  assert.equal(confirmationOutcome(expired, null, pending, { ...receipt, userId: "" }), "unavailable");
});

test("recovery and email-change links are never processed as signup confirmation", () => {
  for (const type of ["recovery", "email_change", "magiclink"]) {
    const result = parseConfirmationCallback(`https://example.com/auth/confirm?request=${requestId}#access_token=secret&type=${type}`);
    assert.equal(confirmationOutcome(result, user, pending, receipt), "unavailable");
  }
});

test("callback parsing exposes status only, and validates correlation IDs", () => {
  const result = parseConfirmationCallback(`https://example.com/auth/confirm?request=${requestId}#access_token=private&refresh_token=private&type=signup`);
  assert.deepEqual(result, callback);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(parseConfirmationCallback("https://example.com/auth/confirm?request=bad#error=access_denied&error_code=otp_expired").requestId, "");
  assert.equal(parseConfirmationCallback("https://example.com/auth/confirm#error_code=otp_expired").errorCode, "otp_expired");
});

test("provider callback snapshot survives SDK hash consumption without retaining authentication secrets", () => {
  const initial = `https://example.com/auth/confirm?request=${requestId}#access_token=private&refresh_token=private&type=signup`;
  const snapshot = snapshotEmailConfirmation(initial);
  const cleaned = parseConfirmationCallback(`https://example.com/auth/confirm?request=${requestId}`);
  assert.equal(cleaned.hasCredentials, false);
  assert.equal(snapshot.hasCredentials, true);
  assert.equal(confirmationOutcome(snapshot, user, pending, null), "verified");
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal(snapshotEmailConfirmation("https://example.com/?auth=recovery#access_token=private&type=recovery"), null);
});

test("email confirmation redirects contain a random request ID and no email address", () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const result = beginEmailConfirmation(" OWNER@example.com ", "https://curbside-eta.vercel.app");
    const url = new URL(result.redirectTo);
    assert.equal(url.pathname, "/auth/confirm");
    assert.equal(url.searchParams.get("request"), result.requestId);
    assert.equal(result.redirectTo.includes("owner"), false);
    assert.equal(pendingEmailConfirmation("owner@example.com"), result.requestId);
    assert.equal(pendingEmailConfirmation("different@example.com"), "");
    const key = [...values.keys()][0];
    const stored = JSON.parse(values.get(key));
    values.set(key, JSON.stringify({ ...stored, createdAt: Date.now() - 25 * 60 * 60 * 1000 }));
    assert.equal(pendingEmailConfirmation("owner@example.com"), "");
    values.set(key, JSON.stringify({ ...stored, createdAt: Date.now() + 5000 }));
    assert.equal(pendingEmailConfirmation("owner@example.com"), "");
    values.set(key, JSON.stringify({ ...stored, email: null }));
    assert.equal(pendingEmailConfirmation("owner@example.com"), "");
    values.set(CONFIRMATION_KEY, JSON.stringify({ ...receipt, userId: "" }));
    assert.equal(readConfirmationEvidence().receipt, null);
    values.set(CONFIRMATION_KEY, JSON.stringify(receipt));
    assert.deepEqual(readConfirmationEvidence().receipt, receipt);
  } finally { delete globalThis.localStorage; }
});
