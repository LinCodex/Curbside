"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseAccount } from "./use-supabase-account";
import {
  loadEmailNotificationSettings,
  saveEmailNotificationSettings,
} from "@/lib/email-notifications";

function useNotificationState(client: SupabaseClient | null, userId?: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const pending = useRef(false);
  const mutating = useRef(false);
  const revision = useRef(0);
  const loadedAt = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(
    async (force = false) => {
      if (
        !client ||
        !userId ||
        pending.current ||
        mutating.current ||
        (!force && Date.now() - loadedAt.current < 60_000)
      )
        return;
      pending.current = true;
      const request = revision.current;
      setError(false);
      // Publish the subscription as soon as the DB answers; provider status is independent.
      const results = await Promise.allSettled([
        loadEmailNotificationSettings(client, userId).then((settings) => {
          if (alive.current && request === revision.current)
            setEnabled(settings.enabled);
        }),
        client.functions
          .invoke("email-notifications", { body: { mode: "status" } })
          .then((status) => {
            if (status.error) throw status.error;
            if (alive.current) setAvailable(status.data?.available === true);
          }),
      ]);
      pending.current = false;
      if (!alive.current || request !== revision.current) return;
      const failed = results.some((result) => result.status === "rejected");
      setError(failed);
      if (!failed) loadedAt.current = Date.now();
    },
    [client, userId],
  );
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);
  const save = useCallback(
    async (next: boolean) => {
      if (!client || !userId || mutating.current) return;
      mutating.current = true;
      revision.current++;
      setSaving(true);
      setError(false);
      try {
        await saveEmailNotificationSettings(client, next, userId);
        const current = await client.auth.getUser();
        if (alive.current && current.data.user?.id === userId) {
          setEnabled(next);
        }
      } catch {
        if (alive.current) setError(true);
      } finally {
        mutating.current = false;
        if (alive.current) setSaving(false);
      }
    },
    [client, userId],
  );
  return {
    enabled,
    available,
    loading: enabled === null,
    saving,
    error,
    save,
    refresh,
  };
}
const Context = createContext<ReturnType<typeof useNotificationState> | null>(
  null,
);
function AccountNotificationState({
  client,
  userId,
  children,
}: {
  client: SupabaseClient | null;
  userId?: string;
  children: React.ReactNode;
}) {
  const value = useNotificationState(client, userId);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function NotificationPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, user } = useSupabaseAccount();
  // Remount on account changes: never display or reuse another account's preferences.
  return (
    <AccountNotificationState
      key={user?.id || "guest"}
      client={client}
      userId={user?.id}
    >
      {children}
    </AccountNotificationState>
  );
}
export function useNotificationPreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("Notification preferences provider is missing");
  return value;
}
