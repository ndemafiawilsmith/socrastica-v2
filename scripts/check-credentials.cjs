const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
async function probe(label, url, headers) {
  try {
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    console.log(`${label}: HTTP ${response.status}`);
    await response.body?.cancel();
  } catch (error) {
    console.log(`${label}: request failed (${error.cause?.code || error.name})`);
  }
}
async function main() {
  let url;
  try { url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); } catch { console.log('Supabase URL: invalid'); return; }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    console.log('Supabase URL: expected a standard HTTPS Supabase project root; skipped sending credentials'); return;
  }
  console.log('Supabase URL: valid project URL');
  await probe('Supabase public key / Auth settings', `${url.origin}/auth/v1/settings`, { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  if(process.env.SUPABASE_SECRET_KEY) await probe('Supabase server key / Auth settings', `${url.origin}/auth/v1/settings`, { apikey: process.env.SUPABASE_SECRET_KEY });
  await probe('OpenAI key / selected model gpt-6-luna', 'https://api.openai.com/v1/models/gpt-6-luna', { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` });
}
main().catch(() => { console.log('Validation failed; no secret values logged'); process.exitCode = 1; });
