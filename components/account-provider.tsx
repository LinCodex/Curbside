"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import type { publicConfig } from "@/lib/runtime";
type Configuration = ReturnType<typeof publicConfig>;
function useAccountState() {
  const { isLoaded, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const clerkUserId = clerkUser?.id;
  const [configuration, setConfiguration] = useState<Configuration>({
    services: {},
  } as Configuration);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Configuration unavailable");
        return response.json();
      })
      .then(setConfiguration)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setConfigured(true);
      });
    return () => controller.abort();
  }, []);
  const email = clerkUser?.primaryEmailAddress;
  const user =
    clerkUser && email?.verification.status === "verified"
      ? { id: clerkUser.id, email: email.emailAddress }
      : null;
  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      if (!clerkUserId) throw new Error("Please sign in to save cars.");
      const token = await getToken();
      const response = await fetch("/api/app/" + path, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Curbside-User": clerkUserId,
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Request unavailable");
      return value;
    },
    [clerkUserId, getToken],
  );
  return {
    user,
    clerk,
    request,
    configuration,
    setConfiguration,
    loading: !isLoaded || !configured,
    error,
  };
}
const Context = createContext<ReturnType<typeof useAccountState> | null>(null);
export function useAccount() {
  const account = useContext(Context);
  if (!account) throw new Error("Account provider is missing.");
  return account;
}
export function AccountProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useAccountState()}>{children}</Context.Provider>
  );
}
