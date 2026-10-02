import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const esc = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// Original copy; Supabase variables are kept intact for dashboard use.
const templates = [
  { id: 'confirm-signup', slot: 'Confirm signup', vars: ['Email', 'ConfirmationURL', 'SiteURL'], action: 'ConfirmationURL',
    en: ['Confirm your email · TicketSafe', 'One step to your garage.', 'Confirm your email', 'Verify your email address to finish creating your TicketSafe account. Then you can save your cars and return to them whenever you need.', 'Confirm email', 'If you didn’t create this account, you can ignore this email. Your email will not be verified by ignoring it.'],
    zh: ['验证您的邮箱 · TicketSafe', '验证邮箱，即可开启您的车库。', '验证您的邮箱', '请验证邮箱，完成TicketSafe账户注册。之后您可以保存车辆，随时回来查看。', '验证邮箱', '如果您没有注册这个账户，可以忽略此邮件。忽略邮件不会完成邮箱验证。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}']] },
  { id: 'change-email-address', slot: 'Change email address', vars: ['Email', 'NewEmail', 'ConfirmationURL', 'SiteURL'], action: 'ConfirmationURL',
    en: ['Confirm your email change · TicketSafe', 'Confirm the email change you requested.', 'Confirm your email change.', 'A request was made to change your TicketSafe account email. Use the button below to confirm this step. You may also need to confirm a separate email sent to the other address.', 'Confirm email change', 'Didn’t request this? Do not confirm the change. Open TicketSafe directly to review your account and contact support.'],
    zh: ['确认更换邮箱 · TicketSafe', '请确认您申请的邮箱变更。', '确认更换邮箱。', '您的TicketSafe账户收到了一项更换邮箱的申请。请点击下方按钮完成本次确认。您可能还需要通过另一个邮箱收到的邮件再次确认。', '确认更换邮箱', '如果这不是您本人的操作，请勿确认。请直接打开TicketSafe查看账户，并联系客服。'],
    details: [['Current email', '当前邮箱', '{{ .Email }}'], ['Requested email', '申请使用的新邮箱', '{{ .NewEmail }}']] },
  { id: 'reset-password', slot: 'Reset password', vars: ['Email', 'ConfirmationURL', 'SiteURL'], action: 'ConfirmationURL',
    en: ['Reset your password · TicketSafe', 'Choose a new password for your account.', 'A fresh start.', 'We received a request to reset your TicketSafe password. Follow the secure link below to choose a new one. If the link has expired, request another reset from the sign-in screen.', 'Reset password', 'If you didn’t request a reset, ignore this email. Your password has not been changed by this request.'],
    zh: ['重设您的密码 · TicketSafe', '为您的账户设置新密码。', '重新设置密码。', '我们收到了重设您TicketSafe密码的申请。请点击下方安全链接设置新密码。如链接已过期，请在登录页面重新申请。', '重设密码', '如果您没有申请重设密码，请忽略此邮件。这项申请本身不会更改您的密码。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}']] },
  { id: 'password-changed', slot: 'Password changed', vars: ['Email', 'SiteURL'], security: true,
    en: ['Your password was changed · TicketSafe', 'A security update for your TicketSafe account.', 'Password changed.', 'The password for your TicketSafe account has been changed. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly, use “Forgot password?” to request a reset, and contact support immediately.'],
    zh: ['您的密码已更改 · TicketSafe', '您的TicketSafe账户安全通知。', '密码已更改。', '您的TicketSafe账户密码已更改。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开TicketSafe，通过“忘记密码？”申请重设密码，并立即联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}']] },
  { id: 'email-address-changed', slot: 'Email Address changed', vars: ['OldEmail', 'Email', 'SiteURL'], security: true,
    en: ['Your email address was changed · TicketSafe', 'Your account email has been updated.', 'Email address changed.', 'Your TicketSafe account email has changed. If this was you, use the updated email address the next time you sign in.', 'Open TicketSafe', 'Wasn’t you? Contact support immediately. If you can still sign in, review your account directly in TicketSafe. This email does not reverse the change.'],
    zh: ['您的邮箱已更改 · TicketSafe', '您的账户邮箱已更新。', '邮箱已更改。', '您的TicketSafe账户邮箱已更改。如果这是您本人的操作，下次登录时请使用新邮箱。', '打开TicketSafe', '如果这不是您本人的操作，请立即联系客服。如果仍能登录，请直接在TicketSafe查看账户。这封邮件不会撤销邮箱变更。'],
    details: [['Previous email', '原邮箱', '{{ .OldEmail }}'], ['Updated email', '新邮箱', '{{ .Email }}']] },
  { id: 'invite-user', slot: 'Invite user', vars: ['Email', 'ConfirmationURL', 'SiteURL'], action: 'ConfirmationURL',
    en: ['Your invitation · TicketSafe', 'You’ve been invited to TicketSafe.', 'You’re invited.', 'An invitation to TicketSafe is ready for this email address. Follow the link below to accept it and set up your account.', 'Accept invitation', 'If you weren’t expecting this invitation, you can ignore this email.'],
    zh: ['您的邀请 · TicketSafe', '您收到了罚单卫士的邀请。', '欢迎加入。', '此邮箱收到了一份罚单卫士邀请。请通过下方链接接受邀请并设置账户。', '接受邀请', '如果您没有预期收到此邀请，可以忽略这封邮件。'],
    details: [['Invited email', '受邀邮箱', '{{ .Email }}']] },
  { id: 'magic-link', slot: 'Magic link', vars: ['Email', 'Token', 'SiteURL'], otp: true,
    en: ['Your sign-in code · TicketSafe', 'Your private code to sign in.', 'Your sign-in code.', 'Enter this code where you requested it to sign in to TicketSafe. Use the most recent code; if it has expired, request another.', '', 'Keep this code private. TicketSafe support will never ask you for it. If you didn’t request it, ignore this email.'],
    zh: ['您的登录验证码 · TicketSafe', '您的专属登录验证码。', '登录验证码。', '请在申请验证码的页面输入此代码，登录罚单卫士。请使用最新的验证码；如已过期，请重新申请。', '', '请勿分享此验证码。罚单卫士客服不会向您索取验证码。如果您没有申请，请忽略此邮件。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}']] },
  { id: 'reauthentication', slot: 'Reauthentication', vars: ['Email', 'Token', 'SiteURL'], otp: true,
    en: ['Verify it’s you · TicketSafe', 'Confirm your identity before continuing.', 'One quick security check.', 'Enter this verification code in TicketSafe to continue with the account action you requested. If the code has expired, request another.', '', 'Never share this code. If you didn’t request it, ignore this email and contact support if you notice unfamiliar account activity.'],
    zh: ['验证您的身份 · TicketSafe', '继续操作前，请验证您的身份。', '验证您的身份。', '请在罚单卫士输入此验证码，继续您申请的账户操作。如验证码已过期，请重新申请。', '', '请勿分享此验证码。如果您没有申请，请忽略此邮件；如发现异常账户活动，请联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}']] },
  { id: 'phone-number-changed', slot: 'Phone number changed', vars: ['OldPhone', 'Phone', 'SiteURL'], security: true,
    en: ['Your phone number was changed · TicketSafe', 'An account security update.', 'Phone number changed.', 'The phone number associated with your TicketSafe account has changed. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly and contact support immediately.'],
    zh: ['您的电话号码已更改 · TicketSafe', '您的账户安全通知。', '电话号码已更改。', '您罚单卫士账户关联的电话号码已更改。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开罚单卫士，并立即联系客服。'],
    details: [['Previous number', '原电话号码', '{{ .OldPhone }}'], ['Updated number', '新电话号码', '{{ .Phone }}']] },
  { id: 'verification-method-added', slot: 'Verification method added', vars: ['Email', 'FactorType', 'SiteURL'], security: true,
    en: ['Verification method added · TicketSafe', 'An account security update.', 'Verification method added.', 'A verification method was added to your TicketSafe account. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly and contact support immediately.'],
    zh: ['已添加验证方式 · TicketSafe', '您的账户安全通知。', '已添加验证方式。', '您的罚单卫士账户添加了一种验证方式。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开罚单卫士，并立即联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}'], ['Verification method', '验证方式', '{{ .FactorType }}']] },
  { id: 'verification-method-removed', slot: 'Verification method removed', vars: ['Email', 'FactorType', 'SiteURL'], security: true,
    en: ['Verification method removed · TicketSafe', 'An account security update.', 'Verification method removed.', 'A verification method was removed from your TicketSafe account. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly and contact support immediately.'],
    zh: ['已移除验证方式 · TicketSafe', '您的账户安全通知。', '已移除验证方式。', '您的罚单卫士账户移除了一种验证方式。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开罚单卫士，并立即联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}'], ['Verification method', '验证方式', '{{ .FactorType }}']] },
  { id: 'sign-in-method-linked', slot: 'Sign-in method linked', vars: ['Email', 'Provider', 'SiteURL'], security: true,
    en: ['Sign-in method linked · TicketSafe', 'An account security update.', 'Sign-in method linked.', 'A sign-in method was linked to your TicketSafe account. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly and contact support immediately.'],
    zh: ['已关联登录方式 · TicketSafe', '您的账户安全通知。', '已关联登录方式。', '您的罚单卫士账户关联了一种登录方式。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开罚单卫士，并立即联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}'], ['Sign-in method', '登录方式', '{{ .Provider }}']] },
  { id: 'sign-in-method-removed', slot: 'Sign-in method removed', vars: ['Email', 'Provider', 'SiteURL'], security: true,
    en: ['Sign-in method removed · TicketSafe', 'An account security update.', 'Sign-in method removed.', 'A sign-in method was removed from your TicketSafe account. If this was you, no further action is needed.', 'Open TicketSafe', 'Wasn’t you? Open TicketSafe directly and contact support immediately.'],
    zh: ['已移除登录方式 · TicketSafe', '您的账户安全通知。', '已移除登录方式。', '您的罚单卫士账户移除了一种登录方式。如果这是您本人的操作，无需进一步处理。', '打开TicketSafe', '如果这不是您本人的操作，请直接打开罚单卫士，并立即联系客服。'],
    details: [['Account email', '账户邮箱', '{{ .Email }}'], ['Sign-in method', '登录方式', '{{ .Provider }}']] },
];

