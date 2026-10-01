# Environment setup

The repository contains variable names and empty placeholders, not provider credentials. `.env.local` and `.dev.vars*` are excluded from Git. The Vercel functions read environment variables through `lib/runtime.ts`; the retained Cloudflare adapters also support runtime bindings.

For registration/login and saved cars on Vercel, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in Vercel and configure Supabase email delivery and redirect URLs. No service-role key is required.

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

## Production hosting

This project uses Cloudflare Workers, D1, and private R2 bindings. A GitHub push alone neither deploys the application nor supplies its environment.

1. In the production host, configure the same names from `.env.example` as **runtime** variables. On a directly managed Cloudflare Worker, use **Workers & Pages → your Worker → Settings → Variables and Secrets**. In Sites-managed hosting, use that site's environment/secret settings.
2. Store server-only values as encrypted **secrets**. Set ordinary configuration as text variables. Build-system variables or GitHub repository secrets alone do not automatically become Worker runtime bindings.
3. Set `APP_ORIGIN` to the actual HTTPS origin, for example `https://your-domain.example`, without a trailing slash. Replace this example with your real domain.
4. Configure D1 as binding `DB` and private R2 as `BUCKET`. These are resource bindings, not API keys to paste into dotenv files. Apply the migrations before enabling account features.
5. Deploy or redeploy the app after configuring the environment. Keep checkout and monitoring disabled until the relevant provider setup is complete.
6. When activating the scheduler, configure its own Worker with the same `JOBS_SECRET` and the production `APP_ORIGIN`; those values are not inherited from the web app.

Do not deploy the current placeholder database IDs or scheduler origin as production settings. The Sites hosting project still needs to be made available before a live Sites deployment can complete. See [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) and [SETUP.md](SETUP.md) for provider onboarding, webhook endpoints, billing prices, and scheduler steps.

## Removing or replacing credentials

Clearing a local env value stops this app from using it after the server and page refresh. It does not revoke the token at its provider, remove copies from chat, or clear credentials configured in a separate hosted environment. Revoke/rotate any private key that was shared outside your secret storage in the issuing provider's dashboard. Update the runtime secret wherever that service runs.

Commit `.env.example` with blank credentials, never the filled `.env.local`. You can check the ignore rule without displaying values:

```powershell
git check-ignore .env.local
```
