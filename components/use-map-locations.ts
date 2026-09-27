"use client";
import { useEffect, useRef, useState } from "react";
import type { Location, Violation } from "@/lib/domain";
import {
  hasPoint,
  locationQuery,
  mapboxLocation,
  geoSearchLocation,
  cleanLocationLabel,
  autocorrectAddress,
} from "@/lib/map-locations";

export function useMapLocations(
  tickets: Violation[],
  token: string | undefined,
  active: boolean,
) {
  // Temporary Mapbox results stay in this page's memory, never D1/localStorage.
  const cache = useRef(new Map<string, Location | null>());
  const [customOverrides, setCustomOverrides] = useState<
    Record<string, Location>
  >({});
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState(24);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const signature = JSON.stringify(
    tickets
      .filter((t) => !hasPoint(t.location) && t.location.label)
      .map((t) => t.location),
  );
  useEffect(() => {
    if (!active || !token) return;
    const abort = new AbortController();
    const unique = [
      ...new Map(
        (JSON.parse(signature) as Location[]).map((l) => [l.label, l]),
      ).values(),
    ];
    const pending = unique
      .slice(0, limit)
      .filter((l) => !cache.current.has(l.label));
    if (!pending.length) return;
    setResolving(true);
    setError("");
    (async () => {
      try {
        for (let i = 0; i < pending.length; i += 2) {
          await Promise.all(
            pending.slice(i, i + 2).map(async (original) => {
              const cleanedLabel = cleanLocationLabel(original.label);
              const addressToGeocode = cleanedLabel || original.label;
              const url = new URL(
                "https://api.mapbox.com/search/geocode/v6/forward",
              );
              Object.entries({
                q: locationQuery(addressToGeocode),
                access_token: token,
                country: "us",
                bbox: "-74.3,40.45,-73.65,40.95",
                types: "address,street",
                autocomplete: "false",
                limit: "1",
                permanent: "false",
              }).forEach(([k, v]) => url.searchParams.set(k, v));
              const response = await fetch(url, {
                signal: AbortSignal.any([
                  abort.signal,
                  AbortSignal.timeout(8000),
                ]),
              });
              if (!response.ok)
                throw new Error(
                  "Address lookup is temporarily unavailable. The city’s addresses are still listed below.",
                );
              const result: any = await response.json();
              let loc = mapboxLocation(
                { ...original, label: addressToGeocode },
                result.features?.[0],
              );

              // If Mapbox didn't match with strict criteria, try NYC Planning Labs GeoSearch fallback
              // (strictly validates layer and accuracy so false pins are never placed)
              if (!loc && !abort.signal.aborted) {
                try {
                  const geoUrl = new URL(
                    "https://geosearch.planninglabs.nyc/v2/search",
                  );
                  geoUrl.searchParams.set("text", addressToGeocode);
                  geoUrl.searchParams.set("size", "1");
                  const geoRes = await fetch(geoUrl, {
                    signal: AbortSignal.any([
                      abort.signal,
                      AbortSignal.timeout(4000),
                    ]),
                  });
                  if (geoRes.ok) {
                    const geoJson: any = await geoRes.json();
                    loc = geoSearchLocation(
                      { ...original, label: addressToGeocode },
                      geoJson.features?.[0],
                    );
                  }
                } catch {}
              }

              if (!abort.signal.aborted) cache.current.set(original.label, loc);
            }),
          );
          if (!abort.signal.aborted) setRevision((r) => r + 1);
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Address lookup unavailable.",
          );
      } finally {
        if (!abort.signal.aborted) setResolving(false);
      }
    })();
    return () => {
      abort.abort();
      setResolving(false);
    };
  }, [signature, token, active, limit]);

  const autocorrectLocation = async (
    ticket: Violation,
    customAddress?: string,
  ): Promise<Location | null> => {
    const addressToLookup = (
      customAddress || cleanLocationLabel(ticket.location.label)
    ).trim();
    if (!addressToLookup) return null;

    // 1. Try Mapbox Geocode
    if (token) {
      try {
        const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
        Object.entries({
          q: locationQuery(addressToLookup),
          access_token: token,
          country: "us",
          bbox: "-74.3,40.45,-73.65,40.95",
          types: "address,street",
          autocomplete: "false",
          limit: "1",
          permanent: "false",
        }).forEach(([k, v]) => url.searchParams.set(k, v));
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data: any = await res.json();
          const loc = mapboxLocation(
            { ...ticket.location, label: addressToLookup },
            data.features?.[0],
          );
          if (loc) {
            const finalLoc: Location = {
              ...loc,
              resolvedBy: "Autocorrected address",
            };
            cache.current.set(ticket.location.label, finalLoc);
            setCustomOverrides((prev) => ({ ...prev, [ticket.id]: finalLoc }));
            setRevision((r) => r + 1);
            return finalLoc;
          }
        }
      } catch {}
    }

    // 2. Try NYC Planning Labs GeoSearch Fallback
    try {
      const geoUrl = new URL("https://geosearch.planninglabs.nyc/v2/search");
      geoUrl.searchParams.set("text", cleanLocationLabel(addressToLookup));
      geoUrl.searchParams.set("size", "1");
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(6000) });
      if (geoRes.ok) {
        const geoJson: any = await geoRes.json();
        const loc = geoSearchLocation(
          { ...ticket.location, label: addressToLookup },
          geoJson.features?.[0],
        );
        if (loc) {
          cache.current.set(ticket.location.label, loc);
          setCustomOverrides((prev) => ({ ...prev, [ticket.id]: loc }));
          setRevision((r) => r + 1);
          return loc;
        }
      }
    } catch {}

    return null;
  };

  void revision;
  const resolved = tickets.map((t) => {
    if (customOverrides[t.id]) {
      return { ...t, location: customOverrides[t.id] };
    }
    const cached = cache.current.get(t.location.label);
    if (cached) {
      return { ...t, location: cached };
    }
    // Clean raw enforcement shorthand on unmapped tickets for readability
    const cleaned = cleanLocationLabel(t.location.label);
    if (cleaned && cleaned !== t.location.label) {
      return {
        ...t,
        location: {
          ...t.location,
          label: cleaned,
        },
      };
    }
    return t;
  });
  const total = new Set(
    tickets
      .filter((t) => t.location.label && !hasPoint(t.location))
      .map((t) => t.location.label),
  ).size;
  return {
    tickets: resolved,
    resolving,
    error,
    hasMore: total > limit,
    resolveMore: () => setLimit((l) => l + 24),
    autocorrectLocation,
  };
}
