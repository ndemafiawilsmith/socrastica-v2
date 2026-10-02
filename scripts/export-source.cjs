const fs = require('node:fs');
const files = [
 'package.json','tsconfig.json','next-env.d.ts','next.config.mjs','postcss.config.mjs','tailwind.config.ts','.env.example',
 'scripts/next-production.cjs','supabase/migrations/202610010001_learning.sql','supabase/migrations/202610020001_execution.sql','supabase/migrations/202610030001_reasoning.sql',
 'scripts/email-templates.cjs','scripts/configure-auth-email.cjs',
 'infra/aws/runtime-boundary.json','infra/aws/deployer-iam.json','infra/aws/ecs-task-trust.json','infra/aws/watchdog.cjs',
 'runner/package.json','runner/Dockerfile','runner/grade.cjs','runner/main.cjs','scripts/provision-execution.cjs','scripts/provision-watchdog.cjs',
 'src/app/layout.tsx','src/app/globals.css','src/components/Logo.tsx',
 'src/lib/supabase/browser.ts','src/lib/supabase/server.ts','src/middleware.ts','src/lib/http.ts','src/lib/learning.ts','src/lib/reasoning.ts','src/lib/mentor.ts','src/lib/use-learning-session.ts',
 'src/components/AuthForm.tsx','src/app/login/page.tsx','src/app/signup/page.tsx','src/app/forgot-password/page.tsx','src/app/reset-password/page.tsx','src/app/auth/callback/route.ts',
 'src/app/api/progress/route.ts','src/app/api/mentor/route.ts','src/lib/execution.ts','src/app/api/execute/route.ts','src/app/studio/layout.tsx',
 'src/components/SocraticChat.tsx','src/components/FlowchartViewer.tsx','src/components/CodeWorkspace.tsx','src/app/studio/page.tsx','src/app/page.tsx',
];
const parts = ['# Socrastica — complete copy-ready source', 'Install dependencies, configure `.env.local` from the blank `.env.example`, apply the database migration, and run `npm run dev`. Landing page: `/`. Protected studio: `/studio`. See README.md and BACKEND_SETUP.md for completed integrations and remaining services.'];
for (const file of files) {
 const ext = file.split('.').pop(); const lang = file.endsWith('/Dockerfile') ? 'dockerfile' : file.endsWith('.env.example') ? 'dotenv' : ext==='json' ? 'json' : ext==='css' ? 'css' : ext==='sql' ? 'sql' : ['cjs','mjs'].includes(ext) ? 'js' : 'tsx';
 parts.push(`## ${file}`, '```'+lang+'\n'+fs.readFileSync(file,'utf8')+'\n```');
}
fs.writeFileSync('SOURCE.md',parts.join('\n\n')+'\n');
console.log('Copy-ready source regenerated. Actual .env.local credentials excluded.');
