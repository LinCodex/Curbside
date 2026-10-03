"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { usePreferences } from "./preferences";
import PopupPresence from "./popup-presence";
import {
  analyticsConsentAllowed,
  cookieConsentHeader,
  createCookieConsent,
  readCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

const Context = createContext({
  analyticsEnabled: false,
  openSettings: () => {},
});
function browserConsentSnapshot() {
  return JSON.stringify({
    consent: readCookieConsent(document.cookie),
    signal:
      navigator.doNotTrack === "1" ||
      !!(navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl,
  });
}
export const useCookieConsent = () => useContext(Context);
export function CookieSettingsButton({
  className = "cookie-settings-link",
}: {
  className?: string;
}) {
  const { openSettings } = useCookieConsent();
  const { tr } = usePreferences();
  return (
    <button type="button" className={className} onClick={openSettings}>
      {tr("Cookie settings")}
    </button>
  );
}
export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const { tr } = usePreferences();
  const [sessionChoice, setSessionChoice] = useState<CookieConsent | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const subscribe = useCallback((notify: () => void) => {
    const onVisible = () => {
      if (document.visibilityState === "visible") notify();
    };
    window.addEventListener("focus", notify);
    window.addEventListener("ticketsafe-cookie-change", notify);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(notify, 60_000);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("ticketsafe-cookie-choice");
      channel.current.onmessage = notify;
    }
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", notify);
      window.removeEventListener("ticketsafe-cookie-change", notify);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current?.close();
      channel.current = null;
    };
  }, []);
  const snapshot = useSyncExternalStore(
    subscribe,
    browserConsentSnapshot,
    () => null,
  );
  const saved = useMemo(
    () =>
      snapshot
        ? (JSON.parse(snapshot) as {
            consent: CookieConsent | null;
            signal: boolean;
          })
        : { consent: null, signal: false },
    [snapshot],
  );
  const ready = snapshot !== null;
  const consent = saved.consent || sessionChoice;
  const signal = saved.signal;
  const openSettings = () => {
    setDraftAnalytics(
      readCookieConsent(document.cookie)?.analytics === true && !signal,
    );
    setSettingsOpen(true);
  };
  useEffect(() => {
    if (!settingsOpen || !dialog.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const active = dialog.current;
    active.showModal();
    return () => {
      active.close();
      previous?.focus();
    };
  }, [settingsOpen]);
  const save = (analytics: boolean) => {
    const next = createCookieConsent(analytics && !signal);
    document.cookie = cookieConsentHeader(next, location.protocol === "https:");
    const persisted = readCookieConsent(document.cookie);
    setStorageBlocked(!persisted);
    setSessionChoice(persisted ? null : next);
    setSettingsOpen(false);
    window.dispatchEvent(new Event("ticketsafe-cookie-change"));
    channel.current?.postMessage("changed");
  };
  const analyticsEnabled =
    ready &&
    !storageBlocked &&
    analyticsConsentAllowed(consent, { globalPrivacyControl: signal });
  return (
    <Context.Provider value={{ analyticsEnabled, openSettings }}>
      {children}
      <PopupPresence>
        {ready && !consent && !settingsOpen && (
          <section
            className="cookie-banner"
            aria-label={tr("Cookies and device storage")}
          >
            <div className="cookie-banner-copy">
              <h2>
                <Cookie size={18} aria-hidden="true" />
                {tr("Your privacy choices")}
              </h2>
              <p>
                {tr(
                  "We use essential cookies and device storage to keep TicketSafe working and remember your settings. Optional analytics help us improve the site.",
                )}{" "}
                <Link href="/legal/privacy">{tr("Privacy policy")}</Link>
              </p>
              {signal && (
                <p>{tr("Your browser privacy signal keeps analytics off.")}</p>
              )}
            </div>
            <div className="cookie-actions">
              <button
                type="button"
                className="cookie-choice"
                onClick={openSettings}
              >
                {tr("Customize")}
              </button>
              <button
                type="button"
                className="cookie-choice cookie-choice-decision"
                onClick={() => save(false)}
              >
                {tr("Necessary only")}
              </button>
              <button
                type="button"
                className="cookie-choice cookie-choice-decision"
                onClick={() => save(true)}
              >
                {tr("Accept all")}
              </button>
            </div>
          </section>
        )}
      </PopupPresence>
      {storageBlocked && (
        <p className="cookie-storage-status" role="status">
          {tr(
            "Your browser could not remember this choice. Analytics remain off.",
          )}
        </p>
      )}
      {
        <dialog
          ref={dialog}
          className="cookie-dialog"
          aria-labelledby="cookie-dialog-title"
          onCancel={() => setSettingsOpen(false)}
        >
          <div className="cookie-dialog-heading">
            <h2 id="cookie-dialog-title">{tr("Cookie settings")}</h2>
            <button
              type="button"
              className="cookie-close"
              aria-label={tr("Close cookie settings")}
              onClick={() => setSettingsOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <p>
            {tr(
              "Choose how TicketSafe uses cookies and similar technologies. You can change this anytime.",
            )}
          </p>
          <div className="cookie-purpose">
            <div>
              <strong>{tr("Strictly necessary")}</strong>
              <p>
                {tr(
                  "Sign-in, security, your privacy choice, and settings you ask us to remember. These keep the service working.",
                )}
              </p>
            </div>
            <span className="cookie-always-on">{tr("Always on")}</span>
          </div>
          <label className="cookie-purpose cookie-analytics">
            <div>
              <strong>{tr("Analytics")}</strong>
              <p>
                {tr(
                  "Vercel Analytics and Speed Insights measure public visits and page performance. No advertising cookies or private vehicle details.",
                )}
              </p>
            </div>
            <input
              type="checkbox"
              checked={draftAnalytics && !signal}
              onChange={(event) => setDraftAnalytics(event.target.checked)}
              disabled={signal}
            />
          </label>
          {signal && (
            <p className="cookie-signal">
              {tr("Your browser privacy signal keeps analytics off.")}
            </p>
          )}
          <p className="cookie-remember">
            {tr(
              "We remember your choice in this browser for six months, unless you clear cookies or our optional uses change.",
            )}{" "}
            <Link href="/legal/privacy" onClick={() => setSettingsOpen(false)}>
              {tr("Privacy policy")}
            </Link>
          </p>
          <div className="cookie-actions">
            <button
              type="button"
              className="cookie-choice cookie-choice-decision"
              onClick={() => save(false)}
            >
              {tr("Necessary only")}
            </button>
            <button
              type="button"
              className="cookie-choice cookie-choice-decision"
              onClick={() => save(true)}
            >
              {tr("Accept all")}
            </button>
            <button
              type="button"
              className="cookie-choice"
              onClick={() => save(draftAnalytics)}
            >
              {tr("Save choices")}
            </button>
          </div>
        </dialog>
      }
    </Context.Provider>
  );
}
