"use client";
import { usePreferences } from "./preferences";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapCredits } from "./map-credits";

import type { Violation } from "@/lib/domain";
import { hasPoint, locationRing } from "@/lib/map-locations";
import { ticketOverview } from "@/lib/map-overview";
const EMPTY: Violation[] = [];
const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const framing = () => {
  const panel = document.querySelector(".map-results")?.getBoundingClientRect();
  return window.innerWidth <= 800
    ? {
        top:
          (document.querySelector(".map-scene-heading")?.getBoundingClientRect()
            .bottom || 140) + 20,
        bottom: panel
          ? window.innerHeight - panel.top + 24
          : window.innerHeight * 0.45,
        left: 32,
        right: 32,
      }
    : {
        top: 130,
        bottom: 80,
        left: 60,
        right: panel
          ? window.innerWidth - panel.left + 24
          : Math.min(window.innerWidth * 0.42, 530),
      };
};

export default function CityMap({
  tickets = EMPTY,
  token,
  onSelect,
  interactive = false,
  selectedId,
}: {
  tickets?: Violation[];
  token?: string;
  onSelect?: (ticket: Violation) => void;
  interactive?: boolean;
  selectedId?: string;
}) {
  const { tr, resolvedTheme } = usePreferences();

  const surface = useRef<HTMLDivElement>(null),
    instance = useRef<any>(null);
  const pin = useRef<any>(null);
  const latest = useRef({ tickets, onSelect, interactive, selectedId });
  latest.current = { tickets, onSelect, interactive, selectedId };
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(0),
    [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState(
    tr("The map could not load. Reported addresses remain available."),
  );
  const [paths, setPaths] = useState<any[]>([]),
    [roads, setRoads] = useState<string[]>([]),
    [zoom, setZoom] = useState(1);
  const fit = useCallback(() => {
    const map = instance.current;
    if (!map) return;
    map.stop();
    const points = latest.current.tickets.filter((t) => hasPoint(t.location));
    if (!points.length) {
      map.easeTo({
        center: [-73.98, 40.73],
        zoom: 10.6,
        padding: 0,
        duration: reduced() ? 0 : 450,
      });
      return;
    }
    const overview = ticketOverview(
      points.map((t) => ({ lng: t.location.lng!, lat: t.location.lat! })),
    )!;
    map.setPadding(0);
    const padding = window.innerWidth <= 800 ? framing() : 48;
    const camera = map.cameraForBounds(overview.bounds, {
      padding,
      maxZoom: 13.5,
      bearing: 0,
    });
    if (!camera) return;
    map.easeTo({
      center: overview.center,
      zoom: camera.zoom,
      bearing: 0,
      pitch: 0,
      padding: window.innerWidth <= 800 ? padding : 0,
      retainPadding: false,
      duration: reduced() ? 0 : 280,
    });
  }, []);
  useEffect(() => {
    if (token && !failed) return;
    const abort = new AbortController();
    fetch("/nyc-boroughs.json", { signal: abort.signal })
      .then((r) => r.json())
      .then((value: any) => setPaths(value))
      .catch(() => {});
    fetch("/nyc-streets.json", { signal: abort.signal })
      .then((r) => r.json())
      .then((value: any) => setRoads(value))
      .catch(() => {});
    return () => abort.abort();
  }, [token, failed]);
  useEffect(() => {
    const cleanToken = token?.trim();
    if (!cleanToken || !surface.current) return;
    let disposed = false;
    setFailed(false);
    import("mapbox-gl")
      .then((mod: any) => {
        const mapbox = mod.default || mod;
        if (disposed || !surface.current || !mapbox?.Map) return;
        mapbox.accessToken = cleanToken;
        if (
          typeof mapbox.supported === "function" &&
          !mapbox.supported({ failIfMajorPerformanceCaveat: false })
        ) {
          setFailureReason(
            tr(
              "WebGL hardware acceleration is unavailable on this device. Fallback map loaded.",
            ),
          );
          if (!disposed) setFailed(true);
          return;
        }
        const map = new mapbox.Map({
          container: surface.current,
          accessToken: cleanToken,
          style: `mapbox://styles/mapbox/${resolvedTheme === "light" ? "light" : "dark"}-v11`,
          center: [-73.98, 40.73],
          zoom: 10.6,
          pitch: 0,
          antialias: false,
          maxTileCacheSize: 64,
          fadeDuration: 180,
          renderWorldCopies: false,
          interactive: true,
          attributionControl: false,
          logoPosition: "bottom-left",
        });
        instance.current = map;
        const dropperEl = document.createElement("div");
        dropperEl.className = "refined-map-dropper";
        dropperEl.setAttribute("aria-label", tr("Selected violation pin"));
        dropperEl.innerHTML = `
          <div class="dropper-pin">
            <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 36S26 22 26 14a12 12 0 1 0-24 0c0 8 12 22 12 22Z" fill="#f8fafc" stroke="#344154" stroke-width="1.5"/>
              <circle cx="14" cy="14" r="4" fill="#3888f7"/>
            </svg>
          </div>
        `;
        dropperEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const currentTicket = latest.current.tickets.find(
            (t) => t.id === latest.current.selectedId,
          );
          if (currentTicket) latest.current.onSelect?.(currentTicket);
        });
        pin.current = new mapbox.Marker({
          element: dropperEl,
          anchor: "bottom",
        });
        map.on("error", (event: any) => {
          if (
            !map.isStyleLoaded() &&
            [401, 403].includes(event.error?.status)
          ) {
            setFailureReason(
              tr(
                "Mapbox rejected the configured token. Reported addresses remain available.",
              ),
            );
            setFailed(true);
          }
        });
        map.on("load", () => {
          if (disposed) return;
          const icon = document.createElement("canvas");
          icon.width = 48;
          icon.height = 64;
          const ctx = icon.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(24, 61);
          ctx.bezierCurveTo(20, 52, 4, 35, 4, 24);
          ctx.arc(24, 24, 20, Math.PI, 0);
          ctx.bezierCurveTo(44, 35, 28, 52, 24, 61);
          ctx.closePath();
          ctx.fillStyle = "#dce9fc";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(24, 24, 6, 0, Math.PI * 2);
          ctx.fillStyle = "#25344a";
          ctx.fill();
          map.addImage("violation-pin", ctx.getImageData(0, 0, 48, 64), {
            pixelRatio: 2,
          });
          map.addSource("tickets", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterRadius: 42,
            clusterMaxZoom: 15,
          });
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "tickets",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#dce7f5",
              "circle-radius": 23,
              "circle-stroke-color": "rgba(172, 204, 255, 0.2)",
              "circle-stroke-width": 7,
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "tickets",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 13,
            },
            paint: { "text-color": "#10151c" },
          });
          const initialSelectedId = latest.current.selectedId;
          map.addLayer({
            id: "ticket-points",
            type: "symbol",
            source: "tickets",
            filter: initialSelectedId
              ? [
                  "all",
                  ["!", ["has", "point_count"]],
                  ["!=", ["get", "id"], initialSelectedId],
                ]
              : ["!", ["has", "point_count"]],
            layout: {
              "icon-image": "violation-pin",
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
              "icon-size": 1.15,
            },
          });
          map.addSource("selection", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addSource("location-area", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer(
            {
              id: "location-area-fill",
              type: "fill",
              source: "location-area",
              paint: { "fill-color": "#77aaf5", "fill-opacity": 0.07 },
            },
            "ticket-points",
          );
          map.addLayer(
            {
              id: "location-area-outline",
              type: "line",
              source: "location-area",
              paint: {
                "line-color": "#77aaf5",
                "line-opacity": 0.5,
                "line-width": 1,
              },
            },
            "ticket-points",
          );
          map.addLayer({
            id: "selection-ring",
            type: "circle",
            source: "selection",
            paint: {
              "circle-radius": 4,
              "circle-color": "#77aaf5",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            },
          });
          map.on("click", "ticket-points", (e: any) => {
            if (!latest.current.interactive) return;
            const t = latest.current.tickets.find(
              (t) => t.id === e.features?.[0]?.properties?.id,
            );
            if (t) latest.current.onSelect?.(t);
          });
          map.on("click", "clusters", async (e: any) => {
            if (!latest.current.interactive) return;
            const f = e.features?.[0];
            if (!f) return;
            try {
              const z = await (
                map.getSource("tickets") as any
              ).getClusterExpansionZoom(f.properties.cluster_id);
              if (!disposed)
                map.easeTo({
                  center: f.geometry.coordinates,
                  zoom: z,
                  padding: framing(),
                  retainPadding: false,
                  duration: reduced() ? 0 : 280,
                });
            } catch {}
          });
          for (const layer of ["ticket-points", "clusters"]) {
            map.on("mouseenter", layer, () => {
              if (latest.current.interactive)
                map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layer, () => {
              map.getCanvas().style.cursor = "";
            });
          }
          setReady((r) => r + 1);
        });
      })
      .catch((error) => {
        console.error("Mapbox init failed:", error);
        setFailureReason(
          tr(
            "This device could not start the interactive map. Reported addresses remain available.",
          ),
        );
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      pin.current?.remove();
      pin.current = null;
      instance.current?.remove();
      instance.current = null;
    };
  }, [token, resolvedTheme, attempt]);
  // Changing a selection or a form field never constructs another map.
  useEffect(() => {
    const map = instance.current;
    // Source updates temporarily make isStyleLoaded false; layer existence is
    // the correct readiness check when switching between Home and Map.
    if (!map || !ready || !map.getLayer("selection-ring")) return;
    map.resize();
    for (const key of [
      "scrollZoom",
      "boxZoom",
      "dragRotate",
      "dragPan",
      "keyboard",
      "doubleClickZoom",
      "touchZoomRotate",
    ])
      interactive ? map[key].enable() : map[key].disable();
    map.getCanvas().tabIndex = interactive ? 0 : -1;
    map
      .getCanvas()
      .setAttribute(
        "aria-label",
        interactive
          ? tr(
              "NYC violation map. The same tickets are available in the location list.",
            )
          : tr("Decorative New York City map"),
      );
    pin.current
      ?.getElement()
      .setAttribute("aria-label", tr("Selected violation pin"));
    for (const layer of map.getStyle().layers || [])
      if (
        layer.type === "symbol" &&
        !["cluster-count", "ticket-points"].includes(layer.id)
      )
        map.setLayoutProperty(
          layer.id,
          "visibility",
          interactive ? "visible" : "none",
        );
    for (const id of [
      "clusters",
      "cluster-count",
      "ticket-points",
      "selection-ring",
      "location-area-fill",
      "location-area-outline",
    ])
      map.setLayoutProperty(id, "visibility", interactive ? "visible" : "none");
    if (!interactive)
      map.easeTo({
        center: [-73.98, 40.73],
        zoom: 10.6,
        padding: 0,
        duration: 0,
      });
  }, [interactive, ready, tr]);
  const pointKey = JSON.stringify(
    tickets.map((t) => [
      t.id,
      t.location.lng,
      t.location.lat,
      t.location.precision,
    ]),
  );
  useEffect(() => {
    const map = instance.current;
    if (!map?.getSource("tickets")) return;
    map.getSource("tickets").setData({
      type: "FeatureCollection",
      features: latest.current.tickets
        .filter((t) => hasPoint(t.location))
        .map((t) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [t.location.lng, t.location.lat],
          },
          properties: { id: t.id, precision: t.location.precision },
        })),
    });
  }, [pointKey, ready, interactive]);
  useEffect(() => {
    const map = instance.current;
    if (!map?.getSource("selection")) return;
    const t = latest.current.tickets.find(
      (t) => t.id === selectedId && hasPoint(t.location),
    );
    const ring = t ? locationRing(t.location) : null;
    map
      .getSource("location-area")
      ?.setData({ type: "FeatureCollection", features: ring ? [ring] : [] });

    // Filter out the selected ticket from WebGL symbol layer so only one dropper is shown
    if (map.getLayer("ticket-points")) {
      if (t && selectedId) {
        map.setFilter("ticket-points", [
          "all",
          ["!", ["has", "point_count"]],
          ["!=", ["get", "id"], selectedId],
        ]);
      } else {
        map.setFilter("ticket-points", ["!", ["has", "point_count"]]);
      }
    }

    if (t && interactive) {
      pin.current?.setLngLat([t.location.lng, t.location.lat]).addTo(map);
      const pinInner = pin.current
        ?.getElement()
        ?.querySelector(".dropper-pin") as HTMLElement | null;
      if (pinInner) {
        pinInner.style.animation = "none";
        void pinInner.offsetWidth;
        pinInner.style.animation = "";
      }
    } else {
      pin.current?.remove();
    }
    map.getSource("selection").setData({
      type: "FeatureCollection",
      features: t
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [t.location.lng, t.location.lat],
              },
            },
          ]
        : [],
    });
  }, [selectedId, ready, pointKey, interactive]);
  // Camera motion is independent of source updates. Geocoding another ticket
  // must never pull the user back to the selected ticket after a manual pan.
  const selectedPoint = tickets.find((t) => t.id === selectedId);
  const selectedCameraKey =
    selectedPoint && hasPoint(selectedPoint.location)
      ? JSON.stringify([
          selectedId,
          selectedPoint.location.lng,
          selectedPoint.location.lat,
          selectedPoint.location.precision,
        ])
      : "";
  useEffect(() => {
    const map = instance.current;
    if (!interactive || !map?.getSource("tickets") || selectedId) return;
    // Coalesce incoming address matches into one overview movement.
    const timer = window.setTimeout(
      () => {
        if (instance.current === map) fit();
      },
      reduced() ? 0 : 240,
    );
    return () => window.clearTimeout(timer);
  }, [pointKey, selectedId, ready, interactive, fit]);
  useEffect(() => {
    const map = instance.current;
    if (!ready || !interactive || !map || !surface.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (instance.current !== map) return;
        map.resize();
        if (!latest.current.selectedId) fit();
      }, 120);
    });
    observer.observe(surface.current);
    const panel = document.querySelector(".map-results");
    if (panel) observer.observe(panel);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ready, interactive, fit]);
  useEffect(() => {
    const map = instance.current;
    if (!interactive || !selectedCameraKey || !map?.getSource("selection"))
      return;
    const [, lng, lat, precision] = JSON.parse(selectedCameraKey);
    // Let the ticket sheet finish shrinking, then center on the full viewport.
    // Fixed contextual zoom prevents zoom ratcheting and stops huge close-ups.
    const timer = window.setTimeout(
      () => {
        if (instance.current !== map) return;
        map.stop();
        map.easeTo({
          center: [lng, lat],
          zoom:
            precision === "approximate"
              ? 13
              : precision === "intersection"
                ? 14
                : 14.5,
          padding: 0,
          retainPadding: false,
          duration: reduced() ? 0 : 280,
        });
      },
      reduced() ? 0 : 240,
    );
    return () => window.clearTimeout(timer);
  }, [selectedCameraKey, ready, interactive]);
  const project = (lng: number, lat: number) => [
    (lng + 74.19) * 2600,
    (40.93 - lat) * 3400,
  ];
  const fallbackPoints = tickets
    .filter((t) => hasPoint(t.location))
    .map((t) => project(t.location.lng!, t.location.lat!));
  const fallbackBounds = fallbackPoints.length
    ? (() => {
        const xs = fallbackPoints.map((p) => p[0]),
          ys = fallbackPoints.map((p) => p[1]);
        const minX = Math.min(...xs) - 100,
          minY = Math.min(...ys) - 100;
        return `${minX} ${minY} ${Math.max(...xs) - minX + 100} ${Math.max(...ys) - minY + 100}`;
      })()
    : "0 0 1100 1150";
  return (
    <div
      className={
        "city-map " + (interactive ? "map-interactive" : "map-decorative")
      }
    >
      <div
        className="mapbox-surface"
        ref={surface}
        style={{ opacity: token && !failed ? 1 : 0 }}
      />
      {(!token || failed) && (
        <svg
          className="geography"
          viewBox={fallbackBounds}
          preserveAspectRatio="xMidYMid meet"
          aria-label={tr("NYC borough outlines")}
        >
          <g
            style={{
              transform: `translate(550px,575px) scale(${zoom}) translate(-550px,-575px)`,
            }}
          >
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="#14181e"
                stroke="#303944"
                strokeWidth="1"
              />
            ))}
            {roads.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#505a67"
                strokeWidth=".65"
                opacity=".5"
              />
            ))}
            {interactive &&
              tickets
                .filter((t) => hasPoint(t.location))
                .map((t) => {
                  const [x, y] = project(t.location.lng!, t.location.lat!);
                  const isSelected = t.id === selectedId;
                  return (
                    <g
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      aria-label={t.location.label}
                      onClick={() => onSelect?.(t)}
                      onKeyDown={(e) => {
                        if (["Enter", " "].includes(e.key)) {
                          e.preventDefault();
                          onSelect?.(t);
                        }
                      }}
                    >
                      {isSelected ? (
                        <>
                          <circle cx={x} cy={y} r="26" fill="#91b8ec55" />
                          <circle
                            cx={x}
                            cy={y}
                            r="12"
                            fill="#ffffff"
                            stroke="#121d2e"
                            strokeWidth="2.5"
                          />
                          <circle cx={x} cy={y} r="5" fill="#3b82f6" />
                        </>
                      ) : (
                        <>
                          <circle cx={x} cy={y} r="18" fill="#a4bfff25" />
                          <circle
                            cx={x}
                            cy={y}
                            r="8"
                            fill="#ecf2ff"
                            stroke="#1b283d"
                            strokeWidth="1.5"
                          />
                        </>
                      )}
                    </g>
                  );
                })}
          </g>
        </svg>
      )}
      <div className="map-vignette" />
      <MapCredits provider={token && !failed ? "mapbox" : "nyc"} />
      {interactive && failed && (
        <div className="map-provider-status" role="status">
          <span>{tr(failureReason)}</span>
          <button
            type="button"
            className="text-link"
            style={{
              marginLeft: 8,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => {
              setFailed(false);
              setAttempt((r) => r + 1);
            }}
          >
            {tr("Retry map")}
          </button>
        </div>
      )}
    </div>
  );
}
