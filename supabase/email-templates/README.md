# Curbside authentication emails

Standalone, ready-to-paste HTML matching the website's dark surfaces, blue accent, lowercase wordmark, and compact cards. `en/` contains English; `zh/` contains natural Simplified Chinese. There are 10 requested email types plus a separate OTP alternative for the Magic Link slot. Recommended subjects and exact dashboard slots are in `subjects.json`.

Chinese emails use “泊查.” to match the Chinese website wordmark, with “泊查（Curbside）” in the footer. `COPY-PASTE.md` contains every complete English HTML template in a separate copyable code block.

## Install

1. Open Supabase → Authentication → Email Templates for project `wkuvihaiacfcqctwolqu`.
2. Choose the matching template. Copy the **entire HTML source** from the appropriate file into its body editor; set the subject from `subjects.json`.
3. Choose either `magic-link.html` **or** `email-otp.html` for the Magic Link or OTP slot. Do not paste both.
4. Enable each security notification individually for password/email/phone changes and sign-in methods linked/removed. Saving HTML alone does not enable sending.
5. Set the correct production Site URL and allowed redirects. Keep email confirmation enabled, configure custom SMTP, and disable the email provider's click/link tracking for these auth emails.
6. Preview, then send real test messages to an email you control. Check desktop and phone email clients before release.

These files have not been applied to your hosted Supabase project or sent to customers. They require no API keys or remote images. Authentication links use `{{ .ConfirmationURL }}`, and app links use `{{ .SiteURL }}`. Never replace them with a real customer's link or token.

## Behavior and limits

- Signup confirmation and password recovery work with the current app's existing link-based flows.
- Magic-link login, an OTP entry screen, reauthentication, phone changes, email changes, and provider linking/removal are not implemented by an email template. The current app supports email/password sign-in and saved cars. Use the OTP alternative only after wiring request and verification into your app.
- The change-email request template describes confirmation of a step because secure email change may require approval from both addresses. The completed-change notice correctly uses `.OldEmail` and `.Email`; `.NewEmail` belongs only to the request template.
- No invented IP address, device, event time, or expiry duration is displayed. Expiry follows project configuration.
- English/Chinese files are separate alternatives. Supabase does not automatically infer the website's local browser language preference. For automatic per-customer selection, add a locale preference and language-aware email sending separately; do not assume these files switch languages automatically.
- The emails intentionally contain no animations, scripts, tracking pixels, externally loaded font, or plate details. Email clients strip scripts and often reject animation/web fonts. Manrope is preferred if available, with system and Chinese font fallbacks; rounded corners degrade gracefully in older Outlook. Some clients override colors in dark mode.
- Security messages have no marketing or unsubscribe link because they are account notices. They do not enroll anyone in SMS or marketing. Support contact and operator details match the current website.

## Source and regeneration

Edit the copy/layout in `generate.mjs`, then run `node supabase/email-templates/generate.mjs`. Generated HTML is independent: no build tooling is needed to paste it into Supabase. `subjects.json` contains only metadata, never credentials.

Variable availability and settings verified against [Supabase Email Templates documentation](https://supabase.com/docs/guides/auth/auth-email-templates). Browser previews verify HTML layout, not real Gmail/Outlook/iOS Mail delivery or link consumption by security scanners.
