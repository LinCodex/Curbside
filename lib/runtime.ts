import { verifyHCaptcha } from "./captcha-verification";
export const config = () => process.env;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = async (s: string | ArrayBuffer) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof s === "string" ? new TextEncoder().encode(s) : s,
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const memLimits = new Map<string, { count: number; expiresAt: number }>();

export async function rate(key: string, cap: number, windowMs: number) {
  const now = Date.now();
  const existing = memLimits.get(key);
  if (!existing || now > existing.expiresAt) {
    for (const [id, item] of memLimits)
      if (item.expiresAt <= now) memLimits.delete(id);
    if (!existing && memLimits.size >= 10_000)
      throw new HttpError(
        429,
        "Too many requests. Please wait before trying again.",
      );
    memLimits.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > cap) {
    throw new HttpError(
      429,
      "Too many requests. Please wait before trying again.",
    );
  }
  return;
}
export async function readJson(req: Request, max = 16000) {
  if (Number(req.headers.get("content-length") ?? 0) > max)
    throw new HttpError(413, "Request is too large.");
  const body = await req.text();
  if (body.length > max) throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export const publicConfig = () => {
  const e = config();
  return {
    clerkKey: e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || null,
    mapboxToken:
      e.MAPBOX_PUBLIC_TOKEN ||
      e.NEXT_PUBLIC_MAPBOX_TOKEN ||
      e.MAPBOX_TOKEN ||
      e.MAPBOX_ACCESS_TOKEN ||
      (typeof process !== "undefined" &&
        (process.env?.MAPBOX_PUBLIC_TOKEN ||
          process.env?.NEXT_PUBLIC_MAPBOX_TOKEN ||
          process.env?.MAPBOX_TOKEN ||
          process.env?.MAPBOX_ACCESS_TOKEN)) ||
      null,
    turnstileKey: e.TURNSTILE_SITE_KEY || null,
    hcaptchaKey: e.HCAPTCHA_SITE_KEY || null,
    services: {
      accounts: !!(
        e.CLERK_SECRET_KEY &&
        e.SUPABASE_URL &&
        e.SUPABASE_SERVICE_ROLE_KEY
      ),
      email: false,
      sms: false,
      billing: false,
      ai: false,
      geocoding: !!e.NYC_GEOCLIENT_KEY,
      monitoring: false,
    },
  };
};
export function sameOrigin(req: Request) {
  if (["GET", "HEAD"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const expected = config().APP_ORIGIN;
  if (!expected || origin !== expected)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function turnstile(token: string | undefined, ip: string) {
  if (config().HCAPTCHA_SECRET_KEY) {
    if (!token) throw new HttpError(403, "Complete the security check.");
    let verified = false;
    try {
      verified = await verifyHCaptcha({
        secret: config().HCAPTCHA_SECRET_KEY!,
        sitekey: config().HCAPTCHA_SITE_KEY || "",
        token,
        ip,
      });
    } catch {
      throw new HttpError(
        503,
        "Security verification is temporarily unavailable. Please try again.",
      );
    }
    if (!verified)
      throw new HttpError(403, "Security check failed. Please try again.");
    return;
  }
  const secret = config().TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new HttpError(403, "Complete the security check.");
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    },
  );
  const data: any = await response.json();
  const appOrigin = config().APP_ORIGIN;
  let expected: string | null = null;
  try {
    if (appOrigin) expected = new URL(appOrigin).hostname;
  } catch {}
  if (!data.success || (expected && data.hostname !== expected))
    throw new HttpError(403, "Security check failed. Please try again.");
}
