# Supabase accounts on Vercel

This release uses confirmed Supabase email/password accounts for private saved cars and profile settings. Saving a car creates a shared snapshot of public NYC history, refreshed every morning. Email/SMS reminders are not enabled by saving a car. Public searches and maps work without an account. Multiple customers can save the same plate; their nicknames and vehicle descriptions remain private.

## Environment variables

In Vercel → your Curbside project → Settings → Environment Variables, add:

```dotenv
SUPABASE_URL=https://wkuvihaiacfcqctwolqu.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your enabled sb_publishable_ key>
```

Copy the **publishable** key from Supabase → Project Settings → API Keys. It is intentionally public: database access is protected by row-level security and the customer's session. Do not use a secret or service-role key. Add the values for Production and the preview/development environments you intend to support, then redeploy. GitHub deployment does not copy `.env.local` into Vercel.

Local development is configured through ignored `.env.local`. Restart `npm run dev` after changing it. Neither filled environment files nor keys should be committed.

## Authentication configuration

In [Supabase URL configuration](https://supabase.com/dashboard/project/wkuvihaiacfcqctwolqu/auth/url-configuration):

1. Set **Site URL** to your stable production website URL.
2. Allow the exact production root URL and `/?auth=recovery` URL as redirects.
3. For local development, also allow `http://localhost:5173/`, `http://localhost:5173/?auth=recovery`, and the equivalent `5174` URLs if using the production preview.
4. Keep email/password signup and email confirmation enabled. Disable anonymous signup unless another deliberately designed feature needs it.

Signup confirmation opens the app, and password recovery opens a dedicated password form. Saving a car requires a verified email and an explicit acceptance of the displayed current terms. Passwords are handled by Supabase, not stored in vehicle records.

## Email delivery is required for public signup

Configure [custom SMTP](https://supabase.com/dashboard/project/wkuvihaiacfcqctwolqu/auth/smtp) with a provider such as Resend and a verified sender/domain. Supabase's default sender is for limited testing, restricts recipients to authorized team addresses, and does not support a public registration launch. Do not disable confirmation to work around email delivery.

For Resend SMTP, use `smtp.resend.com`, port `465`, username `resend`, and your Resend API key as the SMTP password, with your verified sender. Enter these directly in the Supabase dashboard; they are not Curbside frontend environment variables. See the [official Supabase SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and [Resend SMTP documentation](https://resend.com/docs/send-with-smtp).

Supabase enforces authentication rate limits. Enable its CAPTCHA protection before a public launch if needed, with the matching CAPTCHA widget wired into these forms; do not enable CAPTCHA server-side without the client integration.

## Database

The project uses RLS for `curbside_vehicles`, `curbside_terms_acceptances`, `curbside_preferences`, and `curbside_vehicle_snapshots`. Customers see only their own car details, acceptances, settings, and saved histories. Editable vehicle fields are nickname, make, model, year, and color. Ownership and source history cannot be edited by customers. Duplicate plate/state/type combinations are rejected per customer, never across customers.

Schema definitions are in `supabase/migrations/`. The initial schema was installed through the project SQL editor; establish that migration as the baseline before using CLI `db push` on this existing project. Do not rerun its `CREATE TABLE` statements on the already configured project. For a fresh project, apply the initial migration; the hardening migration's event-trigger revocation applies only where that Supabase helper exists.

`supabase/tests/saved-cars.sql` verifies consent gating, owner isolation, rename, duplicates, anonymous denial, immutable ownership, and protected consent timestamps. It rolls back its temporary database fixtures; it does not seed the app or send messages.

## Final activation check

Use a real email you control to register, confirm the email, sign in, search your plate, and save it. Reload and confirm it remains in Garage. Rename/remove it and check from a second account that the first account's cars are inaccessible. Also test a password-reset email. These email flows need the configured SMTP provider and redirects; database isolation checks alone do not verify email delivery.

Account → Account data removes saved cars. Login-account deletion and associated consent deletion are coordinated through the displayed support contact. Consent records cannot be altered through the customer API.

## Confirmed accounts and profile settings

Keep Confirm email enabled. A pending Auth record is required to issue a verification link, but the application and RLS deny private account access until email_confirmed_at exists. Resend confirmation is available after a 60-second cooldown; SMTP also enforces a 60-second per-user interval. All email prompts include an inbox/spam reminder. Old links retain the redirect they were issued with: request a fresh link after correcting Site URL.

The account_preferences migration adds owner-only curbside_preferences for theme, language and detail level. Preview changes are temporary; Apply writes to the verified profile, Cancel restores saved settings. Guest settings remain device-local. supabase/tests/saved-cars.sql verifies profile isolation and unconfirmed-account denial as well as saved cars, and rolls back all fixtures.

## Shared histories and the morning worker

`vehicle-snapshots` is deployed as a Supabase Edge Function. `verify_jwt=false` is intentional: customer refreshes explicitly call `auth.getUser` and check confirmed email plus vehicle ownership; cron uses a dedicated Vault credential. The public lookup mode returns public city data only, never customer details, subscription lists, or lease tokens. Service credentials are supplied by the Supabase runtime and must never be copied into Vercel frontend variables.

The `curbside-saved-history-morning` pg_cron job runs each minute from 13:00–15:59 UTC, invoking only when work is due. That starts at 8 a.m. EST / 9 a.m. EDT. Each invocation claims at most three identities with expiring leases. Successful histories schedule the following morning; failures retain old history and retry after 30 minutes. Initial saves invoke the same worker immediately. Full history through FY2014 is initially loaded and normally refreshed weekly; open records and recent fiscal years are checked daily. City publication can lag, and a disappearance never proves payment.

The pilot accepts 500 distinct saved plate/state/type identities, with any number of subscribers sharing an existing identity. Last-subscriber removal deletes its snapshot. `supabase/tests/snapshot-queue.sql` verifies multiple subscribers, private descriptions, atomic claims, stale workers, retries, cleanup, and the 500-identity workload in a rolled-back transaction.

To redeploy, run `node scripts/bundle-snapshot-function.mjs`, then deploy `work/vehicle-snapshots/index.js` as the function entrypoint with the same custom-auth setting. Review migrations before applying to another project: the cron URL is specific to this project. GitHub/Vercel deployment updates the frontend and search adapters; it does not redeploy Supabase functions automatically.

## hCaptcha and analytics

Vercel uses `HCAPTCHA_SITE_KEY` (public) and `HCAPTCHA_SECRET_KEY` (server-only). In Supabase → Authentication → Attack Protection, choose hCaptcha, enter the same secret, enable CAPTCHA, and save after the client integration is deployed. Signup, sign-in, password-reset requests and confirmation resends pass `captchaToken`. Password recovery completion uses its authenticated recovery session. Add deployment hostnames to the site's hCaptcha configuration if domain restrictions are enabled. Never commit the secret or expose it through `/api/config`.

Enable Web Analytics on the Curbside Vercel project. The layout loads `@vercel/analytics/next`; its `beforeSend` filter excludes private routes/auth callbacks and strips all URL parameters except allowlisted navigation views. GPC/DNT suppress measurement. Vercel analytics paths are excluded from the SPA rewrite.

The first-visit welcome uses the essential `curbside_onboarding` cookie, renewed for a year on visits. It contains only a completion flag. Guests can choose display defaults or skip; verified profiles have their own saved preferences. Signup metadata holds sanitized display defaults only, never authorization claims.
