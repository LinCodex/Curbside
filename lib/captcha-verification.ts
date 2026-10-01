export async function verifyHCaptcha(
  {
    secret,
    sitekey,
    token,
    ip,
  }: {
    secret: string;
    sitekey: string;
    token: string;
    ip: string;
  },
  send: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 8192 || !secret || !sitekey) return false;
  const response = await send("https://api.hcaptcha.com/siteverify", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret,
      sitekey,
      response: token,
      ...(ip !== "unknown" ? { remoteip: ip } : {}),
    }),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
