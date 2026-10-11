"use client";
import { useEffect } from "react";

function atScrollEnd(target: EventTarget | null) {
  const root = document.documentElement;
  if (
    target instanceof HTMLElement &&
    target !== document.body &&
    target !== root
  ) {
    const max = target.scrollHeight - target.clientHeight;
    if (max > 8) return target.scrollTop >= max - 2;
  }
  const max = root.scrollHeight - window.innerHeight;
  return max > 8 && window.scrollY >= max - 2;
}

export default function SafariScrollEdge() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let latest: EventTarget | null = document;
    const apply = () => {
      frame = 0;
      root.toggleAttribute("data-scrolled-bottom", atScrollEnd(latest));
    };
    const schedule = (target: EventTarget | null) => {
      latest = target;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onScroll = (event: Event) => schedule(event.target);
    const onResize = () => schedule(document);
    schedule(document);
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      root.removeAttribute("data-scrolled-bottom");
    };
  }, []);
  return <div className="safari-bottom-edge" aria-hidden="true" />;
}
