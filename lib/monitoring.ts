import { all, one, run, db, config, hash } from "./runtime";
import { searchNYC } from "./nyc";
import {
  plateKey,
  discoveryKind,
  reminder,
  quietUntil,
  activePlan,
  smsSegments,
  type Violation,
} from "./domain";
import { sendEmail, sendSMS, signedToken } from "./providers";
async function enqueue(
  user: any,
  vehicle: any,
  event: string,
  tickets: Violation[],
  now: number,
) {
  const when = new Date(quietUntil(new Date(now), user.timezone)).getTime();
  for (const channel of ["email", "sms"]) {
    const candidates =
      event === "baseline" ? ["baseline"] : tickets.map((t) => t.id);
    if (!candidates.length) continue;
    const ids: string[] = [];
    for (const id of candidates) {
      const key = [user.id, vehicle.id, channel, event, id].join(":");
      if (!(await one("SELECT key FROM notification_events WHERE key=?", key)))
        ids.push(id);
    }
    if (!ids.length) continue;
    const jobId = await hash(
      [user.id, vehicle.id, channel, event, ...ids.sort()].join(":"),
    );
    const payload = JSON.stringify({
      plate: vehicle.plate,
      state: vehicle.state,
      ids: event === "baseline" ? tickets.map((t) => t.id) : ids,
      count: event === "baseline" ? tickets.length : ids.length,
      event,
    });
    // The claims and delivery intent commit together. A racing insert rolls back
    // the batch; source observations are not advanced until enqueue succeeds.
    await db().batch([
      db()
        .prepare(
          "INSERT INTO jobs (id,owner_id,vehicle_id,channel,event,payload,not_before,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          jobId,
          user.id,
          vehicle.id,
          channel,
          event,
          payload,
          when,
          now,
          now,
        ),
      ...ids.map((id) =>
        db()
          .prepare(
            "INSERT INTO notification_events (key,job_id,created_at) VALUES (?,?,?)",
          )
          .bind(
            [user.id, vehicle.id, channel, event, id].join(":"),
            jobId,
            now,
          ),
      ),
    ]);
  }
}
export async function monitorBatch(limit = 25) {
  const now = Date.now();
  const lease = now + 10 * 60_000;
  const vehicles = await all<any>(
    "UPDATE vehicles SET next_check=? WHERE id IN (SELECT id FROM vehicles WHERE monitoring=1 AND next_check<=? ORDER BY next_check LIMIT ?) RETURNING *",
    lease,
    now,
    limit,
  );
  let checked = 0;
  for (const v of vehicles) {
    const user = await one<any>("SELECT * FROM users WHERE id=?", v.owner_id);
    if (!user) continue;
    try {
      const result = await searchNYC(
        { plate: v.plate, state: v.state, plateType: v.plate_type },
        !v.baseline_at,
      );
      const live = result.sources.find((x) => x.id === "nc67-uf89");
      if (!result.complete || !live?.ok) {
        await run(
          "UPDATE vehicles SET next_check=? WHERE id=?",
          now + 3600_000,
          v.id,
        );
        continue;
      }
      const previous = await all<any>(
        "SELECT * FROM observations WHERE vehicle_id=?",
        v.id,
      );
      const seen = new Map(previous.map((t) => [t.summons, t]));
      const fresh: Violation[] = [];
      const history: Violation[] = [];
      const reminderGroups = new Map<string, Violation[]>();
      for (const t of result.tickets) {
        const old = seen.get(t.id);
        if (!old) {
          (discoveryKind(t, new Date(v.created_at).toISOString()) === "history"
            ? history
            : fresh
          ).push(t);
        } else t.localStatus = old.local_status || undefined;
        const key = reminder(
          t,
          new Date(now),
          user.timezone,
          new Date(old?.first_seen ?? now).toISOString(),
        );
        if (key && v.baseline_at) {
          const group = reminderGroups.get(key) || [];
          group.push(t);
          reminderGroups.set(key, group);
        }
      } // Persist delivery intents before observations. Retry uses the same unique job keys.
      if (!v.baseline_at)
        await enqueue(user, v, "baseline", result.tickets, now);
      else {
        await enqueue(user, v, "new", fresh, now);
        await enqueue(user, v, "history", history, now);
        for (const [event, ts] of reminderGroups)
          await enqueue(user, v, event, ts, now);
      }
      for (let i = 0; i < result.tickets.length; i += 50)
        await db().batch(
          result.tickets.slice(i, i + 50).map((t) =>
            db()
              .prepare(
                "INSERT INTO observations (id,vehicle_id,summons,payload,first_seen,last_seen) VALUES (?,?,?,?,?,?) ON CONFLICT(vehicle_id,summons) DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen",
              )
              .bind(v.id + ":" + t.id, v.id, t.id, JSON.stringify(t), now, now),
          ),
        );
      await run(
        "UPDATE vehicles SET baseline_at=COALESCE(baseline_at,?),checked_at=?,next_check=? WHERE id=?",
        now,
        now,
        now + 86400_000,
        v.id,
      );
      checked++;
    } catch {
      await run(
        "UPDATE vehicles SET next_check=? WHERE id=?",
        now + 3600_000,
        v.id,
      );
    }
  }
  await run(
    "INSERT INTO health (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    "monitor",
    JSON.stringify({ checked }),
    now,
  );
  return checked;
}
export async function deliveryBatch(limit = 40) {
  const e = config();
  const now = Date.now();
  await run(
    "UPDATE jobs SET status='uncertain',error='Delivery lease expired; reconcile with provider before retrying.' WHERE status='sending' AND lease_until<?",
    now,
  );
  const jobs = await all<any>(
    "UPDATE jobs SET status='sending',lease_until=?,attempts=attempts+1,updated_at=? WHERE id IN (SELECT id FROM jobs WHERE status='pending' AND not_before<=? ORDER BY not_before LIMIT ?) RETURNING *",
    now + 120000,
    now,
    now,
    limit,
  );
  for (const j of jobs) {
    const user = await one<any>("SELECT * FROM users WHERE id=?", j.owner_id);
    const v = await one<any>(
      "SELECT * FROM vehicles WHERE id=? AND monitoring=1",
      j.vehicle_id,
    );
    const stop = async (reason: string) =>
      run(
        "UPDATE jobs SET status='suppressed',error=?,updated_at=? WHERE id=?",
        reason,
        now,
        j.id,
      );
    if (!user || !v) {
      await stop("Monitoring removed");
      continue;
    }
    const when = new Date(quietUntil(new Date(now), user.timezone)).getTime();
    if (when > now) {
      await run(
        "UPDATE jobs SET status='pending',not_before=? WHERE id=?",
        when,
        j.id,
      );
      continue;
    }
    const p = JSON.parse(j.payload);
    if (j.event.startsWith("reminder") || j.event === "late") {
      const obs = await all<any>(
        "SELECT summons,payload,local_status FROM observations WHERE vehicle_id=?",
        v.id,
      );
      const actionable = obs.filter(
        (o) =>
          p.ids.includes(o.summons) &&
          !o.local_status &&
          JSON.parse(o.payload).due !== 0,
      );
      if (!actionable.length) {
        await stop("Ticket is resolved or marked handled");
        continue;
      }
    }
    if (j.channel === "email" && (!user.email_alerts || !user.email_verified)) {
      await stop("Email not consented");
      continue;
    }
    if (
      j.channel === "sms" &&
      (!user.sms_consent || user.sms_stopped || !user.phone_verified)
    ) {
      await stop("SMS not consented");
      continue;
    }
    const available =
      j.channel === "email"
        ? e.RESEND_API_KEY && e.EMAIL_FROM
        : e.TWILIO_MESSAGING_SERVICE_SID;
    if (!available || !e.SIGNING_SECRET) {
      await run(
        "UPDATE jobs SET status='pending',not_before=?,attempts=attempts-1 WHERE id=?",
        now + 3600_000,
        j.id,
      );
      continue;
    }
    const label =
      j.event === "baseline"
        ? "Your existing-ticket summary is ready"
        : j.event === "history"
          ? "Additional ticket history is available"
          : j.event === "new"
            ? "A new ticket update is available"
            : "You have a ticket reminder";
    const masked = v.state + " •••" + v.plate.slice(-3);
    const text =
      label +
      " for " +
      masked +
      ". Open Curbside to review city records: " +
      e.APP_ORIGIN +
      "/";
    try {
      let providerId;
      if (j.channel === "email") {
        const unsubscribe =
          e.APP_ORIGIN +
          "/api/unsubscribe?token=" +
          (await signedToken({
            owner: user.id,
            purpose: "unsubscribe",
            exp: now + 180 * 86400_000,
          }));
        providerId = await sendEmail(
          user.email,
          "Curbside · " + label,
          text +
            "\n\nCity data may be delayed. No payment is collected by this alert.\n\nManage alerts: " +
            e.APP_ORIGIN +
            "/?view=account\nUnsubscribe: " +
            unsubscribe +
            "\n\nCurbside by Flushing NY Wireless\n136-78 Roosevelt Ave, Flushing, NY\nSupport: ezrefillyny@gmail.com",
          j.id,
          unsubscribe,
        );
      } else {
        const sponsor = await one(
          "SELECT * FROM sponsorships WHERE owner_id=? AND expires_at>?",
          user.id,
          now,
        );
        if (activePlan(user, sponsor, now) === "free") {
          await stop("SMS requires an active plan");
          continue;
        }
        const sms =
          "Curbside: " +
          label +
          " for " +
          v.state +
          " ***" +
          v.plate.slice(-3) +
          ". " +
          e.APP_ORIGIN +
          "/ Reply STOP to opt out.";
        const segments = smsSegments(sms);
        const month = new Date(now).toISOString().slice(0, 7);
        const capKey = "sms:" + user.id + ":" + month;
        const cap = await one<any>(
          "INSERT INTO limits (key,count,expires_at) VALUES (?,0,?) ON CONFLICT(key) DO UPDATE SET count=count RETURNING count",
          capKey,
          now + 62 * 86400_000,
        );
        if (cap.count + segments > 10) {
          await stop("Monthly SMS allowance reached; email remains active");
          continue;
        }
        const globalKey = "sms-global:" + month;
        await run(
          "INSERT OR IGNORE INTO limits (key,count,expires_at) VALUES (?,0,?)",
          globalKey,
          now + 62 * 86400_000,
        );
        const global = await one<any>(
          "UPDATE limits SET count=count+? WHERE key=? AND count+?<=? RETURNING count",
          segments,
          globalKey,
          segments,
          Number(e.MONTHLY_SMS_SEGMENT_CAP || 1000),
        );
        if (!global) {
          await stop("Service SMS budget reached");
          continue;
        }
        const reserved = await one<any>(
          "UPDATE limits SET count=count+? WHERE key=? AND count+?<=10 RETURNING count",
          segments,
          capKey,
          segments,
        );
        if (!reserved) {
          await stop("Monthly SMS allowance reached");
          continue;
        }
        const result = await sendSMS(user.phone, sms, j.id);
        providerId = result.sid;
      }
      await run(
        "UPDATE jobs SET status='sent',provider_id=?,updated_at=? WHERE id=?",
        providerId,
        Date.now(),
        j.id,
      );
    } catch {
      await run(
        "UPDATE jobs SET status='uncertain',error='Provider response uncertain; reconcile before retrying.',updated_at=? WHERE id=?",
        Date.now(),
        j.id,
      );
    }
  }
  await run(
    "INSERT INTO health (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    "delivery",
    JSON.stringify({ processed: jobs.length }),
    now,
  );
  return jobs.length;
}
