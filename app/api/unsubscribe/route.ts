import { readToken } from "@/lib/providers";
import { run } from "@/lib/runtime";
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    const p = await readToken(token);
    if (p.purpose !== "unsubscribe") throw new Error();
    return new Response(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Curbside email preferences</title></head><body style="font:18px system-ui;background:#101a2a;color:white;padding:40px"><h1>Stop Curbside email alerts?</h1><p>This does not stop SMS or cancel your subscription.</p><form method="post"><button style="padding:15px;border-radius:20px">Unsubscribe from email alerts</button></form></body></html>',
      { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } },
    );
  } catch {
    return new Response("Invalid or expired link", { status: 403 });
  }
}
export async function POST(req: Request) {
  try {
    const p = await readToken(new URL(req.url).searchParams.get("token") || "");
    if (p.purpose !== "unsubscribe") throw new Error();
    await run("UPDATE users SET email_alerts=0 WHERE id=?", p.owner);
    return new Response("You have unsubscribed from Curbside email alerts.", {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Invalid or expired link", { status: 403 });
  }
}
