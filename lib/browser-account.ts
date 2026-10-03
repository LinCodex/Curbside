import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

export function confirmedAccount(user?: User | null): User | null {
  return user?.id && user.email_confirmed_at && !user.is_anonymous
    ? user
    : null;
}

// A stored session is only a candidate. Do not expose its profile to account
// consumers until Auth accepts the token; guest settings never require Auth.
export async function verifyBrowserAccount(
  client: SupabaseClient,
  session: Session | null,
): Promise<User | null> {
  const candidate = confirmedAccount(session?.user);
  if (!candidate || !session?.access_token) return null;
  const { data, error } = await client.auth.getUser(session.access_token);
  if (error) {
    if (
      error.status === 401 ||
      error.status === 403 ||
      ["session_not_found", "user_not_found", "bad_jwt"].includes(
        error.code || "",
      )
    ) {
      // A newer sign-in may have completed while the rejected request was in
      // flight. Only discard the rejected session, and only on this device.
      const current = await client.auth.getSession();
      if (current.data.session?.access_token === session.access_token)
        await client.auth.signOut({ scope: "local" });
      return null;
    }
    throw error;
  }
  const verified = confirmedAccount(data.user);
  return verified?.id === candidate.id ? verified : null;
}
