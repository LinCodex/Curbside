// Environment variable accessor compatible with Vercel (Edge & Serverless) and Cloudflare runtimes
const getEnv = (): Record<string, any> => {
  if (typeof process !== "undefined" && process.env) {
    return process.env as unknown as Record<string, any>;
  }
  // @ts-ignore
  if (typeof globalThis !== "undefined" && globalThis.env) {
    // @ts-ignore
    return globalThis.env as Record<string, any>;
  }
  return {} as Record<string, any>;
};

export const config = () => getEnv();
export const db = () => {
  const d = config().DB as D1Database | undefined;
  if (!d)
    throw new HttpError(503, "Storage is unavailable. Please try again later.");
  return d;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const one = async <T = any>(sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args)
    .first<T>();
export const all = async <T = any>(sql: string, ...args: any[]) =>
  (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results ?? [];
export const run = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args)
    .run();
export const uid = () => crypto.randomUUID();
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
  if (!config().DB) {
    const now = Date.now();
    const existing = memLimits.get(key);
    if (!existing || now > existing.expiresAt) {
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
  try {
    const bucket = Math.floor(Date.now() / windowMs);
    const k = key + ":" + bucket;
    const row = await one<any>(
      "INSERT INTO limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      k,
      (bucket + 2) * windowMs,
    );
    if (row && row.count > cap)
      throw new HttpError(
        429,
        "Too many requests. Please wait before trying again.",
      );
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) throw e;
  }
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
    clerkKey: e.CLERK_PUBLISHABLE_KEY || null,
    mapboxToken: e.MAPBOX_PUBLIC_TOKEN || null,
    turnstileKey: e.TURNSTILE_SITE_KEY || null,
    services: {
      accounts: !!e.CLERK_SECRET_KEY,
      email: !!(e.RESEND_API_KEY && e.EMAIL_FROM),
      sms: !!(
        e.TWILIO_ACCOUNT_SID &&
        e.TWILIO_AUTH_TOKEN &&
        e.TWILIO_VERIFY_SERVICE_SID &&
        e.TWILIO_MESSAGING_SERVICE_SID
      ),
      billing: !!e.STRIPE_SECRET_KEY && e.COMMERCE_ENABLED === "true",
      ai: !!(e.AI_API_KEY && e.AI_MODEL),
      geocoding: !!e.NYC_GEOCLIENT_KEY,
      monitoring: e.SCHEDULER_ENABLED === "true",
    },
  };
};
export function requireService(condition: any, message: string) {
  if (!condition) throw new HttpError(503, message);
}
export function sameOrigin(req: Request) {
  if (["GET", "HEAD"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const expected = config().APP_ORIGIN;
  if (!expected || origin !== expected)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function turnstile(token: string | undefined, ip: string) {
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
