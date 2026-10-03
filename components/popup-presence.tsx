"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Keep closing popups mounted briefly so focus and scroll locks survive the exit. */
export default function PopupPresence({ children }: { children: ReactNode }) {
  const [retained, setRetained] = useState(children);
  if (children && children !== retained) setRetained(children);
  useEffect(() => {
    if (children || !retained) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 180;
    const timer = setTimeout(() => setRetained(null), duration);
    return () => clearTimeout(timer);
  }, [children, retained]);
  if (!children && !retained) return null;
  return (
    <div
      className="popup-presence"
      data-state={children ? "open" : "closed"}
      inert={!children}
      aria-hidden={!children}
    >
      {children || retained}
    </div>
  );
}
