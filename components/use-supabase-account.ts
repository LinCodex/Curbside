"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function useSupabaseAccount(url?: string, key?: string) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
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
          setUser(session?.user || null);
          if (event === "PASSWORD_RECOVERY") setRecovering(true);
          if (event === "SIGNED_OUT") setRecovering(false);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const result = await c.auth.getUser();
        if (alive) {
          setUser(result.data.user);
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
