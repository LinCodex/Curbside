// These headers are trustworthy only on their named platform's ingress.
export function clientIp(
  headers: Pick<Headers, "get">,
  platform: "vercel" | "cloudflare",
) {
  return platform === "vercel"
    ? headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : headers.get("cf-connecting-ip")?.trim() || "unknown";
}
