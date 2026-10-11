"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePreferences } from "./preferences";
import { useNotificationPreferences } from "./notification-preferences";

const TUTORIAL_KEY = "ticketsafe.tutorial.v1.";
const TUTORIAL_METADATA = "ticketsafe_tutorial_seen";

type TutorialUser = { id: string; user_metadata?: Record<string, unknown> };

export function tutorialDone(user: TutorialUser) {
  if (user.user_metadata?.[TUTORIAL_METADATA]) return true;
  try {
    return localStorage.getItem(TUTORIAL_KEY + user.id) === "done";
  } catch {
    // Without storage the tour would reappear on every visit; skip it instead.
    return true;
  }
}

// The account flag makes the automatic tour show once per account across
// devices; the local copy covers the moment before Auth confirms the update.
export function markTutorialDone(
  client: SupabaseClient | null,
  user: TutorialUser,
) {
  try {
    localStorage.setItem(TUTORIAL_KEY + user.id, "done");
  } catch {
    /* Storage can be unavailable in restricted browser modes. */
  }
  if (client && !user.user_metadata?.[TUTORIAL_METADATA])
    void client.auth
      .updateUser({ data: { [TUTORIAL_METADATA]: true } })
      .catch(() => {});
}

type Step = {
  target: string;
  view: string;
  sheet?: string;
  title: string;
  body: string;
  // Shown on the first, automatic tour, which turns ticket alerts on.
  enabledTitle?: string;
  enabledBody?: string;
};
const STEPS: Step[] = [
  {
    target: "nav-garage",
    view: "garage",
    title: "Your garage",
    body: "Saved cars and their ticket histories live here. Histories refresh every morning from city data.",
  },
  {
    target: "nav-search",
    view: "search",
    title: "Search any plate",
    body: "Look up NYC parking and camera tickets for any plate, including out-of-state plates. Tap Save vehicle on a result to add it to your garage.",
  },
  {
    target: "nav-map",
    view: "map",
    title: "See where tickets happened",
    body: "The map shows ticket locations. Choose a ticket to see its address and details.",
  },
  {
    target: "nav-account",
    view: "account",
    title: "Account and settings",
    body: "Change your email, display settings and language, contact support, and read what’s new.",
  },
  {
    target: "notifications",
    view: "account",
    title: "Notifications",
    body: "Your email choices live here, right under Account details.",
  },
  {
    target: "ticket-alerts",
    view: "account",
    sheet: "notifications",
    title: "Turn on ticket alerts",
    body: "Tick New-ticket emails and we’ll email you when a saved car gets a new ticket. You can change this any time.",
    enabledTitle: "Ticket alerts are on",
    enabledBody: "We’ll email you when a saved car gets a new ticket. Don’t want these emails? Turn them off here or in Account any time.",
  },
];

function visibleTarget(name: string) {
  for (const element of document.querySelectorAll<HTMLElement>(
    `[data-tour="${name}"]`,
  )) {
    const rect = element.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(element).visibility !== "hidden"
    )
      return element;
  }
  return null;
}

const sameRect = (a: DOMRect | null, b: DOMRect | null) =>
  !!a &&
  !!b &&
  a.top === b.top &&
  a.left === b.left &&
  a.width === b.width &&
  a.height === b.height;

