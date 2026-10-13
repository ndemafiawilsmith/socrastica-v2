const fs = require('node:fs');
const files = [
 'package.json','tsconfig.json','next-env.d.ts','next.config.mjs','postcss.config.mjs','tailwind.config.ts','.env.example',
 'scripts/next-production.cjs','supabase/migrations/202610010001_learning.sql','supabase/migrations/202610020001_execution.sql','supabase/migrations/202610030001_reasoning.sql',
 'scripts/email-templates.cjs','scripts/configure-auth-email.cjs',
 'infra/aws/runtime-boundary.json','infra/aws/deployer-iam.json',
 'src/lib/values.ts','src/lib/sandbox.ts','src/app/api/studio/run/route.ts',
 'supabase/migrations/202610040001_blueprint.sql','src/lib/blueprint.ts','src/lib/blueprint-code.ts','src/lib/studio-ai.ts','src/lib/use-blueprint-studio.ts','src/components/BlueprintCanvas.tsx','src/components/VoiceDirector.tsx','src/app/api/studio/route.ts','src/app/api/studio/direct/route.ts','src/app/api/studio/generate/route.ts',
 'supabase/migrations/202610050001_teaching.sql','src/lib/classroom.ts','src/lib/guidance.ts','src/lib/teaching-server.ts','src/components/TeachingRail.tsx','src/components/LearningJournal.tsx','src/components/BlueprintMiniMap.tsx','src/app/api/studio/history/route.ts','src/app/api/classrooms/route.ts','src/app/api/classrooms/join/route.ts','src/app/api/classrooms/[id]/route.ts','src/app/instructor/layout.tsx','src/app/instructor/page.tsx',
 'supabase/migrations/202610060001_exercises.sql','src/lib/exercises.ts','src/lib/exercise-runner.ts','src/lib/auth-destination.ts','src/components/ExerciseLibrary.tsx','src/components/ExerciseWorkspace.tsx','src/app/exercises/page.tsx','src/app/learn/[id]/page.tsx','src/app/api/exercises/[id]/route.ts',
 'src/app/layout.tsx','src/app/globals.css','src/components/Logo.tsx',
 'src/lib/supabase/browser.ts','src/lib/supabase/server.ts','src/middleware.ts','src/lib/http.ts',
 'src/components/AuthForm.tsx','src/app/login/page.tsx','src/app/signup/page.tsx','src/app/forgot-password/page.tsx','src/app/reset-password/page.tsx','src/app/auth/callback/route.ts',
 'src/app/studio/layout.tsx','src/components/CodeWorkspace.tsx','src/app/studio/page.tsx','src/app/page.tsx',
];
const parts = ['# Socrastica — complete copy-ready source', 'Install dependencies, configure `.env.local` from the blank `.env.example`, apply the database migration, and run `npm run dev`. Landing page: `/`. Protected studio: `/studio`. See README.md and BACKEND_SETUP.md for completed integrations and remaining services.'];
for (const file of files) {
 const ext = file.split('.').pop(); const lang = file.endsWith('/Dockerfile') ? 'dockerfile' : file.endsWith('.env.example') ? 'dotenv' : ext==='json' ? 'json' : ext==='css' ? 'css' : ext==='sql' ? 'sql' : ['cjs','mjs'].includes(ext) ? 'js' : 'tsx';
 parts.push(`## ${file}`, '```'+lang+'\n'+fs.readFileSync(file,'utf8')+'\n```');
}
fs.writeFileSync('SOURCE.md',parts.join('\n\n')+'\n');
console.log('Copy-ready source regenerated. Actual .env.local credentials excluded.');
