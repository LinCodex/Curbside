"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mail, Send, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crmClientRequest, type CrmVehicle } from "@/lib/crm-client";
import { meetsPasswordRequirement, PASSWORD_REQUIREMENT } from "@/lib/password-policy";
import { usePreferences } from "./preferences";
import CrmSelect from "./crm-select";
import type { LanguagePreference, ThemePreference } from "@/lib/preferences";

type Translate = (text: string) => string;
export function CrmDisplaySettings({ tr }: { tr: Translate }) {
  const { theme, language, setTheme, setLanguage } = usePreferences();
  return (
    <div className="crm-display-settings">
      <CrmSelect
        label={tr("Appearance")}
        value={theme}
        onChange={(value) => setTheme(value as ThemePreference)}
        options={[
          { value: "system", label: tr("System theme") },
          { value: "light", label: tr("Light") },
          { value: "dark", label: tr("Dark") },
        ]}
      />
      <CrmSelect
        label={tr("Language")}
        value={language}
        onChange={(value) => setLanguage(value as LanguagePreference)}
        options={[
          { value: "system", label: tr("System language") },
          { value: "en", label: "English" },
          { value: "zh", label: "中文" },
        ]}
      />
    </div>
  );
}

type SupportMessage = {
  id: string;
  email: string;
  kind: string;
  subject: string;
  message: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};
