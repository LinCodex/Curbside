"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { crmRequest } from "@/lib/crm";
import { useSupabaseAccount } from "./use-supabase-account";
import { usePreferences } from "./preferences";

const confirmedChoices = new Map<string, boolean>();
export default function AnnouncementSettings() {
  const { client, user } = useSupabaseAccount();
  const { tr } = usePreferences();
  const owner = user?.id || "";
  const currentOwner = useRef(owner);
  const revision = useRef(0);
  useEffect(() => {
    currentOwner.current = owner;
  }, [owner]);
  const [choice, setChoice] = useState<{
    owner: string;
    enabled: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const enabled =
    choice?.owner === owner ? choice.enabled : confirmedChoices.get(owner);
  const loading = enabled === undefined;
  const checkbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = loading;
  }, [loading]);
  useEffect(() => {
    if (!client || !owner) return;
    let active = true;
    const requestRevision = ++revision.current;
    void crmRequest<{ enabled: boolean }>(client, "announcement_preferences", {
      expectedUserId: owner,
    })
      .then((result) => {
        if (
          !active ||
          currentOwner.current !== owner ||
          requestRevision !== revision.current
        )
          return;
        confirmedChoices.set(owner, result.enabled === true);
        setChoice({ owner, enabled: result.enabled === true });
        setError(false);
      })
      .catch(() => {
        if (
          active &&
          currentOwner.current === owner &&
          requestRevision === revision.current
        )
          setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, owner, retry]);
  const save = async (next: boolean) => {
    if (!client || !owner || saving || loading) return;
    ++revision.current;
    setSaving(true);
    setError(false);
    try {
      const result = await crmRequest<{ enabled: boolean }>(
        client,
        "announcement_preferences_save",
        { enabled: next, expectedUserId: owner },
      );
      confirmedChoices.set(owner, result.enabled === true);
      if (currentOwner.current === owner)
        setChoice({ owner, enabled: result.enabled === true });
    } catch {
      if (currentOwner.current === owner) setError(true);
    } finally {
      if (currentOwner.current === owner) setSaving(false);
    }
  };
  if (!owner) return null;
  return (
    <section
      className="notification-settings announcement-settings"
      aria-label={tr("TicketSafe updates")}
    >
      <h3>{tr("TicketSafe updates")}</h3>
      <label className="notification-checkbox">
        <input
          ref={checkbox}
          className="notification-checkbox-input"
          type="checkbox"
          checked={enabled === true}
          disabled={loading || saving}
          aria-busy={loading || saving}
          onChange={(event) => void save(event.target.checked)}
        />
        <span className="notification-checkbox-mark" aria-hidden="true">
          {loading ? (
            <LoaderCircle className="notification-loading-icon" size={14} />
          ) : enabled ? (
            <Check size={15} strokeWidth={3} />
          ) : null}
        </span>
        <span>{tr("Product update emails")}</span>
      </label>
      <p>{tr("Optional · Unsubscribe anytime.")}</p>
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
              onClick={() => setRetry((value) => value + 1)}
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
