import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestEmailChange(
  client: SupabaseClient,
  userId: string,
  rawEmail: string,
  origin: string,
) {
  const email = rawEmail.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid new email address.");
  const { data, error } = await client.auth.getUser();
  if (
    error ||
    !data.user?.email_confirmed_at ||
    data.user.is_anonymous ||
    data.user.id !== userId
  )
    throw new Error("Please sign in again before editing account details.");
  if (email === data.user.email?.toLowerCase())
    throw new Error("Choose a different email address.");
  const result = await client.auth.updateUser(
    { email },
    { emailRedirectTo: new URL("/?view=account", origin).toString() },
  );
  if (result.error) throw result.error;
  return result.data.user;
}
