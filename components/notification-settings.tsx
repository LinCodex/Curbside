"use client";
import { useEffect, useRef } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { usePreferences } from "./preferences";
import { useNotificationPreferences } from "./notification-preferences";

export function NotificationSettings({
  legalAccepted,
}: {
  legalAccepted: boolean;
}) {
  const { tr } = usePreferences();
  const { enabled, available, loading, saving, error, save, refresh } =
    useNotificationPreferences();
  const checkbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = loading;
  }, [loading]);
  return (
    <section
      className="notification-settings"
      aria-label={tr("Ticket notifications")}
    >
      <h3>{tr("Ticket notifications")}</h3>
      <p>{tr("New tickets on saved cars, checked daily.")}</p>
      <label className="notification-checkbox">
        <input
          ref={checkbox}
          className="notification-checkbox-input"
          type="checkbox"
          checked={enabled === true}
          aria-busy={loading || saving}
          onChange={(event) => void save(event.target.checked)}
          disabled={
            loading || saving || (!enabled && (!available || !legalAccepted))
          }
        />
        <span className="notification-checkbox-mark" aria-hidden="true">
          {loading ? (
            <LoaderCircle className="notification-loading-icon" size={14} />
          ) : enabled ? (
            <Check size={15} strokeWidth={3} />
          ) : null}
        </span>
        <span>{tr("New-ticket emails")}</span>
      </label>
      <p>
        {available === true
          ? tr("Account email · Unsubscribe anytime.")
          : available === false
            ? tr("Email alerts unavailable.")
            : tr("Checking email service…")}
      </p>
      {!legalAccepted && <p>{tr("Accept the terms to enable alerts.")}</p>}
      <p className="notification-channel-note">
        {tr("SMS not available yet.")}
      </p>
      <div
        className="notification-status-slot"
        aria-live="polite"
        aria-atomic="true"
      >
        {error ? (
          <div role="alert">
            {tr("Could not update preferences.")}{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => void refresh(true)}
            >
              {tr("Try again")}
            </button>
          </div>
        ) : (
          <p>{saving ? tr("Saving…") : loading ? tr("Loading…") : "\u00a0"}</p>
        )}
      </div>
    </section>
  );
}