function render(t, language) {
  const cn = language === 'zh';
  const [subject, preheader, title, copy, cta, notice] = t[language].map(text => cn ? text.replaceAll('TicketSafe', '罚单卫士') : text);
  const font = "Arial,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif";
  const details = t.details.map(([en, zh, value]) => `<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">${esc(cn ? zh : en)}</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">${value}</div></td></tr>`).join('\n');
  const button = t.action || t.security ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:28px;"><tr><td align="center" bgcolor="#8cbbff" style="border-radius:10px;mso-padding-alt:16px 24px;"><a href="{{ .${t.action || 'SiteURL'} }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#101820;border-radius:10px;">${esc(cta)}</a></td></tr></table>` : '';
  const otp = t.otp ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#111419" style="padding:22px 12px;border:1px solid #30343d;border-radius:14px;"><div style="font-size:11px;letter-spacing:1px;line-height:18px;color:#a6adb8;">${cn ? '一次性验证码' : 'ONE-TIME CODE'}</div><div style="margin-top:10px;font-family:Consolas,'Courier New',monospace;font-size:34px;line-height:44px;font-weight:700;letter-spacing:5px;color:#f5f6f8;">{{ .Token }}</div></td></tr></table>` : '';
  const fallback = t.action ? `<p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#a6adb8;">${cn ? '按钮无法打开？请将以下链接复制到浏览器。请勿分享此链接。' : 'Button not opening? Copy this private link into your browser.'}</p><p style="margin:8px 0 0;padding:12px;background-color:#111419;border:1px solid #30343d;border-radius:8px;font-size:11px;line-height:18px;"><a href="{{ .ConfirmationURL }}" style="color:#8cbbff;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>` : '';
  return `<!DOCTYPE html>
<html lang="${cn ? 'zh-CN' : 'en'}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>${esc(subject)}</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:${font};">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:${font};">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${[22,16,10].map(height => `<td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:${height}px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td>`).join('')}</tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:${cn ? '0.5px' : '-1.2px'};color:#f5f6f8;">${cn ? '罚单卫士' : 'TicketSafe'}<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:${font};">
          <p style="margin:0 0 16px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:${t.security ? '#f0c17d' : '#8cbbff'};font-weight:700;">${cn ? (t.security ? '账户安全通知' : '账户验证') : (t.security ? 'ACCOUNT SECURITY' : 'ACCOUNT ACCESS')}</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">${esc(title)}</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">${esc(copy)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;">${details}</table>
          ${otp}${button}${fallback}
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:${t.security ? '#f0c17d' : '#a6adb8'};">${esc(notice)}</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">${cn ? '需要帮助？' : 'Need a hand?'} <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">${cn ? '联系罚单卫士客服' : 'Contact TicketSafe support'}</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          ${cn ? '罚单卫士（TicketSafe）账户邮件 · 非营销邮件' : 'TicketSafe account email · Not a marketing message'}<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">${cn ? '打开罚单卫士' : 'Open TicketSafe'}</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`;
}

