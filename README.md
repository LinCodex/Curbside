# Curbside

Mobile-first NYC parking/camera violation search and monitoring for **Flushing NY Wireless**. The app uses locally bundled Manrope and IBM Plex Mono fonts, actual NYC map geometry, a neutral black theme, accessible custom selectors, and reduced-motion-aware transitions.

## Status

Real NYC plate search is available without purchased provider accounts. The UI contains no seeded vehicles, example tickets, fake balances, or invented pins. Empty states remain empty until a real search. Source freshness, partial results, unknown fields, and unlocated tickets are explicit.

Accounts, notification jobs, billing, dealership enrollment, and case workflows have application/server implementations, but need provider setup and end-to-end acceptance before operation. Hosting deployment is pending; this repository is not confirmation of a live commercial launch. Paid checkout additionally requires COMMERCE_ENABLED=true. Leave it false until SETUP.md and LEGAL-LAUNCH.md are complete.

## Included

- Direct NYC Open Data queries, fiscal-year history, summons deduplication, field provenance, caching, geocoding, and full financial details.
- Garage, search, map/list, account, dealership sponsorship, and assigned-partner interfaces. Maps support gestures and keyboard navigation without a floating control dock.
- Clerk adapters and server-side owner/dealer/partner authorization.
- D1 durable notification jobs, unique event claims, initial summaries, quiet hours, reminders, consent rechecks and SMS caps.
- Resend, Twilio and Stripe adapters; signed/replay-protected webhooks; private R2 evidence and expiring links.
- AI preparation on request, version-bound approval, self-submission guidance, partner handoff and official-receipt gating. Current AI does not read uploaded document/image contents.
- Separate /legal routes for terms, privacy, messaging, billing, accessibility and data/dispute disclosures. General terms and recurring purchases have separate recorded consent.
- Installable manifest. Only public map backgrounds, geometry, fonts, icons, and the offline page are cached; ticket records are not persisted in the browser for offline use.

## Appearance and language

The header settings menu offers Light / Dark / System and English / Chinese / System. Both default to device settings; explicit choices persist locally and synchronize across tabs. Chinese uses Simplified Chinese UI and legal copy. Official city descriptions, addresses, and user-entered facts remain unchanged. External provider pages retain their own language settings. Language and theme do not change stored records, API enums, or currency (USD).

## Local development

See [ENVIRONMENT.md](ENVIRONMENT.md) for local and production environment variables. Credentials are not included in the repository.

Use Node 22.13+. Run npm ci, then copy .env.example to ignored .env.local. Add only providers being activated.

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_chief_silver_sable.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_skinny_monster_badoon.sql
npm run dev
```

Apply migrations once to a new local database. Port 5173 is the default. Sites provisions logical DB and private BUCKET bindings. The operational scheduler is a separate Worker in worker/. Never commit secrets, .wrangler, .sites-runtime or node_modules.

If the Windows npm shim is broken, use node scripts/run-framework.mjs dev or build directly; invoke npm via the installed npm-cli.js for installation.

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/domain.test.mjs tests/queue.test.mjs
node scripts/run-framework.mjs build
```

## Validation and remaining limits

Type checking and focused tests cover plate identities, normalization, camera dates, history backfill, DST quiet hours, reminders, SMS segments, sponsorship expiry, partner isolation, webhook rollback and a 500-vehicle duplicate-job simulation. Live NYC API checks returned matching actual summons records. Browser verification covers responsive layout, custom-select keyboard operation, map/background separation, and legal subpaths.

This is not provider end-to-end or live 500-vehicle throughput proof. Sign-in isolation, messages, subscriptions, AI and filing require configured accounts and acceptance. Measure the 15-minute delivery objective before promising it.

Pilot limitations: 100 active customers per dealer; no automated dealer overage billing, extra SMS purchases, self-service staff invitations, sponsorship renewals, or partner onboarding. Unknown provider responses are held for manual reconciliation. AI tracks tokens/attempts; dollar costs depend on the chosen model and provider budgets. No evidence OCR or automatic filing is implied.

## Data and asset provenance

- NYC Open Parking and Camera Violations nc67-uf89 plus fiscal-year datasets, queried directly. No unapproved How's My Driving website dependency or copied app source.
- NYC DCP borough boundaries gthc-hcne and a selected 12,000-feature subset of wider NYC streets from inkn-q76z. The background is real geography, not a complete navigation map.
- Geoclient / NYC Planning GeoSearch for real locations. Garage, Search and Account use an original local WebP background rendered from NYC public geometry; no Mapbox runtime or tiles load on those screens. Mapbox mounts only on the Map view. Ticket previews use static Mapbox images.
- Manrope, IBM Plex Mono, and the locally subset Noto Sans SC variable font licenses included in public/fonts; Lucide icons.

## Cost controls

The original $25-50/month baseline is a planning target, not a guaranteed invoice. Sites-managed hosting has separate terms from a directly purchased Cloudflare plan. Verify actual pricing before launch. Controls include shared city caches, daily checks, bounded address lookups and Mapbox only on the Map view, 500 total vehicles, bounded uploads, 10 SMS segments/user/month, a global SMS ceiling and explicit-request-only AI. No ads or sale of vehicle data.
