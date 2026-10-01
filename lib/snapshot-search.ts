import type { Plate, SearchResult } from "./domain";
import { config } from "./runtime";
import { searchNYC } from "./nyc";

export async function searchWithSnapshot(
  plate: Plate,
  history: boolean,
): Promise<SearchResult> {
  const env = config();
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
    try {
      const response = await fetch(url + "/functions/v1/vehicle-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lookup", ...plate }),
        signal: AbortSignal.timeout(3500),
      });
      if (response.ok) {
        const { result } = (await response.json()) as {
          result: SearchResult | null;
        };
        if (result && Array.isArray(result.tickets)) return result;
      }
    } catch {
      /* Source lookup continues if the snapshot service is unavailable. */
    }
  }
  return searchNYC(plate, history);
}
