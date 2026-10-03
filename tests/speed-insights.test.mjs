import test from "node:test";
import assert from "node:assert/strict";
import { privateSpeedEvent } from "../lib/analytics-privacy.ts";

test("speed metrics redact public URLs and route values", () => {
  assert.deepEqual(
    privateSpeedEvent(
      {
        type: "vital",
        url: "https://ticketsafe.example/?view=search&plate=PRIVATE&email=private@example.com",
        route: "/private/SECRET",
      },
      {},
    ),
    {
      type: "vital",
      url: "https://ticketsafe.example/?view=search",
      route: "/",
    },
  );
});
test("speed metrics exclude accounts, CRM, auth callbacks and privacy signals", () => {
  for (const suffix of [
    "/",
    "/?view=garage",
    "/?view=account",
    "/web-portal",
    "/auth/confirm?code=SECRET",
    "/?view=search#access_token=SECRET",
  ])
    assert.equal(
      privateSpeedEvent({ url: "https://ticketsafe.example" + suffix }, {}),
      null,
    );
  for (const privacy of [{ doNotTrack: "1" }, { globalPrivacyControl: true }])
    assert.equal(
      privateSpeedEvent(
        { url: "https://ticketsafe.example/?view=search" },
        privacy,
      ),
      null,
    );
});
