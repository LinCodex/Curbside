import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { verifiedIdentity } from "./account-identity";
import { HttpError, config } from "./runtime";
export function accountDatabase() {
  const env = config();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new HttpError(
      503,
      "Vehicle storage is awaiting setup. Please try again later.",
    );
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
// Ownership comes from Clerk's server response, never client metadata or email matching.
export async function accountActor(request: Request) {
  const session = await auth({ treatPendingAsSignedOut: true });
  if (!session.userId || !session.sessionId)
    throw new HttpError(401, "Sign in to continue.");
  if (request.headers.get("x-curbside-user") !== session.userId)
    throw new HttpError(
      409,
      "Your session changed. Sign in again before saving settings.",
    );
  const clerk = await clerkClient();
  const active = await clerk.sessions.getSession(session.sessionId);
  if (active.status !== "active" || active.userId !== session.userId)
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  const user = await clerk.users.getUser(session.userId);
  let identity;
  try {
    identity = verifiedIdentity(user);
  } catch (error) {
    throw new HttpError(403, (error as Error).message);
  }
  const database = accountDatabase();
  let result = await database
    .from("curbside_accounts")
    .select("id")
    .eq("clerk_user_id", identity.clerkId)
    .maybeSingle();
  if (result.error)
    throw new HttpError(503, "Account migration is awaiting setup.");
  if (!result.data && identity.legacyId) {
    result = await database
      .from("curbside_accounts")
      .update({ clerk_user_id: identity.clerkId })
      .eq("id", identity.legacyId)
      .is("clerk_user_id", null)
      .eq("legacy", true)
      .select("id")
      .maybeSingle();
  } else if (!result.data) {
    result = await database
      .from("curbside_accounts")
      .upsert(
        { clerk_user_id: identity.clerkId },
        { onConflict: "clerk_user_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
  }
  // Concurrent first requests re-read the winning, unique mapping.
  if (!result.data && !result.error)
    result = await database
      .from("curbside_accounts")
      .select("id")
      .eq("clerk_user_id", identity.clerkId)
      .maybeSingle();
  if (result.error || !result.data)
    throw new HttpError(
      409,
      "Account migration is incomplete. Please contact support.",
    );
  return { database, clerk, identity: { ...identity, id: result.data.id } };
}
