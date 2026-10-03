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
      <p>{tr("Daily alerts for new tickets on saved vehicles.")}</p>
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
        <span>{tr("Email me about new tickets")}</span>
      </label>
      <p>
        {available === true
          ? tr("Sent to your account email. Unsubscribe anytime.")
          : available === false
            ? tr("Email notifications are unavailable.")
            : tr("Checking email delivery availability…")}
      </p>
      {!legalAccepted && (
        <p>{tr("Accept the current terms before enabling ticket emails.")}</p>
      )}
      <p>{tr("SMS notifications are unavailable.")}</p>
      <div
        className="notification-status-slot"
        aria-live="polite"
        aria-atomic="true"
      >
        {error ? (
          <div role="alert">
            {tr(
              "Email preferences could not be loaded or saved. Please try again.",
            )}{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => void refresh(true)}
            >
              {tr("Try again")}
            </button>
          </div>
        ) : (
          <p>
            {saving
              ? tr("Saving email preferences…")
              : loading
                ? tr("Loading email preferences…")
                : "\u00a0"}
          </p>
        )}
      </div>
    </section>
  );
}
