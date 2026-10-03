"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep the fade on the panel edge, outside the scrolling ticket content. */
export default function MapTicketScroll({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = frame.current;
    const list = container?.querySelector<HTMLElement>(".ticket-list");
    if (!container || !list) return;
    const update = () => {
      container.dataset.more = String(
        list.scrollHeight - list.clientHeight - list.scrollTop > 2,
      );
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [children]);
  return (
    <div className="map-ticket-scroll" ref={frame}>
      {children}
    </div>
  );
}
