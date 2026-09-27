import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("Generating icon assets...");
execSync("node scripts/build-icons.mjs", { stdio: "inherit" });

console.log("Running Curbside Vercel build...");
execSync("node node_modules/vinext/dist/cli.js build --prerender-all", {
  stdio: "inherit",
  env: { ...process.env, VERCEL: "1" },
});

const prerenderDir = path.resolve("dist/server/prerendered-routes");
const clientDir = path.resolve("dist/client");
const publicDir = path.resolve("public");

if (fs.existsSync(prerenderDir)) {
  for (const file of fs.readdirSync(prerenderDir)) {
    if (file.endsWith(".html")) {
      fs.copyFileSync(path.join(prerenderDir, file), path.join(clientDir, file));
      console.log(`Copied ${file} to dist/client/`);
    }
  }
}

// Ensure icon assets and manifest are in dist/client/
for (const iconFile of [
  "favicon.ico",
  "favicon.svg",
  "app-icon.svg",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
]) {
  const src = path.join(publicDir, iconFile);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(clientDir, iconFile));
  }
}

console.log("Vercel build prepared successfully.");
