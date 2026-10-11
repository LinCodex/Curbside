"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import CrmSelect from "./crm-select";
import {
  crmClientRequest,
  type CrmAuditEntry,
  type CrmReviewDelivery,
} from "@/lib/crm-client";

type Translate = (text: string) => string;

const ACTION_LABELS: Record<string, string> = {
  role_set: "Changed CRM access",
  role_remove: "Removed CRM access",
  notes_save: "Updated customer notes",
  email_create: "Sent an email",
  change_email: "Changed a sign-in email",
  set_password: "Set a new password",
  reset_password: "Sent a password reset",
  delete_account: "Deleted an account",
  ticket_test: "Sent a latest-ticket email",
  support_delete: "Deleted a support message",
  thread_delete: "Deleted a conversation",
  delivery_resolve: "Settled an uncertain delivery",
  template_save: "Saved an email template",
  template_delete: "Deleted an email template",
};

function dateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function auditDetail(entry: CrmAuditEntry, tr: Translate) {
  const detail = entry.detail || {};
  const parts: string[] = [];
  if (typeof detail.role === "string")
    parts.push(tr(detail.role === "admin" ? "Admin" : "Support"));
  if (typeof detail.kind === "string")
    parts.push(
      tr(
        (
          {
            announcement: "Announcement",
            service: "Service message",
            test: "Test email",
            support: "Support question",
            feedback: "Product feedback",
            bug: "Report a problem",
          } as Record<string, string>
        )[detail.kind] || detail.kind,
      ),
    );
  if (typeof detail.name === "string") parts.push(detail.name);
  if (detail.outcome === "sent") parts.push(tr("Marked sent"));
  if (detail.outcome === "failed") parts.push(tr("Marked failed"));
  if (detail.replied === true) parts.push(tr("Had a reply"));
  return parts.join(" · ");
}

