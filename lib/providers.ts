import { config, HttpError, requireService } from "./runtime";
export async function hmac(
  secret: string,
  message: string,
  algorithm = "SHA-256",
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
}
export function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
const hex = (a: Uint8Array) =>
  Array.from(a)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const b64 = (a: Uint8Array) => btoa(String.fromCharCode(...a));
export async function signedToken(payload: any) {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return body + "." + hex(await hmac(config().SIGNING_SECRET, body));
}
export async function readToken(token: string) {
  const [body, sig] = token.split(".");
  if (
    !body ||
    !sig ||
    !config().SIGNING_SECRET ||
    !equal(sig, hex(await hmac(config().SIGNING_SECRET, body)))
  )
    throw new HttpError(403, "Invalid or expired link.");
  let p;
  try {
    p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    throw new HttpError(403, "Invalid link.");
  }
  if (p.exp < Date.now()) throw new HttpError(403, "This link has expired.");
  return p;
}
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  key: string,
  unsubscribe: string,
) {
  const e = config();
  requireService(
    e.RESEND_API_KEY && e.EMAIL_FROM,
    "Email delivery is not configured.",
  );
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + e.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: e.EMAIL_FROM,
      to: [to],
      subject,
      text,
      headers: {
        "List-Unsubscribe": "<" + unsubscribe + ">",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  const j: any = await r.json();
  if (!r.ok)
    throw new Error("Email provider rejected delivery (" + r.status + ").");
  return j.id;
}
export async function twilio(path: string, form: Record<string, string>) {
  const e = config();
  requireService(
    e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN,
    "SMS is not configured.",
  );
  const r = await fetch("https://" + path, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + btoa(e.TWILIO_ACCOUNT_SID + ":" + e.TWILIO_AUTH_TOKEN),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(12000),
  });
  const j: any = await r.json();
  if (!r.ok)
    throw new HttpError(
      502,
      "SMS provider could not complete the request. Please try again later.",
    );
  return j;
}
export async function sendSMS(to: string, body: string, jobId: string) {
  const e = config();
  requireService(
    e.TWILIO_MESSAGING_SERVICE_SID,
    "SMS delivery is not configured.",
  );
  return twilio(
    "api.twilio.com/2010-04-01/Accounts/" +
      e.TWILIO_ACCOUNT_SID +
      "/Messages.json",
    {
      To: to,
      Body: body,
      MessagingServiceSid: e.TWILIO_MESSAGING_SERVICE_SID,
      StatusCallback:
        e.APP_ORIGIN + "/api/webhooks/twilio?job=" + encodeURIComponent(jobId),
    },
  );
}
export async function checkout(user: any, kind: string, caseId?: string) {
  const e = config();
  const price =
    kind === "plus-year"
      ? e.STRIPE_PLUS_YEAR_PRICE
      : kind === "plus"
        ? e.STRIPE_PLUS_PRICE
        : kind === "dealer"
          ? e.STRIPE_DEALER_PRICE
          : kind === "ai"
            ? e.STRIPE_AI_PRICE
            : null;
  requireService(
    e.STRIPE_SECRET_KEY && price,
    "Checkout is not available until billing is configured.",
  );
  const form: any = {
    mode: kind === "ai" ? "payment" : "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: e.APP_ORIGIN + "/?checkout=success",
    cancel_url: e.APP_ORIGIN + "/?checkout=cancel",
    client_reference_id: user.id,
    "metadata[user_id]": user.id,
    "metadata[kind]": kind,
  };
  if (user.stripe_customer) form.customer = user.stripe_customer;
  else form.customer_email = user.email;
  if (caseId) form["metadata[case_id]"] = caseId;
  if (kind !== "ai") {
    form["subscription_data[metadata][user_id]"] = user.id;
    form["subscription_data[metadata][kind]"] = kind;
  }
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });
  const j: any = await r.json();
  if (!r.ok) throw new HttpError(502, "Checkout is temporarily unavailable.");
  return j.url;
}
export async function billingPortal(customer: string) {
  const e = config();
  requireService(
    customer && e.STRIPE_SECRET_KEY,
    "No billing account is available.",
  );
  const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + e.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ customer, return_url: e.APP_ORIGIN }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new HttpError(502, "Billing portal is unavailable.");
  return j.url;
}
export async function requireCanceledRenewals(customer?: string) {
  if (!customer) return;
  requireService(
    config().STRIPE_SECRET_KEY,
    "Billing must be available to verify cancellation before deleting account data.",
  );
  const response = await fetch(
    "https://api.stripe.com/v1/subscriptions?" +
      new URLSearchParams({ customer, status: "all", limit: "100" }),
    { headers: { Authorization: "Bearer " + config().STRIPE_SECRET_KEY } },
  );
  if (!response.ok)
    throw new HttpError(
      503,
      "Could not verify billing. Your data has not been deleted.",
    );
  const result: any = await response.json();
  if (
    result.has_more ||
    result.data?.some(
      (s: any) =>
        !["canceled", "incomplete_expired"].includes(s.status) &&
        !s.cancel_at_period_end &&
        !s.cancel_at,
    )
  )
    throw new HttpError(
      409,
      "Cancel future renewal in Account → Manage billing before deleting your saved data. Contact support if you cannot access billing.",
    );
}
export async function verifyStripe(body: string, header: string) {
  const fields = header.split(",");
  const ts = fields.find((x) => x.startsWith("t="))?.slice(2);
  if (
    !ts ||
    Math.abs(Date.now() / 1000 - Number(ts)) > 300 ||
    !config().STRIPE_WEBHOOK_SECRET
  )
    throw new HttpError(401, "Invalid webhook");
  const sig = hex(await hmac(config().STRIPE_WEBHOOK_SECRET, ts + "." + body));
  if (
    !fields
      .filter((x) => x.startsWith("v1="))
      .some((x) => equal(x.slice(3), sig))
  )
    throw new HttpError(401, "Invalid webhook");
}
export async function verifyTwilio(req: Request, form: URLSearchParams) {
  const e = config();
  if (!e.TWILIO_AUTH_TOKEN) throw new HttpError(401, "Invalid webhook");
  const u = new URL(req.url);
  let message = e.APP_ORIGIN + u.pathname + u.search;
  for (const key of [...new Set(form.keys())].sort())
    message += key + form.get(key);
  const expected = b64(await hmac(e.TWILIO_AUTH_TOKEN, message, "SHA-1"));
  if (!equal(expected, req.headers.get("x-twilio-signature") || ""))
    throw new HttpError(401, "Invalid webhook");
}
export async function verifyResend(req: Request, body: string) {
  const secret = config().RESEND_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(401, "Invalid webhook");
  const ts = req.headers.get("svix-timestamp") || "";
  const id = req.headers.get("svix-id") || "";
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300)
    throw new HttpError(401, "Invalid webhook");
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (x) =>
    x.charCodeAt(0),
  );
  const k = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = b64(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        k,
        new TextEncoder().encode(id + "." + ts + "." + body),
      ),
    ),
  );
  if (
    !(req.headers.get("svix-signature") || "")
      .split(" ")
      .some((v) => equal(v.replace(/^v1,/, ""), expected))
  )
    throw new HttpError(401, "Invalid webhook");
  return id;
}
