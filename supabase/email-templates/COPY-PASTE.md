# Curbside · Supabase email HTML

Paste a complete HTML block into the matching Supabase Email Templates body field. Set its subject separately. Leave every `{{ .Variable }}` placeholder intact. Chinese alternatives are in `zh/`. Security notices must also be enabled in Supabase. These templates have not been installed or sent.

## Confirm signup

Subject: **Confirm your email · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Confirm your email · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">One step to your garage.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Confirm your email</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">Verify your email address to finish creating your Curbside account. Then you can save your cars and return to them whenever you need.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Confirm email</a></td></tr></table><p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#a6adb8;">Button not opening? Copy this link into your browser. Keep the link private.<br><a href="{{ .ConfirmationURL }}" style="color:#8cbbff;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">If you didn’t create this account, you can ignore this email. Your email will not be verified by ignoring it.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Magic Link or OTP

Subject: **Your sign-in link · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Your sign-in link · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your garage, one tap away.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Welcome back.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">Use this secure link to sign in to Curbside. It can be used once. If it has expired, request a new link.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Sign in to Curbside</a></td></tr></table><p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#a6adb8;">Button not opening? Copy this link into your browser. Keep the link private.<br><a href="{{ .ConfirmationURL }}" style="color:#8cbbff;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">Only open this link if you requested it. Do not forward this email. If you didn’t request a sign-in link, ignore it.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Magic Link or OTP (alternative)

Subject: **Your sign-in code · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Your sign-in code · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">A secure code for your sign-in.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Your sign-in code.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">Enter this code on the Curbside sign-in screen where you requested it. Use it once; if it has expired, request a new code.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#111419" style="padding:22px 12px;border:1px solid #30343d;border-radius:14px;"><div style="font-size:11px;letter-spacing:1px;line-height:18px;color:#a6adb8;">ONE-TIME CODE</div><div style="margin-top:10px;font-family:Consolas,'Courier New',monospace;font-size:34px;line-height:44px;font-weight:700;letter-spacing:5px;color:#f5f6f8;">{{ .Token }}</div></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">Keep this code private. Curbside support will never ask you for it. If you didn’t request it, ignore this email.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Change email address

Subject: **Confirm your email change · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Confirm your email change · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Confirm the email change you requested.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Confirm your email change.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">A request was made to change your Curbside account email. Use the button below to confirm this step. You may also need to confirm a separate email sent to the other address.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Current email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr>
<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Requested email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .NewEmail }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Confirm email change</a></td></tr></table><p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#a6adb8;">Button not opening? Copy this link into your browser. Keep the link private.<br><a href="{{ .ConfirmationURL }}" style="color:#8cbbff;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">Didn’t request this? Do not confirm the change. Open Curbside directly to review your account and contact support.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Reset password

Subject: **Reset your password · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Reset your password · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Choose a new password for your account.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">A fresh start.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">We received a request to reset your Curbside password. Follow the secure link below to choose a new one. If the link has expired, request another reset from the sign-in screen.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Reset password</a></td></tr></table><p style="margin:18px 0 0;font-size:12px;line-height:20px;color:#a6adb8;">Button not opening? Copy this link into your browser. Keep the link private.<br><a href="{{ .ConfirmationURL }}" style="color:#8cbbff;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">If you didn’t request a reset, ignore this email. Your password has not been changed by this request.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Reauthentication

Subject: **Verify it’s you · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Verify it’s you · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Confirm your identity before continuing.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT ACCESS</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">One quick security check.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">Enter this verification code in Curbside to confirm your identity before continuing with the action you requested. If it has expired, request a new code.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#111419" style="padding:22px 12px;border:1px solid #30343d;border-radius:14px;"><div style="font-size:11px;letter-spacing:1px;line-height:18px;color:#a6adb8;">ONE-TIME CODE</div><div style="margin-top:10px;font-family:Consolas,'Courier New',monospace;font-size:34px;line-height:44px;font-weight:700;letter-spacing:5px;color:#f5f6f8;">{{ .Token }}</div></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#a6adb8;">Never share this code. If you didn’t request this verification, ignore the email and contact support if you notice unfamiliar account activity.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Password changed

Subject: **Your password was changed · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Your password was changed · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">A security update for your Curbside account.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT SECURITY</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Password changed.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">The password for your Curbside account has been changed. If this was you, no further action is needed.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .SiteURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Open Curbside</a></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#f0c17d;">Wasn’t you? Open Curbside directly, use “Forgot password?” to request a reset, and contact support immediately.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Email Address changed

