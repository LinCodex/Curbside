// TicketSafe cartography from bundled NYC DCP public geometry.
// No Mapbox styles, tiles, software, or screenshots are used for this asset.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const boroughs = JSON.parse(
  await readFile(
    new URL("../public/nyc-boroughs.json", import.meta.url),
    "utf8",
  ),
);
const streets = JSON.parse(
  await readFile(
    new URL("../public/nyc-streets.json", import.meta.url),
    "utf8",
  ),
);
const paths = boroughs.map((b) => `<path d="${b.d}"/>`).join("");
for (const [suffix, water, land, boundary, road] of [
  ["", "#0b0d10", "#171b20", "#292f37", "#353d47"],
  ["-light", "#e5e9ed", "#f4f5f6", "#cbd2d9", "#d8dde3"],
]) {
  // Flat fills avoid gradient banding and glare. Rasterize the original vectors
  // at 3200px, rather than enlarging the previous compressed 1800px bitmap.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="3200" viewBox="230 180 900 900"><rect x="230" y="180" width="900" height="900" fill="${water}"/><g fill="${land}" stroke="${boundary}" stroke-width=".9">${paths}</g><path d="${streets.join(" ")}" fill="none" stroke="${road}" stroke-width=".65" stroke-linecap="round"/></svg>`;
  if (!suffix)
    await writeFile(
      new URL("../public/nyc-backdrop.svg", import.meta.url),
      svg,
    );
  await sharp(Buffer.from(svg))
    .webp({ lossless: true, effort: 6 })
    .toFile(
      fileURLToPath(
        new URL(`../public/nyc-backdrop${suffix}.webp`, import.meta.url),
      ),
    );
}
