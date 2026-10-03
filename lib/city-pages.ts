/** Plate-scoped paging, bounded to avoid unbounded city-data requests. */
export async function fetchCityPages(
  url: URL,
  headers: Record<string, string>,
  send: typeof fetch = fetch,
) {
  const rows: Record<string, unknown>[] = [];
  const budget = AbortSignal.timeout(24000);
  const pageSize = 1000;
  try {
    for (let page = 0; page < 10; page++) {
      const request = new URL(url);
      request.searchParams.set("$limit", String(pageSize));
      request.searchParams.set("$offset", String(page * pageSize));
      request.searchParams.set("$order", "summons_number,:id");
      const response = await send(request, {
        headers,
        signal: AbortSignal.any([budget, AbortSignal.timeout(12000)]),
      });
      if (!response.ok) throw new Error("Source unavailable");
      const batch: unknown = await response.json();
      if (
        !Array.isArray(batch) ||
        batch.some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        )
      )
        throw new Error("Invalid source response");
      rows.push(...batch);
      if (batch.length < pageSize) return { rows, ok: true, truncated: false };
    }
    return { rows, ok: true, truncated: true };
  } catch {
    // Retain successful pages, but never claim the source is complete.
    return { rows, ok: false, truncated: rows.length > 0 };
  }
}
