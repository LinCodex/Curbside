"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, X } from "lucide-react";
import { usePreferences } from "./preferences";

const TUTORIAL_KEY = "ticketsafe.tutorial.v1.";

export function tutorialDone(userId: string) {
  try {
    return localStorage.getItem(TUTORIAL_KEY + userId) === "done";
  } catch {
    // Without storage the tour would reappear on every visit; skip it instead.
    return true;
  }
}
function markTutorialDone(userId: string) {
  try {
    localStorage.setItem(TUTORIAL_KEY + userId, "done");
  } catch {
    /* Storage can be unavailable in restricted browser modes. */
  }
}

type Step = { target: string; view?: string; title: string; body: string };
const STEPS: Step[] = [
  {
    target: "nav-garage",
    title: "Your garage",
    body: "Saved cars and their ticket histories live here. Histories refresh every morning from city data.",
  },
  {
    target: "nav-search",
    title: "Search any plate",
    body: "Look up NYC parking and camera tickets for any plate, including out-of-state plates. Tap Save vehicle on a result to add it to your garage.",
  },
  {
    target: "nav-map",
    title: "See where tickets happened",
    body: "The map shows ticket locations. Choose a ticket to see its address and details.",
  },
  {
    target: "nav-account",
    title: "Account and settings",
    body: "Change your email, display settings and language, contact support, and read what’s new.",
  },
  {
    target: "notifications",
    view: "account",
    title: "Turn on ticket alerts",
    body: "Open Notifications, then tick New-ticket emails. We email you when a saved car gets a new ticket.",
  },
];

function visibleTarget(name: string) {
  for (const element of document.querySelectorAll<HTMLElement>(
    `[data-tour="${name}"]`,
  )) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      !element.closest("[inert]")
    )
      return element;
  }
  return null;
}

export default function AppTutorial({
  userId,
  view,
  onView,
  onClose,
  onOpenNotifications,
}: {
  userId: string;
  view: string;
  onView: (view: string) => void;
  onClose: () => void;
  onOpenNotifications: () => void;
}) {
  const { tr } = usePreferences();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const startView = useRef(view);
  const card = useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = (returnToStart: boolean) => {
    markTutorialDone(userId);
    if (returnToStart && startView.current !== view) onView(startView.current);
    onClose();
  };

  useEffect(() => {
    if (current.view && current.view !== view) onView(current.view);
  }, [current.view, view, onView]);

  useLayoutEffect(() => {
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      const element = visibleTarget(current.target);
      if (element && !scrolled) {
        scrolled = true;
        const box = element.getBoundingClientRect();
        if (box.top < 72 || box.bottom > window.innerHeight - 96)
          element.scrollIntoView({ block: "center" });
      }
      const next = element?.getBoundingClientRect() ?? null;
      setRect((previous) =>
        previous &&
        next &&
        previous.top === next.top &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [current.target, view]);

  useEffect(() => {
    card.current?.querySelector<HTMLElement>(".tutorial-primary")?.focus();
  }, [step]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(true);
      }
      if (event.key !== "Tab" || !card.current) return;
      const controls = [
        ...card.current.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const end = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        first.focus();
      } else if (!card.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });

  const pad = 6;
  const highlight = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  const cardWidth = Math.min(340, window.innerWidth - 32);
  const below = !rect || rect.bottom + 220 < window.innerHeight;
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
    <div className="app-tutorial" data-spotlight={highlight ? "true" : "false"}>
      <div className="tutorial-blocker" aria-hidden="true" />
      {highlight && (
        <div className="tutorial-highlight" style={highlight} aria-hidden="true" />
      )}
      <div
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
        <h2 id="tutorial-title">{tr(current.title)}</h2>
        <p id="tutorial-body">{tr(current.body)}</p>
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
            <span className="tutorial-final">
              <button
                type="button"
                className="button ghost"
                onClick={() => finish(false)}
              >
                {tr("Done")}
              </button>
              <button
                type="button"
                className="button primary tutorial-primary"
                onClick={() => {
                  finish(false);
                  onOpenNotifications();
                }}
              >
                <Bell size={15} aria-hidden="true" />
                {tr("Open notifications")}
              </button>
            </span>
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
