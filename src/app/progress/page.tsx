import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Check, GraduationCap } from 'lucide-react';
import Logo from '@/components/Logo';
import { serverClient, adminClient } from '@/lib/supabase/server';
import { challenges } from '@/lib/challenges';
import ShareList from '@/components/ShareList';
export const metadata = { title: 'My progress — Socrastica' };
export const dynamic = 'force-dynamic';

// Every activity the learner touched, with its status, latest explanation, and instructor feedback.
export default async function ProgressPage() {
  const db = await serverClient(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect('/login?next=/progress');
  const admin = adminClient();
  const [sessions, reflections, membership] = await Promise.all([
    db.from('learning_sessions').select('challenge_id,blueprint,draft_hash,blueprint_note,updated_at,classroom_id').eq('user_id', user.id),
    db.from('studio_events').select('challenge_id,detail,created_at').eq('user_id', user.id).eq('kind', 'reflection').order('created_at', { ascending: false }).limit(200),
    admin.from('classroom_members').select('classroom_id,display_name').eq('user_id', user.id).eq('active', true).order('joined_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const classroom = membership.data ? await admin.from('classrooms').select('name').eq('id', membership.data.classroom_id).maybeSingle() : null;
  const feedback = membership.data ? await admin.from('classroom_feedback').select('note,rubric').eq('classroom_id', membership.data.classroom_id).eq('user_id', user.id).maybeSingle() : null;
  const started = (sessions.data || []).filter(session => Array.isArray(session.blueprint?.nodes) && session.blueprint.nodes.length > 1);
  const latestReflection = (id: string) => reflections.data?.find(event => event.challenge_id === id)?.detail as { text?: string } | undefined;
  const byCategory = ['Money', 'Numbers', 'Lists', 'Text'].map(category => ({ category, items: challenges.filter(challenge => challenge.category === category).map(challenge => ({ challenge, session: started.find(session => session.challenge_id === challenge.id) })) }));
  const verified = started.filter(session => session.draft_hash).length;
  return <div className="studio-shell"><header className="studio-header"><Link href="/" className="flex items-center gap-3"><Logo className="h-8 w-8"/><span className="font-semibold">socrastica.</span></Link><div className="flex items-center gap-2"><Link href="/exercises" className="secondary">Activities</Link><Link href="/instructor" className="secondary">Instructor</Link></div></header><main className="studio-main">
    <p className="eyebrow text-iris">My progress</p><h1 className="mt-4 text-3xl font-medium tracking-tight">The story so far.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-mist">{user.email} · {started.length} of {challenges.length} activities started · {verified} with code checked on sample inputs.</p>
    {classroom?.data && <section className="guide-card mt-6"><p className="eyebrow flex items-center gap-2 text-mint"><GraduationCap size={13}/>Your class</p><p className="mt-3 text-sm">{classroom.data.name} · joined as {membership.data?.display_name}</p>{feedback?.data ? <><p className="mt-3 text-xs leading-6 text-mist">{feedback.data.note || 'Your instructor has reviewed your progress.'}</p><div className="mt-2 text-xs text-mist">{Object.entries(feedback.data.rubric as Record<string, string>).map(([key, value]) => <p key={key}>{key.replace('_', ' ')}: {value}</p>)}</div></> : <p className="mt-3 text-xs text-mist">No feedback yet.</p>}</section>}
    {byCategory.map(group => <section key={group.category} className="mt-8"><h2 className="eyebrow text-iris">{group.category}</h2><div className="exercise-grid mt-4">{group.items.map(({ challenge, session }) => { const reflection = latestReflection(challenge.id); return <Link key={challenge.id} href={`/learn/${challenge.id}`} className="exercise-card glass"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium">{challenge.title}</span><span className="text-[10px] text-mist">{session?.draft_hash ? <span className="flex items-center gap-1 text-mint"><Check size={12}/>Code checked</span> : session ? 'In progress' : 'Not started'}</span></div>{session && <p className="mt-3 text-[10px] text-mist">{session.blueprint.nodes.length} blocks · updated {new Date(session.updated_at).toLocaleDateString()}</p>}{reflection?.text && <p className="mt-3 text-xs leading-6 text-mist">“{reflection.text.slice(0, 160)}{reflection.text.length > 160 ? '…' : ''}”</p>}{session?.blueprint_note && <p className="mt-3 text-[10px] leading-5 text-iris">{session.blueprint_note.slice(0, 120)}</p>}<span className="mt-auto flex items-center gap-2 pt-5 text-xs text-iris">{session ? 'Continue' : 'Start'}<ArrowRight size={13}/></span></Link>; })}</div></section>)}
    <section className="mt-10"><ShareList/></section>
    <footer className="studio-footer"><p>Sample checks are evidence of progress, not an automated grade.</p><Link href="/exercises" className="text-iris">All activities <ArrowRight size={12} className="inline"/></Link></footer>
  </main></div>;
}
