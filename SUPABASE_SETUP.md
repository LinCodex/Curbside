# Supabase accounts on Vercel

This release uses Supabase email/password accounts for saving, renaming, and removing cars. Saving a car does not start monitoring, send alerts, or persist ticket searches. Existing public searches and maps work without an account. The Supabase SDK is loaded separately when account configuration is available.

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

The `wkuvihaiacfcqctwolqu` project has `curbside_vehicles` and `curbside_terms_acceptances` with RLS enabled. Customers can read only their own cars/acceptances, insert their own cars after accepting terms, rename their own cars, and remove their own cars. Customer API grants prevent changing ownership or forging database timestamps. Duplicate plate/state/type combinations are rejected per customer.

Schema definitions are in `supabase/migrations/`. The initial schema was installed through the project SQL editor; establish that migration as the baseline before using CLI `db push` on this existing project. Do not rerun its `CREATE TABLE` statements on the already configured project. For a fresh project, apply the initial migration; the hardening migration's event-trigger revocation applies only where that Supabase helper exists.

`supabase/tests/saved-cars.sql` verifies consent gating, owner isolation, rename, duplicates, anonymous denial, immutable ownership, and protected consent timestamps. It rolls back its temporary database fixtures; it does not seed the app or send messages.

## Final activation check

Use a real email you control to register, confirm the email, sign in, search your plate, and save it. Reload and confirm it remains in Garage. Rename/remove it and check from a second account that the first account's cars are inaccessible. Also test a password-reset email. These email flows need the configured SMTP provider and redirects; database isolation checks alone do not verify email delivery.

Account → Account data removes saved cars. Login-account deletion and associated consent deletion are coordinated through the displayed support contact. Consent records cannot be altered through the customer API.
