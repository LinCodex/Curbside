import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { accountDatabase } from "@/lib/account-server";
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }
  if (event.type !== "user.deleted") return Response.json({ ok: true });
  if (!event.data.id)
    return Response.json({ error: "Missing identity" }, { status: 400 });
  try {
    const { error } = await accountDatabase().rpc("curbside_delete_clerk_account", {
      clerk_id: event.data.id,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Cleanup pending; retry delivery" },
      { status: 503 },
    );
  }
}
