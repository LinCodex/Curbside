# Changelog

## 1.2.0 — 2026-10-11

Customer-facing notes for this release also appear in Account → What’s new (`lib/changelog.ts`).

- Tutorial: the automatic first-run tour (once per account, stored in Auth user metadata `ticketsafe_tutorial_seen` with a local copy) turns new-ticket emails on when it opens; its ticket-alerts step offers Turn off / Turn on. Replaying the tour from Account never changes the setting. Privacy policy and terms wording updated to match; the terms consent version is unchanged.
- Home Screen app updates: each deployment is stamped with `APP_BUILD_ID` (`VERCEL_DEPLOYMENT_ID`, else the commit SHA). `components/app-updater.tsx` compares it with `/api/version` (`no-store`) on launch, resume, focus and every 5 minutes, then updates the service worker and reloads once per new build, waiting while a field is focused. `/sw.js` is served `no-cache` and registered with `updateViaCache: "none"`.
- Chinese input: the plate field no longer uppercases during IME composition, which duplicated pinyin on iPhone.
- Language: the legal policy picker navigates client-side; the tab title stays translated; full page loads stay hidden until the saved Chinese locale renders (1.5 s fallback).
- Email settings: the announcement preference is prefetched at sign-in so Account shows it without a spinner.
- Sign-up: the verification step reminds users to check spam or junk.
- iOS Safari: `theme-color` follows the light/dark page background.
- UI: removed the floating Edit search button; footer Help & support and Cookie settings sit side by side; the no-account search note is hidden for signed-in users.
- CRM: email templates (10 built-in, English/Chinese) plus shared team templates, a formatting toolbar, live preview and draft checks; Activity log tab; inbox status filter, search and open count; delivery review for uncertain sends; 20 of the 100 daily emails reserved for support replies; support-role deletes blocked and audited.

### Backend deployment

Applied `20261011170000_restrict_support_deletes` and `20261011180000_crm_portal_tools` and recorded both in the migration ledger. Deployed `crm-admin` v7 (`verify_jwt = false`, session checked in the handler). Rollback: redeploy the previous `crm-admin` bundle; the new table and functions are additive.

### Validation

115 regression tests and TypeScript passed; production build verified with a test deployment ID, including the version endpoint and reload behaviour.

## 1.1.0 — 2026-10-11

Customer-facing notes for this release also appear in Account → What’s new (`lib/changelog.ts`).

- Account: notification settings moved into a Notifications sheet directly under Account details. New-ticket and announcement email choices are cached per account in `localStorage`, so a refresh shows the saved state immediately while the server value loads.
- Account: What’s new sheet listing every release, placed between Support & feedback and Privacy & legal. An App tour row replays the guided tour.
- Guided tour after sign-in: highlights Garage, Search, Map, Account and Notifications with a blue outline, explains each, and ends with a shortcut to the Notifications sheet. Skip, Back and Escape are supported; completion is remembered per account.
- Onboarding and all popups: removed the focus outline drawn around the dialog container itself.
- Navigation: Garage/Search/Map/Account changes push browser history, so Back and Android back gestures return to the previous view.
- Saving a searched plate as a guest is resumed after the account is confirmed and terms are accepted (24-hour, single-use local record of plate, state and plate type).
- Mobile: swipe the map panel toolbar to collapse or expand it; pinch, drag, double-tap and wheel zoom on the backup SVG map; Edit search button when the search form scrolls away; Android `beforeinstallprompt` install button; focused fields in popups stay above the on-screen keyboard; tighter popups on short screens.
- Support: Help & support link in the page footer opens the support form. Account data disclosure has a visible chevron.
- Removed the empty `app/admin13678` directory.

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
