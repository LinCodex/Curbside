# Activate Curbside

Real-data manual search works without provider purchases. Activate in this order. Keep private keys out of chat, Git and browser code. Hosted values belong in Sites environment/secret settings; redeploy after changes. Local .env.local affects only your machine.

## 1. Operator and deployment

The policy pages identify Flushing NY Wireless, 136-78 Roosevelt Ave, Flushing, NY, ezrefillyny@gmail.com. Confirm the contracting business/assumed name and full mailing address including ZIP before public commerce. See LEGAL-LAUNCH.md. The code does not register a business or certify legal compliance.

Keep the first release private. Before an authorized public launch choose a domain and set APP_ORIGIN to its exact HTTPS origin, without a trailing slash. It is used in authenticated origin checks and webhook signatures. A private Sites access gate can block provider callbacks and the scheduler. Confirm a reachable, explicitly authorized production origin before enabling them.

Generate distinct 32-byte random SIGNING_SECRET and JOBS_SECRET values. The former signs evidence and unsubscribe links; the latter authenticates scheduled runs. Rotating the signing secret invalidates existing links. D1 and private R2 are provisioned as DB and BUCKET through Sites. Never expose the evidence bucket publicly.

## 2. Clerk accounts

Create a Clerk application, require verified primary email, and configure the app origin, redirects, production DNS and abuse protections. Add CLERK_PUBLISHABLE_KEY and secret CLERK_SECRET_KEY. Add the site's /legal/terms and /legal/privacy links to authentication branding. The app also records its own unchecked/versioned acceptance before saving vehicles or purchasing.

Test with real accounts you control. Verify account B cannot read account A's vehicles, cases or evidence URLs. Roles come from D1, not client metadata. Clerk registration protections are configured in Clerk; the app's search Turnstile does not protect Clerk endpoints. Application-data deletion does not itself erase Clerk identity; support must coordinate that deletion.

## 3. Resend email

Create a Resend account, verify a sending domain and its DNS, and set RESEND_API_KEY. Set EMAIL_FROM to a verified sender on that owned domain. Do not invent or use an unverified sender. Add /api/webhooks/resend for email.delivered, email.bounced and email.complained, and store RESEND_WEBHOOK_SECRET.

