import { config, HttpError, all, run } from "@/lib/runtime";
import { monitorBatch, deliveryBatch } from "@/lib/monitoring";
export async function POST(req: Request) {
  const e = config();
  if (
    !e.JOBS_SECRET ||
    req.headers.get("authorization") !== "Bearer " + e.JOBS_SECRET
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (e.SCHEDULER_ENABLED !== "true")
    return Response.json({ error: "Scheduler disabled" }, { status: 503 });
  try {
    const delivered = await deliveryBatch();
    const monitored = await monitorBatch(25);
    await deliveryBatch();
    await run("DELETE FROM cache WHERE expires_at<?", Date.now());
    await run("DELETE FROM limits WHERE expires_at<?", Date.now());
    return Response.json({ delivered, monitored });
  } catch {
    return Response.json(
      { error: "Job batch failed; inspect health and retry." },
      { status: 503 },
    );
  }
}
