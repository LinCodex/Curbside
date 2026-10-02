# Vercel environment inventory

Project: yangs-projects-008730dc/curbside, connected to LinCodex/Curbside, production branch main. Vercel Web Analytics is retained. Variable names only:

| Variable | Use |
| --- | --- |
| APP_ORIGIN | https://curbside-eta.vercel.app; previews need their exact origin for search POSTs |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | Existing Supabase sign-in, private saved cars/preferences and history functions |
| HCAPTCHA_SITE_KEY, HCAPTCHA_SECRET_KEY | Active search and authentication protection |
| MAPBOX_PUBLIC_TOKEN | Interactive maps |
| NYC_GEOCLIENT_KEY | City location enrichment |
| SOCRATA_APP_TOKEN | City-data requests |
| SEARCH_VERIFICATION_SECRET | Server-only HMAC shared with the Supabase verification function |
| SEARCH_VERIFICATION_LEDGER_URL | Durable service-only search limits; production only |

Unused authentication-provider keys were removed. Previous cleanup also removed scheduler, commerce, old signing/jobs keys, Resend, Twilio, Stripe, AI and redundant Turnstile variables from Vercel. Resend notification credentials now live only in Supabase Edge secrets: RESEND_API_KEY, EMAIL_FROM, EMAIL_SENDER_VERIFIED, EMAIL_UNSUBSCRIBE_SECRET, EMAIL_NOTIFICATIONS_ENABLED and APP_ORIGIN. Supabase Auth's existing custom SMTP remains configured independently. Vercel-managed variables are outside this cleanup. Analytics needs no separate app key.

Removing variables does not cancel subscriptions or modify existing deployment snapshots. Keep the existing Supabase daily schedule and required functions. No application service-role key is needed in Vercel.