Verify initial/new-ticket emails, unsubscribe, bounce suppression and ambiguous timeouts using your own address and actual city records. The footer identifies the operator and support contact. These are service messages, not marketing. Set usage alerts. [Resend webhooks](https://resend.com/docs/webhooks/introduction).

## 4. Twilio SMS

Create Verify and Messaging Services and a sending number. Complete applicable US registration, including A2P 10DLC where required. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID and TWILIO_MESSAGING_SERVICE_SID. Set inbound POST webhook to /api/webhooks/twilio; coordinate Advanced Opt-Out with app STOP/HELP handling. Outbound status callbacks are attached by the app.

Test separate unchecked consent, verification, STOP, HELP, account opt-out and re-enrollment using a number you control. Configure Verify Fraud Guard, geographic permissions and provider spending controls. App defaults: 100 verification starts/day globally, number/IP cooldowns, 10 alert segments/customer/month and 1,000 outbound alert segments/service/month. Number, carrier, registration, inbound and Verify charges are additional. Counters are not a guarantee of the bill. [Twilio registration](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).

## 5. Maps, city data and abuse protection

- Mapbox: create an origin-restricted browser token, set MAPBOX_PUBLIC_TOKEN, and enable usage alerts. Mapbox runs on the Map view and supplies ticket-location previews; other screens use a locally bundled background.
- Geoclient: obtain access through the NYC API portal and set NYC_GEOCLIENT_KEY. Missing coordinates remain missing. A public NYC Planning address resolver is a fallback.
- Socrata: optionally set SOCRATA_APP_TOKEN. Review fiscal-year dataset IDs in lib/nyc.ts each year.
- Turnstile: register the exact app hostname and set TURNSTILE_SITE_KEY plus TURNSTILE_SECRET_KEY. Without them, IP limits still apply, but no challenge is active. Test expired/failed challenges and accessible operation before public launch.

## 6. Stripe billing — initially disabled

Create USD prices matching the offer:

| Variable               | Amount | Interval                        |
| ---------------------- | ------ | ------------------------------- |
| STRIPE_PLUS_PRICE      | $4.99  | Monthly recurring               |
| STRIPE_PLUS_YEAR_PRICE | $39    | Annual recurring                |
| STRIPE_DEALER_PRICE    | $149   | Monthly; 100-customer pilot cap |
| STRIPE_AI_PRICE        | $9     | One time per case               |

Set STRIPE_SECRET_KEY. Register /api/webhooks/stripe and STRIPE_WEBHOOK_SECRET for checkout.session.completed and customer.subscription.created/updated/deleted. Enable the customer portal with simple online cancellation at period end and receipts/confirmations that preserve the renewal terms. Have tax treatment reviewed; this implementation does not determine registrations or automatically configure tax collection.

Configure annual renewal notices 30 days before the cancellation deadline; verify amount, interval, delivery and cancellation link. Use available Stripe notifications only if they meet that timing. Otherwise implement a billing-notice job before enabling annual checkout. A default seven-day notice does not meet New York's annual 15-45 day window. [Stripe recurring-notification guidance](https://support.stripe.com/questions/guidance-for-mastercard-recurring-billing-compliance-updates).

In Stripe test mode, verify duplicate/out-of-order webhooks, failed payments, portal cancellation, receipts and refunds. Do not portray test-mode payments as real purchases. Application purchase consent is separate from general terms and records the offer/version. Support must accept cancellation requests if account access fails. Account-data deletion verifies future renewal is stopped first.

Keep COMMERCE_ENABLED=false until these checks and legal review are complete. Then update prelaunch billing text and policy versions if needed before enabling. Never change displayed amounts while reusing incompatible Stripe price IDs. Dealer overages and additional SMS purchases are not implemented; hard limits prevent automatic charges.

## 7. Schedule real checks

POST /api/jobs requires Bearer JOBS_SECRET. It sends due jobs, scans up to 25 due vehicles, then sends another batch. Vehicles become due daily and shared source caches avoid repeated fetches. Only complete successful scans advance baselines.

worker/scheduler.ts runs every five minutes. Replace APP_ORIGIN in worker/wrangler.jsonc, store its matching JOBS_SECRET using Wrangler secret storage, deploy, and set the application's SCHEDULER_ENABLED=true only after reachability and provider setup are verified. Never deploy the placeholder origin.

```powershell
node node_modules/wrangler/bin/wrangler.js secret put JOBS_SECRET --config worker/wrangler.jsonc
node node_modules/wrangler/bin/wrangler.js deploy --config worker/wrangler.jsonc
```

This is the product's operational scheduler, not a personal Codex reminder. Inspect health timestamps and jobs. Measure the 15-minute detection-to-delivery target outside quiet hours under a concentrated workload before promising it. The 500-vehicle unit simulation does not test real provider latency/capacity.

Ambiguous sends and expired send leases become uncertain. Reconcile in the provider dashboard using stored IDs/idempotency keys before marking sent or explicitly retrying. Do not bulk-reset uncertain jobs. Monitor backlog age, failed/uncertain counts, last daily scan, bounces, usage and webhook errors. When the scheduler is off, manually purge expired cache entries according to the privacy notice.

## 8. AI and partners

Optionally set AI_API_KEY, a supported AI_MODEL and AI_ENDPOINT for a compatible provider. Configure provider-side spending limits and disclose the selected provider/retention policy before enabling purchases. Only ticket fields, confirmed facts and filenames are sent; uploaded files are not analyzed. Each case permits three generation attempts and 1,600 output tokens. Uncertain attempts may still incur charges. Tokens are recorded, but exact dollar cost depends on model pricing.

No partner is seeded. Verify eligibility, NYC registration/authorization requirements, fees, deadlines, escalation and official receipt procedures before activation. A trusted admin assigns the existing Clerk user role partner and creates a partners row whose id is that same Clerk user ID. Do not expose this privilege in public UI. Test assigned-case isolation, rejection, changed approvals and missing/invalid receipts. A checkbox does not replace any required notarized or prescribed authorization.

## 9. Operations

Maintain backups/restores, a written incident-response plan, provider contracts, a monitored privacy/support mailbox, retained policy versions, cancellation/refund processes and an accountable release log. Complete provider end-to-end testing, cross-account checks and private evidence access checks before public launch. These operating duties are not satisfied by website text alone.
## Mobile app and map verification

The manifest includes 192/512px PNG icons and an Apple touch icon. iPhone/iPad browsers receive a one-time installation guide; its presentation flag is the only app preference stored in localStorage. Reopen it from Account. The guide is suppressed in standalone mode. Pull down deliberately from the top of a mobile page to refresh its current query/account data. Maps, controls and scrollable sheets keep their own gestures. Offline navigation shows a clearly labeled static offline page; no ticket or account pages are cached. Validate installation and the gesture on a physical iPhone before launch.

Garage, Search and Account use original Curbside cartography rendered from bundled NYC DCP geometry as a 78 KB WebP image. No Mapbox branding, tiles, or WebGL are used for those backgrounds. The Map view mounts Mapbox dark-v11 with required attribution; leaving Map releases its WebGL context. Its instance survives ticket/modal/form changes while Map remains open. Detail maps use static images rather than a second WebGL context. Address lookup runs only when opening Map or a ticket, in bounded batches, using temporary page-memory results; these are not stored in D1 or localStorage. Restrict the public token to production and preview origins and set budget alerts. A rejected token is an authentication problem, not an empty location result.

CarImages was reviewed: its documented catalog takes make/model/year, not a license plate, and does not document a paint-color parameter. NYC ticket records currently provide make/year/body/color but no verified model. Consequently no vehicle model, guessed stock car, or empty model space is rendered. Activation requires a reliable plate-to-model source and provider support for the verified color; the supplied browser key alone does not supply either. Do not use the provider's make-only fallback or closest-model guess as vehicle identification. No CarImages requests are currently issued.

Dispute preparation is currently hidden from ticket details. Plate financial summaries use deduplicated returned records and show the count with reported amounts. Assessed history means fines plus penalties and interest, minus reductions, before payments. It is not lifetime plate history or an assertion of present ownership.
