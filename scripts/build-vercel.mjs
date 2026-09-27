import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("Running Curbside Vercel build...");
execSync("node node_modules/vinext/dist/cli.js build --prerender-all", {
  stdio: "inherit",
  env: { ...process.env, VERCEL: "1" },
});

const prerenderDir = path.resolve("dist/server/prerendered-routes");
const clientDir = path.resolve("dist/client");

if (fs.existsSync(prerenderDir)) {
  for (const file of fs.readdirSync(prerenderDir)) {
    if (file.endsWith(".html")) {
      fs.copyFileSync(path.join(prerenderDir, file), path.join(clientDir, file));
      console.log(`Copied ${file} to dist/client/`);
    }
  }
}

console.log("Vercel build prepared successfully.");
