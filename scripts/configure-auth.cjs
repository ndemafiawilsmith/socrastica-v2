require('@next/env').loadEnvConfig(process.cwd());
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
async function main() {
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const response = await fetch(url, {headers});
  if (!response.ok) throw new Error('CONFIG_READ_FAILED');
  const config = await response.json();
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
  const redirects = new Set((config.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean));
  redirects.add(`${origin}/auth/callback`);
  redirects.add(`${origin}/auth/callback?next=/reset-password`);
  const patch = { uri_allow_list: [...redirects].join(','), password_min_length: Math.max(10, config.password_min_length || 6) };
  const result = await fetch(url, {method:'PATCH', headers, body: JSON.stringify(patch)});
  if (!result.ok) throw new Error('CONFIG_UPDATE_FAILED');
  console.log('Auth callback URLs configured; minimum password length at least 10.');
  console.log('Email/password provider: '+(config.external_email_enabled ? 'enabled' : 'disabled'));
  console.log('Email confirmation: '+(config.mailer_autoconfirm ? 'disabled' : 'required'));
  console.log('Custom SMTP: '+(config.smtp_host ? 'configured' : 'not configured; Supabase test email limitations apply'));
  const query = `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('learning_sessions','ai_budget','ai_requests');`;
  const check = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {method:'POST',headers,body:JSON.stringify({query,read_only:true})});
  if (!check.ok) throw new Error('SCHEMA_CHECK_FAILED');
  const rows=await check.json();
  console.log('Schema RLS: '+JSON.stringify(rows));
}
main().catch(error=>{console.log('Setup verification failed: '+(error.cause?.code||error.message));process.exitCode=1;});
