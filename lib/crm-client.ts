import type { SupabaseClient } from "@supabase/supabase-js";

export type CrmRole = "master" | "admin" | "support";
export type CrmAdmin = { userId: string; email: string; role: CrmRole };
export type CrmUser = {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  vehicle_count: number;
  ticket_emails: boolean;
  announcement_emails: boolean;
  role: CrmRole | null;
  last_seen_at: string | null;
};
export type CrmUsers = {
  users: CrmUser[];
  total: number;
  page: number;
  pageSize: number;
};
export type CrmVehicle = {
  id: string;
  plate: string;
  state: string;
  nickname?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  created_at?: string;
};
export type CrmUserDetail = {
  user: CrmUser;
  vehicles: CrmVehicle[];
  notes: string;
  tags: string[];
  ticketEmails: boolean;
  announcementEmails: boolean;
};
export type CrmStats = {
  users: number;
  verifiedUsers: number;
  savedVehicles: number;
  ticketSubscribers: number;
  announcementSubscribers: number;
  onlineUsers: number;
  emailsSentToday: number;
  pendingEmails: number;
};
export type CrmCheck = { name: string; state: string; detail: string };
export type CrmPreview = {
  html: string;
  recipientCount: number;
  recipients: { id: string; email: string }[];
  eligible: boolean;
};
export type CrmSendResult = {
  campaignId: string;
  sent: number;
  failed: number;
  remaining: number;
  uncertain?: number;
  status: string;
};
export type CrmAccess = {
  user_id: string;
  email: string;
  role: CrmRole;
  created_at: string;
};
export type CrmEmail = {
  id?: string;
  campaign_id?: string;
  subject?: string;
  kind?: string;
  status?: string;
  created_at?: string;
  sent?: number;
  failed?: number;
  recipient_count?: number;
};

// The function verifies both the JWT and a current server-side CRM role on every
// action. Local session data only supplies the token; it never grants access.
export async function crmClientRequest<T>(
  client: SupabaseClient,
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const result = await client.functions.invoke("crm-admin", {
    body: { ...input, action },
  });
  if (result.error) {
    let message = "CRM unavailable. Please try again.";
    const context = result.error.context;
    if (context instanceof Response) {
      try {
        const body = await context.json();
        if (typeof body.error === "string") message = body.error;
        else if (typeof body.message === "string") message = body.message;
      } catch {
        /* Preserve a safe fallback for non-JSON responses. */
      }
      if (context.status === 401)
        message = "Your session expired. Please sign in again.";
      if (context.status === 403)
        message = "This account does not have access to this action.";
    }
    throw new Error(message);
  }
  if (!result.data || typeof result.data !== "object")
    throw new Error("CRM returned an invalid response.");
  if (typeof result.data.error === "string") throw new Error(result.data.error);
  return result.data as T;
}
