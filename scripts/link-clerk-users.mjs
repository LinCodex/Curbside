import { createClient } from "@supabase/supabase-js";
const apply = process.argv.includes("--apply");
const production = process.argv.includes("--production");
const key = process.env.CLERK_SECRET_KEY;
if (!key || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Configure target Clerk and Supabase server credentials in the ignored local environment.",
  );
if (production !== key.startsWith("sk_live_"))
  throw new Error(
    "Instance mismatch: --production requires the target production key.",
  );
const database = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const plans = [];
const legacyIds = new Set();
for (let offset = 0; ; offset += 100) {
  const response = await fetch(
    "https://api.clerk.com/v1/users?limit=100&offset=" + offset,
    { headers: { Authorization: "Bearer " + key } },
  );
  if (!response.ok)
    throw new Error(
      "Could not inventory Clerk users (HTTP " + response.status + ").",
    );
  const page = await response.json();
  for (const user of page) {
    if (!user.external_id) continue;
    if (legacyIds.has(user.external_id.toLowerCase()))
      throw new Error(
        "Duplicate legacy identity in Clerk; resolve before linking.",
      );
    legacyIds.add(user.external_id.toLowerCase());
    if (
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
        user.external_id,
      ) ||
      !/^user_[A-Za-z0-9]+$/.test(user.id)
    )
      throw new Error("Unsupported identity mapping; resolve before linking.");
    const { data, error } = await database
      .from("curbside_accounts")
      .select("id,clerk_user_id,legacy")
      .eq("id", user.external_id)
      .maybeSingle();
    if (
      error ||
      !data?.legacy ||
      (data.clerk_user_id && data.clerk_user_id !== user.id)
    )
      throw new Error(
        "Missing or conflicting legacy mapping. Nothing is reassigned by email.",
      );
    if (!data.clerk_user_id) {
      const existing = await database
        .from("curbside_accounts")
        .select("id")
        .eq("clerk_user_id", user.id)
        .maybeSingle();
      if (existing.error || (existing.data && existing.data.id !== data.id))
        throw new Error(
          "This Clerk identity is already mapped to a different account. Nothing is reassigned.",
        );
      plans.push({ id: data.id, clerk_user_id: user.id });
    }
  }
  if (page.length < 100) break;
}
console.log(JSON.stringify({ toLink: plans.length, dryRun: !apply }));
if (apply)
  for (const row of plans) {
    const { data, error } = await database
      .from("curbside_accounts")
      .update({ clerk_user_id: row.clerk_user_id })
      .eq("id", row.id)
      .eq("legacy", true)
      .is("clerk_user_id", null)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "Linking stopped on a concurrent or conflicting mapping. Re-run the dry run.",
      );
  }
if (apply) console.log(JSON.stringify({ linked: plans.length }));
