"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { usePreferences } from "./preferences";

let modalLocks = 0;
let previousBodyOverflow = "";
export default function Modal({
  title,
  close,
  children,
  motion,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  motion?: "up";
}) {
  const { tr } = usePreferences();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement;
    const dialog = ref.current;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a,input,select,textarea,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    if (modalLocks++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", key);
      if (--modalLocks === 0)
        document.body.style.overflow = previousBodyOverflow;
      // A new popup may already own focus while this one finishes closing.
      if (
        dialog?.contains(document.activeElement) ||
        document.activeElement === document.body
      )
        last?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="sheet"
        data-motion={motion}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            className="round-control"
            onClick={close}
            aria-label={tr("Close")}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
