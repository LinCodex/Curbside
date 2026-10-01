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
} from "@/lib/runtime";
import { clientIp } from "@/lib/client-ip";
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const plate = normalizePlate(body);
    const ip = clientIp(
      req.headers,
      config().VERCEL === "1" ? "vercel" : "cloudflare",
    );
    await rate("search:" + (await hash(ip)), 30, 3600_000);
    await turnstile(body.challenge, ip);
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
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Search unavailable" },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
