import { createClient } from "@supabase/supabase-js";
import {
  accountDeletedEmail,
  accountDeletionHandler,
  type DeletionNotice,
} from "../../../lib/account-deletion";
import { crmEmailHtml, crmMessageText } from "../../../lib/crm";
import { emailDeliveryAvailable } from "../../../lib/email-notifications";
import { OPERATOR } from "../../../lib/legal";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const value = (key: string) => Deno.env.get(key);
// Supabase injects this server-only credential; it is never sent to Vercel or the browser.
const admin = createClient(
  value("SUPABASE_URL")!,
  value("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const origin = value("APP_ORIGIN") || "https://curbside-eta.vercel.app";
const email = {
  enabled: value("EMAIL_NOTIFICATIONS_ENABLED"),
  apiKey: value("RESEND_API_KEY"),
  from: value("EMAIL_FROM"),
  senderVerified: value("EMAIL_SENDER_VERIFIED"),
  signingSecret: value("EMAIL_UNSUBSCRIBE_SECRET"),
  appOrigin: origin,
  supabaseUrl: value("SUPABASE_URL"),
};
const prepareNotice: DeletionNotice = async (user, language) => {
  if (!emailDeliveryAvailable(email)) return null;
  const { subject, message } = accountDeletedEmail(
    language,
    user.email,
    OPERATOR.email,
  );
  const html = crmEmailHtml(subject, message, origin);
  const text = crmMessageText(message, origin);
  return async () => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${email.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticketsafe-account-deleted/${user.id}`,
      },
      body: JSON.stringify({
        from: `TicketSafe <${email.from}>`,
        to: [user.email],
        subject,
        html,
        text,
      }),
    });
    if (!response.ok) throw new Error("Deletion email was not accepted");
  };
};
Deno.serve(
  accountDeletionHandler(
    admin,
    [
      "https://curbside-eta.vercel.app",
      ...(value("APP_ORIGIN") ? [value("APP_ORIGIN")!] : []),
    ],
    prepareNotice,
  ),
);
