# TicketSafe administration

The dashboard is `/admin13678`. Sign in with your existing TicketSafe Supabase account. The migration resolves the already verified `ylin20001@gmail.com` account once and pins master access to its UUID. It does not reset a password, migrate customers, or modify saved vehicles.

## Access and data

Every request checks the token against Supabase Auth, the active database session, and the current database role. The path is not an access control. Master can grant, edit and revoke admin/support access for existing verified accounts. Admin can manage customers and send mail; support can read the workspace and maintain notes, but cannot send mail or change access. Master access cannot be edited through the dashboard.

Customer search/filter/pagination, saved vehicles, notes/tags, recent signed-in presence, sending history, connection status and notification dry runs use real database state. Online means signed-in activity within three minutes; hidden pages stop heartbeat requests. Status distinguishes configured credentials from a tested connection. No guest presence or external presence service is used.

Product announcements require separate explicit opt-in in Account. Ticket subscriptions never imply promotional consent. Individual service messages must concern the selected customer's account. Preview, recipient eligibility and explicit confirmation precede sending. Debug mail can go only to the requesting administrator.

## Delivery safeguards

CRM uses existing Supabase Edge secrets and the verified Resend sender. It adds no Vercel service-role credential or subscription. CRM sends at most ten messages per invocation, 100 provider attempts per UTC day, and ten new campaigns per administrator in 24 hours. These are additional to the ticket-alert worker's separate limit. Provider acceptance is not proof of inbox delivery.

Send keys are retained before dispatch and reused after ambiguous responses. The database freezes recipients and deduplicates campaign keys; provider keys deduplicate individual deliveries. Changed email addresses, deleted accounts and revoked announcement consent suppress pending messages. Unknown outcomes stay in review rather than being automatically resent. Remaining messages require explicitly continuing the same campaign. Signed announcement unsubscribe links affect only announcement subscriptions; viewing the link does not unsubscribe until confirmation or one-click POST.

CRM tables enable RLS with no browser-role access. Privileged database logic is in an unexposed schema with service-only execution and an empty search path. Administrative audit/campaign records older than 90 days and budget rows older than 30 days are removed during later administrative activity; presence older than 24 hours is removed during later presence updates. Customer notes/preferences follow account deletion.

## Deployment and checks

Apply `supabase/migrations/20261003013822_crm_dashboard.sql` using the linked-project migration workflow. Run `node scripts/bundle-crm-function.mjs` to produce the Deno-ready bundle at `work/crm-admin/index.js`, using the same deployment workspace pattern as the other bundled functions. Deploy it as `crm-admin` with gateway JWT verification disabled: signed unsubscribe links are public, and the handler validates every regular action itself. Do not deploy a raw source entrypoint without its imports/bundle configuration.

`npm test` includes actual Postgres role/session/consent/delivery-limit tests and mocked Edge dispatch checks. Use notification dry runs first. A dashboard email test or campaign confirmation sends real email and consumes the existing Resend allowance.
