# TicketSafe developer handoff

Baseline: version **1.0.0**, October 4, 2026. Start with [CHANGELOG.md](CHANGELOG.md), [service verification](docs/SERVICE-VERIFICATION.md), and [AGENTS.md](AGENTS.md). This is a Next.js application deployed to Vercel with a separate Supabase backend. GitHub deployment does **not** deploy database migrations or Edge Functions.

## Local development

Use Node 22.13+ and npm. The lockfile is authoritative.

```sh
npm ci
# Copy .env.example to .env.local and fill the values locally.
npm run dev
npm run typecheck
npm test
npm run build
npm run lint
```

The default origin is `http://localhost:3000`. Set `APP_ORIGIN` to the exact origin if using another port. Search POSTs intentionally reject a different origin. Configure hCaptcha with an allowed development hostname; do not bypass its production verification. Production credentials must not be embedded in UI code, test fixtures, screenshots or committed environment files.

`npm run build` generates icons and the standard `.next` output. Vercel uses `npm ci` and `npm run build`; do not select Vite, Cloudflare or a custom `dist` output directory. Start a built app with `npm start`. `.next`, `node_modules`, `.vercel`, `work`, local environments and tool profiles are checkout-local and ignored. Keep `.vercel` when using the already-linked project. Never commit a deployment bundle containing runtime credentials.

## Ownership map

| Location                                                                                               | Responsibility                                                                                |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `app/page.tsx`, `components/curbside.tsx`                                                              | Main view/navigation orchestration, searches, garage selection, map panels and ticket details |
| `components/ticket-list.tsx`, `vehicle-data.tsx`, `plate-balance.tsx`                                  | Ticket rows, separate city-reported vehicle attributes, financial summaries                   |
| `components/modal.tsx`, `popup-presence.tsx`                                                           | Dialog focus/scroll ownership and exit presence; preserve nested popup lock behavior          |
| `components/city-map.tsx`, `use-map-locations.ts`, `map-panel-controls.tsx`, `map-ticket-scroll.tsx`   | Map rendering, location resolution, panel controls and contained-list fade                    |
| `components/account-provider.tsx`, `use-supabase-account.tsx`, `lib/supabase-account.ts`               | Verified identity, session recovery, saved vehicles and per-profile caches                    |
| `components/auth-panel.tsx`, `account-details.tsx`, `email-confirmation.tsx`, `lib/password-policy.ts` | Authentication, confirmation, recovery and account changes                                    |
| `components/preferences.tsx`, `lib/preferences.ts`, `lib/zh.json`                                      | Theme/language/detail preferences and translation                                             |
| `components/welcome-onboarding.tsx`, `mobile-web-app.tsx`, `public/sw.js`                              | Cookie-backed onboarding, installation, refreshing and offline shell                          |
| `components/cookie-consent.tsx`, `private-analytics.tsx`                                               | Consent and restricted telemetry                                                              |
| `components/notification-settings.tsx`, `notification-preferences.tsx`                                 | Customer alert opt-in and availability                                                        |
| `components/crm-*`, `lib/crm-client.ts`                                                                | Staff dashboard, custom selectors and authenticated CRM actions                               |
| `app/legal`, `components/legal-page.tsx`, `lib/legal.ts`                                               | Public legal subpaths and current disclosure text                                             |
| `app/api/config`                                                                                       | Explicit public browser configuration; never expose all environment variables                 |
| `app/api/search`, `app/api/search/verification`                                                        | Same-origin search, challenge verification and signed durable request limits                  |
| `lib/nyc.ts`, `domain.ts`, `city-pages.ts`, `ttl-cache.ts`                                             | City adapters, normalization, source provenance, bounded pagination and cache                 |
| `lib/snapshot-search.ts`, `vehicle-snapshots.ts`, `garage-history.ts`                                  | Retained snapshot search and combined histories                                               |
| `lib/email-notifications.ts`, `ticket-email.ts`, `email-map.ts`                                        | Notification decisions, frozen messages and bounded attachments                               |
| `supabase/migrations`, `supabase/functions`, `supabase/tests`                                          | Database history, privileged functions and transactional SQL fixtures                         |
| `tests`, `scripts`                                                                                     | Regression proof and maintained asset/function build tools                                    |

`components/curbside.tsx` still owns substantial application orchestration. The release extracted presentation boundaries without redesigning state management. Continue incremental extraction with tests; avoid a simultaneous account, navigation and map rewrite.

Global styles are imported in `app/layout.tsx` in an intentional cascade: `globals`, `atlas`, `polish`, `preferences`, `design`, `desktop-workspace`, `map-controls`, then `privacy-controls`. Later files contain focused corrections, but selector specificity can still override import order. Mobile map-panel bounds belong in `map-controls.css`; do not reintroduce competing height limits in older design layers. A complete stylesheet consolidation remains a separate visual refactor, not part of this cleanup.

