import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emailDeliveryAvailable,
  signEmailUnsubscribe,
  type EmailDeliveryConfig,
} from "../../../lib/email-notifications";
import {
  detailedTicketEmail,
  enrichTicketEmailDetails,
  readTicketEmailDetails,
  type TicketEmailContent,
} from "../../../lib/ticket-email";

type Job = {
  id: string;
  user_id: string;
  setting_revision: string;
  lease: string;
  recipient: string;
  language: string;
  ticket_count: number;
  created_at: string;
  ticket_details?: unknown;
  email_content?: TicketEmailContent | null;
};
export async function dispatchTicketEmails(
  admin: SupabaseClient,
  config: EmailDeliveryConfig,
  send: typeof fetch = fetch,
) {
  if (!emailDeliveryAvailable(config)) return { available: false, accepted: 0 };
  // Finish all the current morning's car checks before creating one daily
  // summary. A checking lease also blocks dispatch until its completion/retry.
  const due = await admin
    .from("curbside_vehicle_snapshots")
    .select("key", { count: "exact", head: true })
    .lte("next_check_at", new Date().toISOString());
  if (due.error || (due.count || 0) > 0)
    return { available: true, accepted: 0 };
  const claimed = await admin.rpc("curbside_claim_email_jobs");
  if (claimed.error) return { available: true, accepted: 0 };
  let accepted = 0;
  for (const job of (claimed.data || []) as Job[]) {
    const current = await admin.rpc("curbside_email_job_is_current", {
      job_id: job.id,
      lease_id: job.lease,
    });
    if (current.error || current.data !== true) {
      await admin.rpc("curbside_finish_email_job", {
        job_id: job.id,
        lease_id: job.lease,
        delivered: false,
        retryable: false,
      });
      continue;
    }
    let providerId: string | null = null;
    let retryable = true;
    try {
      const token = await signEmailUnsubscribe(
        job.user_id,
        job.setting_revision,
        Date.parse(job.created_at) + 365 * 86400_000,
        config.signingSecret!,
      );
      const unsubscribe = new URL(
        "/functions/v1/email-notifications",
        config.supabaseUrl!,
      );
      unsubscribe.searchParams.set("token", token);
      const garage = new URL("/", config.appOrigin!);
      garage.hash = "garage";
      let message = job.email_content;
      if (!message) {
        const details = await enrichTicketEmailDetails(
          readTicketEmailDetails(job.ticket_details),
        );
        const prepared = await detailedTicketEmail(
          job.ticket_count,
          job.language,
          garage.toString(),
          unsubscribe.toString(),
          details,
        );
        const frozen = await admin.rpc("curbside_freeze_email_content", {
          job_id: job.id,
          lease_id: job.lease,
          content: prepared,
        });
        if (frozen.error || !frozen.data)
          throw new Error("Email content could not be frozen");
        message = frozen.data as TicketEmailContent;
      }
      const eligible = await admin.rpc("curbside_email_job_is_current", {
        job_id: job.id,
        lease_id: job.lease,
      });
      if (eligible.error || eligible.data !== true) {
        retryable = false;
        throw new Error("Email subscription changed");
      }
      const response = await send("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `ticketsafe-new-tickets/${job.id}`,
        },
        body: JSON.stringify({
          from: `TicketSafe <${config.from}>`,
          to: [job.recipient],
          ...message,
          headers: {
            "List-Unsubscribe": `<${unsubscribe}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.id === "string" && data.id.length <= 100)
          providerId = data.id;
      } else if (response.status === 409) {
        const data = await response.json();
        retryable = data.name === "concurrent_idempotent_requests";
      } else if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 429].includes(response.status)
      )
        retryable = false;
      // Never log provider response bodies, recipient addresses, tokens or key.
    } catch {
      /* Retry a possibly accepted request only inside the 22h window. */
    }
    const finished = await admin.rpc("curbside_finish_email_job", {
      job_id: job.id,
      lease_id: job.lease,
      delivered: !!providerId,
      provider_id: providerId,
      retryable,
    });
    if (!finished.error && finished.data === true && providerId) accepted++;
  }
  return { available: true, accepted };
}
