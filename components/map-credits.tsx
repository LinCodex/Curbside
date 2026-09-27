"use client";
import { usePreferences } from "./preferences";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function MapCredits({ provider }: { provider: "mapbox" | "nyc" }) {
  const { tr } = usePreferences();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="map-credits map-legal-credits">
      <nav aria-label={tr("Legal information")}>
        <a href="/legal/privacy">{tr("Privacy")}</a>
        <a href="/legal/terms">{tr("Terms")}</a>
        <a href="/legal">{tr("Legal & accessibility")}</a>
      </nav>
      {provider === "mapbox" ? (
        <nav aria-label={tr("Map attribution")}>
          <a
            href="https://www.mapbox.com/about/maps"
            target="_blank"
            rel="noreferrer"
          >
            © Mapbox
          </a>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap
          </a>
          <a
            href="https://apps.mapbox.com/feedback/"
            target="_blank"
            rel="noreferrer"
          >
            {tr("Improve this map")}
          </a>
        </nav>
      ) : (
        <a href="/legal/sources">{tr("Map data: NYC DCP")}</a>
      )}
    </div>,
    document.body,
  );
}
