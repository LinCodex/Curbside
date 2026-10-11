"use client";

import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRef } from "react";
import { usePreferences } from "./preferences";

export default function MapPanelControls({
  selectedIndex,
  total,
  collapsed,
  onShowAll,
  onNavigate,
  onToggle,
}: {
  selectedIndex: number;
  total: number;
  collapsed: boolean;
  onShowAll: () => void;
  onNavigate: (index: number) => void;
  onToggle: () => void;
}) {
  const { tr } = usePreferences();
  const selected = selectedIndex >= 0;
  const toggle = (
    <button
      type="button"
      className="map-panel-action map-panel-toggle"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls="map-location-panel"
      aria-label={tr(collapsed ? "Expand location panel" : "Collapse location panel")}
    >
      {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      {tr(collapsed ? "Expand" : "Collapse")}
    </button>
  );

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0];
      swipeStart.current =
        event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const start = swipeStart.current;
      const touch = event.changedTouches[0];
      swipeStart.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      if (dy > 0 !== collapsed) onToggle();
    },
    onTouchCancel: () => {
      swipeStart.current = null;
    },
  };

  return (
    <div className="map-panel-toolbar" {...swipe}>
      <span className="map-panel-grip" aria-hidden="true" />
      <div className="map-panel-heading">
        {selected ? (
          <>
            <button type="button" className="map-panel-action map-panel-back" onClick={onShowAll}>
              <ArrowLeft size={15} />
              {tr("All locations")}
            </button>
            <span className="map-panel-position" aria-live="polite">
              {tr("Ticket")} {selectedIndex + 1} / {total}
            </span>
          </>
        ) : (
          <>
            <h2>{tr("Locations")}</h2>
            {toggle}
          </>
        )}
      </div>
      {selected && (
        <div className="map-panel-navigation">
          <div className="map-panel-step-controls" role="group" aria-label={tr("Browse tickets")}>
            <button
              type="button"
              className="map-panel-action"
              disabled={selectedIndex === 0}
              onClick={() => onNavigate(selectedIndex - 1)}
              aria-label={tr("Previous ticket")}
            >
              <ChevronLeft size={15} />
              {tr("Previous")}
            </button>
            <button
              type="button"
              className="map-panel-action"
              disabled={selectedIndex >= total - 1}
              onClick={() => onNavigate(selectedIndex + 1)}
              aria-label={tr("Next ticket")}
            >
              {tr("Next")}
              <ChevronRight size={15} />
            </button>
          </div>
          {toggle}
        </div>
      )}
    </div>
  );
}
