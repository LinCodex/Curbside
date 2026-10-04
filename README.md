# TicketSafe · 罚单卫士

NYC plate search, private saved cars, retained city ticket histories, and a map. Public search requires no account. Supabase supplies authentication, database storage and existing account/snapshot Edge Functions. Existing customer UUIDs, cars, preferences, sessions and acceptance records remain in the same project.

Current release: **1.0.0**. Start with the [changelog](CHANGELOG.md), [developer handoff](DEVELOPER.md) and [dated service verification](docs/SERVICE-VERIFICATION.md). Database and Edge Function deployment is separate from Vercel's GitHub deployment.

## Development

Use Node 22.13 or newer. Run npm ci, copy .env.example to an ignored .env.local, configure the existing project's URL and publishable key, and run npm run dev. APP_ORIGIN must match the exact website origin. Never expose a Supabase service-role key; privileged function credentials remain in the Supabase function runtime.

## Authentication and agreement

Email/password sign-in, email confirmation, confirmation resend, password recovery and verified email changes use the Supabase browser SDK. The verified customer session and row-level security protect saved cars and preferences. Customers explicitly accept the terms and age requirement before saving cars. Reading a legal page does not record agreement. Historical agreement version and timestamps remain intact; the displayed policy revision is separate.

Account deletion calls the existing account-delete Edge Function, which validates identity, explicit confirmation and a live session before deleting the user. Database cascades remove that customer's private data while shared histories still used by other customers remain.

## Deployment and costs

Vercel uses the standard Next.js build. The active address remains https://curbside-eta.vercel.app. The custom-domain alias is listed in Vercel but did not resolve in the October 4 check. It requires DNS, TLS and authentication-origin verification before activation; no redirect to an unavailable domain is enabled.

Vercel Web Analytics is retained. Only explicit public search/map and current legal-page visits are counted, with queries stripped and private account/garage/recovery views excluded. Global Privacy Control and Do Not Track are respected.

The retired D1/R2 backend, duplicate Cloudflare scheduler, static Vite/vinext runtime and unused payment/messaging/AI routes remain removed. Keep the Supabase database, Auth email delivery, account-delete function, vehicle-snapshots function and existing daily history schedule. Mapbox is optional. Removing source or environment variables does not cancel external subscriptions or delete previously hosted resources.

## Saved-vehicle alerts and search protection

Account email alerts are opt-in and cover saved vehicles only. A complete historical baseline sends no alert; later new summons trigger one daily email. Balance changes alone do not trigger mail. Branded English/Chinese messages show up to 20 ticket details, reported balances, an attached map for reliable locations, and official NYC CityPay links. Unknown balances and positions stay unknown. Resend sends from alert@ezrefillny.net; SMS is unavailable.

The existing Supabase morning job handles discovery and delivery without adding a scheduler. Private outbox leases, frozen message bodies and provider idempotency protect retries. Delivery is capped at 10 messages per worker invocation and 100 attempts per UTC day, with at most five attempts per message within 22 hours. Unsubscribe and account/car removal suppress pending alerts.

Search runs hCaptcha automatically when verification is required. A five-minute HTTP-only pass permits at most ten searches, bound to trusted ingress IP and browser identity. Every request consumes durable Supabase attempt/search limits. Configure both SEARCH_VERIFICATION_SECRET and SEARCH_VERIFICATION_LEDGER_URL only after installing the ledger. Partial configuration fails closed; neither configured requires fresh CAPTCHA for each search. Authentication always uses its own fresh CAPTCHA.

See [NOTIFICATIONS.md](NOTIFICATIONS.md) for deployment order, secret names, caps and validation.

## Verification

Run npm run typecheck, npm test and npm run build. Tests cover local Postgres ownership/consent/history protections, account deletion, email editing, password requirements, city records, preferences, privacy and translations. Existing repository-wide lint debt is reported separately.
