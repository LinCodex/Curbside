import { hasPoint } from "./map-locations";

export type EmailMapOptions = {
  token?: string;
  appOrigin?: string;
  send?: typeof fetch;
};
type EmailMapPoint = { lat: number; lng: number; number: number };
const maxImageBytes = 180_000; // Leaves room under the outbox's 300KB JSON limit.

/** Fetch one attributed Mapbox image, then attach it to the frozen email.
 * Only coordinates and anonymous pin numbers go to Mapbox; never account data.
 */
export async function renderEmailMap(
  points: EmailMapPoint[],
  options: EmailMapOptions = {},
): Promise<string | null> {
  const valid = points
    .slice(0, 20)
    .filter(
      (point) =>
        hasPoint({ ...point, label: "", precision: "address" }) &&
        Number.isInteger(point.number) &&
        point.number >= 1 &&
        point.number <= 20,
    );
  if (!valid.length || !options.token) return null;
  try {
    const pins = valid
      .map(
        (point) =>
          `pin-l-${point.number}+8cbbff(${point.lng.toFixed(5)},${point.lat.toFixed(5)})`,
      )
      .join(",");
    const first = valid[0];
    const close = valid.every(
      (point) =>
        Math.abs(point.lng - first.lng) < 0.001 &&
        Math.abs(point.lat - first.lat) < 0.001,
    );
    const viewport = close
      ? `${first.lng.toFixed(5)},${first.lat.toFixed(5)},14.5`
      : "auto";
    const url = new URL(
      `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/${viewport}/640x420.png`,
    );
    url.searchParams.set("access_token", options.token);
    url.searchParams.set("attribution", "true");
    url.searchParams.set("logo", "true");
    if (!close) url.searchParams.set("padding", "48");
    const headers: Record<string, string> = {};
    if (options.appOrigin) {
      const origin = new URL(options.appOrigin);
      if (origin.protocol === "https:") headers.Referer = origin.origin + "/";
    }
    const response = await (options.send || fetch)(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get("content-type")?.startsWith("image/png")
    )
      return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImageBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const png = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      png.set(chunk, offset);
      offset += chunk.length;
    }
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (size < 33 || signature.some((byte, index) => png[index] !== byte))
      return null;
    const view = new DataView(png.buffer);
    if (view.getUint32(16) !== 640 || view.getUint32(20) !== 420) return null;
    let binary = "";
    for (let start = 0; start < png.length; start += 8192)
      binary += String.fromCharCode(...png.subarray(start, start + 8192));
    return btoa(binary);
  } catch {
    // Failed, restricted or unconfigured maps never prevent a ticket alert.
    // Do not log request URLs: they contain a Mapbox token.
    return null;
  }
}
