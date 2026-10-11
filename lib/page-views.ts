import type { SupabaseClient } from "@supabase/supabase-js";

export const COUNTED_PAGES = [
  "garage",
  "search",
  "map",
  "timeline",
  "account",
  "legal",
] as const;
export type CountedPage = (typeof COUNTED_PAGES)[number];

type PrivacySignals = {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  webdriver?: boolean;
};

export function pageViewsAllowed(signals: PrivacySignals) {
  return (
    signals.doNotTrack !== "1" &&
    !signals.globalPrivacyControl &&
    !signals.webdriver
  );
}

export function countedPage(view: string): CountedPage | null {
  return (COUNTED_PAGES as readonly string[]).includes(view)
    ? (view as CountedPage)
    : null;
}

export function recordPageView(
  client: Pick<SupabaseClient, "rpc"> | null,
  view: string,
  signals: PrivacySignals,
) {
  const page = countedPage(view);
  if (!client || !page || !pageViewsAllowed(signals)) return false;
  void Promise.resolve(
    client.rpc("ticketsafe_page_view", { page_name: page }),
  ).catch(() => {
    /* Counting never interrupts the app or retries. */
  });
  return true;
}

export function browserPrivacySignals(): PrivacySignals {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return {
    doNotTrack: nav.doNotTrack,
    globalPrivacyControl: !!nav.globalPrivacyControl,
    webdriver: !!nav.webdriver,
  };
}
