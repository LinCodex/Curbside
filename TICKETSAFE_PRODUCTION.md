# TicketSafe production setup

Updated October 1, 2026. Canonical website: https://ticketsafe.ezrefillny.net. Keep https://curbside-eta.vercel.app as a redirect after the verified cutover.

## Completed

- Clerk production instance created: ins_3K78LAu2hAMyijEtT9kLHaQTc8C, application TicketSafe.
- Vercel project curbside has ticketsafe.ezrefillny.net added.
- Clerk requires verified email and its built-in Terms/Privacy checkbox. Production legal links use the canonical domain.
- Password minimum is 15 characters; breached-password checks, password reverification and device trust are enabled. Phone/SMS and Clerk customer-subscription billing remain disabled.
- Website and policies use TicketSafe / 罚单卫士. Messaging/billing policy pages and irrelevant feature descriptions are removed.
- The code includes a host-specific 308 redirect that preserves paths and query parameters. It does not affect localhost, previews or the new domain.
- The deployment gate keeps the currently working production release live. Publishing code does not activate the redirect or authentication cutover.

## DNS deferred at your request

DNS is managed in Netlify; records were not added because you do not currently have access. Add these records to the ezrefillny.net DNS zone when access is available. Host names below are relative to that zone. Keep unrelated website, email and DNS records.

| Type | Host | Value |
| --- | --- | --- |
| A | ticketsafe | 76.76.21.21 |
| CNAME | clerk.ticketsafe | frontend-api.clerk.services |
| CNAME | accounts.ticketsafe | accounts.clerk.services |
| CNAME | clkmail.ticketsafe | mail.aukwslaatg10.clerk.services |
| CNAME | clk._domainkey.ticketsafe | dkim1.aukwslaatg10.clerk.services |
| CNAME | clk2._domainkey.ticketsafe | dkim2.aukwslaatg10.clerk.services |

The A record is the current Vercel-recommended value verified for this project. Recheck Vercel’s domain instructions when adding records. Clerk records should use DNS-only mode where a provider offers proxying. Verify DNS, SSL and email with clerk deploy status; the current state is domain_pending.

[Clerk production domain settings](https://dashboard.clerk.com/apps/app_3K6yDRE97n4v0sWHxXzDuQjYXCV/instances/ins_3K78LAu2hAMyijEtT9kLHaQTc8C/domains)

## Google and Apple

You selected email, Google and Apple. Production Google/Apple credentials remain pending; development uses Clerk’s shared credentials. Configure them in Clerk’s production SSO connections, using its displayed callback URLs. Do not paste client secrets or Apple private keys into chat or GitHub.

- Google needs your OAuth client ID/secret and published consent configuration. Add https://ticketsafe.ezrefillny.net as the website origin and the exact redirect URI displayed by Clerk. [Clerk Google setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- Apple needs your Services ID, Team ID, Key ID and Sign in with Apple private key. Configure the verified domain and return URL shown by Clerk; enable its private-email relay configuration if required for existing Apple users. [Clerk Apple setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/apple)

## Customer migration and launch

The Supabase connector currently returns no accessible projects. No live customer import, SQL cutover or ownership migration was performed. Preserve the existing database and account records. Follow CLERK_MIGRATION.md to back up/export users, import original password/consent data, apply the tested migration and verify saved-car ownership.

Before launch, configure the Supabase server credential and signed Clerk user.deleted webhook at https://ticketsafe.ezrefillny.net/api/webhooks/clerk. Verify webhook retry and account deletion without deleting a real customer. Google/Apple sign-in, email delivery and customer sign-in must be tested with the real production setup.

Once DNS, authentication, webhook and migrated accounts pass, remove the automatic-main-deployment gate and deploy the new Next.js release. Verify canonical pages and the old-address redirect before reopening registration. The old address currently still serves the working prior release.
