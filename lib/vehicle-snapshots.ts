import { mergeTickets, plateKey, type SearchResult } from "./domain";

export function mergeSnapshot(
  previous: SearchResult | null,
  current: SearchResult,
): SearchResult {
  if (current.unavailable) return previous || current;
  if (!previous || plateKey(previous.query) !== plateKey(current.query))
    return current;
  const currentIds = new Set(current.tickets.map((ticket) => ticket.id));
  const retained = previous.tickets.filter(
    (ticket) => !currentIds.has(ticket.id),
  );
  const sources = new Map(
    previous.sources.map((source) => [source.id, source]),
  );
  current.sources.forEach((source) => sources.set(source.id, source));
  return {
    ...current,
    tickets: mergeTickets([...previous.tickets, ...current.tickets]),
    sources: [...sources.values()],
    complete: current.complete && retained.length === 0,
    snapshot: { retainedRecords: retained.length },
  };
}
