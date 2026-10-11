import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["lib/crm-inbound.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const {
  crmInboundHandler,
  htmlToText,
  inboundAddress,
  parseSender,
  splitQuoted,
  threadFromRecipients,
  verifyResendWebhook,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

const secretBytes = Buffer.from("test-webhook-secret-bytes");
const secret = "whsec_" + secretBytes.toString("base64");
const threadId = "1f6d3a9e-2b4c-4d8e-9f10-123456789abc";
const sign = (id, timestamp, body) =>
  "v1," + createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");

test("webhook signatures must match and be recent", async () => {
  const now = Date.now();
  const ts = String(Math.floor(now / 1000));
  const body = '{"type":"email.received"}';
  const headers = { id: "msg_1", timestamp: ts, signature: "v1,bad " + sign("msg_1", ts, body) };
  assert.equal(await verifyResendWebhook(secret, headers, body, now), true);
  assert.equal(await verifyResendWebhook(secret, headers, body + " ", now), false);
  assert.equal(await verifyResendWebhook(secret, headers, body, now + 10 * 60_000), false);
  assert.equal(await verifyResendWebhook("not-a-secret", headers, body, now), false);
});

test("reply addresses route back to their conversation", () => {
  assert.equal(inboundAddress("reply.example.com", threadId), `support+${threadId}@reply.example.com`);
  assert.equal(inboundAddress("reply.example.com"), "support@reply.example.com");
  assert.equal(
    threadFromRecipients(["Team <SUPPORT+" + threadId.toUpperCase() + "@reply.example.com>"], "reply.example.com"),
    threadId,
  );
  assert.equal(threadFromRecipients([`support+${threadId}@other.example.com`], "reply.example.com"), null);
  assert.deepEqual(parseSender('"Pat Lee" <Pat@Example.com>', ""), { email: "pat@example.com", name: "Pat Lee" });
});

test("quoted history and HTML-only emails become readable text", () => {
  assert.deepEqual(splitQuoted("Thanks!\n\nOn Mon, Oct 12, 2026 at 9:00 AM TicketSafe wrote:\n> Hi"), {
    body: "Thanks!",
    quoted: "On Mon, Oct 12, 2026 at 9:00 AM TicketSafe wrote:\n> Hi",
  });
  assert.equal(splitQuoted("谢谢\n在 2026年10月12日 罚单卫士 写道：\n> 你好").body, "谢谢");
  assert.equal(splitQuoted("> quoted only").body, "> quoted only");
  assert.equal(
    htmlToText("<p>Hello&nbsp;<b>there</b></p><script>x()</script><ul><li>One</li></ul>"),
    "Hello there\n- One",
  );
  assert.equal(htmlToText("data:text/html;base64," + Buffer.from("<p>Hi</p>").toString("base64")), "Hi");
});

test("the webhook records signed received emails and ignores everything else", async () => {
  const recorded = [];
  const handler = crmInboundHandler({
    secret,
    domain: "reply.example.com",
    fetchEmail: async (id) => ({
      id,
      from: "pat@example.com",
      to: [`support+${threadId}@reply.example.com`],
      subject: "Re: Help",
      text: null,
      html: "<p>It worked</p>",
      headers: { from: "Pat <pat@example.com>" },
      message_id: "<x@example.com>",
      attachments: [{ filename: "a.pdf", size: 5, content_type: "application/pdf" }],
    }),
    record: async (payload) => {
      recorded.push(payload);
      return { threadId };
    },
  });
  const post = (event, signed = true) => {
    const body = JSON.stringify(event);
    const ts = String(Math.floor(Date.now() / 1000));
    return new Request("https://fn.example/crm-inbound", {
      method: "POST",
      headers: {
        "svix-id": "msg_2",
        "svix-timestamp": ts,
        "svix-signature": signed ? sign("msg_2", ts, body) : "v1,forged",
      },
      body,
    });
  };
  const event = { type: "email.received", data: { email_id: "recv_1", to: ["support@reply.example.com"] } };
  assert.equal((await handler(post(event, false))).status, 401);
  assert.deepEqual(await (await handler(post({ type: "email.sent", data: {} }))).json(), { ignored: true });
  assert.deepEqual(
    await (await handler(post({ ...event, data: { ...event.data, to: ["someone@else.com"] } }))).json(),
    { ignored: true },
  );
  assert.equal((await handler(post(event))).status, 200);
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0], {
    providerId: "recv_1",
    threadId,
    fromEmail: "pat@example.com",
    fromName: "Pat",
    subject: "Re: Help",
    body: "It worked",
    messageId: "<x@example.com>",
    attachments: [{ filename: "a.pdf", size: 5, contentType: "application/pdf" }],
  });
  const unconfigured = crmInboundHandler({ secret: "", domain: "", fetchEmail: async () => ({}), record: async () => ({}) });
  assert.equal((await unconfigured(post(event))).status, 503);
});
