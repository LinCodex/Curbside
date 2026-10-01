# Clerk migration and production cutover

The existing project uses Supabase Auth UUIDs as car/preferences/consent foreign keys. Never delete or replace that database during this migration. The new curbside_accounts table retains those UUIDs and maps them to Clerk users through Clerk's admin-controlled external_id. Email matching and unsafe_metadata are never used to transfer ownership.

## 1. Prepare the production instance

The CLI linked application is app_3K6yDRE97n4v0sWHxXzDuQjYXCV (TicketSafe). Its development instance is configured; a production instance was not configured when this migration was prepared. Create/configure the target production instance and domain before importing real users. Use production keys for the final import and deployment. Follow [Clerk's migration guide](https://clerk.com/docs/guides/development/migrating/overview); development users cannot be moved to production.

Apply and verify the built-in legal settings on the target instance:

```sh
clerk config patch --app app_3K6yDRE97n4v0sWHxXzDuQjYXCV --instance prod --file clerk.config.json --yes
clerk config pull --instance prod --keys compliance
```

The checkbox must be required, with /legal/terms and /legal/privacy at the public Curbside origin. New registrations use Clerk's built-in consent UI. Import only real, previously recorded consent timestamps for existing users. No one accepts legal terms on behalf of a user. Users lacking consent must resolve that requirement before import; the dry run stops on them. If the service origin changes, update the URLs before rollout.

The terms contract remains version 2026-09-27.1; its agreement instruction now points to Clerk. Factual privacy disclosures are dated separately as 2026-10-01.1. Imported consent timestamps record historical acceptance, not a new acceptance of changed wording. Notify existing customers of the authentication provider/privacy update before rollout; any material contract change needs a separately collected agreement and version.

The checked-in configuration also disables phone/SMS authentication, the username requirement and Clerk product billing. Preserve any customer-required authentication factors after inventory rather than silently dropping them; this export does not migrate MFA enrollments. Configure production OAuth credentials for existing social providers.

## 2. Preserve and inventory users

Take a database backup. Freeze old registration and account writes for the final export/import/cutover window. Disable the old Supabase account-delete function during this window so an old session cannot delete an identity during migration. In the authorized SQL editor, run [scripts/export-legacy-users.sql](scripts/export-legacy-users.sql). Save just its JSON array to ignored work/legacy-users.json. This export contains password hashes and personal data: do not commit it, paste it in chat, or place it in outputs.

The export includes original UUIDs, confirmed-email status, bcrypt password digests and versioned legal acceptance. Anonymous accounts, unsupported hashes and users without recorded acceptance require administrator resolution before cutover. Enable the corresponding email/password and existing OAuth providers on the target Clerk instance. Social-only users do not gain a fabricated password; existing sessions need a new Clerk sign-in. Do not import Supabase refresh tokens.

Set the target Clerk secret in .env.local without printing it, then dry-run:

```sh
npm run auth:import -- work/legacy-users.json --production
```

Review counts and resolve conflicts. Apply only to the intended instance:

```sh
npm run auth:import -- work/legacy-users.json --apply --production
```

The importer preflights all email collisions, skips already imported external IDs, preserves verification and legal timestamps, rate-limits writes, and never logs hashes, email addresses or keys. It stops on API errors. Resolve the error and rerun; already migrated rows are skipped. Never attach an existing Clerk account to a legacy UUID merely because email addresses match. For development rehearsal, use isolated synthetic accounts and omit --production.

## 3. Apply the database cutover

Apply supabase/migrations/20261001221612_clerk_accounts.sql through the normal migration process after the user import is complete and old traffic is frozen. It inserts account mappings from auth.users, preserves all existing user_id values, changes foreign keys to curbside_accounts, and revokes old Supabase browser access, including column privileges. RLS remains enabled; private account tables are available only to the server service role. The existing subscription cleanup triggers and city histories remain intact.

Run Supabase security advisors and confirm the migration is recorded exactly once. Verify before/after account/car/preference/consent row counts. Do not delete old auth.users. New app traffic binds a legacy UUID only from the authenticated Clerk user's external_id and only if the matching legacy row is unclaimed. Missing or conflicting mappings fail closed.

Pre-link every imported identity before permitting traffic, including deletions in Clerk's profile UI. This makes webhook cleanup work even before the customer's first app login:

```sh
npm run auth:link -- --production
npm run auth:link -- --apply --production
```

The linker preflights all mappings and refuses missing legacy rows or conflicting IDs. Review the dry-run count, then verify every imported external_id resolves to its original UUID. Configure the signed deletion webhook before reopening access. If an imported identity is deleted during the closed maintenance window, reconcile it against the export before proceeding.

Deletion records a minimal Clerk-ID tombstone and removes the mapped account in one database transaction. Account creation/binding uses the same per-identity lock, preventing an in-flight request from recreating a deleted account. Tombstones contain no email, vehicle data, password, or consent history.

## 4. Deploy and verify

Set production Clerk publishable/secret keys, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the exact APP_ORIGIN in Vercel. Keep keys server-only. Configure a Clerk user.deleted webhook to https://curbside-eta.vercel.app/api/webhooks/clerk and set CLERK_WEBHOOK_SIGNING_SECRET; webhook delivery is signed, idempotent and retries failed cleanup. This also handles deletion from Clerk's own UserButton/profile UI or dashboard. The app's deletion endpoint verifies an active Clerk session, revokes the Clerk identity first and cascades its database account data. Histories retained by another customer survive.

Deploy as Next.js with npm ci and npm run build, removing prior dashboard overrides for dist/client and the static build. Check two migrated users with distinct saved cars and preferences, plus a new Clerk signup. Check the built-in legal checkbox and legal links, same-password sign-in, password recovery, account switching, a renamed car, car deletion, full account deletion in a synthetic account, signature rejection, webhook retry and old Supabase-token denial. Verify actual production signup before opening registrations again. Never delete a real customer's account as a test.

If the cutover must be rolled back, restore the old application and database backup together during the same maintenance window. Database changes/new Clerk-only users cannot be safely rolled back by redeploying the old frontend alone. Reconcile any new writes first.

## 5. Retire unused services after verification

Disable old Auth registration/sign-in entry points; keep the retired account-delete function disabled and stop the old custom SMTP integration when no longer used. Remove the duplicate Cloudflare curbside-scheduler and unused legacy app/D1/R2 resources after inspecting their contents. Disable Vercel analytics in the dashboard and cancel unused Stripe/Twilio/Resend/AI subscriptions or resources. Removing credentials is not cancellation. Do not remove Supabase saved-car tables, vehicle-snapshots or curbside-saved-history-morning: these are still used for city-history retention.

The Supabase connector denied project access during preparation, so live user export, production import, migration, function retirement, advisors, deployment and billing cancellation were not performed. The code and local Postgres migration tests are reviewable independently; these access-dependent steps remain required before merging/deploying the auth cutover.
