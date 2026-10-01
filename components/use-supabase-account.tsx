"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { publicConfig } from "../lib/runtime";

function useAccountClient(url?: string, key?: string) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!url || !key) {
      setLoading(false);
      return;
    }
    let alive = true;
    let revision = 0;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(false);
    import("@supabase/supabase-js")
      .then(async ({ createClient }) => {
        if (!alive) return;
        const c = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        setClient(c);
        const { data } = c.auth.onAuthStateChange((event, session) => {
          if (!alive) return;
          revision++;
          setUser(session?.user?.email_confirmed_at ? session.user : null);
          if (event === "PASSWORD_RECOVERY") setRecovering(true);
          if (event === "SIGNED_OUT") setRecovering(false);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const initialRevision = revision;
        const result = await c.auth.getUser();
        if (alive && initialRevision === revision) {
          setUser(
            result.data.user?.email_confirmed_at ? result.data.user : null,
          );
        }
        if (alive) {
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [url, key]);
  return { client, user, recovering, setRecovering, loading, error };
}

type Configuration = ReturnType<typeof publicConfig>;
type AccountContext = ReturnType<typeof useAccountClient> & {
  configuration: Configuration;
  setConfiguration: React.Dispatch<React.SetStateAction<Configuration>>;
};
const Context = createContext<AccountContext | null>(null);
export function useSupabaseAccount() {
  const account = useContext(Context);
  if (!account) throw new Error("Account provider is missing.");
  return account;
}
export function SupabaseAccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [configuration, setConfiguration] = useState<Configuration>({
    services: {},
  } as Configuration);
  const [configurationError, setConfigurationError] = useState(false);
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/config", { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Configuration unavailable");
        return response.json();
      })
      .then((value) => setConfiguration(value as Configuration))
      .catch(() => {
        if (!abort.signal.aborted) setConfigurationError(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setConfigurationLoaded(true);
      });
    return () => abort.abort();
  }, []);
  const account = useAccountClient(
    configuration.supabase?.url,
    configuration.supabase?.publishableKey,
  );
  return (
    <Context.Provider
      value={{
        ...account,
        loading:
          !configurationLoaded ||
          (!!configuration.supabase && !account.client && !account.error) ||
          account.loading,
        error: account.error || configurationError,
        configuration,
        setConfiguration,
      }}
    >
      {children}
    </Context.Provider>
  );
}
