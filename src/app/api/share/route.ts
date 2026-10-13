import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { serverClient, adminClient } from '@/lib/supabase/server';
import { findChallenge } from '@/lib/challenges';
import { sameOrigin, readBody } from '@/lib/http';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const token = () => { const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'; return Array.from(randomBytes(12), byte => alphabet[byte % alphabet.length]).join(''); };

export async function GET() {
  const db = await serverClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: 'Sign in to see your shared blueprints.' }, { status: 401 });
  const result = await db.from('blueprint_shares').select('token,challenge_id,note,verified,created_at,revoked_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  return result.error ? NextResponse.json({ error: 'Shares could not load.' }, { status: 503 }) : NextResponse.json({ shares: result.data }, { headers });
}

// Snapshots the saved blueprint and code for a challenge into a public read-only link.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const db = await serverClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: 'Sign in to share a blueprint.' }, { status: 401 });
  let payload; try { payload = await readBody(request, 2000); } catch { return NextResponse.json({ error: 'Invalid share request.' }, { status: 400 }); }
  const body = z.object({ challenge: z.string().max(80), note: z.string().trim().max(300).default('') }).strict().safeParse(payload);
  if (!body.success || !findChallenge(body.data.challenge)) return NextResponse.json({ error: 'Invalid share request.' }, { status: 400 });
  const result = await adminClient().rpc('create_blueprint_share', { p_user_id: user.id, p_challenge_id: body.data.challenge, p_token: token(), p_note: body.data.note });
  if (result.error) return NextResponse.json({ error: result.error.message.includes('NOTHING_TO_SHARE') ? 'Save a blueprint before sharing it.' : result.error.message.includes('SHARE_LIMIT') ? 'You created 20 share links today. Reuse one of them.' : 'The share link could not be created.' }, { status: result.error.message.includes('SHARE_LIMIT') ? 429 : result.error.message.includes('NOTHING') ? 409 : 503 });
  return NextResponse.json({ ...result.data, url: `${new URL(process.env.NEXT_PUBLIC_APP_URL!).origin}/share/${result.data.token}` }, { status: 201, headers });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const db = await serverClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: 'Sign in to revoke a share.' }, { status: 401 });
  const share = z.string().regex(/^[a-z0-9]{12}$/).safeParse(request.nextUrl.searchParams.get('token'));
  if (!share.success) return NextResponse.json({ error: 'Invalid share token.' }, { status: 400 });
  const result = await adminClient().from('blueprint_shares').update({ revoked_at: new Date().toISOString() }).eq('token', share.data).eq('user_id', user.id).select('token').maybeSingle();
  if (result.error) return NextResponse.json({ error: 'The share could not be revoked.' }, { status: 503 });
  if (!result.data) return NextResponse.json({ error: 'Share not found.' }, { status: 404 });
  return NextResponse.json({ revoked: true }, { headers });
}
