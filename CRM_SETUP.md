# TicketSafe administration

The dashboard is `/web-portal`. Sign in with your existing TicketSafe Supabase account. The migration resolves the already verified `ylin20001@gmail.com` account once and pins master access to its UUID. It does not reset a password, migrate customers, or modify saved vehicles.

## Access and data

Every request checks the token against Supabase Auth, the active database session, and the current database role. The path is not an access control. Master can grant, edit and revoke admin/support access for existing verified accounts. Admin can manage customers and send mail; support can read the workspace and maintain notes, but cannot send mail or change access. Master access cannot be edited through the dashboard.

Customer search/filter/pagination, saved vehicles, notes/tags, recent signed-in presence, sending history, connection status and notification dry runs use real database state. Online means signed-in activity within three minutes; hidden pages stop heartbeat requests. Status distinguishes configured credentials from a tested connection. No guest presence or external presence service is used.

Product announcements require separate explicit opt-in in Account. Ticket subscriptions never imply promotional consent. Individual service messages must concern the selected customer's account. Preview, recipient eligibility and explicit confirmation precede sending. Debug includes a connection test to the requesting administrator. From a customer record, an admin can send that customer's selected saved car's most recent ticket using the real new-ticket email. That send never updates notification baselines.

## Delivery safeguards

CRM uses existing Supabase Edge secrets and the verified Resend sender. It adds no Vercel service-role credential or subscription. CRM sends at most ten messages per invocation, 100 provider attempts per UTC day, and ten new campaigns per administrator in 24 hours. These are additional to the ticket-alert worker's separate limit. Provider acceptance is not proof of inbox delivery.

Send keys are retained before dispatch and reused after ambiguous responses. The database freezes recipients and deduplicates campaign keys; provider keys deduplicate individual deliveries. Changed email addresses, deleted accounts and revoked announcement consent suppress pending messages. Unknown outcomes stay in review rather than being automatically resent. Remaining messages require explicitly continuing the same campaign. Signed announcement unsubscribe links affect only announcement subscriptions; viewing the link does not unsubscribe until confirmation or one-click POST.

CRM tables enable RLS with no browser-role access. Privileged database logic is in an unexposed schema with service-only execution and an empty search path. Administrative audit/campaign records older than 90 days and budget rows older than 30 days are removed during later administrative activity; presence older than 24 hours is removed during later presence updates. Customer notes/preferences follow account deletion.

## Deployment and checks

Apply `supabase/migrations/20261003013822_crm_dashboard.sql` using the linked-project migration workflow. Run `node scripts/bundle-crm-function.mjs` to produce the Deno-ready bundle at `work/crm-admin/index.js`, using the same deployment workspace pattern as the other bundled functions. Deploy it as `crm-admin` with gateway JWT verification disabled: signed unsubscribe links are public, and the handler validates every regular action itself. Do not deploy a raw source entrypoint without its imports/bundle configuration.

`npm test` includes actual Postgres role/session/consent/delivery-limit tests and mocked Edge dispatch checks. Use notification dry runs first. A dashboard email test or campaign confirmation sends real email and consumes the existing Resend allowance.

## Support and account tools

Apply `20261003162622_crm_support_account_actions.sql` after the base CRM migration and redeploy the bundled function. Verified users submit support, feedback, and bug reports from Account; messages go only to this database inbox, never email. Customers cannot read the inbox or other users' messages. Admin/support can read and permanently delete messages. Submissions are capped at five per day with a 60-second cooldown; the inbox caps at 10,000 messages. Records older than 90 days are cleaned on submissions or inbox activity.

Only master/admin can run customer account actions. Email and password changes are applied immediately, then the customer is emailed what changed. The notice never includes a new password. Email changes notify both the previous and new address. Delete emails the current address before the account is removed. Administrator accounts must use their own settings. Delete still requires typing the customer's email in the UI. Apply `20261003180000_force_account_actions.sql` after the support migration so ticket tests are limited to one saved car and password changes can be recorded.

Administrative actions use a durable idempotency ledger, 20 actions per admin/day, and the existing shared CRM 100-email daily cap. Ambiguous responses are marked for review and are never automatically replayed. The sender accepting a message is distinct from delivery. CRM links/cookies are absent; all dropdowns are custom. `/admin13678` is removed; `/web-portal` is the supported Vercel route. `CRM_ALLOWED_ORIGINS` optionally extends allowed origins for a named local development origin; production does not need a new variable.
