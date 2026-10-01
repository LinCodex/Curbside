import fs from "node:fs";
import { importPayload, preflightImport } from "../lib/clerk-import.mjs";
const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
if (!file)
  throw new Error(
    "Usage: npm run auth:import -- work/legacy-users.json [--apply --production]",
  );
const rows = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(rows))
  throw new Error("Expected a JSON array of legacy users.");
const planned = rows.map(importPayload);
if (new Set(planned.map((row) => row.external_id)).size !== planned.length)
  throw new Error("Duplicate legacy identities in export.");
if (
  new Set(planned.map((row) => row.email_address[0].toLowerCase())).size !==
  planned.length
)
  throw new Error(
    "Duplicate email addresses in export; resolve before importing.",
  );
const missingLegal = rows.filter((row) => !row.legal_accepted_at).length;
console.log(
  JSON.stringify({
    users: rows.length,
    passwordHashes: rows.filter((row) => row.encrypted_password).length,
    unconfirmedEmails: rows.filter((row) => !row.email_confirmed_at).length,
    missingLegal,
    dryRun: !args.includes("--apply"),
  }),
);
if (missingLegal)
  throw new Error(
    "Some users have no recorded consent. Resolve their legal acceptance before importing; the script will not invent it.",
  );
const key = process.env.CLERK_SECRET_KEY;
if (!key)
  throw new Error("Set CLERK_SECRET_KEY in the ignored local environment.");
if (args.includes("--production") !== key.startsWith("sk_live_"))
  throw new Error(
    "Instance mismatch: --production requires the target production secret key.",
  );
async function api(path, init) {
  const response = await fetch("https://api.clerk.com/v1" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok)
    throw new Error(
      "Clerk import stopped (HTTP " +
        response.status +
        "). Resolve the conflict; no email-based auto-linking is performed.",
    );
  return response.json();
}
// Preflight the entire batch before writing. An existing same-email account without
// the exact external ID must be resolved separately by an administrator.
const existing = [];
for (let offset = 0; ; offset += 100) {
  const page = await api("/users?limit=100&offset=" + offset);
  existing.push(...page);
  if (page.length < 100) break;
}
preflightImport(planned, existing);
if (!args.includes("--apply")) {
  console.log(JSON.stringify({ preflightPassed: true, dryRun: true }));
  process.exit(0);
}
let imported = 0,
  skipped = 0;
for (const user of planned) {
  if (existing.some((item) => item.external_id === user.external_id)) {
    skipped++;
    continue;
  }
  await api("/users", { method: "POST", body: JSON.stringify(user) });
  imported++;
  await new Promise((resolve) => setTimeout(resolve, 150));
}
console.log(JSON.stringify({ imported, alreadyMigrated: skipped }));
