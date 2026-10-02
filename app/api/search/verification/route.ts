import { clientIp } from "@/lib/client-ip";
import { config } from "@/lib/runtime";
import {
  SearchVerificationError,
  statusSearchVerification,
} from "@/lib/search-verification";

export async function GET(req: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  };
  try {
    const ip = clientIp(
      req.headers,
      config().VERCEL === "1" ? "vercel" : "cloudflare",
    );
    return Response.json(await statusSearchVerification(req, { ip }), {
      headers,
    });
  } catch (error) {
    return Response.json(
      { verifiedUntil: null },
      {
        status: error instanceof SearchVerificationError ? error.status : 503,
        headers,
      },
    );
  }
}
