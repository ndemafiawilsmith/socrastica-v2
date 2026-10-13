import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/supabase/server';
import { blueprintSchema } from '@/lib/blueprint';
import { findChallenge } from '@/lib/challenges';
import SharedBlueprint from '@/components/SharedBlueprint';
export const dynamic = 'force-dynamic';

async function loadShare(token: string) {
  if (!/^[a-z0-9]{12}$/.test(token)) return null;
  const result = await adminClient().from('blueprint_shares').select('challenge_id,blueprint,code,note,verified,created_at,revoked_at').eq('token', token).maybeSingle();
  if (result.error || !result.data || result.data.revoked_at) return null;
  const challenge = findChallenge(result.data.challenge_id); const blueprint = blueprintSchema.safeParse(result.data.blueprint);
  if (!challenge || !blueprint.success) return null;
  return { challenge, blueprint: blueprint.data, code: result.data.code as string, note: result.data.note as string, verified: result.data.verified as boolean, created_at: result.data.created_at as string };
}
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token);
  return { title: share ? `${share.challenge.title} blueprint — Socrastica` : 'Shared blueprint — Socrastica', description: share?.note || share?.challenge.description, robots: { index: false } };
}
// A public, read-only snapshot. Anyone with the link can replay the packet through it.
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token); if (!share) notFound();
  return <SharedBlueprint challengeId={share.challenge.id} blueprint={share.blueprint} code={share.code} note={share.note} verified={share.verified} createdAt={share.created_at}/>;
}
