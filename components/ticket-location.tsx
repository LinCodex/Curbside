"use client";
import { usePreferences } from "./preferences";
import { useState } from "react";
import type { Violation } from "@/lib/domain";
import { hasPoint, locationRing, contextRadius } from "@/lib/map-locations";
import { useMapLocations } from "./use-map-locations";

export function TicketLocation({
  ticket,
  token,
  onOpen,
}: {
  ticket: Violation;
  token?: string;
  onOpen: (ticket: Violation) => void;
}) {
  const { tr, locale, resolvedTheme } = usePreferences();

  const lookup = useMapLocations([ticket], token, true);
  const resolved = lookup.tickets[0];
  const [failed, setFailed] = useState(false);
  const location = resolved.location;
  const point = hasPoint(location);
  const ring = locationRing(location);
  const src =
    point && token
      ? `https://api.mapbox.com/styles/v1/mapbox/${resolvedTheme === "light" ? "light" : "dark"}-v11/static/geojson(${encodeURIComponent(JSON.stringify(ring))}),pin-s+e5efff(${location.lng},${location.lat})/${location.lng},${location.lat},${location.precision === "approximate" ? 13.5 : 14.5}/640x280@2x?access_token=${encodeURIComponent(token)}`
      : "";
  return (
    <section className="ticket-location" aria-label={tr("Violation location")}>
      {src && !failed && (
        <button
          className="ticket-map-preview"
          onClick={() => onOpen(resolved)}
          aria-label={tr("Explore this violation on the map")}
        >
          <img
            src={src}
            width="640"
            height="280"
            alt={
              locale === "zh"
                ? `${location.label}地图。位置精度：${tr(location.precision)}。`
                : `Map of ${location.label}. Location precision: ${location.precision}.`
            }
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </button>
      )}
      <div className="ticket-location-caption">
        <div>
          <span className="eyebrow">{tr("Where it happened")}</span>
          <p>{location.label || tr("Location not provided by NYC")}</p>
          <span className="small muted">
            {lookup.resolving
              ? tr("Finding the reported address…")
              : point
                ? tr(location.precision) +
                  (locale === "zh" ? "位置" : " location")
                : tr("No reliable map match available")}
            {failed ? tr(" · Map preview unavailable") : ""}
          </span>
          {point && (
            <p className="location-radius-note">
              {contextRadius(location)}{" "}
              {tr(
                "m approximate context ring. The pin marks the mapped address or intersection; the ring is illustrative, not an official incident boundary.",
              )}
            </p>
          )}
        </div>
        {point && (
          <button className="text-link" onClick={() => onOpen(resolved)}>
            {tr("Open map ↗")}
          </button>
        )}
      </div>
    </section>
  );
}
