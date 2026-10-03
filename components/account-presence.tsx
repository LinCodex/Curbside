"use client";
import { useEffect } from "react";
import { useSupabaseAccount } from "./use-supabase-account";
import { crmRequest } from "@/lib/crm";

export default function AccountPresence() {
  const { client, user } = useSupabaseAccount();
  useEffect(() => {
    if (!client || !user?.id) return;
    let active = true;
    let pending = false;
    let lastAttempt = 0;
    const heartbeat = async () => {
      if (
        !active ||
        pending ||
        document.visibilityState !== "visible" ||
        Date.now() - lastAttempt < 60_000
      )
        return;
      lastAttempt = Date.now();
      pending = true;
      try {
        await crmRequest(client, "presence");
      } catch {
        /* Presence never interrupts the account or starts retries. */
      } finally {
        pending = false;
      }
    };
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [client, user?.id]);
  return null;
}
