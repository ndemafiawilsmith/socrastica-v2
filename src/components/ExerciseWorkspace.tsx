"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { MotionConfig } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  Code2,
  GitBranch,
  Lightbulb,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Sparkles,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react';
import Logo from './Logo';
import ExerciseBlueprintCanvas from './ExerciseBlueprintCanvas';
import VoiceDirector from './VoiceDirector';
import { checkPlan, runPlan, validateInput, planKey, type Exercise, type Plan, type Value } from '@/lib/exercises';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
type Document = { plan: Plan; code: string; reflection: string; revision: number; verified: boolean };
const display = (value: Value | unknown) => JSON.stringify(value);

export default function ExerciseWorkspace({ exercise }: { exercise: Exercise }) {
  const [document, setDocument] = useState<Document>({ plan: [], code: '', reflection: '', revision: 0, verified: false });
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('Opening activity…');
  const [input, setInput] = useState(JSON.stringify(exercise.sample)), [trace, setTrace] = useState<ReturnType<typeof runPlan> | null>(null), [cursor, setCursor] = useState(0);
  const [checks, setChecks] = useState<ReturnType<typeof checkPlan> | null>(null), [hint, setHint] = useState(false), [showCode, setShowCode] = useState(false), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(650);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null), [previewNote, setPreviewNote] = useState('');
  const [codeResults, setCodeResults] = useState<{ input: unknown; expected: unknown; actual: unknown; passed: boolean }[] | null>(null), [history, setHistory] = useState<Document[]>([]);
  const current = useRef(document), dirty = useRef(false), saving = useRef<Promise<void>>(Promise.resolve()), revision = useRef(0), locked = useRef(false), mounted = useRef(true);
  current.current = document;
  const endpoint = `/api/exercises/${exercise.id}`;

  function accept(data: Document) { revision.current = data.revision; current.current = data; setDocument(data); dirty.current = false; setSaved('Progress saved'); }
  useEffect(() => {
    mounted.current = true;
    void fetch(endpoint, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (mounted.current) { accept(data); setReady(true); } }).catch(e => setError(e.message));
    return () => { mounted.current = false; };
  }, [endpoint]);
  useEffect(() => {
    if (!playing || !trace) return;
    if (cursor >= trace.frames.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setCursor(value => value + 1), speed);
    return () => clearTimeout(timer);
  }, [playing, cursor, trace, speed]);

  function change(next: Document) {
    if (locked.current) return;
    setHistory(items => [...items.slice(-29), current.current]);
    const planChanged = planKey(next.plan) !== planKey(current.current.plan), semantic = planChanged || next.code !== current.current.code;
    current.current = { ...next, verified: semantic ? false : next.verified };
    dirty.current = true; setDocument(current.current); setSaved('Unsaved changes');
    if (planChanged) { setTrace(null); setChecks(null); setPlaying(false); }
    if (semantic) setCodeResults(null);
    setError('');
  }
  function undo() {
    if (locked.current || !history.length) return;
    const previous = history.at(-1)!;
    setHistory(items => items.slice(0, -1));
    const planChanged = planKey(previous.plan) !== planKey(current.current.plan);
    current.current = { ...current.current, plan: previous.plan, code: previous.code, reflection: previous.reflection, verified: false };
    dirty.current = true; setDocument(current.current); setSaved('Unsaved changes'); setCodeResults(null); setError('');
    if (planChanged) { setTrace(null); setChecks(null); setPlaying(false); }
  }
  function save() {
    if (!dirty.current) return saving.current;
    const snapshot = current.current;
    const task = saving.current.catch(() => {}).then(async () => {
      setSaved('Saving…');
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: snapshot.plan, code: snapshot.code, reflection: snapshot.reflection, revision: revision.current }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      revision.current = data.revision;
      if (current.current === snapshot) accept(data); else setSaved('Unsaved changes');
    }).catch(e => { setSaved('Save failed'); setError(e.message); throw e; });
    saving.current = task; return task;
  }
  useEffect(() => { if (!ready || !dirty.current) return; const timer = setTimeout(() => void save().catch(() => {}), 900); return () => clearTimeout(timer); }, [document, ready]);
  useEffect(() => { const before = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); }; window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before); }, []);
  function leave(event: React.MouseEvent<HTMLAnchorElement>) { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (locked.current) { setError('Wait for the current check to finish before changing exercises.'); return; } void save().then(() => window.location.assign('/exercises')).catch(() => {}); }
  function simulate() { try { const value = validateInput(exercise, JSON.parse(input)), result = runPlan(document.plan, value); setTrace(result); setCursor(0); setChecks(checkPlan(exercise, document.plan)); setPlaying(result.frames.length > 1); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Enter a valid input.'); } }
  async function action(action: 'draft' | 'run') { if (locked.current) return; locked.current = true; setBusy(true); setError(''); try { await save(); const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (mounted.current) { setHistory(items => [...items.slice(-29), current.current]); accept(data.document); setCodeResults(data.results); setShowCode(true); } } catch (e) { setError(e instanceof Error ? e.message : 'The check could not finish.'); } finally { locked.current = false; if (mounted.current) setBusy(false); } }
  async function direct(direction: string) { if (locked.current) return; locked.current = true; setBusy(true); setError(''); try { await save(); const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'direct', direction, revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (mounted.current) { setPreviewPlan(data.previewPlan); setPreviewNote(data.note); } } catch (e) { setError(e instanceof Error ? e.message : 'The blueprint draft could not finish.'); throw e; } finally { locked.current = false; if (mounted.current) setBusy(false); } }

  if (!ready) return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"><Logo /><h1 className="text-2xl">Your architecture studio</h1><p role={error ? 'alert' : 'status'} className="text-sm leading-7 text-mist">{error || 'Opening your saved canvas…'}</p>{error && <button className="primary" onClick={() => window.location.reload()}>Retry loading</button>}<Link href="/exercises" className="text-sm text-iris">All exercises</Link></main>;

  const frame = trace?.frames[cursor], passed = !!checks?.length && checks.every(result => result.passed), finished = !!trace && cursor >= trace.frames.length - 1;
  const stage = previewPlan ? 'Review changes' : showCode || document.verified ? 'Inspect code' : passed ? 'Check examples' : trace ? 'Play & inspect' : 'Build your plan';
  const sampleResult = runPlan(exercise.solution, exercise.sample).result;
  const inputLabel = exercise.inputKind === 'list' ? 'Receive the list' : exercise.inputKind === 'text' ? 'Receive the text' : 'Receive the number';

  return <MotionConfig reducedMotion="user"><div className="studio-shell">
    <header className="studio-header">
      <Link href="/" className="flex items-center gap-3"><Logo className="h-9 w-9" /><span className="text-lg font-semibold tracking-[-.045em]">socrastica<span className="text-iris">.</span></span><span className="ml-4 hidden border-l border-white/10 pl-5 font-mono text-[10px] text-mist xl:block">ARCHITECTURE STUDIO</span></Link>
      <div className="flex items-center gap-2"><Link href="/exercises" onClick={leave} className="secondary">Exercises</Link><span role="status" className="hidden text-[10px] text-mist md:block">{saved}</span><button className="icon-button" disabled={busy} onClick={() => void save().catch(() => {})} aria-label="Save canvas"><Save size={16} /></button><span className="studio-profile" aria-label="Private practice">{exercise.category.slice(0, 2).toUpperCase()}</span></div>
    </header>
    <main className="studio-main">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 flex items-center gap-2 text-[10px] text-mist">{exercise.category} · {exercise.level} <ChevronRight size={12} /><span className="text-iris">{exercise.title}</span></p><h1 className="text-[clamp(1.8rem,3vw,2.7rem)] font-medium leading-tight tracking-[-.045em]">Build the idea. <span className="text-iris">Watch it work.</span></h1></div><button className="secondary" onClick={() => setShowCode(value => !value)}><Code2 size={13} />{showCode ? 'Hide code' : 'Show code'}</button></div>
      <div className="studio-brief"><span className="brief-label">THE MISSION</span><p>{exercise.goal}</p><span className="brief-example"><code>{display(exercise.sample)}</code><ArrowRight size={13} /><span className="text-mint">{display(sampleResult)}</span></span></div>
      <div className="learning-path" aria-label="Learning process">{['Build your plan', 'Review changes', 'Play & inspect', 'Check examples', 'Inspect code'].map(label => <span key={label} aria-current={stage === label ? 'step' : undefined} className={stage === label ? 'path-current' : ''}>{label}</span>)}<span className="ml-auto text-[10px]">Private practice</span></div>
      {error && <div role="alert" className="studio-alert"><TriangleAlert size={16} /><p className="flex-1">{error}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      <div className="teaching-workbench">
        <div className="min-w-0">
          <section className="panel studio-blueprint-panel" aria-label="Blueprint workspace">
            <div className="studio-toolbar"><div className="flex items-center gap-2"><GitBranch size={15} className="text-iris" /><span className="text-xs font-medium">Your blueprint</span><span className="hidden text-[10px] text-mist xl:inline">Click a block to change or move it.</span></div><div className="flex gap-1"><button className="icon-button" aria-label="Undo last change" disabled={busy || !history.length} onClick={undo}><Undo2 size={15} /></button><button className="icon-button" aria-label="Reset playback" disabled={busy} onClick={() => { setTrace(null); setCursor(0); setPlaying(false); }}><RotateCcw size={15} /></button></div></div>
            <ExerciseBlueprintCanvas plan={previewPlan || document.plan} inputLabel={inputLabel} onChange={plan => change({ ...current.current, plan })} busy={busy || playing || !!previewPlan} activeStep={previewPlan || frame?.step === -1 ? undefined : frame?.step} failedStep={previewPlan ? null : trace?.failedStep} />
            <div className="simulation-controls"><div className="flex min-w-0 flex-1 items-center gap-3"><label className="sr-only" htmlFor="simulation-input">Mock input packet</label><input id="simulation-input" value={input} disabled={playing || busy} onChange={event => { setInput(event.target.value); setTrace(null); setChecks(null); }} className="packet-input font-mono" /><select aria-label="Sample input" className="sample-select" disabled={playing || busy} value="" onChange={event => { setInput(JSON.stringify(exercise.cases[Number(event.target.value)])); setTrace(null); setChecks(null); }}><option value="" disabled>Try an example</option>{exercise.cases.slice(0, 8).map((value, index) => <option key={index} value={index}>{display(value)}</option>)}</select></div><button className="primary !border-mint/50 !bg-mint" disabled={busy || !document.plan.length} onClick={() => playing ? setPlaying(false) : trace && !finished ? setPlaying(true) : simulate()}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : trace && !finished ? 'Resume' : 'Simulate'}</button><button className="icon-button" disabled={!trace || cursor <= 0 || busy} aria-label="Step backward" onClick={() => { setPlaying(false); setCursor(value => Math.max(0, value - 1)); }}><SkipBack size={15} /></button><button className="icon-button" disabled={!trace || finished || busy} aria-label="Advance one simulation step" onClick={() => { setPlaying(false); setCursor(value => Math.min((trace?.frames.length || 1) - 1, value + 1)); }}><SkipForward size={15} /></button><select aria-label="Simulation speed" className="speed-select" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1000}>Slow</option><option value={650}>1×</option><option value={200}>Fast</option></select></div>
            {trace && trace.frames.length > 1 && <div className="trace-scrubber"><label htmlFor="trace-position">Step {cursor + 1} of {trace.frames.length}</label><input id="trace-position" type="range" min={0} max={trace.frames.length - 1} value={cursor} onChange={event => { setPlaying(false); setCursor(Number(event.target.value)); }} aria-label="Playback position" /><span className="text-mist">{frame?.note}</span></div>}
            <div className="canvas-feedback" role="status">{passed ? <Check size={15} className="text-mint" /> : <Play size={15} className="text-iris" />}<p>{passed ? `Your blueprint passed all ${checks?.length} examples. It is ready to become code.` : trace ? frame?.note : 'Add blocks, send a packet through them, and watch each value change.'}</p>{passed && <button className="secondary ml-auto" onClick={() => setShowCode(true)}>Inspect code</button>}</div>
          </section>
          {showCode && <section className="mt-5">
            <div className="code-reward"><p className="eyebrow text-iris">Your architecture becomes code</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-medium">Understand the path. Inspect the syntax.</h2><p className="mt-3 max-w-lg text-xs leading-6 text-mist">{document.verified ? 'Your code matched this blueprint and every sample.' : passed ? 'Your plan works. Let the drafter translate those exact blocks into TypeScript.' : 'Simulate a complete blueprint and pass the examples before drafting code.'}</p></div><button className="primary" disabled={busy || !passed} onClick={() => void action('draft')}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Braces size={14} />}Draft code</button></div></div>
            <section className="panel overflow-hidden"><Editor height="320px" language="typescript" theme="vs-dark" value={document.code} onChange={code => change({ ...current.current, code: code || '' })} options={{ readOnly: busy, minimap: { enabled: false }, fontSize: 13, padding: { top: 18 }, automaticLayout: true, scrollBeyondLastLine: false, ariaLabel: 'Exercise TypeScript editor' }} loading={<p className="p-6 text-xs text-mist">Loading code editor…</p>} /><div className="flex flex-wrap items-center justify-between gap-4 p-5"><p className="text-[10px] leading-5 text-mist">Plan simulation is free. AI drafting uses the shared testing allowance. Code runs are isolated.</p><button className="secondary" disabled={busy || !document.code.trim() || !passed} onClick={() => void action('run')}><Play size={13} />Run code tests</button></div>{codeResults && <><p role="status" className="px-5 pb-5 text-sm text-iris">{codeResults.filter(result => result.passed).length}/{codeResults.length} code examples passed.</p><div className="exercise-results">{codeResults.map((result, index) => <div key={index}><span className={result.passed ? 'text-mint' : 'text-rose-300'}>{result.passed ? 'Pass' : 'Repair'}</span><code>{display(result.input)} → {display(result.actual)}</code>{!result.passed && <p>Expected {display(result.expected)}.</p>}</div>)}</div></>}</section>
          </section>}
        </div>
        <aside className="teaching-rail" aria-label="Learning guide">
          <section className="guide-card"><p className="eyebrow flex items-center gap-2 text-iris"><Sparkles size={13} />{previewPlan ? 'Review the change' : 'Your next experiment'}</p><h2 className="mt-3 text-lg font-medium tracking-tight">{previewPlan ? 'Does this match your idea?' : !document.plan.length ? 'Choose the first useful step' : passed ? 'Your blueprint holds up' : trace?.error ? `Repair step ${(trace.failedStep ?? 0) + 1}` : trace ? 'Follow the changing value' : 'Send a sample through it'}</h2><p className="mt-3 text-xs leading-6 text-mist">{previewPlan ? previewNote : !document.plan.length ? exercise.hint : passed ? 'Every example reached the expected result. Open the code view when you are ready.' : trace?.error || 'Simulation highlights one block at a time so you can connect the step with its effect.'}</p>{previewPlan ? <div className="mt-4 flex flex-wrap gap-2"><button className="primary" onClick={() => { change({ ...current.current, plan: previewPlan }); setPreviewPlan(null); setPreviewNote(''); }}>Apply this draft</button><button className="secondary" onClick={() => { setPreviewPlan(null); setPreviewNote(''); }}>Keep my canvas</button></div> : <><button className="secondary mt-4" onClick={() => setHint(value => !value)}><Lightbulb size={13} />{hint ? 'Hide hint' : 'Show me a hint'}</button>{hint && <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-mist">{exercise.hint}</p>}</>}</section>
          <VoiceDirector reviewPending={!!previewPlan} busy={busy || !!previewPlan} playing={playing} note={previewNote} onDirect={direct} onPreview={() => {}} />
          <section className="guide-card"><p className="eyebrow flex items-center gap-2"><GitBranch size={13} />Inside your packet <span className="ml-auto font-mono text-[9px]">{frame ? `${cursor + 1}/${trace?.frames.length}` : 'READY'}</span></p><div className="runtime-values exercise-runtime-values"><div><span>Input</span><strong>{display(exercise.sample)}</strong></div><div><span>Current value</span><strong className="text-mint">{frame ? display(frame.value) : '—'}</strong></div><div><span>Result</span><strong>{finished && trace ? display(trace.result) : '—'}</strong></div></div><p className="mt-3 text-xs leading-6 text-mist">{frame?.note || 'Run a packet to see its value change at every block.'}</p>{trace?.error && <p className="mt-3 text-xs leading-6 text-rose-300">Step {(trace.failedStep ?? 0) + 1}: {trace.error}</p>}</section>
          {checks && <section className="guide-card"><p className="eyebrow text-iris">Sample checks</p><h3 className="mt-3 text-base font-medium">{checks.filter(result => result.passed).length}/{checks.length} examples passed</h3><div className="exercise-check-list">{checks.slice(0, 6).map((result, index) => <div key={index}><span className={result.passed ? 'text-mint' : 'text-rose-300'}>{result.passed ? 'Pass' : 'Repair'}</span><code>{display(result.input)} → {display(result.actual)}</code></div>)}</div></section>}
          <section className="guide-card"><label htmlFor="exercise-reflection" className="text-sm font-medium">Explain one decision</label><p className="mt-2 text-xs leading-6 text-mist">Why did you choose these blocks, and why are they in this order?</p><textarea id="exercise-reflection" rows={3} maxLength={1000} className="guide-textarea mt-3" placeholder="I chose this step because…" value={document.reflection} disabled={busy} onChange={event => change({ ...current.current, reflection: event.target.value })} /><button className="secondary mt-3" disabled={busy || !document.reflection.trim()} onClick={() => void save().catch(() => {})}><Save size={12} />Save my explanation</button></section>
        </aside>
      </div>
      <footer className="studio-footer"><p>You own the idea. Every experiment makes it clearer.</p><Link href="/exercises" onClick={leave} className="text-iris"><ArrowLeft size={12} className="inline" /> Choose another exercise</Link><span>Sample checks are evidence, not a proof.</span></footer>
    </main>
  </div></MotionConfig>;
}