export function CrmActivity({
  client,
  tr,
  locale,
}: {
  client: SupabaseClient;
  tr: Translate;
  locale: string;
}) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    entries?: CrmAuditEntry[];
    total?: number;
    error?: string;
  } | null>(null);
  const key = JSON.stringify({ filter, page, revision });
  useEffect(() => {
    let alive = true;
    const { filter: f, page: p } = JSON.parse(key);
    crmClientRequest<{ entries: CrmAuditEntry[]; total: number }>(
      client,
      "audit",
      { filter: f, page: p },
    ).then(
      (data) => {
        if (alive) setResult({ key, ...data });
      },
      (err) => {
        if (alive)
          setResult({
            key,
            error:
              err instanceof Error
                ? err.message
                : "CRM unavailable. Please try again.",
          });
      },
    );
    return () => {
      alive = false;
    };
  }, [client, key]);
  const current = result?.key === key ? result : null;
  const pages = Math.max(1, Math.ceil((current?.total || 0) / 25));
  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <h1>{tr("Activity")}</h1>
          <p>
            {tr(
              "Who changed access, accounts, emails, templates and the inbox. Entries are kept for 90 days.",
            )}
          </p>
        </div>
        <button
          className="crm-button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={!current}
        >
          <RefreshCw size={16} />
          {tr("Refresh")}
        </button>
      </div>
      <div className="crm-inbox-filter">
        <CrmSelect
          label={tr("Activity type")}
          value={filter}
          onChange={(value) => {
            setFilter(value || "all");
            setPage(1);
          }}
          options={[
            { value: "all", label: tr("All activity") },
            { value: "access", label: tr("Access") },
            { value: "accounts", label: tr("Account tools") },
            { value: "email", label: tr("Email") },
            { value: "inbox", label: tr("Support inbox") },
            { value: "notes", label: tr("Customer notes") },
            { value: "templates", label: tr("Templates") },
          ]}
        />
      </div>
      {!current && (
        <p className="crm-feedback" role="status">
          <LoaderCircle size={16} className="crm-spinner" />
          {tr("Loading…")}
        </p>
      )}
      {current?.error && (
        <p className="crm-error crm-feedback" role="alert">
          {tr(current.error)}
        </p>
      )}
      {current?.entries && (
        <div className="crm-panel crm-history">
          {current.entries.map((entry) => {
            const detail = auditDetail(entry, tr);
            return (
              <div className="crm-history-row" key={entry.id}>
                <div>
                  <strong>{tr(ACTION_LABELS[entry.action] || entry.action)}</strong>
                  <span>
                    {entry.actor_email || tr("Deleted account")}
                    {entry.has_target || entry.target_email
                      ? ` → ${entry.target_email || tr("Deleted account")}`
                      : ""}
                    {detail ? ` · ${detail}` : ""}
                  </span>
                </div>
                <time className="crm-tag" dateTime={entry.created_at}>
                  {dateTime(entry.created_at, locale)}
                </time>
              </div>
            );
          })}
          {!current.entries.length && (
            <p className="crm-empty">{tr("No activity yet.")}</p>
          )}
          {pages > 1 && (
            <nav className="crm-pagination" aria-label={tr("Page")}>
              <button
                className="crm-button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {tr("Previous")}
              </button>
              <span>
                {page} / {pages}
              </span>
              <button
                className="crm-button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                {tr("Next")}
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}

export function CrmDeliveryReview({
  client,
  tr,
  locale,
  onResolved,
}: {
  client: SupabaseClient;
  tr: Translate;
  locale: string;
  onResolved: () => void;
}) {
  const [items, setItems] = useState<CrmReviewDelivery[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState("");
  const [checked, setChecked] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    crmClientRequest<{ deliveries: CrmReviewDelivery[] }>(
      client,
      "delivery_review",
    ).then(
      (data) => {
        if (alive) setItems(data.deliveries);
      },
      () => {
        if (alive) setItems([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [client, revision]);
  if (!items?.length) return null;
  const resolve = async (id: string, outcome: "sent" | "failed") => {
    setBusy(true);
    setError("");
    try {
      await crmClientRequest(client, "delivery_resolve", {
        deliveryId: id,
        outcome,
        providerId: providerId.trim(),
        confirm: true,
      });
      setOpen("");
      setChecked(false);
      setProviderId("");
      setRevision((value) => value + 1);
      onResolved();
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
    <div className="crm-panel crm-review-panel">
      <h2>
        <TriangleAlert size={18} />
        {tr("Deliveries that need review")}
      </h2>
      <p className="crm-fine-print">
        {tr(
          "These emails were handed to Resend but the result never came back. Look each one up in Resend, then record what happened. Marking one doesn't send anything.",
        )}
      </p>
      {items.map((item) => (
        <div className="crm-review-row" key={item.id}>
          <div className="crm-review-summary">
            <div>
              <strong>{item.subject}</strong>
              <span>
                {item.recipient} ·{" "}
                {tr(item.support_reply ? "Support reply" : item.kind === "announcement" ? "Announcement" : "Service message")}{" "}
                · {dateTime(item.created_at, locale)}
              </span>
            </div>
            <button
              className="crm-button"
              onClick={() => {
                setOpen(open === item.id ? "" : item.id);
                setChecked(false);
                setProviderId(item.provider_id || "");
                setError("");
              }}
              disabled={busy}
            >
              {tr(open === item.id ? "Cancel" : "Settle")}
            </button>
          </div>
          {open === item.id && (
            <div className="crm-review-form">
              <label>
                {tr("Resend email ID (optional)")}
                <input
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                  maxLength={100}
                  disabled={busy}
                />
              </label>
              <label className="crm-check-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                  disabled={busy}
                />
                <span>{tr("I checked this email in Resend.")}</span>
              </label>
              <div className="crm-message-actions">
                <button
                  className="crm-button crm-primary"
                  disabled={!checked || busy}
                  onClick={() => void resolve(item.id, "sent")}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="crm-spinner" />
                  ) : (
                    <Check size={16} />
                  )}
                  {tr("Mark sent")}
                </button>
                <button
                  className="crm-button"
                  disabled={!checked || busy}
                  onClick={() => void resolve(item.id, "failed")}
                >
                  <X size={16} />
                  {tr("Mark failed")}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p className="crm-error crm-feedback" role="alert">
          {tr(error)}
        </p>
      )}
    </div>
  );
}
