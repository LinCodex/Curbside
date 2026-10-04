import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// 1. Create the SVG representing the exact homepage top-left logo (curb-mark)
// In CSS (.curb-mark):
//   - 3 bars bottom-aligned, heights 24px, 17px, 10px, width 6px, gap 3px, border-radius 2px
//   - Container skewed at -14deg (leaning right)
//   - Color #e6eef8
//
// In our SVG icon (viewBox 0 0 64 64):
//   - Sleek dark squircle background (#080c14 with #223348 subtle border, rx 15)
//   - 3 bars centered optically with exact -14deg skew
export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0e1724"/>
      <stop offset="100%" stop-color="#05080e"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dce9fc"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bg)"/>
  <rect width="64" height="64" rx="15" fill="none" stroke="#223348" stroke-width="1.2"/>
  <g fill="url(#bar)" transform="translate(32 32) skewX(-14) translate(-32 -32)">
    <rect x="20.4" y="16" width="7" height="32" rx="2.5"/>
    <rect x="30.9" y="25.5" width="7" height="22.5" rx="2.5"/>
    <rect x="41.4" y="35" width="7" height="13" rx="2.5"/>
  </g>
</svg>
`;

export const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="app-bg" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0e1724"/>
      <stop offset="100%" stop-color="#05080e"/>
    </linearGradient>
    <linearGradient id="app-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dce9fc"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#app-bg)"/>
  <rect width="512" height="512" rx="120" fill="none" stroke="#223348" stroke-width="8"/>
  <g fill="url(#app-bar)" transform="translate(256 256) skewX(-14) translate(-256 -256)">
    <rect x="163" y="128" width="56" height="256" rx="20"/>
    <rect x="247" y="204" width="56" height="180" rx="20"/>
    <rect x="331" y="280" width="56" height="104" rx="20"/>
  </g>
</svg>
`;

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + count * entrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(item.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((b) => b.buffer)]);
}

async function buildIcons() {
  const publicDir = path.resolve("public");

  // Write SVGs
  fs.writeFileSync(path.join(publicDir, "favicon.svg"), faviconSvg, "utf-8");
  fs.writeFileSync(path.join(publicDir, "app-icon.svg"), appIconSvg, "utf-8");
  console.log("Wrote favicon.svg and app-icon.svg to public/");

  // Render PNGs
  const svgBuf = Buffer.from(appIconSvg);

  const png16 = await sharp(svgBuf).resize(16, 16).png().toBuffer();
  const png32 = await sharp(svgBuf).resize(32, 32).png().toBuffer();
  const png48 = await sharp(svgBuf).resize(48, 48).png().toBuffer();
  const png180 = await sharp(svgBuf).resize(180, 180).png().toBuffer();
  const png192 = await sharp(svgBuf).resize(192, 192).png().toBuffer();
  const png512 = await sharp(svgBuf).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), png180);
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), png192);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), png512);

  // Generate ICO with 16, 32, 48 sizes
  const ico = createIco([
    { width: 16, height: 16, buffer: png16 },
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 },
  ]);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);
  console.log("Wrote PNG icons and favicon.ico to public/");

}

buildIcons().catch((err) => {
  console.error("Failed to build icons:", err);
  process.exit(1);
});
