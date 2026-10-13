import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/server';
import { blueprintSchema, emptyBlueprint, blueprintKey } from '@/lib/blueprint';
import { learningContext } from '@/lib/teaching-server';
import { StudioError } from '@/lib/studio-ai';
import { failure, loadSession, ok, openSession, openStudio, readJson, type RouteContext } from '@/lib/studio-server';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user, challenge } = await openStudio(context, undefined, 'Sign in to open your canvas.');
    const session = await openSession(user.id, challenge);
    return ok({ ...session, blueprint: session.blueprint || emptyBlueprint, email: user.email, ...await learningContext(user.id, session.classroom_id) });
  } catch (error) { return failure(error, 'Your saved canvas is unavailable. Retry loading it.'); }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user, challenge } = await openStudio(context, request, 'Sign in to save your canvas.');
    const body = z.object({ blueprint: blueprintSchema, code: z.string().max(15000), revision: z.number().int().min(0) }).strict().safeParse(await readJson(request, 75000));
    if (!body.success) throw new StudioError('Invalid or oversized canvas.', 400);
    const session = await loadSession(user.id, challenge);
    if (session.blueprint_revision !== body.data.revision) throw new StudioError('This canvas changed in another tab. Reload to keep the latest version.', 409);
    const sameBlueprint = blueprintKey(blueprintSchema.parse(session.blueprint || emptyBlueprint)) === blueprintKey(body.data.blueprint);
    const same = sameBlueprint && session.code === body.data.code;
    const { data: saved, error } = await adminClient().rpc('save_studio_canvas', { p_user_id: user.id, p_challenge_id: challenge.id, p_blueprint: body.data.blueprint, p_code: body.data.code, p_revision: body.data.revision, p_same_blueprint: sameBlueprint, p_same_draft: same });
    if (error || !saved) throw new StudioError(error?.message.includes('REVISION_CONFLICT') ? 'The canvas changed while saving. Reload before continuing.' : 'Your canvas and journal could not save. Retry saving before closing.', error?.message.includes('REVISION_CONFLICT') ? 409 : 503);
    return ok(saved);
  } catch (error) { return failure(error, 'Your canvas could not be saved. Retry saving before closing.'); }
}
