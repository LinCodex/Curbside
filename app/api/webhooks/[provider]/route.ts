import { verifyStripe, verifyTwilio, verifyResend } from "@/lib/providers";
import { one, run, db, config } from "@/lib/runtime";
export async function POST(req: Request) {
  try {
    const provider = new URL(req.url).pathname.split("/").pop();
    const raw = await req.text();
    if (raw.length > 1000000) return new Response("Too large", { status: 413 });
    let id = "",
      statements: D1PreparedStatement[] = [];
    if (provider === "stripe") {
      await verifyStripe(raw, req.headers.get("stripe-signature") || "");
      const event = JSON.parse(raw);
      id = event.id;
      const o = event.data.object;
      if (
        event.type === "checkout.session.completed" &&
        o.payment_status === "paid"
      ) {
        const uid = o.metadata?.user_id;
        const kind = o.metadata?.kind;
        if (uid) {
          statements.push(
            db()
              .prepare("UPDATE users SET stripe_customer=? WHERE id=?")
              .bind(o.customer, uid),
          );
          if (kind === "ai" && o.metadata.case_id)
            statements.push(
              db()
                .prepare("UPDATE cases SET paid=1 WHERE id=? AND owner_id=?")
                .bind(o.metadata.case_id, uid),
            );
        }
      }
      if (
        [
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
        ].includes(event.type)
      ) {
        // Fetch current state so delayed/out-of-order webhook events cannot restore an expired plan.
        const r = await fetch(
          "https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(o.id),
          {
            headers: { Authorization: "Bearer " + config().STRIPE_SECRET_KEY },
          },
        );
        if (!r.ok) throw new Error("Stripe state unavailable");
        const sub: any = await r.json();
        const uid = sub.metadata?.user_id;
        const kind = sub.metadata?.kind;
        const active = ["active", "trialing"].includes(sub.status);
        const until =
          Number(
            sub.current_period_end ||
              sub.items?.data?.[0]?.current_period_end ||
              0,
          ) * 1000;
        if (uid && kind === "dealer")
          statements.push(
            db()
              .prepare(
                "UPDATE dealers SET active=?,stripe_customer=? WHERE owner_id=?",
              )
              .bind(active ? 1 : 0, sub.customer, uid),
          );
        else if (uid && ["plus", "plus-year"].includes(kind))
          statements.push(
            db()
              .prepare(
                "UPDATE users SET plan=?,plan_until=?,stripe_customer=? WHERE id=?",
              )
              .bind(
                active ? "plus" : "free",
                active ? until : 0,
                sub.customer,
                uid,
              ),
          );
      }
    } else if (provider === "twilio") {
      const f = new URLSearchParams(raw);
      await verifyTwilio(req, f);
      id =
        (f.get("MessageSid") || "") +
        ":" +
        (f.get("MessageStatus") || f.get("Body") || "");
      if (!id) throw new Error();
      const from = f.get("From"),
        body = (f.get("Body") || "").trim().toUpperCase();
      if (
        ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(
          body,
        )
      )
        statements.push(
          db()
            .prepare(
              "UPDATE users SET sms_stopped=1,sms_consent=0 WHERE phone=?",
            )
            .bind(from),
        );
      const job = new URL(req.url).searchParams.get("job");
      const status = f.get("MessageStatus");
      if (job && status)
        statements.push(
          db()
            .prepare(
              "UPDATE jobs SET status=CASE WHEN ?='delivered' THEN 'delivered' WHEN ? IN ('failed','undelivered') THEN 'failed' ELSE status END,provider_id=?,updated_at=? WHERE id=? AND channel='sms'",
            )
            .bind(status, status, f.get("MessageSid"), Date.now(), job),
        );
      if (body === "HELP")
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Curbside by Flushing NY Wireless. Help: ezrefillyny@gmail.com. Reply STOP to stop. Message and data rates may apply.</Message></Response>',
          { headers: { "Content-Type": "text/xml" } },
        );
    } else if (provider === "resend") {
      id = await verifyResend(req, raw);
      const event = JSON.parse(raw);
      const pid = event.data?.email_id;
      if (["email.bounced", "email.complained"].includes(event.type)) {
        statements.push(
          db()
            .prepare(
              "UPDATE users SET email_alerts=0 WHERE id IN (SELECT owner_id FROM jobs WHERE provider_id=?)",
            )
            .bind(pid),
        );
        statements.push(
          db()
            .prepare(
              "UPDATE jobs SET status='failed',updated_at=? WHERE provider_id=?",
            )
            .bind(Date.now(), pid),
        );
      }
      if (event.type === "email.delivered")
        statements.push(
          db()
            .prepare(
              "UPDATE jobs SET status='delivered',updated_at=? WHERE provider_id=?",
            )
            .bind(Date.now(), pid),
        );
    } else return new Response("Not found", { status: 404 });
    if (!id) throw new Error();
    const key = provider + ":" + id;
    if (await one("SELECT id FROM webhooks WHERE id=?", key))
      return Response.json({ received: true, duplicate: true });
    // Unique event insertion and side effects are transactional; retries cannot partially apply.
    await db().batch([
      db()
        .prepare("INSERT INTO webhooks (id,provider,created_at) VALUES (?,?,?)")
        .bind(key, provider!, Date.now()),
      ...statements,
    ]);
    return provider === "twilio"
      ? new Response("<Response/>", { headers: { "Content-Type": "text/xml" } })
      : Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Webhook verification or processing failed" },
      { status: 400 },
    );
  }
}
