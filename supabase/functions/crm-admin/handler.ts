import { detailedTicketEmail } from "../../../lib/ticket-email";
import { escapeCrmHtml } from "../../../lib/crm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crmEmailHtml, uuid, validatedEmailInput } from "../../../lib/crm";
import {
  emailDeliveryAvailable,
  signEmailUnsubscribe,
  verifyEmailUnsubscribe,
  type EmailDeliveryConfig,
} from "../../../lib/email-notifications";

type Config = EmailDeliveryConfig & {
  mapboxConfigured?: boolean;
  captchaConfigured?: boolean;
  mapboxToken?: string;
};
const actions = new Set([
  "support_create",
  "support_messages",
  "support_delete",
  "account_action",
  "ticket_test",
  "me",
  "stats",
  "users",
  "user",
  "notes_save",
  "roles",
  "role_set",
  "role_remove",
  "email_preview",
  "email_send",
  "emails",
  "status",
  "debug",
  "test_email",
  "presence",
  "announcement_preferences",
  "announcement_preferences_save",
]);
type Delivery = {
  id: string;
  recipient: string;
  user_id: string;
  consent_revision: string | null;
  kind: string;
  subject: string;
  message: string;
};
class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function boundedBody(request: Request) {
  if (!request.body) throw new RequestError("A request is required.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        throw new RequestError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new RequestError("Invalid request.");
  }
}
export function crmAdminHandler(
  admin: SupabaseClient,
  config: Config,
  allowedOrigins: string[],
  sendFetch: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
      Vary: "Origin",
    };
    if (origin && allowedOrigins.includes(origin))
      headers["Access-Control-Allow-Origin"] = origin;
    const reply = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.includes(origin))
      return reply({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return reply({});
    try {
      const token = new URL(request.url).searchParams.get("unsubscribe");
      if (token) {
        if (!["GET", "POST"].includes(request.method))
          throw new RequestError("Method not allowed.", 405);
        const claim = await verifyEmailUnsubscribe(
          token,
          (config.signingSecret || "") + ":announcements",
        );
        if (!claim)
          throw new RequestError(
            "This unsubscribe link is invalid or expired.",
          );
        if (request.method === "POST") {
          const { error } = await admin.rpc(
            "ticketsafe_unsubscribe_announcement",
            { account_id: claim.u, setting_revision: claim.r },
          );
          if (error)
            throw new RequestError(
              "Preferences are temporarily unavailable.",
              503,
            );
        }
        const posted = request.method === "POST";
        return new Response(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TicketSafe email preferences</title><body><main><h1>TicketSafe</h1><p>${posted ? "This link has been processed. Product announcements are turned off for its subscription. Ticket alerts are unchanged." : "Turn off product announcements. Your saved cars and ticket alerts will remain available."}</p>${posted ? "" : '<form method="post"><button type="submit">Unsubscribe from announcements</button></form>'}</main></body></html>`,
          {
            headers: {
              ...headers,
              "Content-Type": "text/html; charset=utf-8",
              "Content-Security-Policy":
                "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            },
          },
        );
      }
      if (request.method !== "POST")
        throw new RequestError("Method not allowed.", 405);
      const bearer = request.headers
        .get("authorization")
        ?.match(/^Bearer ([A-Za-z0-9_.-]{1,10000})$/i)?.[1];
      if (!bearer) throw new RequestError("Sign in to continue.", 401);
      const {
        data: { user },
        error: authError,
      } = await admin.auth.getUser(bearer);
      if (authError || !user?.email_confirmed_at || user.is_anonymous)
        throw new RequestError("Sign in with a verified account.", 401);
      let sessionId: string;
      try {
        const claims = JSON.parse(
          atob(bearer.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        if (!uuid(claims.session_id) || claims.sub !== user.id)
          throw new Error();
        sessionId = claims.session_id;
      } catch {
        throw new RequestError("Sign in again to continue.", 401);
      }
      const input = await boundedBody(request);
      const action = typeof input.action === "string" ? input.action : "";
      if (!actions.has(action)) throw new RequestError("Unknown CRM action.");
      if (input.userId !== undefined && !uuid(input.userId))
        throw new RequestError("Choose a valid customer.");
      for (const field of ["page", "pageSize"]) {
        if (
          input[field] !== undefined &&
          (!Number.isSafeInteger(input[field]) || Number(input[field]) < 1)
        )
          throw new RequestError("Choose a valid page.");
      }
      if (
        action === "notes_save" &&
        (typeof input.notes !== "string" ||
          !Array.isArray(input.tags) ||
          input.tags.some((tag) => typeof tag !== "string"))
      )
        throw new RequestError("Check the note and tags.");
      const rpc = async (
        operation: string,
        args: Record<string, unknown> = {},
      ) => {
        const { data, error } = await admin.rpc("ticketsafe_crm_request", {
          actor_id: user.id,
          session_id: sessionId,
          action: operation,
          input: args,
        });
        if (error) {
          const status =
            error.code === "42501"
              ? 403
              : error.code === "28000"
                ? 401
                : error.code === "P0001"
                  ? 400
                  : 503;
          throw new RequestError(
            status === 503
              ? "The CRM is temporarily unavailable."
              : error.message,
            status,
          );
        }
        return data;
      };
      if (["account_action", "ticket_test"].includes(action)) {
        const kind =
          action === "ticket_test" ? "ticket_test" : String(input.kind || "");
        if (
          ![
            "change_email",
            "reset_password",
            "delete_account",
            "ticket_test",
          ].includes(kind) ||
          !uuid(input.userId) ||
          !uuid(input.idempotencyKey) ||
          input.confirm !== true
        )
          throw new RequestError("Confirm this action first.");
        const newEmail =
          typeof input.newEmail === "string"
            ? input.newEmail.trim().toLowerCase()
            : "";
        if (
          kind === "change_email" &&
          (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) ||
            newEmail.length > 254)
        )
          throw new RequestError("Enter a valid new email address.");
        if (
          (kind !== "delete_account" || input.notify === true) &&
          !emailDeliveryAvailable(config)
        )
          throw new RequestError(
            "The verified email sender is not ready.",
            503,
          );
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            JSON.stringify({
              kind,
              userId: input.userId,
              newEmail,
              notify: input.notify === true,
            }),
          ),
        );
        const fingerprint = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        const claimed = await rpc("account_claim", {
          ...input,
          kind,
          fingerprint,
        });
        if (!claimed.claimed)
          return reply({
            status: claimed.status,
            mailStatus: claimed.mailStatus,
            replayed: true,
          });
        const operationId = claimed.operationId;
        let mailStatus = "not_requested";
        const mail = async (
          recipient: string,
          subject: string,
          html: string,
          text: string,
          suffix: string,
          attachments?: unknown[],
        ) => {
          await rpc("account_mail_claim", { operationId });
          const response = await sendFetch("https://api.resend.com/emails", {
            method: "POST",
            signal: AbortSignal.timeout(12000),
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `ticketsafe-account/${operationId}/${suffix}`,
            },
            body: JSON.stringify({
              from: `TicketSafe <${config.from}>`,
              to: [recipient],
              subject,
              html,
              text,
              ...(attachments?.length ? { attachments } : {}),
            }),
          });
          if (!response.ok || typeof (await response.json()).id !== "string")
            throw new Error("Email delivery needs review.");
          mailStatus = "accepted";
        };
        const linkMail = async (
          type: "recovery" | "email_change_current" | "email_change_new",
          recipient: string,
          suffix: string,
        ) => {
          const options = {
            redirectTo: new URL(
              type === "recovery" ? "/?auth=recovery" : "/?view=account",
              config.appOrigin,
            ).toString(),
          };
          const generated = await admin.auth.admin.generateLink(
            type === "recovery"
              ? { type, email: claimed.email, options }
              : { type, email: claimed.email, newEmail, options },
          );
          if (generated.error || !generated.data?.properties?.action_link)
            throw new Error("Account verification could not be prepared.");
          const zh = claimed.language === "zh";
          const subject =
            type === "recovery"
              ? zh
                ? "TicketSafe：重设密码"
                : "TicketSafe: reset your password"
              : zh
                ? "TicketSafe：确认邮箱变更"
                : "TicketSafe: confirm your email change";
          const message = zh
            ? "管理员应您的请求发起了此操作。请验证以继续；若非您本人请求，请联系支持。请检查垃圾邮件文件夹。"
            : "An administrator started this action at your request. Verify to continue. If you did not request it, contact support. Please check your spam folder.";
          const link = generated.data.properties.action_link;
          const html = crmEmailHtml(
            subject,
            message,
            config.appOrigin!,
          ).replace(
            "</div>",
            `<br><br><a href="${escapeCrmHtml(link)}">${zh ? "安全确认" : "Verify securely"}</a></div>`,
          );
          await mail(recipient, subject, html, message + "\n\n" + link, suffix);
        };
        try {
          if (kind === "reset_password")
            await linkMail("recovery", claimed.email, "reset");
          if (kind === "change_email") {
            await linkMail(
              "email_change_current",
              claimed.email,
              "current-email",
            );
            await linkMail("email_change_new", newEmail, "new-email");
          }
          if (kind === "delete_account") {
            const deleted = await admin.auth.admin.deleteUser(input.userId);
            if (deleted.error)
              throw new Error("Account deletion could not be completed.");
          }
          if (kind === "ticket_test") {
            const ticket = claimed.ticket;
            const origin = config.appOrigin!;
            const content = await detailedTicketEmail(
              1,
              claimed.language,
              new URL("/?view=garage", origin).toString(),
              new URL("/?view=account", origin).toString(),
              [
                {
                  ...ticket,
                  nickname: "",
                  location: ticket.location || {
                    label: "",
                    precision: "unknown",
                  },
                },
              ],
              { token: config.mapboxToken },
            );
            const testLabel =
              claimed.language === "zh"
                ? "测试邮件：以下为已保存的历史罚单，并非新发现的罚单。"
                : "TEST EMAIL: this is a saved historical ticket, not a newly discovered ticket.";
            const html = content.html
              .replace(
                "<h1",
                `<p style="color:#f0c17d;font-size:14px">${testLabel}</p><h1`,
              )
              .replace(
                /Turn off new-ticket emails/g,
                "Manage notification preferences",
              )
              .replace(/关闭新罚单邮件/g, "管理通知设置");
            await mail(
              claimed.email,
              "[TEST] " + content.subject,
              html,
              testLabel + "\n\n" + content.text,
              "ticket-test",
              content.attachments,
            );
          }
          if (input.notify === true && kind !== "ticket_test") {
            const zh = claimed.language === "zh";
            const subject = zh
              ? "TicketSafe：账户操作进度"
              : "TicketSafe: account action update";
            const message =
              kind === "delete_account"
                ? zh
                  ? "您的账户已删除。如非您请求，请联系支持。"
                  : "Your account has been deleted. If you did not request this, contact support."
                : kind === "change_email"
                  ? zh
                    ? "邮箱变更验证已发送，确认完成前不会生效。请检查原邮箱和新邮箱的收件箱及垃圾邮件文件夹。"
                    : "Email-change verification has been sent. The change takes effect only after confirmation. Check both inboxes and spam folders."
                  : zh
                    ? "密码重置链接已发送。密码将在您完成重置后更新。请检查收件箱及垃圾邮件文件夹。"
                    : "A password-reset link has been sent. Your password changes only when you finish the reset. Check your inbox and spam folder.";
            await mail(
              claimed.email,
              subject,
              crmEmailHtml(subject, message, config.appOrigin!),
              message,
              "status",
            );
          }
          await rpc("account_result", {
            operationId,
            status: "completed",
            mailStatus,
          });
          return reply({
            status: "completed",
            mailStatus,
            verificationPending: ["change_email", "reset_password"].includes(
              kind,
            ),
          });
        } catch {
          await rpc("account_result", {
            operationId,
            status: "review",
            mailStatus:
              mailStatus === "accepted" ? "partially_accepted" : "needs_review",
          });
          return reply({
            status: "review",
            mailStatus: "needs_review",
            message:
              "The action or delivery needs review. Check the customer and Resend before repeating.",
          });
        }
      }
      if (["email_preview", "email_send", "test_email"].includes(action)) {
        const draft =
          action === "test_email"
            ? {
                kind: "test",
                userId: user.id,
                subject: "Your TicketSafe email test",
                message:
                  "Your TicketSafe email connection is working. This message was requested from your administrator dashboard.",
              }
            : validatedEmailInput(input);
        const preview = await rpc("email_preview", draft);
        const html = crmEmailHtml(
          draft.subject,
          draft.message,
          config.appOrigin || "https://curbside-eta.vercel.app",
          draft.kind === "announcement"
            ? "https://example.invalid/unsubscribe-preview"
            : undefined,
        );
        if (action === "email_preview") return reply({ ...preview, html });
        if (input.confirm !== true)
          throw new RequestError("Confirm this send first.");
        if (!uuid(input.idempotencyKey))
          throw new RequestError("A unique send key is required.");
        if (!emailDeliveryAvailable(config))
          throw new RequestError(
            "The verified email sender is not ready.",
            503,
          );
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(draft)),
        );
        const fingerprint = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        const created = await rpc("email_create", {
          ...draft,
          confirm: true,
          idempotencyKey: input.idempotencyKey,
          fingerprint,
        });
        for (let attempt = 0; attempt < 10; attempt++) {
          const batch = await rpc("email_claim", {
            campaignId: created.campaignId,
          });
          const delivery = (batch.deliveries as Delivery[])[0];
          if (!delivery) break;
          // The durable claim never gets automatically reclaimed. An ambiguous
          // network result stays reviewable, rather than duplicating customer mail.
          let unsubscribeUrl: string | undefined;
          if (delivery.kind === "announcement") {
            const signed = await signEmailUnsubscribe(
              delivery.user_id,
              delivery.consent_revision!,
              Date.now() + 180 * 86400000,
              config.signingSecret! + ":announcements",
            );
            unsubscribeUrl = `${config.supabaseUrl}/functions/v1/crm-admin?unsubscribe=${encodeURIComponent(signed)}`;
          }
          try {
            const response = await sendFetch("https://api.resend.com/emails", {
              method: "POST",
              signal: AbortSignal.timeout(12000),
              headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `ticketsafe-crm/${delivery.id}`,
              },
              body: JSON.stringify({
                from: `TicketSafe <${config.from}>`,
                to: [delivery.recipient],
                subject: delivery.subject,
                html: crmEmailHtml(
                  delivery.subject,
                  delivery.message,
                  config.appOrigin!,
                  unsubscribeUrl,
                ),
                text:
                  delivery.message +
                  "\n\nTicketSafe · 136-78 Roosevelt Ave, Flushing, NY 11354" +
                  (unsubscribeUrl
                    ? "\nUnsubscribe from announcements: " + unsubscribeUrl
                    : ""),
                ...(unsubscribeUrl
                  ? {
                      headers: {
                        "List-Unsubscribe": `<${unsubscribeUrl}>`,
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                      },
                    }
                  : {}),
              }),
            });
            if (response.ok) {
              const body = await response.json();
              if (typeof body.id !== "string") break;
              await rpc("email_result", {
                deliveryId: delivery.id,
                status: "sent",
                providerId: body.id,
              });
            } else if (
              response.status >= 400 &&
              response.status < 500 &&
              response.status !== 429 &&
              response.status !== 408
            ) {
              await rpc("email_result", {
                deliveryId: delivery.id,
                status: "failed",
              });
            } else break;
          } catch {
            break;
          }
          // Resend's default API rate is two requests per second.
          await new Promise((resolve) => setTimeout(resolve, 550));
        }
        return reply(
          await rpc("email_progress", { campaignId: created.campaignId }),
        );
      }
      if (action === "status") {
        const state = await rpc("status");
        return reply({
          connections: [
            {
              name: "Supabase database",
              state: "ok",
              detail: "Authenticated query succeeded.",
            },
            {
              name: "Supabase authentication",
              state: "ok",
              detail: "Current account and live session verified.",
            },
            {
              name: "Resend sender",
              state: emailDeliveryAvailable(config)
                ? "configured"
                : "unavailable",
              detail:
                "Configuration check; use the self-test to verify delivery.",
            },
            {
              name: "Saved-vehicle checks",
              state: state.snapshotLastChecked ? "ok" : "pending",
              detail: state.snapshotLastChecked
                ? "Last successful check: " + state.snapshotLastChecked
                : "No successful saved-vehicle check recorded.",
            },
            {
              name: "Ticket email queue",
              state: state.ticketFailed ? "warning" : "ok",
              detail: `${state.ticketPending} pending · ${state.ticketFailed} failed`,
            },
            {
              name: "Mapbox email maps",
              state: config.mapboxConfigured ? "configured" : "unavailable",
              detail: "Server credential configuration only.",
            },
            {
              name: "hCaptcha",
              state: config.captchaConfigured ? "configured" : "unknown",
              detail: "Security provider configuration only.",
            },
            {
              name: "Vercel",
              state: "external",
              detail:
                "Hosting, Analytics and Speed Insights are monitored in the Vercel dashboard.",
            },
          ],
        });
      }
      if (action === "debug") {
        const result = await rpc(action, input);
        return reply({
          ...result,
          checks: [
            ...result.checks,
            {
              name: "Verified sender",
              state: emailDeliveryAvailable(config) ? "ok" : "unavailable",
              detail:
                "Dry run only. No emails sent and no ticket baselines changed.",
            },
            {
              name: "Mapbox email map",
              state: config.mapboxConfigured ? "ok" : "unavailable",
              detail: "Credential configured; no paid map request made.",
            },
          ],
        });
      }
      return reply(await rpc(action, input));
    } catch (error) {
      return reply(
        {
          error:
            error instanceof RequestError
              ? error.message
              : error instanceof Error &&
                  [
                    "Enter a subject and message within the size limits.",
                    "Choose one customer for a service email.",
                  ].includes(error.message)
                ? error.message
                : "This request could not be completed.",
        },
        error instanceof RequestError ? error.status : 400,
      );
    }
  };
}
