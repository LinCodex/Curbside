# Vercel environment inventory

Project: `yangs-projects-008730dc/curbside`, connected to `LinCodex/Curbside` with `main` as its production branch. Web Analytics is enabled and retained. This inventory contains variable names only.

## Retained variables

| Variable | Use |
| --- | --- |
| HCAPTCHA_SITE_KEY, HCAPTCHA_SECRET_KEY | Active search protection |
| SUPABASE_URL | Current accounts and shared city-history lookup |
| SUPABASE_PUBLISHABLE_KEY | Current deployed Supabase sign-in; retire after verified Clerk cutover |
| APP_ORIGIN | Request origin verification |
| CLERK_PUBLISHABLE_KEY | Legacy Clerk fallback; replace with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at cutover |
| CLERK_SECRET_KEY | Clerk server authentication; verify target production instance at cutover |
| MAPBOX_PUBLIC_TOKEN | Interactive maps |
| NYC_GEOCLIENT_KEY | City location enrichment |
| SOCRATA_APP_TOKEN | City-data requests |

Vercel-managed system variables are outside this cleanup. Analytics does not require a separate app API key.

## Removed variables

Removed 24 unused project variables from Production and Preview:

- SCHEDULER_ENABLED, COMMERCE_ENABLED, SIGNING_SECRET, JOBS_SECRET
- RESEND_API_KEY, EMAIL_FROM, RESEND_WEBHOOK_SECRET
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID, TWILIO_MESSAGING_SERVICE_SID, DAILY_VERIFY_CAP, MONTHLY_SMS_SEGMENT_CAP
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PLUS_PRICE, STRIPE_PLUS_YEAR_PRICE, STRIPE_DEALER_PRICE, STRIPE_AI_PRICE
- AI_API_KEY, AI_MODEL, AI_ENDPOINT
- TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY (hCaptcha is configured and takes priority in both deployed and pending releases)

The deployed static release does not serve the dormant payment/messaging/AI backend. This branch removes it entirely. Supabase's own SMTP and snapshot-function credentials were not changed. Removing variables does not cancel external subscriptions or alter existing deployment snapshots.

## Clerk cutover requirements

Before promoting the new auth release, configure verified production values for NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL and APP_ORIGIN. Follow CLERK_MIGRATION.md for imports, SQL migration, ownership linking and verification. Do not substitute development Clerk keys in production.

Automatic deployments from main remain gated in vercel.json during this migration. The currently working production deployment continues serving customers. Once cutover is verified, remove that gate and deploy using standard Next.js output.
