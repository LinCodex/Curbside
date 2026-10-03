import type { SupabaseClient } from "@supabase/supabase-js";

export type CrmRole = "master" | "admin" | "support";
export type CrmAction =
  | "me"
  | "stats"
  | "users"
  | "user"
  | "notes_save"
  | "roles"
  | "role_set"
  | "role_remove"
  | "email_preview"
  | "email_send"
  | "emails"
  | "status"
  | "debug"
  | "test_email"
  | "support_create"
  | "support_messages"
  | "support_delete"
  | "account_action"
  | "ticket_test"
  | "presence"
  | "announcement_preferences"
  | "announcement_preferences_save";
export async function crmRequest<T = Record<string, unknown>>(
  client: SupabaseClient,
  action: CrmAction,
  input: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.functions.invoke("crm-admin", {
    body: { ...input, action },
  });
  if (error) {
    let message = "This request could not be completed. Please try again.";
    try {
      const result = await error.context?.json();
      if (typeof result?.error === "string") message = result.error;
    } catch {
      /* Offline and gateway errors have no application JSON. */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function validatedEmailInput(input: Record<string, unknown>) {
  const kind =
    input.kind === "announcement"
      ? "announcement"
      : input.kind === "service"
        ? "service"
        : null;
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (
    !kind ||
    !subject ||
    subject.length > 160 ||
    /[\r\n]/.test(subject) ||
    !message ||
    message.length > 10000
  )
    throw new Error("Enter a subject and message within the size limits.");
  if (kind === "service" && !uuid(input.userId))
    throw new Error("Choose one customer for a service email.");
  return {
    kind,
    subject,
    message,
    userId: uuid(input.userId) ? (input.userId as string) : null,
  };
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function escapeCrmHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function crmEmailHtml(
  subject: string,
  message: string,
  origin: string,
  unsubscribeUrl?: string,
) {
  const safeOrigin = new URL(origin);
  if (safeOrigin.protocol !== "https:" && safeOrigin.hostname !== "localhost")
    throw new Error("Invalid app origin");
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#eef3f8;font-family:Arial,sans-serif;color:#182238"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:24px"><tr><td style="padding:32px"><p style="margin:0 0 24px;color:#245bdc;font-weight:800;font-size:24px">TicketSafe</p><h1 style="font-size:26px;line-height:1.3;margin:0 0 20px">${escapeCrmHtml(subject)}</h1><div style="font-size:16px;line-height:1.7;white-space:pre-line">${escapeCrmHtml(message).replace(/\n/g, "<br>")}</div><p style="margin:28px 0"><a href="${escapeCrmHtml(safeOrigin.origin)}" style="display:inline-block;padding:14px 24px;background:#245bdc;color:#fff;border-radius:12px;text-decoration:none;font-weight:700">Open TicketSafe</a></p><p style="color:#68758b;font-size:12px;line-height:1.6;margin:24px 0 0">TicketSafe · 136-78 Roosevelt Ave, Flushing, NY 11354${unsubscribeUrl ? `<br><a href="${escapeCrmHtml(unsubscribeUrl)}" style="color:#68758b">Unsubscribe from announcements</a>` : "<br>This service message concerns your TicketSafe account."}</p></td></tr></table></td></tr></table></body></html>`;
}
