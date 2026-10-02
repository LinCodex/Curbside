import { createClient } from "@supabase/supabase-js";
import { searchVerificationHandler } from "../../../lib/search-verification";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
// The gateway JWT check must be disabled for this function. The handler verifies
// the server HMAC before using Supabase's internal service credential; public
// clients cannot invoke the ledger RPC or create verification passes.
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  searchVerificationHandler(
    Deno.env.get("SEARCH_VERIFICATION_SECRET"),
    async (input) => {
      const { data, error } = await admin.rpc("curbside_search_verification", {
        action_name: input.action,
        actor_hash: input.actor,
        request_nonce: input.nonce,
        pass_id: input.passId || null,
        pass_expiry: input.expiresAt
          ? new Date(input.expiresAt).toISOString()
          : null,
      });
      if (error || !data) throw new Error("Ledger unavailable");
      return data;
    },
  ),
);
