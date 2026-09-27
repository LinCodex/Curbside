"use client";
import { useEffect, useRef, useState } from "react";
import type { Location, Violation } from "@/lib/domain";
import { hasPoint, locationQuery, mapboxLocation } from "@/lib/map-locations";

export function useMapLocations(
  tickets: Violation[],
  token: string | undefined,
  active: boolean,
) {
  // Temporary Mapbox results stay in this page's memory, never D1/localStorage.
  const cache = useRef(new Map<string, Location | null>());
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
              const url = new URL(
                "https://api.mapbox.com/search/geocode/v6/forward",
              );
              Object.entries({
                q: locationQuery(original.label),
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
              if (!abort.signal.aborted)
                cache.current.set(
                  original.label,
                  mapboxLocation(original, result.features?.[0]),
                );
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
  void revision;
  const resolved = tickets.map((t) =>
    hasPoint(t.location)
      ? t
      : cache.current.get(t.location.label)
        ? { ...t, location: cache.current.get(t.location.label)! }
        : t,
  );
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
  };
}
