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

Unused authentication-provider keys were removed. Previous cleanup also removed scheduler, commerce, signing, jobs, Resend, Twilio, Stripe, AI and redundant Turnstile variables. Supabase's own Auth email settings and Edge-function credentials remain unchanged. Vercel-managed variables are outside this cleanup. Analytics needs no separate app key.

Removing variables does not cancel subscriptions or modify existing deployment snapshots. Keep the existing Supabase daily schedule and required functions. No application service-role key is needed in Vercel.
