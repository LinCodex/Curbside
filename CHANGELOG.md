# Changelog

## 1.0.0 — 2026-10-04

This is the first documented production version. It captures the existing application and the cleanup below; it does not imply that every feature in the original product proposal has shipped. Earlier commits are unversioned development history. The application version is recorded in `package.json` and `package-lock.json`.

### Current product

- TicketSafe / 罚单卫士: responsive NYC parking and camera-ticket searches, including out-of-state plates, optional plate types, and historical fiscal-year records from FY2014. Real city records, source freshness, missing fields and incomplete results remain explicit.
- Garage: confirmed Supabase accounts, privately saved vehicle details, shared retained city histories, individual and combined balances, full scrollable ticket lists, and custom all/unpaid/with-payments filters. Multiple customers can save the same plate without sharing their private vehicle labels or account settings.
- Maps: lazy-loaded dark/light Mapbox maps, matched-address pins, approximate-area rings, selected-ticket details, vehicle switching, stable mobile panel widths and scroll fades. Unknown locations remain in the list. Map attribution remains on interactive maps.
- Accounts: email/password registration, confirmation and resend, recovery, email changes, account deletion, profile-specific display preferences, English/Chinese, light/dark/system themes and Normal/Geek detail modes. Phone sign-in and phone editing remain unavailable.
- Mobile web app: Home Screen installation instructions inside onboarding, safe-area layouts, pull-to-refresh, retained search navigation, reduced-motion support and map-tab dock visibility. On mobile, optional analytics stays disabled; storage guidance directs users to browser settings.
- Opt-in saved-vehicle ticket emails in English/Chinese through Resend, with reported balances, official payment links and a bounded static map attachment when available. An initial complete scan establishes a baseline without emailing old tickets.
- CRM at `/web-portal`: session- and role-protected user management, support/feedback inbox and replies, announcements, real-snapshot test alerts, theme and language settings. CRM account actions can include a customer status email.
- Legal subpaths, consent records, custom controls, hCaptcha, durable search verification limits and consent-gated, redacted Vercel analytics.

### Reliability fixes included

- Plate-scoped city pagination beyond the original 1,000-record response, with bounded page/time limits and honest partial-result reporting.
- Bounded authentication and database requests so unavailable services cannot leave startup waiting indefinitely.
- New-ticket email grouping waits for the recipient's vehicles, with a ten-minute ceiling, instead of waiting for unrelated vehicle scans.
- Durable CRM support-reply preparation, immutable delivery content, leases, retry limits and provider idempotency. Ambiguous recording failures require review instead of reporting success.
- CRM deletion notices follow successful account deletion.
- Full individual garage history scrolling, aligned map-list fades, visible empty-state search buttons, compact notification copy and consistent light-mode button contrast.
- Preserved the subsequent desktop account-card/sign-out fixes and window scrolling from commits `2ade3e9` and `95a773c`.

### Production cleanup

- Removed the unused starter UI component library, its hook/helpers/configuration, unused starter images, unused vendor stylesheet and the obsolete legacy-password export utility.
- Removed 19 direct dependencies used only by the starter library, reducing the installed dependency graph by 69 packages.
- Extracted ticket lists, city-reported vehicle attributes, modal focus/scroll ownership and date formatting from the main application into dedicated modules. Ticket-list inputs now use the existing `Violation` contract.
- Removed the no-op map-credit component; this does not remove Mapbox's actual map attribution.
- Removed its unused CSS and a superseded mobile map-height rule that clipped the empty-state search action on short phones. Current map-panel sizing remains in `app/map-controls.css`.
- Removed tracked Supabase CLI temporary state and obsolete icon copying to the retired static build directory. Generated caches and local execution profiles are excluded from lint and Git.
- Added the developer handoff and a dated service-verification record. No customer records, secrets, profile identifiers, consent versions or production routing were replaced.

### Backend deployment

Applied `20261003200000_profile_notification_readiness` and `20261003200001_durable_support_replies` to the existing project and recorded both in its migration ledger. Deployed `vehicle-snapshots` v8, `email-notifications` v4 and `crm-admin` v5. `account-delete` v4 and `search-verification` v3 remain active and unchanged.

### Validation and limits

106 regression tests, TypeScript and the production build passed. See [service verification](docs/SERVICE-VERIFICATION.md) for live evidence and [developer handoff](DEVELOPER.md) for deployment, security boundaries and remaining lint debt. No guarantee is made that delayed city publication, provider outages, source pagination caps or daily email budgets cannot delay or omit an alert. SMS, payments, AI disputes and partner filing are not active production services.

## Updating this file

For each release, bump the package version and add the date, user-visible changes, schema/function dependencies, tests, limits and rollback considerations. Treat changes to historical consent versions separately from application releases. Do not include credentials or customer data in release notes.
