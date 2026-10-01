# Environment setup

The repository contains variable names and empty placeholders, not provider credentials. `.env.local` and `.dev.vars*` are excluded from Git. The Vercel functions read environment variables through `lib/runtime.ts`; the retained Cloudflare adapters also support runtime bindings.

For registration/login and saved cars on Vercel, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Vercel and configure Supabase email delivery and redirect URLs. No service-role key is required.

Public search protection uses `HCAPTCHA_SITE_KEY` and server-only `HCAPTCHA_SECRET_KEY`. hCaptcha takes priority over legacy Turnstile variables. The same hCaptcha secret must be configured separately in Supabase Auth Attack Protection. The `/api/config` response exposes only the site key. Vercel Analytics requires its project dashboard switch, not an API key in the application.

Shared saved histories and the morning schedule run inside Supabase using its runtime credentials and a Vault cron secret. No Vercel service-role key or `JOBS_SECRET` is needed for this new scheduler. See SUPABASE_SETUP.md for deployment and rollback details.

## Local development

From the project directory, create the local file only if it does not already exist:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Open `.env.local` in your editor. Fill only the services you are activating. Keep the defaults below for an initial local setup:

```dotenv
APP_ORIGIN=http://localhost:5173
COMMERCE_ENABLED=false
SCHEDULER_ENABLED=false
MAPBOX_PUBLIC_TOKEN=
```

Put your own public Mapbox token after `MAPBOX_PUBLIC_TOKEN=` to enable the interactive map. Without it, the app uses its bundled map fallback; public NYC searches do not need this token. There is no CarImages credential setting because that integration is not implemented.

Use the exact variable names from `.env.example`. Do not add `VITE_` or `NEXT_PUBLIC_` prefixes. Do not put private keys in React components, JSON configuration, URLs, or GitHub source files. If a value contains spaces or `#`, quote the value in the dotenv file.

Restart the development process after editing, then reload the browser:

```powershell
node scripts/run-framework.mjs dev
```

The Cloudflare Vite plugin loads local dotenv files. Avoid also creating `.dev.vars`: when that file exists, it takes precedence over dotenv loading. Local files do not configure production. See [Cloudflare local environment variables](https://developers.cloudflare.com/workers/local-development/environment-variables/).

## Which variables to configure

| Feature                 | Public values / ordinary configuration                                                                                           | Server-only secrets                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| App                     | `APP_ORIGIN`, `COMMERCE_ENABLED`, `SCHEDULER_ENABLED`                                                                            | `SIGNING_SECRET`, `JOBS_SECRET`                   |
| Maps                    | `MAPBOX_PUBLIC_TOKEN`                                                                                                            | None                                              |
| Clerk sign-in           | `CLERK_PUBLISHABLE_KEY`                                                                                                          | `CLERK_SECRET_KEY`                                |
| Email                   | `EMAIL_FROM`                                                                                                                     | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`         |
| SMS                     | `TWILIO_ACCOUNT_SID`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_MESSAGING_SERVICE_SID`, `DAILY_VERIFY_CAP`, `MONTHLY_SMS_SEGMENT_CAP` | `TWILIO_AUTH_TOKEN`                               |
| Billing                 | `STRIPE_PLUS_PRICE`, `STRIPE_PLUS_YEAR_PRICE`, `STRIPE_DEALER_PRICE`, `STRIPE_AI_PRICE`                                          | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`      |
| Bot protection          | `TURNSTILE_SITE_KEY`                                                                                                             | `TURNSTILE_SECRET_KEY`                            |
| City API access         | None required for basic public queries                                                                                           | Optional `SOCRATA_APP_TOKEN`, `NYC_GEOCLIENT_KEY` |
| Optional AI preparation | `AI_MODEL`, `AI_ENDPOINT`                                                                                                        | `AI_API_KEY`                                      |

Twilio SIDs and Stripe price IDs are identifiers, not authorization credentials; the app still keeps them on the server. Treat Socrata's app token as server-only even though it is not a user login credential.

`MAPBOX_PUBLIC_TOKEN`, `CLERK_PUBLISHABLE_KEY`, and `TURNSTILE_SITE_KEY` are intentionally exposed to the browser by `/api/config`. Moving a browser token into an environment variable keeps it out of source control, but does not hide it from website visitors. Create a dedicated Mapbox public token with only the required read scopes and restrict its allowed URLs to localhost and your actual website origins. Use separate development and production tokens. See [Mapbox token management](https://docs.mapbox.com/accounts/guides/tokens/).

Generate distinct values for `SIGNING_SECRET` and `JOBS_SECRET` locally. Run this command once for each secret and paste the output only into your local env file or the host's secret field:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the two values different. Rotating `SIGNING_SECRET` invalidates existing signed evidence and unsubscribe links.

## Production hosting: Vercel

The current release deploys from GitHub to Vercel using vercel.json and scripts/build-vercel.mjs. It serves static client assets and the standalone /api/config and /api/search functions. Keep Framework Preset set to Other; this build does not emit a Next routes-manifest.

Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and MAPBOX_PUBLIC_TOKEN for the environments you use, then redeploy. SOCRATA_APP_TOKEN and NYC_GEOCLIENT_KEY are optional city API credentials. TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are an optional matching pair for public search protection.

Supabase authentication email is sent using the SMTP credentials configured in Supabase itself. RESEND_API_KEY and EMAIL_FROM in Vercel do not configure those auth emails.

The remaining table entries above belong to retained Cloudflare monitoring, SMS, billing, dealer, AI and partner adapters. Current Vercel deployment does not expose those routes, has no D1/R2 bindings and does not run their scheduler. Do not enable SCHEDULER_ENABLED or COMMERCE_ENABLED to imply that those services are available on Vercel. They require a separately designed backend deployment.

Sensitive Vercel values cannot be read back after saving. Before removing unused provider configuration, retain recoverable credentials in your secret manager; an unreadable value is not evidence that it is blank. Never replace working production configuration with empty placeholders.

## Removing or replacing credentials

Clearing a local env value stops this app from using it after the server and page refresh. It does not revoke the token at its provider, remove copies from chat, or clear credentials configured in a separate hosted environment. Revoke/rotate any private key that was shared outside your secret storage in the issuing provider's dashboard. Update the runtime secret wherever that service runs.

Commit `.env.example` with blank credentials, never the filled `.env.local`. You can check the ignore rule without displaying values:

```powershell
git check-ignore .env.local
```
