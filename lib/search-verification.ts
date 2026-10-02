const PASS_MS = 5 * 60_000;
const COOKIE = "__Host-ticketsafe-search";
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const randomId = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const unhex = (value: string) =>
  Uint8Array.from(value.match(/../g) || [], (pair) => parseInt(pair, 16));

export class SearchVerificationError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "SearchVerificationError";
    this.status = status;
    this.code = code;
  }
}

type Options = {
  secret?: string;
  ledgerUrl?: string;
  production?: boolean;
  send?: typeof fetch;
  now?: () => number;
};
type Pass = {
  v: 1;
  id: string;
  issuedAt: number;
  expiresAt: number;
  binding: string;
};
type LedgerInput = {
  action: "attempt" | "mint" | "consume";
  actor: string;
  passId?: string;
  expiresAt?: number;
};
export type SearchLedgerRequest = LedgerInput & {
  timestamp: number;
  nonce: string;
};
export type SearchLedgerResult = {
  status: "ok" | "captcha_required" | "rate_limited" | "replay";
};

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function mac(secret: string, purpose: string, value: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        await signingKey(secret),
        encoder.encode(purpose + "\n" + value),
      ),
    ),
  );
}
async function validMac(
  secret: string,
  purpose: string,
  value: string,
  signature: string,
) {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    unhex(signature),
    encoder.encode(purpose + "\n" + value),
  );
}
const encode = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (value: string) =>
  atob(value.replace(/-/g, "+").replace(/_/g, "/"));

function unavailable(): never {
  throw new SearchVerificationError(
    "Security verification is unavailable. Please try again later.",
    503,
    "verification_unavailable",
  );
}
function requireCaptcha(): never {
  throw new SearchVerificationError(
    "Complete a fresh security check to continue.",
    403,
    "captcha_required",
  );
}

// This factory also lets tests use the same protocol as the deployed handler.
export function createSearchVerification(options: Options) {
  const { secret, ledgerUrl } = options;
  const now = options.now || Date.now;
  const send = options.send || fetch;
  const production = options.production !== false;
  const cookieName = production ? COOKIE : "ticketsafe-search-dev";
  const configured = !!secret || !!ledgerUrl;
  const ready =
    !!secret &&
    encoder.encode(secret).length >= 32 &&
    !!ledgerUrl &&
    /^https:\/\//.test(ledgerUrl);
  async function binding(req: Request, ip: string) {
    return mac(
      secret!,
      "ticketsafe-search-binding-v1",
      JSON.stringify([ip, req.headers.get("user-agent") || ""]),
    );
  }
  async function readPass(req: Request, ip: string): Promise<Pass | null> {
    if (!ready || !ip || ip === "unknown") return null;
    const values = (req.headers.get("cookie") || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith(cookieName + "="));
    if (values.length !== 1) return null;
    const token = values[0].slice(cookieName.length + 1);
    if (token.length > 1024) return null;
    const [payload, signature, extra] = token.split(".");
    if (
      !payload ||
      !signature ||
      extra !== undefined ||
      !/^[A-Za-z0-9_-]+$/.test(payload)
    )
      return null;
    try {
      if (
        !(await validMac(
          secret!,
          "ticketsafe-search-cookie-v1",
          payload,
          signature,
        ))
      )
        return null;
      const pass: Pass = JSON.parse(decode(payload));
      const time = now();
      if (
        pass.v !== 1 ||
        !/^[0-9a-f]{32}$/.test(pass.id) ||
        !Number.isSafeInteger(pass.issuedAt) ||
        !Number.isSafeInteger(pass.expiresAt) ||
        pass.expiresAt - pass.issuedAt !== PASS_MS ||
        pass.issuedAt > time ||
        pass.expiresAt <= time ||
        pass.binding !== (await binding(req, ip))
      )
        return null;
      return pass;
    } catch {
      return null;
    }
  }
  async function ledger(input: LedgerInput) {
    const request: SearchLedgerRequest = {
      ...input,
      timestamp: now(),
      nonce: randomId(),
    };
    const body = JSON.stringify(request);
    try {
      const response = await send(ledgerUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TicketSafe-Signature": await mac(
            secret!,
            "ticketsafe-search-ledger-v1",
            body,
          ),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) unavailable();
      const result = (await response.json()) as SearchLedgerResult;
      if (result.status === "captcha_required") requireCaptcha();
      if (result.status === "rate_limited")
        throw new SearchVerificationError(
          "Too many searches. Please wait before trying again.",
          429,
          "rate_limited",
        );
      if (result.status !== "ok") unavailable();
    } catch (error) {
      if (error instanceof SearchVerificationError) throw error;
      unavailable();
    }
  }
  return {
    async status(req: Request, { ip }: { ip: string }) {
      if (configured && !ready) unavailable();
      const pass = await readPass(req, ip);
      // Status is a UI hint. The POST still atomically consumes the durable budget.
      return { verifiedUntil: pass?.expiresAt || null };
    },
    async verify(
      req: Request,
      { challenge, ip }: { challenge?: string; ip: string },
      verifyCaptcha: (
        challenge: string | undefined,
        ip: string,
      ) => Promise<unknown>,
    ): Promise<{ setCookie?: string; verifiedUntil?: number }> {
      if (!configured) {
        if ((await verifyCaptcha(challenge, ip)) === false) requireCaptcha();
        return {};
      }
      if (!ready || !ip || ip === "unknown") unavailable();
      const actor = await mac(secret!, "ticketsafe-search-ip-v1", ip);
      await ledger({ action: "attempt", actor });
      const pass = await readPass(req, ip);
      if (pass && !challenge) {
        await ledger({ action: "consume", actor, passId: pass.id });
        return { verifiedUntil: pass.expiresAt };
      }
      // Only successful provider verification can create a pass. A cookie is
      // never accepted as verification for Supabase sign-in or account actions.
      if (!challenge) requireCaptcha();
      if ((await verifyCaptcha(challenge, ip)) === false) requireCaptcha();
      const issuedAt = now();
      const created: Pass = {
        v: 1,
        id: randomId(),
        issuedAt,
        expiresAt: issuedAt + PASS_MS,
        binding: await binding(req, ip),
      };
      await ledger({
        action: "mint",
        actor,
        passId: created.id,
        expiresAt: created.expiresAt,
      });
      const payload = encode(JSON.stringify(created));
      const signature = await mac(
        secret!,
        "ticketsafe-search-cookie-v1",
        payload,
      );
      return {
        setCookie: `${cookieName}=${payload}.${signature}; Path=/; Max-Age=300; HttpOnly; SameSite=Strict${production ? "; Secure" : ""}`,
        verifiedUntil: created.expiresAt,
      };
    },
  };
}

