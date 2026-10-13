import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/server';
import { runChallengeCode } from '@/lib/blueprint-code';
import { StudioError } from '@/lib/studio-ai';
import { failure, loadSession, ok, openStudio, readJson, type RouteContext } from '@/lib/studio-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Runs the saved code against the verification suite inside the in-process sandbox.
// Expected answers come from the challenge oracle, so hand-written code is checked
// against the truth even when the blueprint is unfinished.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, challenge } = await openStudio(context, request, 'Sign in to run your code.');
    const body = z.object({ revision: z.number().int().min(0) }).strict().safeParse(await readJson(request, 1000));
    if (!body.success) throw new StudioError('Invalid run request.', 400);
    const session = await loadSession(user.id, challenge);
    if (session.blueprint_revision !== body.data.revision) throw new StudioError('Your code changed in another tab. Save before running.', 409);
    if (!session.code.trim()) throw new StudioError('Write or draft code before running tests.', 400);
    const quota = await adminClient().rpc('reserve_exercise_run', { p_user_id: user.id });
    if (quota.error) throw new StudioError(quota.error.message.includes('PLEASE_WAIT') ? 'Wait 10 seconds between code runs.' : quota.error.message.includes('DAILY_LIMIT') ? 'You reached the 50-run daily limit. Simulation remains available.' : 'Code run tracking is unavailable.', 429);
    const report = await runChallengeCode(session.code, challenge);
    return ok({ ...report, summary: report.passed ? `All ${report.total} checks passed. They check behaviour on sample inputs, not a proof for every input.` : `${report.passedCount} of ${report.total} checks passed. Review the failing inputs and try again.` });
  } catch (error) { return failure(error, 'Code could not run. Please retry shortly.'); }
}
