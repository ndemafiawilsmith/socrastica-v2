import ExerciseLibrary from '@/components/ExerciseLibrary';
import { serverClient } from '@/lib/supabase/server';
export const metadata = { title: 'Activities — Socrastica', description: 'Practise money, numbers, lists, and text with visual blueprints you can simulate before they become code.' };
export default async function ExercisesPage() {
  const db = await serverClient(), { data: { user } } = await db.auth.getUser();
  const progress: { challenge_id: string; verified: boolean; started: boolean }[] = [];
  if (user) {
    const sessions = await db.from('learning_sessions').select('challenge_id,draft_hash,blueprint').eq('user_id', user.id);
    for (const session of sessions.data || []) progress.push({ challenge_id: session.challenge_id, verified: !!session.draft_hash, started: Array.isArray(session.blueprint?.nodes) && session.blueprint.nodes.length > 1 });
  }
  return <ExerciseLibrary progress={progress} signedIn={!!user}/>;
}
