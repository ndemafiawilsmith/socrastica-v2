import { NextRequest } from 'next/server';
import { z } from 'zod';
import { blueprintKey, simulate, simulateSuite } from '@/lib/blueprint';
import { inputSchema, validateInput, verificationInputs } from '@/lib/challenges';
import { predictionChoices } from '@/lib/guidance';
import { recordEvent } from '@/lib/teaching-server';
import { StudioError } from '@/lib/studio-ai';
import { failure, loadSession, ok, openStudio, readJson, sessionBlueprint, type RouteContext } from '@/lib/studio-server';
export const dynamic = 'force-dynamic';

const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('prediction'), revision: z.number().int().min(0), input: inputSchema, step: z.number().int().min(0).max(20000), answer: z.string().min(1).max(40) }).strict(),
  z.object({ kind: z.literal('simulation'), revision: z.number().int().min(0), input: inputSchema }).strict(),
  z.object({ kind: z.literal('reflection'), revision: z.number().int().min(0), text: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ kind: z.literal('hint'), revision: z.number().int().min(0), action: z.enum(['why', 'preview', 'applied', 'example', 'mistake']), title: z.string().max(100) }).strict(),
]);

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { db, user, challenge } = await openStudio(context, undefined, 'Sign in to view your learning journal.');
    const result = await db.from('studio_events').select('id,kind,detail,blueprint,revision,created_at,challenge_id').eq('user_id', user.id).eq('challenge_id', challenge.id).order('created_at', { ascending: false }).limit(100);
    if (result.error) throw new StudioError('Your journal could not load.');
    return ok({ events: result.data });
  } catch (error) { return failure(error, 'Your journal could not load.'); }
}

// Predictions and simulations are checked on the server against the saved graph, so the journal is evidence.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, challenge } = await openStudio(context, request, 'Sign in to save learning evidence.');
    const parsed = eventSchema.safeParse(await readJson(request, 8000));
    if (!parsed.success) throw new StudioError('Invalid activity.', 400);
    const body = parsed.data;
    const session = await loadSession(user.id, challenge);
    if (session.blueprint_revision !== body.revision) throw new StudioError('Your blueprint changed. Try this activity on the saved version.', 409);
    const graph = sessionBlueprint(session);
    let detail: Record<string, unknown>;
    if (body.kind === 'prediction') {
      let input; try { input = validateInput(challenge, body.input); } catch (error) { throw new StudioError(error instanceof Error ? error.message : 'Invalid input.', 400); }
      const trace = simulate(graph, input, { expected: challenge.oracle(input) }), frame = trace.frames[body.step], choices = predictionChoices(graph, frame);
      if (!frame || choices.length < 2 || !choices.some(choice => choice.answer === body.answer) || !trace.frames[body.step + 1]) throw new StudioError('Choose a branch on a valid simulation step.', 400);
      const correct = body.answer === trace.frames[body.step + 1].nodeId;
      detail = { input, step: body.step, nodeId: frame.nodeId, answer: body.answer, correct, expected: trace.frames[body.step + 1].nodeId, graphKey: blueprintKey(graph) };
    } else if (body.kind === 'simulation') {
      let input; try { input = validateInput(challenge, body.input); } catch (error) { throw new StudioError(error instanceof Error ? error.message : 'Invalid input.', 400); }
      const trace = simulate(graph, input, { expected: challenge.oracle(input) }), suite = simulateSuite(graph, verificationInputs(challenge), challenge.oracle);
      detail = { input, passed: trace.passed, error: trace.error || null, nodeId: trace.nodeId || null, suitePassed: suite.passed, passedCount: suite.passedCount, total: suite.total, graphKey: blueprintKey(graph) };
    } else if (body.kind === 'reflection') detail = { text: body.text };
    else detail = { action: body.action, title: body.title };
    const id = await recordEvent(user.id, challenge.id, body.kind, detail, body.kind === 'simulation' ? graph : null, body.revision);
    return ok({ id, detail });
  } catch (error) { return failure(error, 'Your activity could not be saved.'); }
}
