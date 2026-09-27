import { actor, ownedVehicle, dealerFor } from "@/lib/auth";
import {
  all,
  one,
  run,
  db,
  config,
  uid,
  hash,
  HttpError,
  readJson,
  rate,
  sameOrigin,
  requireService,
  publicConfig,
} from "@/lib/runtime";
import { normalizePlate, plateKey, activePlan } from "@/lib/domain";
import { searchNYC, geocode } from "@/lib/nyc";
import {
  checkout,
  billingPortal,
  twilio,
  requireCanceledRenewals,
} from "@/lib/providers";
import { caseFor, draftCase, evidenceUpload, evidenceLinks } from "@/lib/cases";
import { LEGAL_VERSION, OFFERS } from "@/lib/legal";
async function handler(req: Request) {
  try {
    sameOrigin(req);
    const user = await actor(req);
    await rate("app:" + user.id, 200, 60_000);
    const path = new URL(req.url).pathname.replace("/api/app/", "").split("/");
    const method = req.method;
    const id = path[1];
    const action = path[2];
    const body =
      method === "GET" ||
      method === "DELETE" ||
      action === "evidence" ||
      action === "receipt"
        ? {}
        : await readJson(req, 24000);
    let result: any;
    const accepted = await one(
      "SELECT id FROM consents WHERE owner_id=? AND channel='terms' AND action='accepted' AND version=? LIMIT 1",
      user.id,
      LEGAL_VERSION,
    );
    if (
      method !== "GET" &&
      !accepted &&
      !["legal", "account", "sms-stop", "billing", "settings"].includes(path[0])
    )
      throw new HttpError(
        409,
        "Review and accept the current terms in your account before continuing.",
      );
    if (path[0] === "legal" && method === "POST") {
      if (
        body.version !== LEGAL_VERSION ||
        body.accepted !== true ||
        body.adult !== true
      )
        throw new HttpError(
          400,
          "Confirm that you are 18 or older and accept the current terms.",
        );
      if (!accepted)
        await run(
          "INSERT INTO consents (id,owner_id,channel,action,version,created_at) VALUES (?,?,?,?,?,?)",
          uid(),
          user.id,
          "terms",
          "accepted",
          LEGAL_VERSION,
          Date.now(),
        );
      result = { accepted: true, version: LEGAL_VERSION };
    } else if (path[0] === "me" && method === "GET") {
      const sponsor = await one(
        "SELECT s.*,d.name FROM sponsorships s JOIN dealers d ON d.id=s.dealer_id WHERE s.owner_id=? AND s.expires_at>?",
        user.id,
        Date.now(),
      );
      const vehicles = await all<any>(
        "SELECT * FROM vehicles WHERE owner_id=? ORDER BY created_at",
        user.id,
      );
      const observations = await all<any>(
        "SELECT o.*,v.plate,v.state FROM observations o JOIN vehicles v ON v.id=o.vehicle_id WHERE v.owner_id=? ORDER BY o.first_seen DESC LIMIT 3000",
        user.id,
      );
      result = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          plan: activePlan(user, sponsor),
          timezone: user.timezone,
          emailAlerts: !!user.email_alerts,
          phone: user.phone,
          phoneVerified: !!user.phone_verified,
          smsConsent: !!user.sms_consent && !user.sms_stopped,
          legalAccepted: !!accepted,
        },
        sponsor,
        vehicles,
        tickets: observations.map((o) => ({
          ...JSON.parse(o.payload),
          vehicleId: o.vehicle_id,
          localStatus: o.local_status,
        })),
        cases: await all(
          "SELECT id,summons,status,updated_at FROM cases WHERE owner_id=? ORDER BY updated_at DESC",
          user.id,
        ),
        health: await all("SELECT * FROM health"),
        services: publicConfig().services,
      };
    } else if (path[0] === "vehicles" && method === "POST" && !id) {
      const p = normalizePlate(body);
      const sponsor = await one(
        "SELECT * FROM sponsorships WHERE owner_id=? AND expires_at>?",
        user.id,
        Date.now(),
      );
      const max = activePlan(user, sponsor) === "plus" ? 3 : 1;
      const count = await one<any>(
        "SELECT COUNT(*) count FROM vehicles WHERE owner_id=?",
        user.id,
      );
      if (count.count >= max)
        throw new HttpError(
          409,
          "Your plan allows " + max + " saved vehicle" + (max > 1 ? "s." : "."),
        );
      const vid = uid();
      const inserted = await run(
        "INSERT INTO vehicles (id,owner_id,plate,state,plate_type,plate_key,nickname,attributes,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM vehicles WHERE owner_id=?) < ? AND (SELECT COUNT(*) FROM vehicles) < 500",
        vid,
        user.id,
        p.plate,
        p.state,
        p.plateType,
        plateKey(p),
        String(body.nickname || "My vehicle").slice(0, 60),
        JSON.stringify({
          make: String(body.make || "").slice(0, 40),
          model: String(body.model || "").slice(0, 40),
          year: String(body.year || "").slice(0, 4),
          color: String(body.color || "").slice(0, 30),
        }),
        Date.now(),
        user.id,
        max,
      );
      if (!inserted.meta.changes)
        throw new HttpError(409, "Vehicle limit or pilot capacity reached.");
      result = {
        id: vid,
        message:
          "Vehicle saved. A complete initial scan will establish its baseline.",
      };
    } else if (path[0] === "vehicles" && id && method === "DELETE") {
      await ownedVehicle(id, user);
      const cases = await all<any>(
        "SELECT id FROM cases WHERE vehicle_id=?",
        id,
      );
      if (cases.length)
        throw new HttpError(
          409,
          "Remove or close dispute cases before deleting this vehicle.",
        );
      await run(
        "DELETE FROM notification_events WHERE job_id IN (SELECT id FROM jobs WHERE vehicle_id=?)",
        id,
      );
      await db().batch([
        db().prepare("DELETE FROM observations WHERE vehicle_id=?").bind(id),
        db().prepare("DELETE FROM jobs WHERE vehicle_id=?").bind(id),
        db()
          .prepare("DELETE FROM vehicles WHERE id=? AND owner_id=?")
          .bind(id, user.id),
      ]);
      result = { removed: true };
    } else if (path[0] === "vehicles" && id && method === "PATCH") {
      await ownedVehicle(id, user);
      await run(
        "UPDATE vehicles SET nickname=?,monitoring=? WHERE id=? AND owner_id=?",
        String(body.nickname || "My vehicle").slice(0, 60),
        body.monitoring ? 1 : 0,
        id,
        user.id,
      );
      result = { saved: true };
    } else if (path[0] === "tickets" && id && method === "PATCH") {
      const v = await ownedVehicle(body.vehicleId, user);
      if (!["paid", "submitted", ""].includes(body.status))
        throw new HttpError(400, "Invalid ticket state.");
      await run(
        "UPDATE observations SET local_status=? WHERE vehicle_id=? AND summons=?",
        body.status || null,
        v.id,
        id,
      );
      result = { saved: true, cityConfirmationPending: !!body.status };
    } else if (path[0] === "locations" && method === "POST") {
      const v = await ownedVehicle(body.vehicleId, user);
      const rows = await all<any>(
        "SELECT * FROM observations WHERE vehicle_id=? LIMIT 30",
        v.id,
      );
      result = [];
      for (const row of rows) {
        const t = await geocode(JSON.parse(row.payload));
        await run(
          "UPDATE observations SET payload=? WHERE id=?",
          JSON.stringify(t),
          row.id,
        );
        result.push(t);
      }
    } else if (path[0] === "settings" && method === "PATCH") {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format();
      } catch {
        throw new HttpError(400, "Select a valid timezone.");
      }
      await run(
        "UPDATE users SET email_alerts=?,timezone=? WHERE id=?",
        body.emailAlerts ? 1 : 0,
        body.timezone,
        user.id,
      );
      await run(
        "INSERT INTO consents (id,owner_id,channel,action,version,created_at) VALUES (?,?,?,?,?,?)",
        uid(),
        user.id,
        "email",
        body.emailAlerts ? "opt-in" : "opt-out",
        LEGAL_VERSION,
        Date.now(),
      );
      result = { saved: true };
    } else if (path[0] === "phone" && method === "POST") {
      requireService(
        config().TWILIO_VERIFY_SERVICE_SID,
        "Phone verification is not configured.",
      );
      await rate("verify:" + user.id, 5, 86400_000);
      const phone = String(body.phone || "");
      if (!/^\+1[2-9]\d{9}$/.test(phone))
        throw new HttpError(400, "Enter a US number in +1 format.");
      await rate("verify-number:" + (await hash(phone)), 5, 86400_000);
      await rate("verify-cooldown:" + user.id, 1, 60000);
      await rate(
        "verify-global",
        Number(config().DAILY_VERIFY_CAP || 50),
        86400_000,
      );
      if (!body.consent) throw new HttpError(400, "SMS consent is required.");
      await twilio(
        "verify.twilio.com/v2/Services/" +
          config().TWILIO_VERIFY_SERVICE_SID +
          "/Verifications",
        { To: phone, Channel: "sms" },
      );
      await run(
        "UPDATE users SET phone=?,phone_verified=0,sms_consent=0 WHERE id=?",
        phone,
        user.id,
      );
      result = { sent: true };
    } else if (path[0] === "phone-confirm" && method === "POST") {
      if (!/^\d{4,8}$/.test(body.code || "") || !user.phone)
        throw new HttpError(400, "Enter the verification code.");
      await rate("verify-check:" + user.id, 8, 3600_000);
      const v = await twilio(
        "verify.twilio.com/v2/Services/" +
          config().TWILIO_VERIFY_SERVICE_SID +
          "/VerificationCheck",
        { To: user.phone, Code: body.code },
      );
      if (v.status !== "approved")
        throw new HttpError(400, "The code was not accepted.");
      await run(
        "UPDATE users SET phone_verified=1,sms_consent=1,sms_stopped=0 WHERE id=?",
        user.id,
      );
      await run(
        "INSERT INTO consents (id,owner_id,channel,action,version,created_at) VALUES (?,?,?,?,?,?)",
        uid(),
        user.id,
        "sms",
        "verified-opt-in",
        LEGAL_VERSION,
        Date.now(),
      );
      result = { verified: true };
    } else if (path[0] === "sms-stop" && method === "POST") {
      await run(
        "UPDATE users SET sms_consent=0,sms_stopped=1 WHERE id=?",
        user.id,
      );
      result = { stopped: true };
    } else if (path[0] === "checkout" && method === "POST") {
      requireService(
        config().COMMERCE_ENABLED === "true",
        "Paid services are not open yet. Billing and renewal setup must be completed first.",
      );
      if (
        !Object.hasOwn(OFFERS, body.kind || "") ||
        body.purchaseAccepted !== true ||
        body.legalVersion !== LEGAL_VERSION
      )
        throw new HttpError(
          400,
          "Review and accept the displayed purchase and renewal terms.",
        );
      if (body.kind === "ai") {
        const c = await caseFor(body.caseId, user);
        if (c.owner_id !== user.id || c.paid)
          throw new HttpError(409, "This case cannot be purchased.");
        requireService(
          config().AI_API_KEY && config().AI_MODEL,
          "AI drafting must be configured before purchase.",
        );
      }
      if (body.kind === "dealer") {
        await dealerFor(user);
      }
      await run(
        "INSERT INTO consents (id,owner_id,channel,action,version,created_at) VALUES (?,?,?,?,?,?)",
        uid(),
        user.id,
        "purchase",
        body.kind,
        LEGAL_VERSION,
        Date.now(),
      );
      result = { url: await checkout(user, body.kind, body.caseId) };
    } else if (path[0] === "billing" && method === "POST") {
      result = { url: await billingPortal(user.stripe_customer) };
    } else if (path[0] === "dealer" && method === "POST" && !id) {
      const name = String(body.name || "").trim();
      const slug = String(body.slug || "").toLowerCase();
      if (
        name.length < 2 ||
        name.length > 70 ||
        !/^[a-z][a-z0-9-]{2,40}$/.test(slug)
      )
        throw new HttpError(
          400,
          "Enter a name and a valid dealership URL name.",
        );
      await run(
        "INSERT INTO dealers (id,owner_id,name,slug) VALUES (?,?,?,?)",
        uid(),
        user.id,
        name,
        slug,
      );
      result = { created: true };
    } else if (path[0] === "dealer" && method === "GET") {
      const d = await dealerFor(user);
      result = {
        dealer: d,
        enrollments: await all(
          "SELECT id,created_at,expires_at FROM sponsorships WHERE dealer_id=? ORDER BY created_at DESC",
          d.id,
        ),
        invites: await all(
          "SELECT token,expires_at,claimed_by IS NOT NULL AS claimed FROM invitations WHERE dealer_id=? ORDER BY created_at DESC LIMIT 100",
          d.id,
        ),
      };
    } else if (
      path[0] === "dealer" &&
      id === "branding" &&
      method === "PATCH"
    ) {
      const d = await dealerFor(user);
      if (d.owner_id !== user.id)
        throw new HttpError(403, "Owner access required.");
      if (!/^#[0-9a-f]{6}$/i.test(body.color))
        throw new HttpError(400, "Choose a valid color.");
      await run(
        "UPDATE dealers SET name=?,color=? WHERE id=?",
        String(body.name).slice(0, 70),
        body.color,
        d.id,
      );
      result = { saved: true };
    } else if (path[0] === "dealer" && id === "invite" && method === "POST") {
      const d = await dealerFor(user);
      if (!d.active)
        throw new HttpError(
          409,
          "Activate dealership billing before creating sponsorship invitations.",
        );
      const token = uid() + uid();
      await run(
        "INSERT INTO invitations (token,dealer_id,expires_at,created_at) VALUES (?,?,?,?)",
        token,
        d.id,
        Date.now() + 30 * 86400_000,
        Date.now(),
      );
      result = { url: config().APP_ORIGIN + "/?invite=" + token };
    } else if (path[0] === "enroll" && method === "POST") {
      const invite = await one<any>(
        "SELECT i.*,d.active,d.capacity FROM invitations i JOIN dealers d ON d.id=i.dealer_id WHERE token=? AND expires_at>? AND claimed_by IS NULL",
        body.token,
        Date.now(),
      );
      if (!invite || !invite.active)
        throw new HttpError(409, "Invitation is unavailable.");
      const existing = await one(
        "SELECT id FROM sponsorships WHERE owner_id=?",
        user.id,
      );
      if (existing)
        throw new HttpError(409, "This account already has a sponsorship.");
      const sponsorshipId = uid();
      const now = Date.now();
      const writes = await db().batch([
        db()
          .prepare(
            "INSERT INTO sponsorships (id,dealer_id,owner_id,expires_at,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invitations WHERE token=? AND claimed_by IS NULL AND expires_at>?) AND (SELECT COUNT(*) FROM sponsorships WHERE dealer_id=? AND expires_at>?) < ?",
          )
          .bind(
            sponsorshipId,
            invite.dealer_id,
            user.id,
            now + 365 * 86400_000,
            now,
            body.token,
            now,
            invite.dealer_id,
            now,
            invite.capacity,
          ),
        db()
          .prepare(
            "UPDATE invitations SET claimed_by=? WHERE token=? AND claimed_by IS NULL AND EXISTS (SELECT 1 FROM sponsorships WHERE id=?)",
          )
          .bind(user.id, body.token, sponsorshipId),
      ]);
      if (!writes[0].meta.changes)
        throw new HttpError(409, "This sponsorship cannot be claimed.");
      result = { enrolled: true };
    } else if (path[0] === "cases" && method === "POST" && !id) {
      const v = await ownedVehicle(body.vehicleId, user);
      const o = await one(
        "SELECT id FROM observations WHERE vehicle_id=? AND summons=?",
        v.id,
        body.summons,
      );
      if (!o)
        throw new HttpError(
          404,
          "Save and scan this vehicle before opening a case.",
        );
      const cid = uid();
      await run(
        "INSERT INTO cases (id,owner_id,vehicle_id,summons,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        cid,
        user.id,
        v.id,
        body.summons,
        Date.now(),
        Date.now(),
      );
      result = { id: cid };
    } else if (path[0] === "cases" && id && method === "GET") {
      const c = await caseFor(id, user);
      result = { ...c, evidence: await evidenceLinks(c, user) };
    } else if (
      path[0] === "cases" &&
      id &&
      action === "evidence" &&
      method === "POST"
    ) {
      result = await evidenceUpload(req, user, id);
    } else if (
      path[0] === "cases" &&
      id &&
      action === "generate" &&
      method === "POST"
    ) {
      result = await draftCase(id, user, String(body.facts || ""));
    } else if (path[0] === "cases" && id && method === "PATCH") {
      const c = await caseFor(id, user);
      if (
        c.owner_id !== user.id ||
        !["draft", "approved", "rejected"].includes(c.status)
      )
        throw new HttpError(403, "Case cannot be edited.");
      const saved = await run(
        "UPDATE cases SET draft=?,facts=?,version=version+1,approved_version=NULL,status='draft',updated_at=? WHERE id=? AND version=? AND status IN ('draft','approved','rejected')",
        String(body.draft || "").slice(0, 15000),
        String(body.facts || "").slice(0, 6000),
        Date.now(),
        id,
        c.version,
      );
      if (!saved.meta.changes)
        throw new HttpError(409, "Case changed. Reload it before editing.");
      result = { saved: true };
    } else if (
      path[0] === "cases" &&
      id &&
      action === "approve" &&
      method === "POST"
    ) {
      const c = await caseFor(id, user);
      if (
        c.owner_id !== user.id ||
        !["draft", "approved"].includes(c.status) ||
        !body.confirmed ||
        !c.draft ||
        body.version !== c.version
      )
        throw new HttpError(
          409,
          "Review the current draft and confirm your facts first.",
        );
      const approved = await run(
        "UPDATE cases SET approved_version=version,status='approved',updated_at=? WHERE id=? AND version=? AND status IN ('draft','approved')",
        Date.now(),
        id,
        body.version,
      );
      if (!approved.meta.changes)
        throw new HttpError(409, "The case changed. Review it again.");
      result = { approved: true };
    } else if (
      path[0] === "cases" &&
      id &&
      action === "handoff" &&
      method === "POST"
    ) {
      const c = await caseFor(id, user);
      if (
        c.owner_id !== user.id ||
        c.status !== "approved" ||
        c.approved_version !== c.version
      )
        throw new HttpError(
          409,
          "Approve the current case before requesting filing.",
        );
      const p = await one<any>("SELECT * FROM partners WHERE active=1 LIMIT 1");
      if (!p)
        throw new HttpError(
          503,
          "Partner filing is not available yet. Export your reviewed statement and submit directly to NYC.",
        );
      if (!body.authorized)
        throw new HttpError(400, "Partner authorization is required.");
      const handedOff = await run(
        "UPDATE cases SET partner_id=?,status='awaiting authorization',updated_at=? WHERE id=? AND version=? AND approved_version=version AND status='approved'",
        p.id,
        Date.now(),
        id,
        c.version,
      );
      if (!handedOff.meta.changes)
        throw new HttpError(409, "The approved case changed. Review it again.");
      result = {
        status: "awaiting authorization",
        instructions: p.instructions,
        authorization: p.authorization_required,
      };
    } else if (path[0] === "partner" && method === "GET") {
      if (user.role !== "partner")
        throw new HttpError(403, "Partner access required.");
      result = {
        cases: await all(
          "SELECT id,summons,status,updated_at FROM cases WHERE partner_id=?",
          user.id,
        ),
      };
    } else if (
      path[0] === "partner" &&
      id &&
      action === "receipt" &&
      method === "POST"
    ) {
      result = await evidenceUpload(req, user, id, true);
    } else if (path[0] === "partner" && id && method === "PATCH") {
      const c = await caseFor(id, user);
      if (user.role !== "partner" || c.partner_id !== user.id)
        throw new HttpError(403, "Assigned partner access required.");
      if (body.status === "accepted") {
        if (
          c.status !== "awaiting authorization" ||
          c.approved_version !== c.version ||
          !body.authorizationVerified
        )
          throw new HttpError(409, "Verify customer authorization first.");
      } else if (body.status === "filed") {
        if (
          c.status !== "accepted" ||
          !body.receiptEvidenceId ||
          !body.filingReference
        )
          throw new HttpError(
            409,
            "An official filing receipt and reference are required.",
          );
        const receipt = await one<any>(
          "SELECT object_key FROM evidence WHERE id=? AND case_id=?",
          body.receiptEvidenceId,
          id,
        );
        if (!receipt) throw new HttpError(400, "Receipt evidence not found.");
        await run(
          "UPDATE cases SET receipt_key=?,filing_reference=? WHERE id=?",
          receipt.object_key,
          String(body.filingReference).slice(0, 100),
          id,
        );
      } else if (body.status === "resolved" && c.status !== "filed")
        throw new HttpError(409, "Only filed cases can be resolved.");
      else if (!["rejected", "resolved"].includes(body.status))
        throw new HttpError(400, "Invalid case state.");
      await run(
        "UPDATE cases SET status=?,outcome=?,updated_at=? WHERE id=?",
        body.status,
        String(body.outcome || "").slice(0, 2000),
        Date.now(),
        id,
      );
      result = { saved: true };
    } else if (path[0] === "account" && method === "DELETE") {
      await requireCanceledRenewals(user.stripe_customer);
      const dealer = await one(
        "SELECT id FROM dealers WHERE owner_id=?",
        user.id,
      );
      if (dealer)
        throw new HttpError(
          409,
          "Contact support to transfer or close your dealership before deleting its owner account.",
        );
      const pending = await one(
        "SELECT id FROM cases WHERE owner_id=? AND status IN ('accepted','filed','awaiting authorization')",
        user.id,
      );
      if (pending)
        throw new HttpError(
          409,
          "Resolve or withdraw active partner cases before deleting your account.",
        );
      const files = await all<any>(
        "SELECT object_key FROM evidence WHERE owner_id=?",
        user.id,
      );
      for (const f of files) await config().BUCKET?.delete(f.object_key);
      await run(
        "DELETE FROM notification_events WHERE job_id IN (SELECT id FROM jobs WHERE owner_id=?)",
        user.id,
      );
      await db().batch(
        [
          "jobs",
          "evidence",
          "cases",
          "observations",
          "vehicles",
          "consents",
          "sponsorships",
        ].map((table) =>
          db()
            .prepare(
              table === "observations"
                ? "DELETE FROM observations WHERE vehicle_id IN (SELECT id FROM vehicles WHERE owner_id=?)"
                : "DELETE FROM " + table + " WHERE owner_id=?",
            )
            .bind(user.id),
        ),
      );
      await run("DELETE FROM users WHERE id=?", user.id);
      result = { deleted: true };
    } else throw new HttpError(404, "Not found.");
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    const known = e instanceof HttpError;
    return Response.json(
      {
        error: known
          ? e.message
          : e instanceof Error && /UNIQUE/.test(e.message)
            ? "This record already exists."
            : "The request could not be completed. Please try again.",
      },
      {
        status: known ? e.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