## Data and saved vehicles

Vehicle identity is normalized **plate + registration state + plate type**; an empty type means all types and preserves uncertainty. Do not key history by plate alone. NYC summons number deduplicates tickets. Financial records take precedence for balances, while fiscal-year history can enrich location/vehicle attributes. Retain provenance, missing amounts and source freshness. Plate history never establishes current ownership.

Saved vehicle metadata belongs to each profile. City snapshots are shared across subscriptions to the same identity; many users can save one plate. RLS restricts customer metadata and snapshot access to authorized subscriptions. Switching profiles clears/reloads private in-memory state. Signing out must not delete the shared database history. Removed/disappearing city rows remain retained and do not prove payment or dismissal. Combined garage totals deduplicate summons, and the unpaid/with-payments filters can both contain a partially paid ticket.

Public searches first consult eligible shared snapshots, then city sources as required. City fetches are plate-scoped, not a whole-city import. Pagination is currently bounded to ten 1,000-record pages per source, with request/time limits. A cap, source timeout or failed later page is incomplete, not an empty result. Never show unknown totals as zero or partial history as a lifetime balance.

Map locations require a valid match. Unknown locations stay in the list; intersection and approximate matches retain their precision. Area rings are contextual, not proof of an exact violation point. Keep actual Mapbox attribution visible. The static background assets come from NYC geographic data and are distinct from the live map.

## Notifications and morning checks

The existing Supabase cron `curbside-saved-history-morning` runs every minute at **13–15 UTC** (`* 13-15 * * *`). This is a fixed UTC schedule, so New York local time changes with daylight saving. It invokes the existing snapshot function using its private cron credential; do not publish that credential or add a competing Vercel scheduler.

The worker claims up to three due vehicles per invocation. Complete initial history establishes a baseline without alerting. Later complete checks discover new summons; partial/outage observations cannot establish a new baseline or notification event. The database stores deduplication state and outbox jobs. Balance-only changes do not send new-ticket alerts.

New jobs wait for the recipient's own due vehicles, at most ten minutes. Frozen retries do not wait for fresh scans. Each worker invocation handles at most ten email attempts; the database enforces 100 attempts per UTC day and five attempts per job within 22 hours. One daily summary groups a customer's tickets. Auth SMTP emails use their own provider/rate limits and are not covered by that outbox budget.

Delivery content, attachment and provider idempotency key are frozen before sending. Leases prevent concurrent claims. Unsubscribe, changed consent/email, removed vehicles and deleted accounts suppress pending delivery. Provider acceptance is not inbox delivery; inspect Resend delivery events when troubleshooting. A morning schedule success only proves the scheduled invocation ran, so inspect snapshot freshness and outbox state as well.

500 due vehicles can require most of the three-hour window even before retries. Daily budgets, publication delays, pagination/time caps and outages prevent an unconditional “never misses a ticket” or fifteen-minute guarantee. Monitor overdue snapshots, oldest pending jobs, terminal failures, attempts and provider allowance before increasing enrollment. Current code does not implement SMS, user-timezone quiet hours or the original seven/two-day legal-deadline reminder proposal.

## Auth, privacy and security boundaries

- Only server-verified confirmed identities can save cars or use protected customer flows. A pending Auth row is not a confirmed application account. Keep email-confirmation redirects and recovery types separate. Confirmation resend has a UI cooldown and service limits.
- Supabase RLS is the authorization boundary. Do not rely on hidden buttons or customer-supplied user IDs. Staff actions additionally require a live Auth session and an existing CRM role.
- Gateway `verify_jwt=false` is intentional for four functions with custom authentication. Preserve their checks: snapshot cron credential/customer identity, search HMAC/replay controls, CRM verified session/roles, and narrowly scoped notification availability/unsubscribe. `account-delete` retains gateway JWT verification **and** handler identity/confirmation checks.
- Service-only SQL functions and private delivery tables must remain inaccessible to `anon` and `authenticated` where applicable. Keep explicit grants/revokes and empty SQL search paths. Do not grant a customer the service role.
- Search verification uses hCaptcha, trusted ingress IP, browser-bound short-lived HTTP-only passes and durable limits. Partial ledger configuration fails closed. Do not trust arbitrary forwarded IP headers or silently permit searches when CAPTCHA is unavailable.
- CRM support replies use the existing durable delivery ledger. Prepare immutable context/content, acquire a bounded lease, send with the stable key, then record acceptance. An ambiguous send/recording failure requires review; do not issue a new key to work around it. Support deletion clears its associated reply ledger.
- Announcements/marketing consent is separate from ticket alerts. Optional analytics requires consent and respects DNT/GPC. Private garage/account/CRM/recovery routes and search queries are excluded/redacted. Mobile uses essential-only analytics behavior.
- The service worker does not cache private API/auth data. Cached shell information is not a fresh city observation. Preserve iOS safe-area padding, bounded dialog height and visible actions.
- Historical acceptance version `2026-09-27.1` is embedded in existing eligibility checks. Do not replace it with the app version. Policy display revisions are a separate concern requiring a deliberate consent migration.