type InboxResult = { messages: SupportMessage[]; page: number; total: number };
export function CrmInbox({
  client,
  tr,
  locale,
}: {
  client: SupabaseClient;
  tr: Translate;
  locale: string;
}) {
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InboxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState("");
  const [replyId, setReplyId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyReady, setReplyReady] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyNotice, setReplyNotice] = useState("");
  const reload = () => {
    setLoading(true);
    setError("");
    setData(null);
    setConfirm("");
    setReplyId("");
    setReplyNotice("");
    setRevision((value) => value + 1);
  };
  const sendReply = async (message: SupportMessage) => {
    const text = replyText.trim();
    if (!text || !replyReady || replying) return;
    setReplying(true);
    setError("");
    setReplyNotice("");
    try {
      await crmClientRequest(client, "support_reply", {
        messageId: message.id,
        reply: text,
        confirm: true,
      });
      setData((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === message.id
                  ? {
                      ...item,
                      reply: text,
                      replied_at: new Date().toISOString(),
                    }
                  : item,
              ),
            }
          : current,
      );
      setReplyText("");
      setReplyReady(false);
      setReplyId("");
      setReplyNotice(message.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The reply email was not accepted. Try again.",
      );
    } finally {
      setReplying(false);
    }
  };
  useEffect(() => {
    let active = true;
    crmClientRequest<InboxResult>(client, "support_messages", { page, kind })
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "CRM unavailable. Please try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, page, kind, revision]);
  const remove = async (id: string) => {
    setDeleting(id);
    setError("");
    try {
      await crmClientRequest(client, "support_delete", { messageId: id });
      setConfirm("");
      if (data?.messages.length === 1 && page > 1) {
        setLoading(true);
        setData(null);
        setConfirm("");
        setPage(page - 1);
      } else reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setDeleting("");
    }
  };
  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <h1>{tr("Support inbox")}</h1>
          <p>
            {tr(
              "Private support questions and feedback. Messages expire after 90 days. Replies are emailed from support@ezrefillny.net and include the customer's message.",
            )}
          </p>
        </div>
        <button
          className="crm-button"
          onClick={reload}
          disabled={loading}
        >
          {tr("Refresh")}
        </button>
      </div>
      <div className="crm-inbox-filter">
        <CrmSelect
          label={tr("Message type")}
          value={kind}
          onChange={(value) => {
            setLoading(true);
            setError("");
            setData(null);
            setConfirm("");
            setKind(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: tr("All messages") },
            { value: "support", label: tr("Support question") },
            { value: "feedback", label: tr("Product feedback") },
            { value: "bug", label: tr("Report a problem") },
          ]}
        />
      </div>
      {error && (
        <p className="crm-error crm-feedback" role="alert">
          {tr(error)}
        </p>
      )}
      {loading && (
        <p className="crm-feedback" role="status">
          <LoaderCircle size={16} className="crm-spinner" />
          {tr("Loading…")}
        </p>
      )}
      {data && !data.messages.length && (
        <div className="crm-panel">
          <p>{tr("No messages yet.")}</p>
        </div>
      )}
      <div className="crm-inbox-list">
        {data?.messages.map((message) => (
          <article className="crm-panel crm-support-message" key={message.id}>
            <div className="crm-message-meta">
              <span className="crm-tag">
                {tr(
                  message.kind === "support"
                    ? "Support question"
                    : message.kind === "feedback"
                      ? "Product feedback"
                      : "Report a problem",
                )}
              </span>
              <time dateTime={message.created_at}>
                {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.created_at))}
              </time>
            </div>
            <h2>{message.subject}</h2>
            <p className="crm-wrap crm-message-sender">{message.email}</p>
            <p className="crm-message-body">{message.message}</p>
            {message.reply && (
              <div className="crm-previous-reply">
                <span>
                  {tr("Previous reply")}
                  {message.replied_at
                    ? " · " +
                      new Intl.DateTimeFormat(
                        locale === "zh" ? "zh-CN" : "en-US",
                        { dateStyle: "medium", timeStyle: "short" },
                      ).format(new Date(message.replied_at))
                    : ""}
                </span>
                <p>{message.reply}</p>
              </div>
            )}
            {replyNotice === message.id && (
              <p className="crm-success" role="status">
                <Check size={16} />
                {tr("Reply sent to the customer's email.")}
              </p>
            )}
            {confirm === message.id ? (
              <div className="crm-delete-confirm">
                <span>{tr("Delete this message permanently?")}</span>
                <button
                  className="crm-button"
                  disabled={!!deleting}
                  onClick={() => void remove(message.id)}
                >
                  {tr("Confirm delete")}
                </button>
                <button
                  className="crm-button"
                  disabled={!!deleting}
                  onClick={() => setConfirm("")}
                >
                  {tr("Cancel")}
                </button>
              </div>
            ) : (
              <div className="crm-message-actions">
                <button
                  className="crm-button"
                  onClick={() => {
                    setConfirm("");
                    setReplyNotice("");
                    setReplyReady(false);
                    setReplyText("");
                    setReplyId(replyId === message.id ? "" : message.id);
                  }}
                  disabled={replying || !!deleting}
                >
                  <Mail size={16} />
                  {tr("Reply by email")}
                </button>
                <button
                  className="crm-button"
                  onClick={() => {
                    setReplyId("");
                    setConfirm(message.id);
                  }}
                  disabled={!!deleting || replying}
                >
                  <Trash2 size={16} />
                  {tr("Delete message")}
                </button>
              </div>
            )}
            {replyId === message.id && (
              <form
                className="crm-reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendReply(message);
                }}
              >
                <label className="stack small">
                  {tr("Your reply")}
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    required
                    disabled={replying}
                  />
                </label>
                <label className="crm-reply-confirm">
                  <input
                    type="checkbox"
                    checked={replyReady}
                    onChange={(event) => setReplyReady(event.target.checked)}
                    disabled={replying}
                  />
                  {tr("Send this reply to the customer's email.")}
                </label>
                <div className="crm-message-actions">
                  <button
                    className="crm-button"
                    disabled={
                      replying || !replyReady || !replyText.trim()
                    }
                  >
                    {replying ? (
                      <LoaderCircle size={16} className="crm-spinner" />
                    ) : (
                      <Send size={16} />
                    )}
                    {tr("Send reply")}
                  </button>
                  <button
                    className="crm-button"
                    type="button"
                    disabled={replying}
                    onClick={() => setReplyId("")}
                  >
                    {tr("Cancel")}
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
      {data && data.total > 20 && (
        <nav className="crm-pagination" aria-label={tr("Page")}>
          <button
            className="crm-button"
            disabled={page === 1 || loading}
            onClick={() => {
              setLoading(true);
              setData(null);
              setPage((v) => v - 1);
            }}
          >
            {tr("Previous")}
          </button>
          <span>
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <button
            className="crm-button"
            disabled={page * 20 >= data.total || loading}
            onClick={() => {
              setLoading(true);
              setData(null);
              setPage((v) => v + 1);
            }}
          >
            {tr("Next")}
          </button>
        </nav>
      )}
    </section>
  );
}

type ActionResult = {
  status: "completed" | "review" | "processing";
  mailStatus: string;
  verificationPending?: boolean;
};
async function operationKey(client: SupabaseClient, content: string) {
  const session = await client.auth.getSession();
  const owner = session.data.session?.user.id;
  if (!owner) throw new Error("Your session expired. Please sign in again.");
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  const storageKey =
    "ticketsafe.crm-account." +
    owner +
    "." +
    Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const fresh = crypto.randomUUID();
  try {
    const previous = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (previous?.key && previous.time > Date.now() - 86400000)
      return previous.key as string;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ key: fresh, time: Date.now() }),
    );
  } catch {
    /* The in-memory key still protects repeat clicks in this panel. */
  }
  return fresh;
}
export function CrmAccountActions({
  client,
  userId,
  email,
  tr,
  onComplete,
}: {
  client: SupabaseClient;
  userId: string;
  email: string;
  tr: Translate;
  onComplete?: () => void;
}) {
  const [kind, setKind] = useState("change_email");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  const reset = () => {
    setConfirmed(false);
    setResult(null);
    setError("");
    key.current = null;
  };
  const run = async () => {
    if (busy || !confirmed || result) return;
    setBusy(true);
    setError("");
    try {
      const input = {
        kind,
        userId,
        newEmail: kind === "change_email" ? newEmail.trim().toLowerCase() : "",
        password: kind === "set_password" ? password : "",
      };
      key.current ||= await operationKey(client, JSON.stringify(input));
      const value = await crmClientRequest<ActionResult>(
        client,
        "account_action",
        { ...input, confirm: true, idempotencyKey: key.current },
      );
      setResult(value);
      setConfirmed(false);
      if (value.status === "completed") onComplete?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="crm-account-actions crm-form">
      <h3>{tr("Account tools")}</h3>
      <p>
        {tr(
          "These changes apply immediately. The customer is emailed what changed. A new password is never included in the email.",
        )}
      </p>
      <label>
        {tr("Action")}
        <CrmSelect
          label={tr("Account action")}
          value={kind}
          disabled={busy}
          onChange={(value) => {
            setKind(value);
            reset();
          }}
          options={[
            { value: "change_email", label: tr("Change email address") },
            { value: "set_password", label: tr("Set a new password") },
            { value: "delete_account", label: tr("Delete account") },
          ]}
        />
      </label>
      {kind === "change_email" && (
        <label>
          {tr("New email address")}
          <input
            type="email"
            value={newEmail}
            maxLength={254}
            disabled={busy}
            onChange={(e) => {
              setNewEmail(e.target.value);
              reset();
            }}
          />
          <small>
            {tr(
              "The new address is applied immediately. Both the current and new address receive a notice.",
            )}
          </small>
        </label>
      )}
      {kind === "set_password" && (
        <label>
          {tr("New password")}
          <input
            type="password"
            value={password}
            maxLength={72}
            autoComplete="new-password"
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              reset();
            }}
          />
          <small>{tr(PASSWORD_REQUIREMENT)}</small>
        </label>
      )}
      {kind === "delete_account" && (
        <label>
          {tr("Type the customer's email to confirm deletion")}
          <input
            value={typedEmail}
            disabled={busy}
            onChange={(e) => setTypedEmail(e.target.value)}
            autoComplete="off"
          />
          <small>
            {tr(
              "Deletion is permanent. Saved cars and private account data are removed.",
            )}
          </small>
        </label>
      )}
      <label className="crm-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || !!result}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{tr("Apply this change to the customer's account now.")}</span>
      </label>
      {error && (
        <p className="crm-error" role="alert">
          {tr(error)}
        </p>
      )}
      {result && (
        <p
          className={
            result.status === "completed" ? "crm-success" : "crm-error"
          }
          role="status"
        >
          {tr(
            result.status !== "completed"
              ? "The action or delivery needs review. Check the customer and Resend before repeating."
              : "The customer was emailed about this change.",
          )}
        </p>
      )}
      <button
        className="crm-button"
        disabled={
          busy ||
          !confirmed ||
          !!result ||
          (kind === "change_email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) ||
          (kind === "set_password" && !meetsPasswordRequirement(password)) ||
          (kind === "delete_account" &&
            typedEmail.trim().toLowerCase() !== email.toLowerCase())
        }
        onClick={() => void run()}
      >
        {busy ? (
          <LoaderCircle className="crm-spinner" size={16} />
        ) : (
          <Check size={16} />
        )}{" "}
        {tr("Confirm action")}
      </button>
    </section>
  );
}