const slots = {
  'confirm-signup': 'confirmation',
  'change-email-address': 'email_change',
  'reset-password': 'recovery',
  'password-changed': 'password_changed_notification',
  'email-address-changed': 'email_changed_notification',
  'invite-user': 'invite',
  'magic-link': 'magic_link',
  'reauthentication': 'reauthentication',
  'phone-number-changed': 'phone_changed_notification',
  'verification-method-added': 'mfa_factor_enrolled_notification',
  'verification-method-removed': 'mfa_factor_unenrolled_notification',
  'sign-in-method-linked': 'identity_linked_notification',
  'sign-in-method-removed': 'identity_unlinked_notification',
};
// Metadata chooses presentation only; it is never used for authorization.
// `with` handles older accounts that have no saved language preference.
const languageSwitch = '{{ $zh := false }}{{ with .Data }}{{ with .curbside_preferences }}{{ if eq .language "zh" }}{{ $zh = true }}{{ end }}{{ end }}{{ end }}{{ if $zh }}';
const localize = (en, zh) => `${languageSwitch}${zh}{{ else }}${en}{{ end }}`;
const patch = { smtp_sender_name: 'TicketSafe' };
for (const t of templates) {
  const slot = slots[t.id];
  patch[`mailer_subjects_${slot}`] = localize(t.en[0], t.zh[0].replaceAll('TicketSafe', '罚单卫士'));
  patch[`mailer_templates_${slot}_content`] = localize(render(t, 'en'), render(t, 'zh'));
  for (const language of ['en', 'zh']) {
    const html = render(t, language);
    if ((html.match(/<!DOCTYPE html>/g) || []).length !== 1 || html.includes('```')) throw new Error(`Invalid document: ${t.id}`);
    const vars = [...new Set([...html.matchAll(/\{\{ \.([A-Za-z]+) \}\}/g)].map(match => match[1]))];
    if (vars.some(variable => !t.vars.includes(variable)) || t.vars.some(variable => !vars.includes(variable))) throw new Error(`Unexpected variables: ${t.id}`);
    if (/Curbside|howsmydriving|<script|<img|https:\/\//i.test(html)) throw new Error(`Unexpected brand or external asset: ${t.id}`);
    if (t.action && !html.includes('href="{{ .ConfirmationURL }}"')) throw new Error(`Missing action: ${t.id}`);
    if (t.id === 'reset-password' && html.includes('{{ .Token }}')) throw new Error('Password recovery must not contain another template’s code');
  }
}
for (const language of ['en', 'zh']) {
  fs.mkdirSync(path.join(root, language), { recursive: true });
  for (const t of templates) fs.writeFileSync(path.join(root, language, `${t.id}.html`), render(t, language));
}
fs.writeFileSync(path.join(root, 'subjects.json'), JSON.stringify(templates.map(t => ({ file: `${t.id}.html`, dashboardTemplate: t.slot, subject: { en: t.en[0], zh: t.zh[0].replaceAll('TicketSafe', '罚单卫士') }, variables: t.vars })), null, 2) + '\n');
fs.writeFileSync(path.join(root, 'auth-config.json'), JSON.stringify(patch, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'COPY-PASTE.md'), '# TicketSafe · Supabase email HTML\n\nGenerate with `node supabase/email-templates/generate.mjs`. `auth-config.json` contains only the 13 email subjects/bodies and the sender display name, ready for the Management API PATCH. It does not enable sign-in methods or notification types.\n\nLive templates select Chinese when saved user metadata `curbside_preferences.language` is `zh`; older accounts and system preferences default to English. The historical metadata key is retained for existing accounts. Standalone English and Chinese alternatives are in `en/` and `zh/`.\n\nFor manual dashboard edits, copy only the HTML inside a code block into the matching body field and set the subject separately. Do not paste this entire document. Leave every `{{ .Variable }}` placeholder intact. Preserve the configured notification switches, SMTP sender address, verification URLs and auth settings.\n\n' + templates.map(t => `## ${t.slot}\n\nSubject: **${t.en[0]}**\n\n\`\`\`html\n${render(t, 'en')}\`\`\`\n`).join('\n'));
console.log(`Generated and validated ${templates.length} English and Chinese templates, plus localized Management API configuration.`);