Subject: **Your email address was changed · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Your email address was changed · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your account email has been updated.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT SECURITY</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Email address changed.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">Your Curbside account email has changed. If this was you, use the updated email address the next time you sign in.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Previous email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .OldEmail }}</div></td></tr>
<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Updated email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .SiteURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Open Curbside</a></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#f0c17d;">Wasn’t you? Contact support immediately. If you can still sign in, review your account directly in Curbside. This email does not reverse the change.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Phone number changed

Subject: **Your phone number was changed · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>Your phone number was changed · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your account phone number has been updated.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT SECURITY</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Phone number changed.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">The phone number associated with your Curbside account has changed. If this was you, no further action is needed. This change does not subscribe you to SMS alerts or marketing.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Previous number</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ if .OldPhone }}{{ .OldPhone }}{{ else }}—{{ end }}</div></td></tr>
<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Updated number</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ if .Phone }}{{ .Phone }}{{ else }}—{{ end }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .SiteURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Open Curbside</a></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#f0c17d;">Wasn’t you? Contact support immediately and review your account directly in Curbside if you can still sign in.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Sign in method linked

Subject: **A sign-in method was linked · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>A sign-in method was linked · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">A new way to sign in has been linked.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT SECURITY</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Sign-in method linked.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">A sign-in method was linked to your Curbside account. If this was you, no further action is needed.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr>
<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Sign-in provider</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Provider }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .SiteURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Open Curbside</a></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#f0c17d;">Wasn’t you? Contact support immediately and review your account directly in Curbside if you can still sign in.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```

## Sign in method removed

Subject: **A sign-in method was removed · Curbside**

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
  <title>A sign-in method was removed · Curbside</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    table{border-collapse:collapse}
    body{margin:0;padding:0;width:100%!important;background:#0b0d10}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media screen and (max-width:600px){.outer{padding:24px 12px!important}.card{padding:28px 24px!important}.headline{font-size:28px!important;line-height:34px!important}.footer{padding:22px 14px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d10;color:#f5f6f8;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#0b0d10;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">A sign-in method has been disconnected.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b0d10">
    <tr><td class="outer" align="center" style="padding:48px 20px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="28" style="width:28px;padding-right:10px;vertical-align:middle;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:22px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:16px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td><td width="7" valign="bottom" style="width:7px;vertical-align:bottom;"><div style="width:4px;height:10px;background:#8cbbff;border-radius:2px;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table></td>
            <td style="font-size:26px;line-height:32px;font-weight:600;letter-spacing:-1.2px;color:#f5f6f8;">curbside<span style="color:#8cbbff;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="card" bgcolor="#191c21" style="padding:36px;border:1px solid #30343d;border-radius:22px;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.5px;color:#8cbbff;font-weight:700;">ACCOUNT SECURITY</p>
          <h1 class="headline" style="margin:0;font-size:34px;line-height:40px;letter-spacing:-0.8px;font-weight:700;color:#f5f6f8;">Sign-in method removed.</h1>
          <p style="margin:16px 0 24px;font-size:15px;line-height:25px;color:#c5cbd4;">A sign-in method was removed from your Curbside account. It can no longer be used to sign in to this account. If this was you, use another available sign-in method.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111419" style="border:1px solid #30343d;border-radius:14px;"><tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Account email</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Email }}</div></td></tr>
<tr><td style="padding:14px 18px;border-bottom:1px solid #30343d;"><div style="font-size:12px;line-height:18px;color:#a6adb8;">Removed provider</div><div style="margin-top:4px;font-size:15px;line-height:23px;color:#f5f6f8;word-break:break-all;overflow-wrap:anywhere;">{{ .Provider }}</div></td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:26px;"><tr><td align="center" bgcolor="#3175e6" style="border-radius:12px;mso-padding-alt:16px 24px;"><a href="{{ .SiteURL }}" style="display:block;padding:16px 24px;font-size:16px;font-weight:700;line-height:24px;text-decoration:none;color:#ffffff;border-radius:12px;">Open Curbside</a></td></tr></table>
          <p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #30343d;font-size:13px;line-height:22px;color:#f0c17d;">Wasn’t you, or can’t sign in? Contact support immediately. Open Curbside directly to review your account if you still have access.</p>
          <p style="margin:12px 0 0;font-size:13px;line-height:22px;color:#a6adb8;">Need a hand? <a href="mailto:ezrefillyny@gmail.com" style="color:#8cbbff;text-decoration:underline;">Contact Curbside support</a></p>
        </td></tr>
        <tr><td class="footer" style="padding:24px 12px;font-size:11px;line-height:19px;color:#a6adb8;text-align:center;">
          Curbside account email · Not a marketing message<br>
          Flushing NY Wireless<br>136-78 Roosevelt Ave, Flushing, NY, United States<br>
          <a href="{{ .SiteURL }}" style="display:inline-block;margin-top:10px;color:#8cbbff;text-decoration:underline;">Open Curbside</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
```
