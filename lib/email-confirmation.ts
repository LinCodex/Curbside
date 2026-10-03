import type { User } from "@supabase/supabase-js";

const PENDING_KEY = "ticketsafe.email-confirmation.pending";
export const CONFIRMATION_KEY = "ticketsafe.email-confirmation.completed";
const CHANNEL = "ticketsafe.email-confirmation";
const MAX_AGE = 24 * 60 * 60 * 1000;

type PendingConfirmation = { requestId: string; email: string; createdAt: number };
export type ConfirmationReceipt = { requestId: string; userId: string; createdAt: number };
export type ConfirmationCallback = {
  requestId: string;
  errorCode: string;
  hasCredentials: boolean;
  supported: boolean;
};
const validRequestId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

function readStored<T>(key: string): T | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (!value || !validRequestId(value.requestId) ||
      typeof value.createdAt !== "number" || value.createdAt > Date.now() ||
      Date.now() - value.createdAt > MAX_AGE) return null;
    if (key === PENDING_KEY && (typeof value.email !== "string" || !value.email.trim())) return null;
    if (key === CONFIRMATION_KEY && (typeof value.userId !== "string" || !value.userId)) return null;
    return value as T;
  } catch { return null; }
}

export function beginEmailConfirmation(email: string, origin: string) {
  const requestId = crypto.randomUUID();
  const pending: PendingConfirmation = { requestId, email: email.trim().toLowerCase(), createdAt: Date.now() };
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch {}
  return { requestId, redirectTo: `${origin}/auth/confirm?request=${requestId}` };
}

export function pendingEmailConfirmation(email: string) {
  const pending = readStored<PendingConfirmation>(PENDING_KEY);
  return pending?.email === email.trim().toLowerCase() ? pending.requestId : "";
}

export function parseConfirmationCallback(href: string): ConfirmationCallback {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const request = url.searchParams.get("request");
  const type = hash.get("type") || url.searchParams.get("type");
  return {
    requestId: validRequestId(request) ? request : "",
    errorCode: hash.get("error_code") || url.searchParams.get("error_code") ||
      (hash.has("error") || url.searchParams.has("error") ? "unknown" : ""),
    hasCredentials: !!hash.get("access_token") || !!url.searchParams.get("code"),
    supported: !type || type === "signup" || type === "email",
  };
}

// Capture this non-secret status in the parent provider before creating the
// Supabase client. Its URL session initialization removes the callback hash.
export function snapshotEmailConfirmation(href: string): ConfirmationCallback | null {
  return new URL(href).pathname === "/auth/confirm" ? parseConfirmationCallback(href) : null;
}

// Receipts affect explanatory UI only. Account access still requires Auth's
// server-verified session; a used/expired link is never accepted as a login.
export function confirmationOutcome(
  callback: ConfirmationCallback,
  user: Pick<User, "id" | "email" | "email_confirmed_at" | "is_anonymous"> | null,
  pending: PendingConfirmation | null,
  receipt: ConfirmationReceipt | null,
): "verified" | "already" | "unavailable" {
  if (!callback.supported) return "unavailable";
  const confirmed = !!user?.email_confirmed_at && !user.is_anonymous;
  const matchingRequest = !!callback.requestId && pending?.requestId === callback.requestId;
  const matchingAccount = confirmed && matchingRequest &&
    pending?.email === user?.email?.toLowerCase();
  const completed = !!callback.requestId && receipt?.requestId === callback.requestId &&
    typeof receipt?.userId === "string" && !!receipt.userId;
  if (callback.errorCode) {
    if (completed && (!confirmed || receipt?.userId === user?.id)) return "already";
    if (matchingAccount && callback.errorCode === "otp_expired") return "already";
    return "unavailable";
  }
  if (confirmed && callback.hasCredentials && (!matchingRequest || matchingAccount)) return "verified";
  if (completed && (!confirmed || receipt?.userId === user?.id)) return "already";
  if (matchingAccount) return "already";
  return "unavailable";
}

export function readConfirmationEvidence() {
  return {
    pending: readStored<PendingConfirmation>(PENDING_KEY),
    receipt: readStored<ConfirmationReceipt>(CONFIRMATION_KEY),
  };
}

export function notifyEmailConfirmed(requestId: string, userId: string) {
  if (!validRequestId(requestId) || !userId) return;
  const receipt: ConfirmationReceipt = { requestId, userId, createdAt: Date.now() };
  try { localStorage.setItem(CONFIRMATION_KEY, JSON.stringify(receipt)); } catch {}
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(receipt);
    channel.close();
  } catch {}
}

export function watchEmailConfirmation(onConfirmed: (receipt: ConfirmationReceipt) => void) {
  const receive = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const receipt = value as ConfirmationReceipt;
    if (validRequestId(receipt.requestId) && typeof receipt.userId === "string" &&
      receipt.userId && typeof receipt.createdAt === "number" &&
      Math.abs(Date.now() - receipt.createdAt) < MAX_AGE) onConfirmed(receipt);
  };
  const storage = (event: StorageEvent) => {
    if (event.key !== CONFIRMATION_KEY || !event.newValue) return;
    try { receive(JSON.parse(event.newValue)); } catch {}
  };
  const focus = () => receive(readStored<ConfirmationReceipt>(CONFIRMATION_KEY));
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => receive(event.data);
  } catch {}
  window.addEventListener("storage", storage);
  window.addEventListener("focus", focus);
  focus();
  return () => {
    channel?.close();
    window.removeEventListener("storage", storage);
    window.removeEventListener("focus", focus);
  };
}
