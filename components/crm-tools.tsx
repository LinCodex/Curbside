"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Send, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crmClientRequest } from "@/lib/crm-client";
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
  const reload = () => {
    setLoading(true);
    setError("");
    setData(null);
    setConfirm("");
    setRevision((value) => value + 1);
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
              "Private support questions and feedback. Messages expire after 90 days.",
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
              <button
                className="crm-button"
                onClick={() => setConfirm(message.id)}
                disabled={!!deleting}
              >
                <Trash2 size={16} />
                {tr("Delete message")}
              </button>
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
  const [kind, setKind] = useState("reset_password");
  const [newEmail, setNewEmail] = useState("");
  const [notify, setNotify] = useState(false);
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
        newEmail: newEmail.trim().toLowerCase(),
        notify,
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
          "Only act at the customer's request. Verification links keep email and password changes under their control.",
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
            { value: "reset_password", label: tr("Send password reset") },
            { value: "change_email", label: tr("Change email address") },
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
              "Confirmation is sent to both the current and new address. Neither changes immediately.",
            )}
          </small>
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
          checked={notify}
          disabled={busy}
          onChange={(e) => {
            setNotify(e.target.checked);
            reset();
          }}
        />
        <span>{tr("Email the customer a status update")}</span>
      </label>
      <label className="crm-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || !!result}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{tr("The customer requested this action.")}</span>
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
              : result.verificationPending
                ? "Verification sent. Check inboxes and spam folders."
                : "Account action completed.",
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
  tr,
}: {
  client: SupabaseClient;
  userId: string;
  tr: Translate;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  return (
    <div className="crm-panel crm-test-panel">
      <h2>{tr("Test the latest saved ticket email")}</h2>
      <p>
        {tr(
          "Sends the selected customer's latest saved ticket, clearly marked TEST. It does not change discovery or reminder history.",
        )}
      </p>
      {!userId && <p>{tr("Select a customer above first.")}</p>}
      <label className="crm-check-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!userId || busy || !!result}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>{tr("Send one test email to this customer.")}</span>
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
              ? "Test email accepted. Check Resend for delivery."
              : "The action or delivery needs review. Check the customer and Resend before repeating.",
          )}
        </p>
      )}
      <button
        className="crm-button"
        disabled={!userId || !confirmed || busy || !!result}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            key.current ||= await operationKey(
              client,
              JSON.stringify({ kind: "ticket_test", userId }),
            );
            setResult(
              await crmClientRequest(client, "ticket_test", {
                userId,
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
        {tr("Send test ticket")}
      </button>
    </div>
  );
}
