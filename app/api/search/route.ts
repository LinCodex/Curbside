import { searchWithSnapshot } from "@/lib/snapshot-search";
import { normalizePlate } from "@/lib/domain";
import { geocode } from "@/lib/nyc";
import {
  readJson,
  rate,
  hash,
  turnstile,
  HttpError,
  config,
  sameOrigin,
} from "@/lib/runtime";
import { clientIp } from "@/lib/client-ip";
import {
  verifySearchRequest,
  SearchVerificationError,
} from "@/lib/search-verification";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = await readJson(req);
    const plate = normalizePlate(body);
    const ip = clientIp(
      req.headers,
      config().VERCEL === "1" ? "vercel" : "cloudflare",
    );
    await rate("search:" + (await hash(ip)), 30, 3600_000);
    const verification = await verifySearchRequest(
      req,
      { challenge: body.challenge, ip },
      async (challenge, address) => {
        if (!config().HCAPTCHA_SECRET_KEY && !config().TURNSTILE_SECRET_KEY)
          throw new HttpError(
            503,
            "Security verification is unavailable. Please try again later.",
          );
        await turnstile(challenge, address);
      },
    );
    const result = await searchWithSnapshot(plate, body.history === true);
    if (body.locations === true && !result.snapshot) {
      result.tickets = await Promise.all(
        result.tickets.map((t, i) =>
          i < 15 ? geocode(t) : Promise.resolve(t),
        ),
      );
    }
    return Response.json(result, {
      status: result.unavailable ? 503 : 200,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
        ...(verification.setCookie
          ? { "Set-Cookie": verification.setCookie }
          : {}),
        ...(verification.verifiedUntil
          ? {
              "X-TicketSafe-Verified-Until": String(verification.verifiedUntil),
            }
          : {}),
      },
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Search unavailable",
        ...(e instanceof SearchVerificationError ? { code: e.code } : {}),
      },
      {
        status:
          e instanceof HttpError || e instanceof SearchVerificationError
            ? e.status
            : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
