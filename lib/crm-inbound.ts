// Customer email replies arrive through Resend's receiving webhook. Replies sent
// from the portal use support+<conversation id>@<inbound domain> as reply-to so
// a customer's answer returns to the same conversation.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /[^\s<>"',;:]+@[^\s<>"',;:]+\.[^\s<>"',;:]+/;

export function inboundAddress(domain: string, threadId?: string) {
  return threadId && UUID.test(threadId)
    ? `support+${threadId.toLowerCase()}@${domain}`
    : `support@${domain}`;
}

export function threadFromRecipients(recipients: string[], domain: string) {
  const suffix = "@" + domain.toLowerCase();
  for (const raw of recipients) {
    const address = raw.match(EMAIL)?.[0]?.toLowerCase();
    if (!address?.endsWith(suffix)) continue;
    const tag = address.slice(0, -suffix.length).split("+")[1];
    if (tag && UUID.test(tag)) return tag;
  }
  return null;
}

export function parseSender(header: string | undefined, fallback: string) {
  const email = (header?.match(EMAIL)?.[0] || fallback).toLowerCase();
  const name = header
    ?.replace(/<[^>]*>/, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
  return { email, name: name && !name.includes("@") ? name.slice(0, 200) : "" };
}

function decodeDataUri(value: string) {
  const comma = value.indexOf(",");
  if (!value.startsWith("data:") || comma < 0) return value;
  const meta = value.slice(5, comma);
  const data = value.slice(comma + 1);
  if (!/;base64$/i.test(meta)) return decodeURIComponent(data);
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function htmlToText(html: string) {
  return decodeDataUri(html)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Splits the new text from the quoted history most mail apps append.
export function splitQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(
    (line, index) =>
      /^\s*On .{3,200}wrote:\s*$/i.test(line) ||
      /^\s*在.{2,200}(写道|寫道)[:：]\s*$/.test(line) ||
      /^\s*-{2,}\s*(Original Message|原始邮件|原始郵件)\s*-{2,}\s*$/i.test(line) ||
      (/^\s*(From|发件人|寄件者)\s*[:：]/i.test(line) &&
        /^\s*(Sent|Date|发送时间|日期|To|收件人)\s*[:：]/i.test(lines[index + 1] || "")) ||
      (/^\s*>/.test(line) && lines.slice(index).every((l) => /^\s*(>|$)/.test(l))),
  );
  if (start <= 0) return { body: text.trim(), quoted: "" };
  return {
    body: lines.slice(0, start).join("\n").trim(),
    quoted: lines.slice(start).join("\n").trim(),
  };
}

const encodeBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

// Resend signs webhooks with Svix: HMAC-SHA256 of "id.timestamp.body".
export async function verifyResendWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now = Date.now(),
) {
  const { id, timestamp, signature } = headers;
  if (!secret.startsWith("whsec_") || !id || !timestamp || !signature)
    return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300)
    return false;
  let key: Uint8Array<ArrayBuffer>;
  try {
    key = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const hmac = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = encodeBase64(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        hmac,
        new TextEncoder().encode(`${id}.${timestamp}.${body}`),
      ),
    ),
  );
  return signature
    .split(" ")
    .some((part) => {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value || value.length !== expected.length)
        return false;
      let diff = 0;
      for (let i = 0; i < value.length; i++)
        diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
      return diff === 0;
    });
}

export type ReceivedEmail = {
  id: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string>;
  message_id?: string;
  attachments?: { filename?: string; size?: number; content_type?: string }[];
};

export function inboundPayload(email: ReceivedEmail, domain: string) {
  const sender = parseSender(email.headers?.from, email.from || "");
  const body = (
    email.text?.trim() ||
    (email.html ? htmlToText(email.html) : "") ||
    "(This email had no readable text.)"
  ).slice(0, 50000);
  return {
    providerId: email.id,
    threadId: threadFromRecipients(email.to || [], domain),
    fromEmail: sender.email,
    fromName: sender.name,
    subject: (email.subject || "").slice(0, 300),
    body,
    messageId: (email.message_id || "").slice(0, 1000),
    attachments: (email.attachments || []).slice(0, 20).map((file) => ({
      filename: String(file.filename || "attachment").slice(0, 200),
      size: Number(file.size) || 0,
      contentType: String(file.content_type || "").slice(0, 100),
    })),
  };
}

export function crmInboundHandler(options: {
  secret: string;
  domain: string;
  fetchEmail: (id: string) => Promise<ReceivedEmail>;
  record: (payload: ReturnType<typeof inboundPayload>) => Promise<unknown>;
}) {
  return async (request: Request) => {
    const reply = (body: object, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
    if (!options.secret || !options.domain)
      return reply({ error: "Email receiving is not configured" }, 503);
    const raw = await request.text();
    if (raw.length > 100000) return reply({ error: "Request is too large" }, 413);
    const verified = await verifyResendWebhook(
      options.secret,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      raw,
    );
    if (!verified) return reply({ error: "Invalid signature" }, 401);
    let event: { type?: string; data?: { email_id?: string; to?: string[] } };
    try {
      event = JSON.parse(raw);
    } catch {
      return reply({ error: "Invalid event" }, 400);
    }
    if (event.type !== "email.received" || !event.data?.email_id)
      return reply({ ignored: true });
    const suffix = "@" + options.domain.toLowerCase();
    if (
      !(event.data.to || []).some((to) =>
        to.match(EMAIL)?.[0]?.toLowerCase().endsWith(suffix),
      )
    )
      return reply({ ignored: true });
    try {
      const email = await options.fetchEmail(event.data.email_id);
      const payload = inboundPayload(email, options.domain);
      if (payload.fromEmail.endsWith(suffix)) return reply({ ignored: true });
      return reply({ ok: true, result: await options.record(payload) });
    } catch {
      // A non-2xx response makes Resend retry; recording is idempotent.
      return reply({ error: "Could not record this email" }, 500);
    }
  };
}
