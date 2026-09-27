import { normalizePlate } from "../lib/domain";
import { searchNYC, geocode } from "../lib/nyc";
import { readJson, rate, hash, turnstile, HttpError } from "../lib/runtime";

export const config = {
  runtime: "edge",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const plate = normalizePlate(body);
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    await rate("search:" + (await hash(ip)), 30, 3600_000);
    await turnstile(body.challenge, ip);
    const result = await searchNYC(plate, body.history === true);
    if (body.locations === true) {
      result.tickets = await Promise.all(
        result.tickets.map((t, i) =>
          i < 15 ? geocode(t) : Promise.resolve(t),
        ),
      );
    }
    return new Response(JSON.stringify(result), {
      status: result.unavailable ? 503 : 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Search unavailable" }),
      {
        status: e instanceof HttpError ? e.status : 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default async function handler(req: any, res?: any) {
  if (req instanceof Request || !res) {
    return POST(req);
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const plate = normalizePlate(body);
    const ip =
      req.headers["cf-connecting-ip"] ||
      (typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : null) ||
      req.headers["x-real-ip"] ||
      "unknown";
    await rate("search:" + (await hash(ip)), 30, 3600_000);
    await turnstile(body.challenge, ip);
    const result = await searchNYC(plate, body.history === true);
    if (body.locations === true) {
      result.tickets = await Promise.all(
        result.tickets.map((t, i) =>
          i < 15 ? geocode(t) : Promise.resolve(t),
        ),
      );
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(result.unavailable ? 503 : 200).json(result);
  } catch (e: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(e instanceof HttpError ? e.status : 400).json({
      error: e instanceof Error ? e.message : "Search unavailable",
    });
  }
}
