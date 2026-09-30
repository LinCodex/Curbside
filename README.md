# Curbside

Mobile-first NYC parking/camera violation search and monitoring for **Flushing NY Wireless**. The app uses locally bundled Manrope and IBM Plex Mono fonts, actual NYC map geometry, a neutral black theme, accessible custom selectors, and reduced-motion-aware transitions.

## Status

Real NYC plate search is available without purchased provider accounts. The UI contains no seeded vehicles, example tickets, fake balances, or invented pins. Empty states remain empty until a real search. Source freshness, partial results, unknown fields, and unlocated tickets are explicit.

This release is free: consumer/dealer pricing is hidden and new checkout is blocked on both client and server by `FREE_ACCESS` in `lib/release.ts`, even if payment credentials are configured. Existing cancellation access is preserved. Accounts, notification jobs, dealership enrollment, and case workflows still need provider setup and end-to-end acceptance before operation.

The current Vercel deployment uses `vercel.json`, `node scripts/build-vercel.mjs`, and `dist/client` with standalone `api/config.ts` and `api/search.ts` functions. It is a Vinext/Vite build, not a Next.js `.next` deployment. Other handlers in `app/api` and the D1/R2 bindings are retained but are not standalone Vercel function adapters; private account/notification workflows require a durable backend and corresponding deployment before activation.

Account contains appearance, language, and Normal/Geek controls. Normal is the default overview; Geek exposes city-reported vehicle histories, source coverage, and per-ticket provenance. These settings persist locally and do not change source queries. Historical lookup defaults on through FY2014.

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

Account opens a settings popup with Light / Dark / System, English / Chinese / System, and Normal / Geek detail modes. Save applies choices together and persists them on this device; Cancel discards edits. Appearance and language default to device settings, with Normal as the detail default. The legal pages also offer appearance/language controls. Chinese uses Simplified Chinese UI and legal copy, with localized known violation descriptions. Official addresses, identifiers, brand names, and customer-entered evidence remain unchanged. External provider pages retain their own language settings. Preferences do not change stored records, API enums, or currency (USD).

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