export default function AppTutorial({
  view,
  onView,
  onSheet,
  enableAlerts = false,
  onClose,
}: {
  view: string;
  onView: (view: string) => void;
  onSheet: (sheet: string | null) => void;
  enableAlerts?: boolean;
  onClose: () => void;
}) {
  const { tr } = usePreferences();
  const alerts = useNotificationPreferences();
  const saveAlerts = useRef(alerts.save);
  useLayoutEffect(() => {
    saveAlerts.current = alerts.save;
  });
  useEffect(() => {
    if (enableAlerts) void saveAlerts.current(true);
  }, [enableAlerts]);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const startView = useRef(view);
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const latest = useRef({ onView, onSheet });
  useLayoutEffect(() => {
    latest.current = { onView, onSheet };
  });

  const finish = (skipped: boolean) => {
    if (skipped) latest.current.onView(startView.current);
    onClose();
  };

  // Each step shows its real screen: the view, a visible dock, and any sheet.
  useEffect(() => {
    latest.current.onView(current.view);
    latest.current.onSheet(current.sheet ?? null);
  }, [current.view, current.sheet]);

  // The page stays still while the tour points at things.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    const overlay = root.current;
    const stop = (event: Event) => event.preventDefault();
    overlay?.addEventListener("wheel", stop, { passive: false });
    overlay?.addEventListener("touchmove", stop, { passive: false });
    return () => {
      html.style.overflow = previous;
      overlay?.removeEventListener("wheel", stop);
      overlay?.removeEventListener("touchmove", stop);
    };
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    let revealed = false;
    const measure = () => {
      const element = visibleTarget(current.target);
      if (element && !revealed) {
        revealed = true;
        const box = element.getBoundingClientRect();
        if (box.top < 72 || box.bottom > window.innerHeight - 96)
          element.scrollIntoView({ block: "center", behavior: "instant" });
      }
      const next = element?.getBoundingClientRect() ?? null;
      setRect((previous) => (sameRect(previous, next) ? previous : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [current.target]);

  useEffect(() => {
    const focus = () =>
      card.current?.querySelector<HTMLElement>(".tutorial-primary")?.focus();
    focus();
    // A sheet opened by this step takes focus as it mounts; take it back.
    const timer = setTimeout(focus, 320);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(true);
        return;
      }
      if (event.key !== "Tab" || !card.current) return;
      const controls = [
        ...card.current.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const end = controls[controls.length - 1];
      event.stopImmediatePropagation();
      if (!card.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  });

  const pad = 6;
  const highlight = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  const cardWidth = Math.min(340, window.innerWidth - 32);
  const below = !rect || rect.bottom + 230 < window.innerHeight;
  const cardStyle = rect
    ? {
        width: cardWidth,
        left: Math.max(
          16,
          Math.min(
            rect.left + rect.width / 2 - cardWidth / 2,
            window.innerWidth - cardWidth - 16,
          ),
        ),
        ...(below
          ? { top: rect.bottom + pad + 12 }
          : { bottom: window.innerHeight - rect.top + pad + 12 }),
      }
    : {
        width: cardWidth,
        left: (window.innerWidth - cardWidth) / 2,
        top: window.innerHeight / 2 - 110,
      };

  return (
    <div
      ref={root}
      className="app-tutorial"
      data-spotlight={highlight ? "true" : "false"}
    >
      <div className="tutorial-blocker" aria-hidden="true" />
      {highlight && (
        <div
          key={step}
          className="tutorial-highlight"
          style={highlight}
          aria-hidden="true"
        />
      )}
      <div
        key={`card-${step}`}
        ref={card}
        className="tutorial-card"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
      >
        <div className="tutorial-card-head">
          <span className="tutorial-progress mono">
            {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            className="tutorial-skip"
            onClick={() => finish(true)}
          >
            {tr("Skip tour")}
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <h2 id="tutorial-title">
          {tr(
            (enableAlerts && alerts.enabled && current.enabledTitle) ||
              current.title,
          )}
        </h2>
        <p id="tutorial-body">
          {tr(
            (enableAlerts && alerts.enabled && current.enabledBody) ||
              current.body,
          )}
        </p>
        {enableAlerts && current.enabledBody && (
          <button
            type="button"
            className="button ghost tutorial-alert-toggle"
            disabled={alerts.saving || alerts.enabled === null}
            onClick={() => void alerts.save(!alerts.enabled)}
          >
            {alerts.saving
              ? tr("Saving…")
              : alerts.enabled
                ? tr("Turn off ticket alerts")
                : tr("Turn ticket alerts on")}
          </button>
        )}
        <div className="tutorial-actions">
          {step > 0 ? (
            <button
              type="button"
              className="button ghost"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {tr("Back")}
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <button
              type="button"
              className="button primary tutorial-primary"
              onClick={() => finish(false)}
            >
              {tr("Done")}
              <Check size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="button primary tutorial-primary"
              onClick={() => setStep(step + 1)}
            >
              {tr("Continue")}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