export function CrmTicketTest({
  client,
  userId,
  vehicles,
  tr,
}: {
  client: SupabaseClient;
  userId: string;
  vehicles: CrmVehicle[];
  tr: Translate;
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  const clear = () => {
    setConfirmed(false);
    setResult(null);
    setError("");
    key.current = null;
  };
  return (
    <div className="crm-panel crm-test-panel">
      <h2>{tr("Send this car's latest ticket")}</h2>
      <p>
        {tr(
          "Sends the selected car's most recent saved ticket to this customer, using the same email they receive when a new ticket is found. It does not change discovery or reminder history.",
        )}
      </p>
      {!vehicles.length ? (
        <p>{tr("No saved vehicles.")}</p>
      ) : (
        <label>
          {tr("Saved vehicle")}
          <CrmSelect
            label={tr("Saved vehicle")}
            value={vehicleId}
            disabled={busy}
            onChange={(value) => {
              setVehicleId(value);
              clear();
            }}
            options={vehicles.map((vehicle) => ({
              value: vehicle.id,
              label: `${vehicle.nickname || vehicle.plate} · ${vehicle.state} ${vehicle.plate}`,
            }))}
          />
        </label>
      )}
      <label className="crm-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!userId || !vehicleId || busy || !!result}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{tr("Send this car's latest ticket to the customer.")}</span>
      </label>
      {error && (
        <p className="crm-error" role="alert">
          {tr(error)}
        </p>
      )}
      {result && (
        <p
          className={
            result.status === "completed" ? "crm-success" : "crm-error"
          }
          role="status"
        >
          {tr(
            result.status === "completed"
              ? "The new-ticket email was accepted. Check the customer's inbox."
              : "The action or delivery needs review. Check the customer and Resend before repeating.",
          )}
        </p>
      )}
      <button
        className="crm-button"
        disabled={!userId || !vehicleId || !confirmed || busy || !!result}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            key.current ||= await operationKey(
              client,
              JSON.stringify({ kind: "ticket_test", userId, vehicleId }),
            );
            setResult(
              await crmClientRequest(client, "ticket_test", {
                userId,
                vehicleId,
                confirm: true,
                idempotencyKey: key.current,
              }),
            );
            setConfirmed(false);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "CRM unavailable. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle className="crm-spinner" size={16} />
        ) : (
          <Send size={16} />
        )}{" "}
        {tr("Send latest ticket")}
      </button>
    </div>
  );
}
