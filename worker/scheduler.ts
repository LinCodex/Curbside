// Deploy independently with worker/wrangler.jsonc. The Sites host handles the app;
// this inexpensive Cron Worker triggers its authenticated, leased D1 queue every 5 minutes.
export default {
  async scheduled(
    _event: ScheduledEvent,
    env: { APP_ORIGIN: string; JOBS_SECRET: string },
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      fetch(env.APP_ORIGIN + "/api/jobs", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.JOBS_SECRET },
      }).then((r) => {
        if (!r.ok) throw new Error("Curbside job batch failed: " + r.status);
      }),
    );
  },
};
