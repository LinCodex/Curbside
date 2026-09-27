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

function copyPrerendered(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyPrerendered(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${path.relative(clientDir, destPath)} to dist/client/`);

      if (
        entry.name.endsWith(".html") &&
        entry.name !== "index.html" &&
        entry.name !== "404.html"
      ) {
        const baseName = entry.name.replace(/\.html$/, "");
        const subDir = path.join(destDir, baseName);
        fs.mkdirSync(subDir, { recursive: true });
        fs.copyFileSync(srcPath, path.join(subDir, "index.html"));
      }
    }
  }
}

if (fs.existsSync(prerenderDir)) {
  copyPrerendered(prerenderDir, clientDir);
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
