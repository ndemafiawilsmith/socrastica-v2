const fs=require('node:fs');
const path=require('node:path');
const content={
  confirmation:{subject:'Confirm your email — Socrastica',eyebrow:'YOUR LEARNING SPACE',title:'A good idea starts<br>with you.',body:'Confirm your email to open your learning studio. Think through a challenge, map your approach, and bring your reasoning to life.',action:'Confirm email',preheader:'Confirm your email and start learning with Socrastica.',note:'If you didn’t create a Socrastica account, you can ignore this email.'},
  recovery:{subject:'Reset your Socrastica password',eyebrow:'ACCOUNT SECURITY',title:'Back to your<br>next breakthrough.',body:'We received a request to reset your password. Use the button below to choose a new one and get back to your learning space.',action:'Reset password',preheader:'A secure link to reset your Socrastica password.',note:'If you didn’t request this reset, ignore this email. Your password will stay the same.'},
  email_change:{subject:'Confirm your new email — Socrastica',eyebrow:'ACCOUNT SECURITY',title:'Your account.<br>Your new address.',body:'Confirm this email address to complete the change to your Socrastica account. Your saved work and learning progress will stay with you.',action:'Confirm email change',preheader:'Confirm the email change for your Socrastica account.',note:'If you didn’t request this change, don’t confirm it. Review your account security.'},
  invite:{subject:'Your invitation to Socrastica',eyebrow:'YOU’RE INVITED',title:'Make room for<br>a little curiosity.',body:'You’ve been invited to Socrastica. Accept your invitation to set up your account and start turning ideas into working code.',action:'Accept invitation',preheader:'Your Socrastica learning studio is waiting.',note:'If you weren’t expecting this invitation, you can ignore this email.'},
  magic_link:{subject:'Your secure Socrastica sign-in link',eyebrow:'SECURE SIGN-IN',title:'Your learning space<br>is one click away.',body:'Use this secure link to sign in to Socrastica. It is intended only for you; don’t forward this email or share the link.',action:'Sign in to Socrastica',preheader:'Use your secure link to sign in to Socrastica.',note:'If you didn’t request this link, ignore this email.'},
  reauthentication:{subject:'Your Socrastica verification code',eyebrow:'ACCOUNT SECURITY',title:'A quick check.<br>Then you’re ready.',body:'Enter this verification code in Socrastica to confirm it’s you. Keep it private; we will never ask you to send this code to anyone.',action:null,preheader:'Your verification code for a sensitive account action.',note:'If you didn’t request this code, don’t share it. Review your account security.'}
};
function render(type) {
  const c=content[type];
  const action=c.action?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 24px;"><tr><td bgcolor="#b9adff" style="border-radius:12px;background:#b9adff;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:16px 24px;color:#15112b;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">${c.action}&nbsp; &rarr;</a></td></tr></table><p style="margin:0;color:#a2a9bd;font-size:12px;line-height:20px;">Button not working? Copy this link into your browser:</p><p style="margin:8px 0 0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{ .ConfirmationURL }}" style="color:#c3baff;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>`:`<p style="margin:28px 0;padding:20px;border:1px solid #45405d;border-radius:12px;background:#111523;color:#c3baff;text-align:center;font-size:30px;letter-spacing:6px;font-weight:700;">{{ .Token }}</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${c.subject}</title><style>@media only screen and (max-width:600px){.outer{padding:20px 12px!important}.content{padding:30px 24px!important}.headline{font-size:32px!important;line-height:38px!important}}</style></head>
<body style="margin:0;padding:0;background:#0b0f1c;color:#f4f5fb;font-family:'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${c.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0f1c"><tr><td class="outer" align="center" style="padding:48px 20px;">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 8px 24px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#242039" style="width:38px;height:38px;background:#242039;border:1px solid #4f456a;border-radius:11px;text-align:center;color:#c3baff;font-size:22px;font-weight:700;">S</td><td style="padding-left:12px;color:#f4f5fb;font-size:22px;font-weight:700;letter-spacing:-1px;">socrastica<span style="color:#b9adff;">.</span></td></tr></table></td></tr>
<tr><td class="content" bgcolor="#171b2b" style="padding:42px;background:#171b2b;background-image:linear-gradient(145deg,#201d35,#171b2b 60%);border:1px solid #303448;border-radius:24px;">
<p style="margin:0 0 20px;color:#b9adff;font-size:10px;font-weight:700;letter-spacing:2px;">${c.eyebrow}</p>
<h1 class="headline" style="margin:0 0 20px;color:#f4f5fb;font-size:38px;line-height:44px;font-weight:600;letter-spacing:-1.4px;">${c.title}</h1>
<p style="margin:0;color:#bfc5d5;font-size:15px;line-height:26px;">${c.body}</p>
${action}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;"><tr><td style="border-top:1px solid #34374a;padding-top:22px;color:#a2a9bd;font-size:12px;line-height:20px;">This link or code is time limited and can only be used once. ${c.note}</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:28px 16px 12px;color:#a2a9bd;font-size:11px;letter-spacing:1px;">REASON&nbsp;&nbsp; &rarr;&nbsp;&nbsp; MAP&nbsp;&nbsp; &rarr;&nbsp;&nbsp; BUILD</td></tr>
<tr><td align="center" style="padding:0 20px;color:#737d98;font-size:11px;line-height:20px;">Socrastica &middot; Learn to think like a developer.<br>Account email for {{ .Email }} &middot; Never share your sign-in links or codes.</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
function writeTemplates() {
  fs.mkdirSync('emails/auth',{recursive:true});
  for(const type of Object.keys(content))fs.writeFileSync(path.join('emails/auth',`${type}.html`),render(type));
}
module.exports={content,render,writeTemplates};
if(require.main===module){writeTemplates();console.log('Six branded auth templates generated; no emails sent.');}
