import { notFound } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { challenges, findChallenge } from '@/lib/challenges';
import StudioWorkspace from '@/components/StudioWorkspace';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const challenge = findChallenge(id);
  return { title: challenge ? `${challenge.title} — Socrastica` : 'Socrastica', description: challenge?.description };
}
export const dynamicParams = true;
export function generateStaticParams() { return challenges.map(challenge => ({ id: challenge.id })); }

// Guests get the full studio with browser-local state; signing in is only needed to save, draft code, or join a class.
export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const challenge = findChallenge(id); if (!challenge) notFound();
  const db = await serverClient(); const { data: { user } } = await db.auth.getUser();
  return <StudioWorkspace key={`${challenge.id}:${user ? 'account' : 'guest'}`} challengeId={challenge.id} guest={!user}/>;
}
