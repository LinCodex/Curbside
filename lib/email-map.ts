import { EMAIL_MAP_BASE, EMAIL_MAP_BOUNDS } from "./email-map-base";
const width = 640,
  height = 420,
  pad = 24;
export function emailMapPoint(
  lng: number,
  lat: number,
): [number, number] | null {
  const [west, south, east, north] = EMAIL_MAP_BOUNDS;
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < west ||
    lng > east ||
    lat < south ||
    lat > north
  )
    return null;
  const mercator = (value: number) =>
    Math.log(Math.tan(Math.PI / 4 + (value * Math.PI) / 360));
  return [
    pad + ((lng - west) / (east - west)) * (width - 2 * pad),
    height -
      pad -
      ((mercator(lat) - mercator(south)) /
        (mercator(north) - mercator(south))) *
        (height - 2 * pad),
  ];
}
const digits = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001001001",
  "111101111101111",
  "111101111001111",
];
const bytes = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function transformed(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
) {
  const writer = stream.writable.getWriter();
  const result = new Response(stream.readable).arrayBuffer();
  await writer.write(Uint8Array.from(input));
  await writer.close();
  return new Uint8Array(await result);
}
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12),
    view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(new TextEncoder().encode(type), 4);
  result.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, 8 + data.length))
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  view.setUint32(8 + data.length, (crc ^ 0xffffffff) >>> 0);
  return result;
}
/** One attached map, rendered locally. No remote pixels, tracking or map charges. */
export async function renderEmailMap(
  points: Array<{ lat: number; lng: number; number: number }>,
): Promise<string | null> {
  const valid = points
    .map((point) => ({ ...point, pixel: emailMapPoint(point.lng, point.lat) }))
    .filter((point) => point.pixel);
  if (!valid.length) return null;
  const raw = await transformed(
    bytes(EMAIL_MAP_BASE),
    new DecompressionStream("deflate"),
  );
  const pixel = (x: number, y: number, color: number[]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    raw.set(color, (y * width + x) * 4);
  };
  for (const point of valid) {
    const [x, y] = point.pixel!;
    for (let dy = -12; dy <= 12; dy++)
      for (let dx = -12; dx <= 12; dx++)
        if (dx * dx + dy * dy <= 144)
          pixel(
            x + dx,
            y + dy,
            dx * dx + dy * dy > 100
              ? [255, 255, 255, 255]
              : [140, 187, 255, 255],
          );
    const text = String(point.number),
      scale = 2,
      start = x - (text.length * 8 - 2) / 2;
    for (let i = 0; i < text.length; i++) {
      const glyph = digits[Number(text[i])];
      if (!glyph) continue;
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++)
          if (glyph[row * 3 + col] === "1")
            for (let sy = 0; sy < scale; sy++)
              for (let sx = 0; sx < scale; sx++)
                pixel(
                  start + i * 8 + col * scale + sx,
                  y - 5 + row * scale + sy,
                  [16, 24, 32, 255],
                );
    }
  }
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    scanlines.set(
      raw.subarray(y * width * 4, (y + 1) * width * 4),
      y * (width * 4 + 1) + 1,
    );
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk(
      "IDAT",
      await transformed(scanlines, new CompressionStream("deflate")),
    ),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  let binary = "";
  for (let i = 0; i < png.length; i += 8192)
    binary += String.fromCharCode(...png.subarray(i, i + 8192));
  return btoa(binary);
}
