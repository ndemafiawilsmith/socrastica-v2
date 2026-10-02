const fs = require('node:fs');
require('@next/env').loadEnvConfig(process.cwd());
async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) { console.log('Missing SUPABASE_ACCESS_TOKEN. Run supabase/migrations/202610010001_learning.sql in the Supabase SQL Editor, or add the management token locally.'); process.exitCode = 2; return; }
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) throw new Error('INVALID_PROJECT_URL');
  const ref = url.hostname.split('.')[0];
  const migration = process.argv[2] || '202610010001_learning.sql';
  if (!/^\d{12}_[a-z_]+\.sql$/.test(migration)) throw new Error('INVALID_MIGRATION');
  const query = fs.readFileSync(`supabase/migrations/${migration}`, 'utf8');
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(30000) });
  console.log(`Database migration: HTTP ${response.status}`);
  if (!response.ok) { console.log('Migration failed. Response body omitted to avoid exposing project data.'); process.exitCode = 1; }
  else console.log('Migration applied.');
}
main().catch(error => { console.log(`Migration failed (${error.cause?.code || error.name}); no secrets logged.`); process.exitCode = 1; });