## Environment and provider setup

See [VERCEL_ENVIRONMENT.md](VERCEL_ENVIRONMENT.md), [NOTIFICATIONS.md](NOTIFICATIONS.md), [CRM_SETUP.md](CRM_SETUP.md) and [LEGAL-LAUNCH.md](LEGAL-LAUNCH.md).

Vercel owns the website origin, Supabase URL/publishable key, hCaptcha, map token, optional city-data credentials and search-ledger connection. Supabase owns privileged runtime credentials, the scheduler credential, Resend sending credentials and unsubscribe/search signing configuration. Auth SMTP is configured independently in Supabase Auth with Resend. A verified sending domain does not provide a receiving inbox.

Public keys are allowed in the browser; service-role, SMTP, Resend, CAPTCHA secrets and signing credentials are not. Preview deployments currently do not have the full production account/origin configuration. Provision preview-specific origins and CAPTCHA/Auth allowed redirects deliberately before treating previews as complete. Avoid copying production service secrets indiscriminately.

`/api/config` includes legacy disabled-service flags. The actual opt-in email capability comes from the read-only `email-notifications` function status; `services.email=false` alone does not mean alerts are off. Paid commerce, AI preparation, partner filing, dealer sponsorship billing and phone features remain disabled/deferred; do not reactivate their UI without a working backend and policy review.

## Deployment and rollback

1. Run the checks above and review source/lockfile changes. Push `main` to `LinCodex/Curbside`; the existing Vercel Git integration builds production. Confirm its deployment is Ready and the public configuration is present.
2. Deploy database/function changes separately to the **existing** Supabase project. Never run `db reset` against production. Original local migration timestamps differ from some live historical entries: reconcile the ledger in an isolated deployment directory before `db push`; do not replay all local history blindly.
3. Apply new SQL transactionally and record the exact version/name/statements in the migration ledger. Additive migrations go before dependent function code. The two October 3 audit migrations are already installed; do not rerun their unguarded `add column` statements.
4. The maintained `scripts/bundle-*-function.mjs` commands produce ESM `work/<function>/index.js`, externalizing the pinned `npm:@supabase/supabase-js@2.117.2` import. Stage those bundles in an isolated `supabase/functions/<name>/index.js` tree with a `config.toml` preserving each function's gateway setting. Run `npx supabase functions deploy <explicit names> --project-ref wkuvihaiacfcqctwolqu --use-api --workdir <staging-root>`. Do not use `--prune` or deploy unrelated functions.
5. Check function versions, read-only availability, unsigned/unauthorized rejection and SQL privileges. Never invoke the cron/notification sender as a generic health probe: it can send real customer email. Obtain specific authorization before test mail, account deletion or production test records.

Use a new Git revert commit for website rollback; do not force-push over another coder's commits. Backend rollback is separate: redeploy prior function bundles from the prior Git revision, retaining the additive database columns and data unless an explicit reviewed rollback requires more. Do not erase customer histories, consent records or delivery idempotency state to repair a release. Keep the current origin until custom-domain DNS, TLS, Auth redirects, CAPTCHA hostname and Edge CORS are verified together.

## Verification and remaining maintenance

Version 1.0.0 passed 106 tests, TypeScript and a production Next build after cleanup. Tests cover real local Postgres/RLS execution, baseline/discovery/outage behavior, delivery deduplication, immutable retries, unrelated 500-vehicle grouping, account management, IP trust, search caps, preferences, translation contracts and email escaping/maps. Synthetic data exists only in test fixtures, not customer UI. Local SQL test fixtures roll back.

Repository-wide lint is **not a clean gate yet**: existing broad `any` types, React effect-state/memoization rules, hook dependency warnings, internal-link rules and deliberate plain image elements remain. This release did not silence the rules globally or rewrite account/map lifecycle merely to hide warnings. Keep `npm run lint` visible and address debt in separately tested slices. Translation tests validate contracts, not a native-speaker review of every dynamic NYC source label.

For layout changes, test small phones and desktop, light/dark, English/Chinese, long addresses, many tickets, empty states, internal list ends, popup actions, profile switches and reduced motion. Actual iPhone Home Screen behavior needs device testing; desktop emulation does not prove notch/keyboard/standalone behavior. `work` captures are temporary local evidence, not source dependencies.
