import { createClient } from "@supabase/supabase-js";
import { accountDeletionHandler } from "../../../lib/account-deletion";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
// Supabase injects this server-only credential; it is never sent to Vercel or the browser.
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  accountDeletionHandler(admin, [
    "https://curbside-eta.vercel.app",
    ...(Deno.env.get("APP_ORIGIN") ? [Deno.env.get("APP_ORIGIN")!] : []),
  ]),
);
