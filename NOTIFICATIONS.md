# TicketSafe alerts

Email is opt-in in Account and covers saved vehicles only. SMS is unavailable. New tickets trigger mail; balance changes alone do not. Initial complete historical checks establish a baseline without sending existing tickets. Incomplete/failed source checks cannot create notification events.

Emails include up to 20 newly found tickets, saved-vehicle labels/plates, reported balances, reliable locations, an attached Mapbox dark map with numbered pins, a garage link, unsubscribe, and official NYC CityPay links. Missing balances and locations are labeled unknown. Counts above 20 link to the garage for the rest; partial totals exclude omitted/unknown balances. Mapbox Static Images receives only coordinates and anonymous pin numbers. Images retain the Mapbox logo and attribution. NYC Planning GeoSearch receives only location text when reliable coordinates are absent.

Set the existing `MAPBOX_PUBLIC_TOKEN` in Supabase Edge secrets for the notification worker. Each newly prepared email makes at most one Mapbox Static Images request, for one 640×420 PNG. The frozen attachment is reused on delivery retries and mailbox opens do not request another map. Missing configuration, unavailable Mapbox, invalid images, or images over 180KB fall back to the ticket location text; they never block an alert. Static Images usage is billed separately from interactive map loads; monitor the existing Mapbox account. No new account, plan upgrade, scheduler, image hosting or map geocoding service is required.

## Deployment order

Use the existing Supabase project. Do not create a replacement database or run a database reset. Fetch its migration history into an isolated CLI deployment directory first: original repository migration timestamps differ from the live historical versions. Keep historical consent version 2026-09-27.1 intact.

1. Apply the CLI-created email settings/outbox, search ledger and email details migrations after the existing schema.
2. Bundle the notification, search-verification and vehicle-snapshots functions with their scripts. Deploy only those functions; do not prune. Their custom authentication permits disabled gateway JWT verification: search uses signed short-lived request bodies, snapshot cron validates its private credential, customer snapshot actions verify user identity, unsubscribe verifies a scoped signed token, and the notification availability status is public and contains no customer data.
3. Set Supabase Edge secrets EMAIL_NOTIFICATIONS_ENABLED=false, RESEND_API_KEY, EMAIL_FROM=alert@ezrefillny.net, EMAIL_SENDER_VERIFIED=true only after domain verification, EMAIL_UNSUBSCRIBE_SECRET (at least 32 random characters), APP_ORIGIN=https://curbside-eta.vercel.app, and SEARCH_VERIFICATION_SECRET (matching Vercel). Runtime-supplied service credentials stay in Supabase.
4. Verify migration RLS/privileges, unsigned ledger rejection, signed request replay rejection and Resend acceptance using its official delivered@resend.dev test sink with fictional tickets. Then set EMAIL_NOTIFICATIONS_ENABLED=true. No existing customer is opted in automatically.
5. Set Vercel's production SEARCH_VERIFICATION_SECRET and SEARCH_VERIFICATION_LEDGER_URL to the deployed HTTPS function endpoint together, then deploy the website. Do not put Resend or Supabase service-role keys in Vercel or browser configuration.

## Cost and retry bounds

Reuse the existing morning cron; no additional scheduler. Maximum 10 delivery attempts per invocation, 100 per UTC day and five attempts per job. Retry only within 22 hours to stay inside Resend's idempotency retention. Provider acceptance is distinct from inbox delivery. No automatic plan upgrade. Monitor Resend monthly allowance; attempts include authentication emails separately, so these limits do not promise zero billing.

Outbox content is frozen before sending so retries retain the identical message and map. It is cleared on successful acceptance or permanent failure; terminal records/events are cleaned after 30 days. Pending jobs expire after seven days. Opt-out, removed cars, changed verified email, stale leases and account deletion suppress sends. Each user can manage email preferences through RLS, but cannot access service-only delivery data, other profiles, or search-limit tables/RPCs.

## Validation

Run npm test, npm run typecheck and npm run build. The real Postgres fixtures test ownership, legal/verified eligibility, baseline/partial-source behavior, deduplication, message freezing, retry caps, unsubscribe and deletion. The HTML tests check escaping, partial balance labels, official payment links, map PNG validity and limited address-only lookup. Mapbox tests cover anonymous coordinate-only requests, retained attribution, unavailable/oversized images, and frozen-attachment reuse on retries. The production SQL fixture in supabase/tests/email-notifications.sql uses synthetic records inside a transaction and always rolls back.

October 2, 2026: configured the existing Mapbox token in Edge secrets and deployed vehicle-snapshots version 7. A real Mapbox request returned a 640×420 PNG (50,188 bytes), and Resend accepted a fictional test alert with that inline attachment at its official test sink. English desktop and Chinese mobile previews loaded the map without horizontal overflow. All 61 tests, TypeScript checks, and the production build passed. Website publishing remains paused.
