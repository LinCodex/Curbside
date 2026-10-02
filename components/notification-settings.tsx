"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseAccount } from "./use-supabase-account";
import { usePreferences } from "./preferences";
import {
  loadEmailNotificationSettings,
  saveEmailNotificationSettings,
} from "../lib/email-notifications";

export function NotificationSettings({
  legalAccepted,
}: {
  legalAccepted: boolean;
}) {
  const { client, user } = useSupabaseAccount();
  return (
    <NotificationSettingsState
      key={user?.id || "guest"}
      client={client}
      userId={user?.id}
      legalAccepted={legalAccepted}
    />
  );
}
function NotificationSettingsState({
  client,
  userId,
  legalAccepted,
}: {
  client: SupabaseClient | null;
  userId?: string;
  legalAccepted: boolean;
}) {
  const { tr } = usePreferences();
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!client || !userId) return;
    Promise.all([
      loadEmailNotificationSettings(client),
      client.functions.invoke("email-notifications", {
        body: { mode: "status" },
      }),
    ])
      .then(([settings, status]) => {
        if (!alive) return;
        setEnabled(settings.enabled);
        setAvailable(status.error ? null : status.data?.available === true);
        if (status.error) setError(true);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [client, userId, reload]);
  async function save(next: boolean) {
    if (!client || saving || !userId) return;
    const identity = userId;
    setSaving(true);
    setError(false);
    try {
      await saveEmailNotificationSettings(client, next);
      const current = await client.auth.getUser();
      if (current.data.user?.id === identity) setEnabled(next);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="notification-settings"
      aria-label={tr("Ticket notifications")}
    >
      <h3>{tr("Ticket notifications")}</h3>
      <p>
        {tr(
          "Daily email when newly found tickets appear for your saved cars. No balance-change emails. Your first complete check establishes a baseline and sends no alerts.",
        )}
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => void save(event.target.checked)}
          disabled={
            loading || saving || (!enabled && (!available || !legalAccepted))
          }
        />{" "}
        {tr("Email me about new tickets")}
      </label>
      <p>
        {available === true
          ? tr(
              "Sent to your verified account email. You can turn this off here or unsubscribe from an email.",
            )
          : available === false
            ? tr(
                "Email delivery is unavailable while the sender is being configured. No ticket emails are being sent.",
              )
            : tr("Checking email delivery availability…")}
      </p>
      {!legalAccepted && (
        <p>{tr("Accept the current terms before enabling ticket emails.")}</p>
      )}
      <p>
        {tr(
          "Emails include your saved vehicle, new-ticket details, reported balances, available location maps, and official NYC payment links. Only saved vehicles are monitored.",
        )}
      </p>
      <p>{tr("SMS notifications are unavailable.")}</p>
      {loading && <p role="status">{tr("Loading email preferences…")}</p>}
      {saving && <p role="status">{tr("Saving email preferences…")}</p>}
      {error && (
        <div role="alert">
          {tr(
            "Email preferences could not be loaded or saved. Please try again.",
          )}
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setError(false);
              setLoading(true);
              setAvailable(null);
              setReload((value) => value + 1);
            }}
          >
            {tr("Try again")}
          </button>
        </div>
      )}
    </section>
  );
}
