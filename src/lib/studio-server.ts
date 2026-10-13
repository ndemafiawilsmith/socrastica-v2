import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { serverClient, adminClient } from './supabase/server';
import { blueprintSchema, emptyBlueprint, type Blueprint } from './blueprint';
import { findChallenge, starterCode, type Challenge } from './challenges';
import { StudioError } from './studio-ai';
import { SandboxError } from './sandbox';
import { readBody, sameOrigin } from './http';

export type RouteContext = { params: Promise<{ challenge: string }> };
export type SessionRow = { blueprint: unknown; code: string; blueprint_revision: number; blueprint_note: string; draft_hash: string | null; classroom_id: string | null };

// Resolves the signed-in user and the challenge named in the route.
export async function openStudio(context: RouteContext, request?: NextRequest, signInMessage = 'Sign in to open your studio.') {
  if (request && !sameOrigin(request)) throw new StudioError('Invalid request origin.', 403);
  const { challenge: id } = await context.params;
  const challenge = findChallenge(id);
  if (!challenge) throw new StudioError('Activity not found.', 404);
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new StudioError(signInMessage, 401);
  return { db, user, challenge };
}

// Creates the session on first open, then returns it. Service role: class membership is copied in.
export async function openSession(userId: string, challenge: Challenge): Promise<SessionRow> {
  const result = await adminClient().rpc('open_studio_session', { p_user_id: userId, p_challenge_id: challenge.id, p_code: starterCode(challenge) });
  if (result.error || !result.data) throw new StudioError('Your saved canvas is unavailable. Retry loading it.');
  return result.data as SessionRow;
}

export async function loadSession(userId: string, challenge: Challenge): Promise<SessionRow> {
  const result = await adminClient().from('learning_sessions').select('blueprint,code,blueprint_revision,blueprint_note,draft_hash,classroom_id').eq('user_id', userId).eq('challenge_id', challenge.id).maybeSingle();
  if (result.error) throw new StudioError('Your saved canvas could not load.');
  if (!result.data) throw new StudioError('Open the activity before continuing.', 409);
  return result.data as SessionRow;
}

export const sessionBlueprint = (session: SessionRow): Blueprint => blueprintSchema.parse(session.blueprint || emptyBlueprint);

export async function readJson(request: NextRequest, limit: number) {
  try { return await readBody(request, limit); } catch { throw new StudioError('Invalid or oversized request.', 400); }
}

export function failure(error: unknown, fallback = 'The request could not finish. Please retry shortly.') {
  const known = error instanceof StudioError || error instanceof SandboxError;
  const status = error instanceof StudioError ? error.status : error instanceof SandboxError ? 422 : 503;
  return NextResponse.json({ error: known ? error.message : fallback }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
