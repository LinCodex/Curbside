import { publicConfig } from "../lib/runtime";

export const config = {
  runtime: "edge",
};

export async function GET() {
  const cfg = publicConfig();
  if (!cfg.mapboxToken && typeof process !== "undefined" && process.env) {
    cfg.mapboxToken =
      process.env.MAPBOX_PUBLIC_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
      process.env.MAPBOX_TOKEN ||
      process.env.MAPBOX_ACCESS_TOKEN ||
      null;
  }
  return new Response(JSON.stringify(cfg), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default async function handler(req: any, res?: any) {
  if (req instanceof Request || !res) {
    return GET();
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const cfg = publicConfig();
  if (!cfg.mapboxToken && typeof process !== "undefined" && process.env) {
    cfg.mapboxToken =
      process.env.MAPBOX_PUBLIC_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
      process.env.MAPBOX_TOKEN ||
      process.env.MAPBOX_ACCESS_TOKEN ||
      null;
  }
  return res.status(200).json(cfg);
}
