import { createClient } from "@supabase/supabase-js";
import { crmAdminHandler } from "./handler";
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const value = (key: string) => Deno.env.get(key);
const admin = createClient(
  value("SUPABASE_URL")!,
  value("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const origin = value("APP_ORIGIN") || "https://curbside-eta.vercel.app";
Deno.serve(
  crmAdminHandler(
    admin,
    {
      enabled: value("EMAIL_NOTIFICATIONS_ENABLED"),
      apiKey: value("RESEND_API_KEY"),
      from: value("EMAIL_FROM"),
      senderVerified: value("EMAIL_SENDER_VERIFIED"),
      signingSecret: value("EMAIL_UNSUBSCRIBE_SECRET"),
      appOrigin: origin,
      supabaseUrl: value("SUPABASE_URL"),
      mapboxConfigured: !!value("MAPBOX_PUBLIC_TOKEN"),
      captchaConfigured: !!value("HCAPTCHA_SECRET_KEY"),
    },
    [
      origin,
      "https://curbside-eta.vercel.app",
      "https://ticketsafe.ezrefillny.net",
    ],
  ),
);
