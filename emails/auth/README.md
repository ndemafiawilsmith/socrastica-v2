# Socrastica auth emails

Six dark, responsive HTML templates are configured in Supabase: email confirmation, password recovery, email change, invitation, magic-link sign-in, and reauthentication code. The templates use table layout, inline styles, Outlook fallbacks, mobile spacing, a clear lavender action button, preheader text, a fallback link, and safety guidance. They use Supabase's actual ConfirmationURL/Token variables; the local previews replace those with sample values only. No marketing unsubscribe is added to required account emails.

Source: `scripts/email-templates.cjs`. Generate HTML with `node scripts/email-templates.cjs`. Publish transport/templates with `npm run auth:email`; preview at `http://localhost:3010/confirmation` after `npm run email:preview`, or replace confirmation with recovery, email_change, invite, magic_link, or reauthentication.

Resend SMTP authentication and saved Supabase configuration have been verified. Sender: `accounts@socrastica.com`. The API key is restricted to sending; its domain-read API response is restricted_api_key, not evidence of invalid credentials. Keep this least-privilege key. Domain status must be checked in Resend's dashboard. Public DNS contains the expected DKIM record, but DNS presence alone does not establish Resend's current verified status.

Browser previews were checked at desktop and 390px mobile width. Real email-client rendering and actual recipient delivery still require an inbox test; no test email was sent without a recipient supplied by the user. Auth callback URLs currently target the local app. Do not switch them to the production domain until the site is deployed with HTTPS. Default Supabase provider settings and rate limits are preserved except for the requested SMTP/template configuration.

`confirmation-preview.png` and `confirmation-mobile-preview.png` show sample data, with no real auth links, tokens, or user information.
