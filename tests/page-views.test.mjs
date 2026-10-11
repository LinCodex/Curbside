import test from "node:test";
import assert from "node:assert/strict";
import {
  countedPage,
  pageViewsAllowed,
  recordPageView,
} from "../lib/page-views.ts";

test("page counts honor privacy signals and known screens", () => {
  assert.equal(pageViewsAllowed({}), true);
  assert.equal(pageViewsAllowed({ doNotTrack: "1" }), false);
  assert.equal(pageViewsAllowed({ globalPrivacyControl: true }), false);
  assert.equal(pageViewsAllowed({ webdriver: true }), false);
  assert.equal(countedPage("garage"), "garage");
  assert.equal(countedPage("legal"), "legal");
  assert.equal(countedPage("web-portal"), null);
});

test("a blocked or unknown view never calls the counter", async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
    },
  };
  assert.equal(recordPageView(client, "search", { doNotTrack: "1" }), false);
  assert.equal(recordPageView(null, "search", {}), false);
  assert.equal(recordPageView(client, "inbox", {}), false);
  assert.equal(recordPageView(client, "account", {}), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [
    { name: "ticketsafe_page_view", args: { page_name: "account" } },
  ]);
});
