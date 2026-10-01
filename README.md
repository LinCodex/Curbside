# Curbside

NYC plate search, private saved cars, retained city ticket histories, and a map. Public search requires no account. Accounts use Clerk; Supabase stores saved cars and preferences.

## Development

Use Node 22.13 or newer and npm:

```sh
npm ci
clerk auth login
clerk env pull --app app_3K6yDRE97n4v0sWHxXzDuQjYXCV --file .env.local
npm run dev
```

Set the non-Clerk variables from [.env.example](.env.example) in an ignored local environment file. Set APP_ORIGIN to the exact development origin. Do not run init again to upgrade an already integrated checkout; use env pull and doctor instead. The linked Clerk application is TicketSafe.

## Authentication and consent

The Next.js Clerk SDK supplies sign-in, sign-up, password recovery, OAuth verification, and account controls. Clerk's built-in legal checkbox collects Terms and Privacy acceptance during sign-up, including supported OAuth flows. The settings are checked into [clerk.config.json](clerk.config.json). The application does not collect a second agreement. Existing recorded acceptance timestamps are carried through the user import; the migration never fabricates consent.

Email/password authentication is enabled; phone/SMS authentication and the extra username requirement are disabled. Clerk product billing is disabled. Configure production OAuth providers separately before cutover.

Account APIs validate the Clerk session and verified primary email on the server. Every private query uses the resolved ownership UUID. Browser-selected ownership and user-editable metadata cannot change that identity. Account-switch responses are discarded, private responses are not cached, and the service worker caches only public assets.

## Existing users and deployment

**Follow [CLERK_MIGRATION.md](CLERK_MIGRATION.md) before switching production.** Existing UUIDs, cars, preferences, and acceptance timestamps are retained. Import users into the target production Clerk instance; development users cannot be promoted into production.

Vercel now uses its standard Next.js build. Remove old static output/build/install overrides in the project dashboard. Production needs Clerk keys, Supabase server credentials, APP_ORIGIN, and a signed user.deleted webhook at /api/webhooks/clerk. Secrets must never be supplied through NEXT_PUBLIC_ variables.

## Cost cleanup

The legacy D1/R2 backend, duplicate five-minute Cloudflare scheduler, static Vite/vinext deployment, Vercel analytics, Supabase auth email templates, and unused Stripe/Twilio/Resend/AI routes are removed. Those provider credentials no longer activate spending paths in this release. Supabase database storage and its existing daily city-history worker remain because they support saved cars; Mapbox is optional and loaded only for the map.

Removing code does not cancel provider subscriptions or previously deployed jobs. Disable the old Supabase account-delete function during the cutover maintenance window, then retire the Cloudflare scheduler/deployment and unused D1/R2 resources, old auth SMTP sender, and unused paid provider subscriptions after verification. Export/inspect any data before deleting a hosted resource. Keep the Supabase database, snapshot function and daily history schedule.

The database and account API intentionally stay separate from Supabase Auth. Old user records remain as a rollback source; old browser grants are revoked at cutover. No new paid storage, queues, or worker services are introduced.

## Verification

```sh
npm run typecheck
npm test
npm run build
clerk doctor
npm run lint
```

Tests include an actual local Postgres migration with legacy data and permission checks, identity/password/consent import checks, account deletion, and existing city-data, preference, map and garage behavior. The repository has pre-existing ESLint debt; any remaining lint failures must be reported separately from type, build and test results.
