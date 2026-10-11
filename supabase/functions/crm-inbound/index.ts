import { createClient } from "@supabase/supabase-js";
import { crmInboundHandler, type ReceivedEmail } from "../../../lib/crm-inbound";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const value = (key: string) => Deno.env.get(key);
// Resend cannot send a Supabase JWT, so the gateway check is off and every
// request must carry a valid Resend webhook signature instead.
const admin = createClient(
  value("SUPABASE_URL")!,
  value("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  crmInboundHandler({
    secret: value("RESEND_WEBHOOK_SECRET") || "",
    domain: (value("INBOUND_DOMAIN") || "").toLowerCase(),
    fetchEmail: async (id) => {
      const response = await fetch(
        `https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`,
        {
          signal: AbortSignal.timeout(12000),
          headers: { Authorization: `Bearer ${value("RESEND_API_KEY")}` },
        },
      );
      if (!response.ok) throw new Error("Received email is unavailable");
      return (await response.json()) as ReceivedEmail;
    },
    record: async (payload) => {
      const { data, error } = await admin.rpc("ticketsafe_crm_inbound", {
        payload,
      });
      if (error) throw new Error("Inbound email could not be recorded");
      return data;
    },
  }),
);
