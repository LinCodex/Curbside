"use client";
import { ChevronRight, MapPin, Ticket } from "lucide-react";
import { usePreferences } from "./preferences";
import { niceDate } from "@/lib/display-date";
import { money, type Violation } from "@/lib/domain";

export default function TicketList({
  tickets,
  onSelect,
  activeId,
  showPlate = false,
}: {
  tickets: Violation[];
  onSelect: (t: Violation) => void;
  activeId?: string;
  showPlate?: boolean;
}) {
  const { tr, locale, detailMode } = usePreferences();
  return (
    <div className="ticket-list">
      {tickets.map((t) => (
        <button
          className={"ticket " + (activeId === t.id ? "ticket-selected" : "")}
          aria-pressed={activeId === undefined ? undefined : activeId === t.id}
          key={t.id}
          onClick={() => onSelect(t)}
        >
          <div className={"ticket-symbol " + (t.due === 0 ? "resolved" : "")}>
            <Ticket size={18} />
          </div>
          <div className="ticket-main">
            <div className="ticket-reference">
              {showPlate && (
                <span className="ticket-plate-label">
                  {t.plate} · {t.state}
                </span>
              )}
              {detailMode === "geek" && (
                <>
                  <span className="mono">{t.id}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{niceDate(t.issued, locale)}</span>
            </div>
            <h3>{tr(t.description)}</h3>
            <p>
              {t.location.label ? (
                <>
                  <MapPin size={10} />
                  <span>{t.location.label}</span>
                </>
              ) : (
                tr("Location not provided")
              )}
            </p>
          </div>
          <div className="ticket-cost">
            <div>
              <strong>{tr(money(t.due))}</strong>
              <p>
                {t.localStatus
                  ? tr("Marked ") + tr(t.localStatus)
                  : t.due === 0
                    ? tr("No balance")
                    : t.due == null
                      ? tr("Status unknown")
                      : tr("Outstanding")}
              </p>
            </div>
            <ChevronRight size={15} />
          </div>
        </button>
      ))}
    </div>
  );
}
