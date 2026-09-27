import { readToken } from "@/lib/providers";
import { one, config } from "@/lib/runtime";
export async function GET(req: Request) {
  try {
    const p = await readToken(new URL(req.url).searchParams.get("token") || "");
    if (p.purpose !== "evidence") throw new Error();
    const item = await one<any>(
      "SELECT e.*,c.owner_id AS case_owner,c.partner_id FROM evidence e JOIN cases c ON c.id=e.case_id WHERE e.id=?",
      p.id,
    );
    if (!item || (p.actor !== item.case_owner && p.actor !== item.partner_id))
      throw new Error();
    const obj = await config().BUCKET.get(item.object_key);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "Content-Type": item.type,
        "Content-Disposition":
          'attachment; filename="' +
          item.name.replace(/[^a-zA-Z0-9._-]/g, "_") +
          '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Access denied", { status: 403 });
  }
}
