import { publicConfig } from "../lib/runtime";

export const config = {
  runtime: "edge",
};

export async function GET() {
  return new Response(JSON.stringify(publicConfig()), {
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
  return res.status(200).json(publicConfig());
}
