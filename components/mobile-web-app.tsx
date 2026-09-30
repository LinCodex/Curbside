"use client";
import { usePreferences } from "./preferences";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  LoaderCircle,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import {
  INSTALL_HINT_KEY,
  isIOSDevice,
  shouldShowInstallGuide,
  pullDistance,
  PULL_THRESHOLD,
} from "@/lib/mobile";

export function InstallGuide({
  manualRequest = 0,
}: {
  manualRequest?: number;
}) {
  const { tr } = usePreferences();

  const [open, setOpen] = useState(false),
    [ios, setIOS] = useState(false),
    [standalone, setStandalone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      !!(navigator as any).standalone;
    const apple = isIOSDevice(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    );
    setIOS(apple);
    setStandalone(installed);
    let seen = false;
    try {
      seen = localStorage.getItem(INSTALL_HINT_KEY) === "seen";
    } catch {}
    if (shouldShowInstallGuide(apple, installed, seen)) {
      // Record presentation, not account data. Dismissal and later visits do not nag.
      try {
        localStorage.setItem(INSTALL_HINT_KEY, "seen");
      } catch {}
      setOpen(true);
    }
  }, []);
  useEffect(() => {
    if (manualRequest) setOpen(true);
  }, [manualRequest]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="install-guide"
      onCancel={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      aria-labelledby="install-title"
    >
      <div className="install-inner">
        <div className="row spread">
          <div className="install-brand">
            <img src="/apple-touch-icon.png" width="48" height="48" alt="" />
            <span>
              curbside<span className="brand-period">.</span>
              <small>{tr("Your garage, one tap away")}</small>
            </span>
          </div>
          <button
            className="round-control"
            aria-label={tr("Close installation guide")}
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="install-phone" aria-hidden="true">
          <div className="install-phone-notch" />
          <div className="install-phone-grid">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span key={i} />
            ))}
            <div className="install-phone-app">
              <img src="/apple-touch-icon.png" width="48" height="48" alt="" />
              <span>Curbside</span>
            </div>
          </div>
        </div>
        <div className="eyebrow">{tr("Curbside, one tap away")}</div>
        <h2 id="install-title">{tr("Make room for Curbside.")}</h2>
        {standalone ? (
          <p>
            {tr("Curbside is already opening as a web app on this device.")}
          </p>
        ) : (
          <>
            <p>
              {tr(
                "Open your garage like an app, with more room for what matters. No App Store download.",
              )}
            </p>
            <ol className="install-steps">
              <li>
                <Share size={20} />
                <div>
                  <strong>{tr("Open this website in Safari")}</strong>
                  <span>
                    {tr(
                      "Tap the Share button. It may be inside Safari’s More menu.",
                    )}
                  </span>
                </div>
              </li>
              <li>
                <PlusSquare size={20} />
                <div>
                  <strong>{tr("Choose Add to Home Screen")}</strong>
                  <span>
                    {tr(
                      "Scroll through the actions. If missing, choose Edit Actions to add it.",
                    )}
                  </span>
                </div>
              </li>
              <li>
                <Smartphone size={20} />
                <div>
                  <strong>{tr("Keep Open as Web App on")}</strong>
                  <span>
                    {tr(
                      "If that option appears, leave it enabled, then tap Add.",
                    )}
                  </span>
                </div>
              </li>
            </ol>
            {!ios && (
              <p className="small muted">
                {tr(
                  "These steps are for iPhone and iPad. On Android, use your browser’s Install app or Add to Home screen option.",
                )}
              </p>
            )}
            <p className="install-footnote">
              {tr(
                "Inside the app, pull down from the top to refresh. An internet connection is needed for current ticket records.",
              )}
            </p>
          </>
        )}
        <button className="primary-action" onClick={() => setOpen(false)}>
          {standalone ? tr("Back to Curbside") : tr("Got it")}
          <Check size={17} />
        </button>
      </div>
    </dialog>
  );
}

export function PullToRefresh({
  onRefresh,
  disabled = false,
}: {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}) {
  const { tr } = usePreferences();

  const [distance, setDistance] = useState(0),
    [refreshing, setRefreshing] = useState(false),
    [message, setMessage] = useState("");
  const latest = useRef({ onRefresh, disabled });
  latest.current = { onRefresh, disabled };
  const locked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let start: { x: number; y: number } | null = null,
      amount = 0;
    const cancel = () => {
      start = null;
      amount = 0;
      setDistance(0);
    };
    const begin = (e: TouchEvent) => {
      if (
        locked.current ||
        latest.current.disabled ||
        e.touches.length !== 1 ||
        window.scrollY > 1 ||
        window.innerWidth > 800 ||
        document.querySelector("dialog[open], [role=dialog]")
      )
        return;
      const target = e.target as Element;
      if (
        target.closest(
          "input,textarea,select,button,a,[role=combobox],.mapbox-surface,.map-results,.ticket-list,.custom-select-menu",
        )
      )
        return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      clearTimeout(timer.current);
      setMessage("");
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1 || window.scrollY > 1) {
        cancel();
        return;
      }
      const dx = e.touches[0].clientX - start.x,
        dy = e.touches[0].clientY - start.y;
      if (dy < 0 || Math.abs(dx) > Math.max(15, dy)) {
        cancel();
        return;
      }
      amount = pullDistance(dx, dy);
      if (amount > 5 && e.cancelable) e.preventDefault();
      setDistance(amount);
    };
    const end = async () => {
      const trigger = !!start && amount >= PULL_THRESHOLD;
      cancel();
      if (!trigger || locked.current) return;
      locked.current = true;
      setRefreshing(true);
      setMessage("Refreshing…");
      try {
        await latest.current.onRefresh();
        setMessage("Updated");
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : tr("Refresh failed. Try again."),
        );
      } finally {
        locked.current = false;
        setRefreshing(false);
        timer.current = setTimeout(() => setMessage(""), 3500);
      }
    };
    window.addEventListener("touchstart", begin, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", cancel);
    return () => {
      window.removeEventListener("touchstart", begin);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", cancel);
      clearTimeout(timer.current);
    };
  }, []);
  const visible = distance > 5 || refreshing || !!message;
  return (
    <div
      className={"pull-refresh " + (visible ? "pull-visible" : "")}
      style={{
        transform: `translate(-50%, ${visible ? Math.min(distance, 86) : 0}px)`,
      }}
      role="status"
      aria-live="polite"
    >
      {refreshing ? (
        <LoaderCircle className="spin" size={17} />
      ) : message === "Updated" ? (
        <Check size={17} />
      ) : (
        <ArrowDown
          size={17}
          style={{
            transform: distance >= PULL_THRESHOLD ? "rotate(180deg)" : "none",
          }}
        />
      )}
      <span>
        {tr(message) ||
          (distance >= PULL_THRESHOLD
            ? tr("Release to refresh")
            : tr("Pull down to refresh"))}
      </span>
    </div>
  );
}
