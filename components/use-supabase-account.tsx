"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { publicConfig } from "../lib/runtime";
import { confirmedAccount, verifyBrowserAccount } from "@/lib/browser-account";
import {
  snapshotEmailConfirmation,
  type ConfirmationCallback,
} from "@/lib/email-confirmation";

function useAccountClient(url?: string, key?: string) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    let revision = 0;
    let verificationTimer: ReturnType<typeof setTimeout> | undefined;
    let verifiedToken: string | undefined;
    let verifiedUser: User | null = null;
    let unsubscribe: (() => void) | undefined;
    import("@supabase/supabase-js")
      .then(async ({ createClient }) => {
        if (!alive) return;
        setLoading(true);
        setError(false);
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
          const currentRevision = ++revision;
          clearTimeout(verificationTimer);
          if (event === "PASSWORD_RECOVERY") setRecovering(true);
          if (event === "SIGNED_OUT") setRecovering(false);
          if (!confirmedAccount(session?.user) || !session?.access_token) {
            verifiedToken = undefined;
            verifiedUser = null;
            setUser(null);
            setLoading(false);
            setError(false);
            return;
          }
          const sameAccount = verifiedUser?.id === session.user.id;
          if (
            sameAccount &&
            verifiedToken === session.access_token &&
            event !== "USER_UPDATED"
          ) {
            setLoading(false);
            return;
          }
          verifiedToken = undefined;
          // Token refresh keeps the previously verified profile mounted. New
          // session claims are published only after Auth verifies them.
          if (!sameAccount) {
            verifiedUser = null;
            setUser(null);
          }
          setLoading(!sameAccount);
          // Keep SDK calls outside its auth-state callback/initialization lock.
          verificationTimer = setTimeout(() => {
            void verifyBrowserAccount(c, session)
              .then((verified) => {
                if (!alive || currentRevision !== revision) return;
                verifiedToken = verified ? session.access_token : undefined;
                verifiedUser = verified;
                setUser(verified);
                setError(false);
              })
              .catch(() => {
                if (alive && currentRevision === revision) setError(true);
              })
              .finally(() => {
                if (alive && currentRevision === revision) setLoading(false);
              });
          }, 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const initialRevision = revision;
        const result = await c.auth.getSession();
        if (alive && initialRevision === revision) {
          try {
            const verified = await verifyBrowserAccount(c, result.data.session);
            if (alive && initialRevision === revision) {
              verifiedToken = verified
                ? result.data.session?.access_token
                : undefined;
              verifiedUser = verified;
              setUser(verified);
            }
          } catch {
            if (alive && initialRevision === revision) setError(true);
          } finally {
            if (alive && initialRevision === revision) setLoading(false);
          }
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
      clearTimeout(verificationTimer);
      unsubscribe?.();
    };
  }, [url, key]);
  return {
    client,
    user,
    recovering,
    setRecovering,
    loading: url && key ? loading : false,
    error,
  };
}

type Configuration = ReturnType<typeof publicConfig>;
type AccountContext = ReturnType<typeof useAccountClient> & {
  configuration: Configuration;
  setConfiguration: React.Dispatch<React.SetStateAction<Configuration>>;
  emailConfirmationCallback: ConfirmationCallback | null;
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
  const [emailConfirmationCallback] = useState(() =>
    typeof window === "undefined"
      ? null
      : snapshotEmailConfirmation(window.location.href),
  );
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
        emailConfirmationCallback,
      }}
    >
      {children}
    </Context.Provider>
  );
}
