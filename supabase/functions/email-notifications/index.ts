import { createClient } from "@supabase/supabase-js";
import {
  emailDeliveryAvailable,
  verifyEmailUnsubscribe,
  type EmailDeliveryConfig,
} from "../../../lib/email-notifications";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
export const emailConfig = (): EmailDeliveryConfig => ({
  enabled: Deno.env.get("EMAIL_NOTIFICATIONS_ENABLED"),
  apiKey: Deno.env.get("RESEND_API_KEY"),
  from: Deno.env.get("EMAIL_FROM"),
  senderVerified: Deno.env.get("EMAIL_SENDER_VERIFIED"),
  signingSecret: Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET"),
  appOrigin: Deno.env.get("APP_ORIGIN"),
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
});
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const configured =
    Deno.env.get("APP_ORIGIN") || "https://curbside-eta.vercel.app";
  const cors = {
    ...headers,
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin === configured ? origin : configured,
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: cors });
  if (request.method === "OPTIONS") return reply({});
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    if (!["GET", "POST"].includes(request.method))
      return reply({ error: "Method not allowed" }, 405);
    const claim = await verifyEmailUnsubscribe(
      token,
      Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") || "",
    );
    if (!claim)
      return reply(
        { error: "This unsubscribe link is invalid or expired." },
        400,
      );
    if (request.method === "GET") {
      // Mail scanners following a link cannot opt someone out. Only the explicit
      // confirmation POST or RFC 8058 one-click POST updates this one setting.
      return new Response(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TicketSafe email preferences</title><body><main><h1>Turn off new-ticket emails</h1><p>This changes ticket email alerts only. Your account and saved cars remain available.</p><form method="post"><button type="submit">Turn off new-ticket emails</button></form></main></body></html>',
        {
          headers: {
            ...headers,
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
          },
        },
      );
    }
    const result = await admin.rpc("curbside_unsubscribe_ticket_email", {
      account_id: claim.u,
      setting_revision: claim.r,
    });
    if (result.error)
      return reply(
        { error: "Email preferences are temporarily unavailable." },
        503,
      );
    return new Response(
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>TicketSafe email preferences</title><body><p>This link has been processed. New-ticket emails are turned off for its subscription.</p><p>If you later enabled emails again, manage that preference in your garage.</p></body></html>',
      {
        headers: {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; frame-ancestors 'none'",
        },
      },
    );
  }
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  // Status is read-only and contains no secrets, account data or addresses.
  // Avoid buffering an attacker-selected body; the client uses POST for invoke.
  const probe = await admin
    .from("curbside_email_settings")
    .select("user_id", { head: true })
    .limit(0);
  return reply({
    available: !probe.error && emailDeliveryAvailable(emailConfig()),
    smsAvailable: false,
  });
});
