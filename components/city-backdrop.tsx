"use client";
import { MapCredits } from "./map-credits";

import { usePreferences } from "./preferences";

export function CityBackdrop() {
  const { resolvedTheme } = usePreferences();
  return (
    <div className="city-map city-backdrop">
      <img
        className="city-backdrop-image"
        src={
          resolvedTheme === "light"
            ? "/nyc-backdrop-light.webp"
            : "/nyc-backdrop.webp"
        }
        alt=""
        width="1800"
        height="1800"
        decoding="async"
        fetchPriority="high"
      />
      <div className="map-vignette" />
      <MapCredits provider="nyc" />
    </div>
  );
}
