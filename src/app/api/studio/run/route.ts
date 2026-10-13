import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient, adminClient } from '@/lib/supabase/server';
import { sampleCases, verificationInputs } from '@/lib/blueprint';
import { runSandbox, SandboxError } from '@/lib/sandbox';
import { StudioError } from '@/lib/studio-ai';
import { sameOrigin, readBody } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Runs the saved code against the verification suite inside the in-process sandbox.
// The expected answers come from the challenge oracle, so hand-written code is checked
// against the truth even when the blueprint is unfinished.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const db = await serverClient(); const { data: { user } } = await db.auth.getUser();
    if (!user) throw new StudioError('Sign in to run your code.', 401);
    let payload; try { payload = await readBody(request, 1000); } catch { throw new StudioError('Invalid run request.', 400); }
    const body = z.object({ revision: z.number().int().min(0) }).strict().safeParse(payload);
    if (!body.success) throw new StudioError('Invalid run request.', 400);
    const { data: session, error } = await db.from('learning_sessions').select('code,blueprint_revision').eq('user_id', user.id).eq('challenge_id', 'contains-duplicate').single();
    if (error) throw new StudioError('Your saved code could not load.');
    if (session.blueprint_revision !== body.data.revision) throw new StudioError('Your code changed in another tab. Save before running.', 409);
    if (!session.code.trim()) throw new StudioError('Write or draft code before running tests.', 400);
    const quota = await adminClient().rpc('reserve_exercise_run', { p_user_id: user.id });
    if (quota.error) throw new StudioError(quota.error.message.includes('PLEASE_WAIT') ? 'Wait 10 seconds between code runs.' : quota.error.message.includes('DAILY_LIMIT') ? 'You reached the 50-run daily limit. Simulation remains available.' : 'Code run tracking is unavailable.', 429);
    const cases = verificationInputs().map((input, index) => ({ name: sampleCases[index]?.name || `Random input ${index - sampleCases.length + 1}`, input, expected: new Set(input).size < input.length }));
    const report = await runSandbox({ language: 'typescript', code: session.code, functionName: 'containsDuplicate', cases });
    return NextResponse.json({ ...report, summary: report.passed ? `All ${report.total} checks passed. They check behaviour on sample inputs, not a proof for every input.` : `${report.passedCount} of ${report.total} checks passed. Review the failing inputs and try again.` }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error instanceof StudioError ? error.status : error instanceof SandboxError ? 422 : 503;
    return NextResponse.json({ error: error instanceof StudioError || error instanceof SandboxError ? error.message : 'Code could not run. Please retry shortly.' }, { status });
  }
}
