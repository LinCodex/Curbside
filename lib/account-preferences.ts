import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedAccount } from "./browser-account";
import { readPreferences } from "./preferences";

export async function saveAccountPreferences(
  client: SupabaseClient | null,
  owner: string | null,
  next: ReturnType<typeof readPreferences>,
) {
  const normalized = readPreferences(JSON.stringify(next));
  // The guest branch is deliberately local-only, including when an old or
  // anonymous Supabase session happens to remain in browser storage.
  if (!owner) return normalized;
  if (!client)
    throw new Error(
      "Your session changed. Sign in again before saving settings.",
    );
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || confirmedAccount(identity.user)?.id !== owner)
    throw new Error(
      "Your session changed. Sign in again before saving settings.",
    );
  const fields = {
    theme: normalized.theme,
    language: normalized.language,
    detail_mode: normalized.detailMode,
  };
  const update = () =>
    client
      .from("curbside_preferences")
      .update(fields)
      .eq("user_id", owner)
      .select("user_id");
  const result = await update();
  if (result.error)
    throw new Error("Settings could not be saved. Please try again.");
  if (!result.data?.length) {
    const inserted = await client
      .from("curbside_preferences")
      .insert({ user_id: owner, ...fields });
    if (
      inserted.error &&
      !(inserted.error.code === "23505" && !(await update()).error)
    )
      throw new Error("Settings could not be saved. Please try again.");
  }
  return normalized;
}
