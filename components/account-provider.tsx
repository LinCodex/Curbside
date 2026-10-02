"use client";
import { useCallback } from "react";
import {
  SupabaseAccountProvider,
  useSupabaseAccount,
} from "./use-supabase-account";
import { savedAccountRequest } from "@/lib/supabase-account";
export const AccountProvider = SupabaseAccountProvider;
export function useAccount() {
  const account = useSupabaseAccount();
  const request = useCallback(
    async (
      path: string,
      method = "GET",
      input: Record<string, unknown> = {},
    ) => {
      if (!account.client) throw new Error("Please sign in to save cars.");
      return savedAccountRequest(account.client, path, method, input);
    },
    [account.client],
  );
  return { ...account, request };
}
