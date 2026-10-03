import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailDeliveryConfig = {
  enabled?: string;
  apiKey?: string;
  from?: string;
  senderVerified?: string;
  signingSecret?: string;
  appOrigin?: string;
  supabaseUrl?: string;
  mapboxToken?: string;
};

export function emailDeliveryAvailable(config: EmailDeliveryConfig) {
  try {
    return (
      config.enabled === "true" &&
      config.senderVerified === "true" &&
      !!config.apiKey &&
      /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(config.from || "") &&
      (config.signingSecret?.length || 0) >= 32 &&
      new URL(config.appOrigin || "").protocol === "https:" &&
      new URL(config.supabaseUrl || "").protocol === "https:"
    );
  } catch {
    return false;
  }
}

const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type UnsubscribeClaim = {
  scope: "ticket-email";
  u: string;
  r: string;
  exp: number;
};
async function signingKey(secret: string) {
  if (secret.length < 32) throw new Error("Email signing is unavailable");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signEmailUnsubscribe(
  userId: string,
  revision: string,
  expiresAt: number,
  secret: string,
) {
  if (
    !uuid.test(userId) ||
    !uuid.test(revision) ||
    !Number.isSafeInteger(expiresAt)
  )
    throw new Error("Invalid email preference");
  const claim: UnsubscribeClaim = {
    scope: "ticket-email",
    u: userId,
    r: revision,
    exp: expiresAt,
  };
  const body = encode(new TextEncoder().encode(JSON.stringify(claim)));
  return (
    body +
    "." +
    encode(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await signingKey(secret),
          new TextEncoder().encode(body),
        ),
      ),
    )
  );
}
export async function verifyEmailUnsubscribe(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<UnsubscribeClaim | null> {
  try {
    if (token.length > 1000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
      return null;
    const [body, signature] = token.split(".");
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(secret),
        decode(signature),
        new TextEncoder().encode(body),
      ))
    )
      return null;
    const claim = JSON.parse(new TextDecoder().decode(decode(body)));
    if (
      claim.scope !== "ticket-email" ||
      !uuid.test(claim.u) ||
      !uuid.test(claim.r) ||
      !Number.isSafeInteger(claim.exp) ||
      claim.exp <= now
    )
      return null;
    return claim;
  } catch {
    return null;
  }
}

// Customer-token calls only; ownership and verified/legal eligibility are also
// enforced by the database. Never accept an email address or arbitrary user ID.
export async function loadEmailNotificationSettings(
  client: SupabaseClient,
  expectedUserId?: string,
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (
    error ||
    !user?.email_confirmed_at ||
    user.is_anonymous ||
    (expectedUserId && user.id !== expectedUserId)
  )
    throw new Error("Verified account required");
  const result = await client
    .from("curbside_email_settings")
    .select("enabled,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (result.error) throw new Error("Email preferences are unavailable");
  return { enabled: result.data?.enabled === true };
}
export async function saveEmailNotificationSettings(
  client: SupabaseClient,
  enabled: boolean,
  expectedUserId?: string,
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (
    error ||
    !user?.email_confirmed_at ||
    user.is_anonymous ||
    (expectedUserId && user.id !== expectedUserId) ||
    typeof enabled !== "boolean"
  )
    throw new Error("Verified account required");
  const updated = await client
    .from("curbside_email_settings")
    .update({ enabled })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (updated.error) throw new Error("Email preferences could not be saved");
  if (updated.data) return;
  const inserted = await client
    .from("curbside_email_settings")
    .insert({ user_id: user.id, enabled });
  if (inserted.error?.code === "23505") {
    const retry = await client
      .from("curbside_email_settings")
      .update({ enabled })
      .eq("user_id", user.id)
      .select("user_id")
      .single();
    if (!retry.error) return;
  } else if (!inserted.error) return;
  throw new Error("Email preferences could not be saved");
}
