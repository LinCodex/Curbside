# TicketSafe account emails

The 13 Supabase Auth subjects and bodies were installed in project `wkuvihaiacfcqctwolqu` on October 2, 2026. The sender display name is **TicketSafe**; the existing account-email address remains `noreply@ezrefillny.net`.

Run `node supabase/email-templates/generate.mjs` to regenerate the standalone English and Chinese HTML, subjects, copy/paste reference, and `auth-config.json`. The configuration contains only email presentation fields and the sender display name. Apply it with the Supabase Management API's `PATCH /v1/projects/{ref}/config/auth`, using an administrator credential outside the repository. Read back the configuration after applying it.

Live templates select Chinese when `user_metadata.curbside_preferences.language` is `zh`, and otherwise use English. This preserves the metadata key used by existing accounts. Language metadata affects presentation only.

Signup, email-change, invitation, and password-reset emails retain Supabase's `ConfirmationURL`. The existing sign-in-code and reauthentication templates retain `Token`. Security messages link to the configured `SiteURL`. Password recovery contains only its own document; the previous live template incorrectly included a second reauthentication document and Markdown.

The layout uses inline styles, presentation tables, system fonts, a hidden preview line, readable account details, and large action buttons. It requires no remote images, fonts, or tracking services. English and Chinese HTML were checked at 390px and 900px, covering all 52 combinations without horizontal overflow. These browser previews do not replace testing in individual email clients.

Deployment readback verified all 27 intended fields and confirmed 214 other Auth configuration fields were unchanged, including confirmation requirements, CAPTCHA, SMTP configuration, redirect URLs, and notification switches. No customer emails were sent for this update. The website deployment remains a separate paused task.
