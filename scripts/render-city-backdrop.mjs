// Original Curbside cartography from bundled NYC DCP public geometry.
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
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1800" viewBox="230 180 900 900"><defs><radialGradient id="shade"><stop stop-color="#080a0d" stop-opacity="0"/><stop offset="1" stop-color="#050608" stop-opacity=".55"/></radialGradient></defs><rect x="230" y="180" width="900" height="900" fill="#090c10"/><g fill="#1b1e22" stroke="#30353b" stroke-width=".9">${paths}</g><path d="${streets.join(" ")}" fill="none" stroke="#686e75" stroke-width=".8" opacity=".46" stroke-linecap="round"/><rect x="230" y="180" width="900" height="900" fill="url(#shade)"/></svg>`;
await writeFile(new URL("../public/nyc-backdrop.svg", import.meta.url), svg);
await sharp(Buffer.from(svg))
  .webp({ quality: 84 })
  .toFile(
    fileURLToPath(new URL("../public/nyc-backdrop.webp", import.meta.url)),
  );