function environmentOptions(): Options {
  return {
    secret: process.env.SEARCH_VERIFICATION_SECRET,
    ledgerUrl: process.env.SEARCH_VERIFICATION_LEDGER_URL,
    production: process.env.NODE_ENV !== "development",
  };
}
export const verifySearchRequest = (
  req: Request,
  input: { challenge?: string; ip: string },
  verifyCaptcha: (
    challenge: string | undefined,
    ip: string,
  ) => Promise<unknown>,
) =>
  createSearchVerification(environmentOptions()).verify(
    req,
    input,
    verifyCaptcha,
  );
export const statusSearchVerification = (req: Request, input: { ip: string }) =>
  createSearchVerification(environmentOptions()).status(req, input);

export function searchVerificationHandler(
  secret: string | undefined,
  consume: (request: SearchLedgerRequest) => Promise<SearchLedgerResult>,
  now = Date.now,
) {
  const reply = (value: unknown, status: number) =>
    Response.json(value, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  return async (req: Request) => {
    if (req.method !== "POST")
      return reply({ error: "Method not allowed" }, 405);
    if (!secret || encoder.encode(secret).length < 32)
      return reply({ error: "Unavailable" }, 503);
    try {
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: "Invalid request" }, 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 2048) {
          await reader.cancel();
          return reply({ error: "Invalid request" }, 413);
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (
        !(await validMac(
          secret,
          "ticketsafe-search-ledger-v1",
          body,
          req.headers.get("x-ticketsafe-signature") || "",
        ))
      )
        return reply({ error: "Unauthorized" }, 401);
      const input = JSON.parse(body) as SearchLedgerRequest;
      if (
        !Number.isSafeInteger(input.timestamp) ||
        Math.abs(now() - input.timestamp) > 30_000 ||
        !/^[0-9a-f]{32}$/.test(input.nonce) ||
        !/^[0-9a-f]{64}$/.test(input.actor) ||
        !["attempt", "mint", "consume"].includes(input.action) ||
        (input.action !== "attempt" &&
          !/^[0-9a-f]{32}$/.test(input.passId || "")) ||
        (input.action === "mint" &&
          (!Number.isSafeInteger(input.expiresAt) ||
            input.expiresAt! <= now() ||
            input.expiresAt! > input.timestamp + PASS_MS))
      )
        return reply({ error: "Invalid request" }, 400);
      return reply(await consume(input), 200);
    } catch {
      return reply({ error: "Unavailable" }, 503);
    }
  };
}
