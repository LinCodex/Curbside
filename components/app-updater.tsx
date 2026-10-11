"use client";
import { useEffect } from "react";

const CURRENT = process.env.APP_BUILD_ID || "dev";
const ATTEMPT_KEY = "ticketsafe.update-attempt";

function editing() {
  const active = document.activeElement as HTMLElement | null;
  return (
    !!active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable)
  );
}

// Home Screen apps on iOS resume from memory instead of reloading, so they can
// keep running an old deployment for days. Reload once a newer one is live.
export default function AppUpdater() {
  useEffect(() => {
    if (CURRENT === "dev") return;
    let checking = false;
    let lastCheck = 0;
    let waiting = "";
    const apply = async (version: string) => {
      if (editing()) {
        waiting = version;
        return;
      }
      try {
        if (sessionStorage.getItem(ATTEMPT_KEY) === version) return;
        sessionStorage.setItem(ATTEMPT_KEY, version);
      } catch {
        /* Without storage a stale CDN response could loop; skip the reload. */
        return;
      }
      try {
        const registration = await navigator.serviceWorker?.getRegistration();
        await registration?.update();
      } catch {
        /* The reload still fetches the new page from the network. */
      }
      location.reload();
    };
    const check = async (force = false) => {
      if (checking || document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastCheck < 60_000) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        const { version } = await response.json();
        if (typeof version === "string" && version !== "dev" && version !== CURRENT)
          await apply(version);
      } catch {
        /* Offline or a transient error; try again on the next resume. */
      } finally {
        checking = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check(true);
    };
    const onFocusOut = () => {
      if (waiting)
        setTimeout(() => {
          if (waiting && !editing()) void apply(waiting);
        }, 300);
    };
    void check(true);
    const timer = setInterval(() => void check(), 5 * 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}
