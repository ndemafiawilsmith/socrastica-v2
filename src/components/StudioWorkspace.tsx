"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MotionConfig } from 'framer-motion';
import { ArrowRight, Check, Columns2, GitBranch, History, LayoutTemplate, LoaderCircle, Pause, Play, RotateCcw, Save, Settings2, SkipBack, SkipForward, Undo2, Redo2, Users, X, TriangleAlert } from 'lucide-react';
import Logo from '@/components/Logo';
import BlueprintCanvas, { type LoopStats } from '@/components/BlueprintCanvas';
import PacketStrip from '@/components/PacketStrip';
import SuiteGrid from '@/components/SuiteGrid';
import CodeWorkspace from '@/components/CodeWorkspace';
import TeachingRail from '@/components/TeachingRail';
import LearningJournal from '@/components/LearningJournal';
import { useBlueprintStudio } from '@/lib/use-blueprint-studio';
import { blueprintKey, simulate, simulateSuite, type Simulation, type Suite } from '@/lib/blueprint';
import { findChallenge, validateInput, verificationInputs, type Challenge } from '@/lib/challenges';
import { predictionChoices } from '@/lib/guidance';
import { displayValue, type Value } from '@/lib/values';
import '@xyflow/react/dist/style.css';

// Accepts JSON for every input kind, and raw text for text activities.
export function parseInput(challenge: Challenge, text: string): Value {
  let raw: unknown; try { raw = JSON.parse(text); } catch { if (challenge.inputKind === 'text') raw = text; else throw new Error(challenge.inputKind === 'list' ? 'Use a JSON list of numbers, like [1, 2, 3].' : 'Use a number.'); }
  return validateInput(challenge, raw);
}
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || !!target.closest('.monaco-editor, dialog[open]'));

export default function StudioWorkspace({ challengeId, guest }: { challengeId: string; guest: boolean }) {
  const challenge = findChallenge(challengeId)!;
  const studio = useBlueprintStudio(challenge, guest), settings = useRef<HTMLDialogElement>(null), journal = useRef<HTMLDialogElement>(null), join = useRef<HTMLDialogElement>(null);
  const [inputText, setInputText] = useState(JSON.stringify(challenge.sample)), [traceInput, setTraceInput] = useState<Value>(challenge.sample), [inputError, setInputError] = useState(''), [trace, setTrace] = useState<Simulation | null>(null), [cursor, setCursor] = useState(-1), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(650), [proof, setProof] = useState(''), [view, setView] = useState<'canvas' | 'split'>('canvas'), [autoDraft, setAutoDraft] = useState(false), [simulationNote, setSimulationNote] = useState(''), [problem, setProblem] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [predictionMode, setPredictionMode] = useState(true), [predictionResult, setPredictionResult] = useState<{ correct: boolean; expected: string } | null>(null), [counterInput, setCounterInput] = useState<Value | null>(null), [suite, setSuite] = useState<Suite | null>(null), [breakpoints, setBreakpoints] = useState<Set<string>>(new Set()), [joinCode, setJoinCode] = useState(''), [joinName, setJoinName] = useState(''), [joinError, setJoinError] = useState(''), [shareUrl, setShareUrl] = useState(''), [shareError, setShareError] = useState(''), [sharing, setSharing] = useState(false);
  const semanticKey = blueprintKey(studio.blueprint), generatedRef = useRef(''), runId = useRef(0), recordedRun = useRef(-1), pausedAt = useRef(-1);
  const frame = trace?.frames[cursor], isFinished = !!trace && cursor >= trace.frames.length - 1, choices = useMemo(() => predictionChoices(studio.blueprint, frame), [semanticKey, frame]); // eslint-disable-line react-hooks/exhaustive-deps
  const predict = predictionMode || !!studio.classroom?.require_prediction, locked = studio.busy || !!studio.preview, canDraft = proof === semanticKey, split = view === 'split';
  const waitingForPrediction = !playing && !!trace && !isFinished && predict && choices.length > 1 && !predictionResult;
  useEffect(() => { setTrace(null); setCursor(-1); setPlaying(false); setProof(''); setSimulationNote(''); setProblem(null); setPredictionResult(null); setCounterInput(null); setSuite(null); pausedAt.current = -1; }, [semanticKey]);
  useEffect(() => { setPredictionResult(null); }, [cursor, semanticKey]);
  useEffect(() => { if (studio.draft_hash) setView('split'); }, [studio.draft_hash]);
  useEffect(() => {
    if (!playing || !trace) return;
    if (cursor >= trace.frames.length - 1) { setPlaying(false); return; }
    if (predict && choices.length >= 2 && !predictionResult) { setPlaying(false); return; }
    // Breakpoints pause once per visit; Resume continues past the block.
    if (cursor > 0 && pausedAt.current !== cursor && breakpoints.has(trace.frames[cursor].nodeId)) { pausedAt.current = cursor; setPlaying(false); return; }
    const timer = setTimeout(() => setCursor(value => value + 1), speed); return () => clearTimeout(timer);
  }, [playing, cursor, trace, speed, predict, choices.length, predictionResult, breakpoints]);
  useEffect(() => {
    if (!trace || !isFinished) return; setPlaying(false);
    if (recordedRun.current !== runId.current) { recordedRun.current = runId.current; void studio.recordActivity({ kind: 'simulation', input: traceInput }).catch(() => {}); }
    if (!trace.passed) { setProof(''); setProblem(trace.nodeId || null); setSimulationNote(trace.error || 'This input did not reach the expected result.'); return; }
    const suite = simulateSuite(studio.blueprint, verificationInputs(challenge), challenge.oracle); setSuite(suite);
    if (!suite.passed) { setProof(''); setProblem(suite.nodeId || null); setCounterInput(suite.input ?? null); setSimulationNote(`${suite.error} ${suite.input !== undefined ? `Try ${displayValue(suite.input)}.` : ''}`); return; }
    setProof(semanticKey); setSimulationNote(`${suite.passedCount} sample inputs passed. Explain a decision, or draft the code when you’re ready.`);
    if (autoDraft && !studio.draft_hash && generatedRef.current !== semanticKey && !studio.busy && !studio.preview && !studio.classroom?.require_prediction && studio.classroom?.allow_code !== false && !guest) { generatedRef.current = semanticKey; setView('split'); void studio.generate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, isFinished, semanticKey, autoDraft, studio.busy, studio.preview]);
  function startSimulation(provided?: Value) {
    if (locked) return;
    try { const input = provided ?? parseInput(challenge, inputText);
      setInputText(JSON.stringify(input)); setTraceInput(input); setInputError(''); setSimulationNote(''); setProblem(null); setCounterInput(null); setPredictionResult(null); runId.current++; const result = simulate(studio.blueprint, input, { expected: challenge.oracle(input) }); setTrace(result); setCursor(result.frames.length ? 0 : -1); setPlaying(result.frames.length > 1);
      if (!result.frames.length) { setProblem(result.nodeId || null); setSimulationNote(result.error || 'This blueprint could not start.'); }
    } catch (error) { setInputError(error instanceof Error ? error.message : 'Use a valid input.'); }
  }
  function togglePlay() { if (locked) return; if (playing) setPlaying(false); else if (trace && !isFinished) setPlaying(true); else startSimulation(); }
  function forward() { setPlaying(false); if (predict && choices.length >= 2 && !predictionResult) return; setCursor(value => Math.min(value + 1, (trace?.frames.length || 1) - 1)); }
  function backward() { setPlaying(false); setCursor(value => Math.max(0, value - 1)); }
  // Space plays or pauses, the arrow keys step, unless the learner is typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === ' ') { event.preventDefault(); togglePlay(); }
      else if (event.key === 'ArrowRight' && trace && !isFinished && !locked) { event.preventDefault(); forward(); }
      else if (event.key === 'ArrowLeft' && trace && cursor > 0 && !locked) { event.preventDefault(); backward(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  // Loop passes so far and how far through the list the packet is, per loop block.
  const loopStats = useMemo<LoopStats | undefined>(() => {
    if (!trace || !frame || !Array.isArray(traceInput)) return undefined; const stats: LoopStats = {};
    for (const past of trace.frames.slice(0, cursor + 1)) if (studio.blueprint.nodes.find(node => node.id === past.nodeId)?.op === 'loop') stats[past.nodeId] = { passes: (stats[past.nodeId]?.passes || 0) + (past.current !== null && past.index > 0 ? 1 : 0), progress: traceInput.length ? Math.min(1, frame.index / traceInput.length) : 1 };
    return stats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, cursor, traceInput, semanticKey]);
  function toggleBreakpoint(id: string) { setBreakpoints(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function runTo(id: string) {
    let result = trace; if (!result || isFinished) { if (locked) return; try { const input = parseInput(challenge, inputText); setInputText(JSON.stringify(input)); setTraceInput(input); setInputError(''); setSimulationNote(''); setProblem(null); setCounterInput(null); setPredictionResult(null); runId.current++; result = simulate(studio.blueprint, input, { expected: challenge.oracle(input) }); setTrace(result); } catch (error) { setInputError(error instanceof Error ? error.message : 'Use a valid input.'); return; } }
    const from = result === trace ? cursor : -1, index = result.frames.findIndex((past, i) => i > from && past.nodeId === id);
    setPlaying(false); pausedAt.current = index; setCursor(index >= 0 ? index : result.frames.length - 1); if (index < 0) setSimulationNote('The packet never reaches that block on this input.');
  }
  async function share() {
    setSharing(true); setShareError(''); try { await studio.save(); const response = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: challenge.id, note: studio.blueprint_note.slice(0, 300) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setShareUrl(data.url); try { await navigator.clipboard.writeText(data.url); } catch { /* Clipboard may be unavailable; the link is shown. */ } }
    catch (error) { setShareError(error instanceof Error ? error.message : 'The share link could not be created.'); } finally { setSharing(false); }
  }
  async function answerPrediction(answer: string) {
    setPlaying(false); try { const result = await studio.recordActivity({ kind: 'prediction', input: traceInput, step: cursor, answer }); setPredictionResult({ correct: !!result.detail.correct, expected: String(result.detail.expected) }); } catch { /* Visible journal error retains the step. */ }
  }
  if (!studio.ready) return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"><Logo/><h1 className="text-2xl">{challenge.title}</h1><p role={studio.error ? 'alert' : 'status'} className="text-sm leading-7 text-mist">{studio.error || 'Opening your saved canvas…'}</p>{studio.error && <button className="primary" onClick={() => window.location.reload()}>Retry loading</button>}<Link href="/exercises" className="text-sm text-iris">All activities</Link></main>;
  const stage = studio.preview ? 'Review changes' : canDraft || studio.draft_hash ? 'Inspect code' : studio.blueprint.nodes.length > 1 ? 'Play & predict' : 'Explain your idea';
  const draftBlocked = studio.classroom?.allow_code === false ? 'Your instructor has paused code drafting for this activity.' : undefined;
  const activeNode = frame && !studio.preview ? studio.blueprint.nodes.find(node => node.id === frame.nodeId) : undefined;
  const feedback = studio.phase || (waitingForPrediction ? 'Choose the next branch in the guide, then continue.' : simulationNote) || (studio.preview ? 'Review the highlighted changes before applying them.' : canDraft && studio.classroom?.require_prediction && !studio.draft_hash ? 'Your class asks for one correct branch prediction before drafting code.' : 'Say your idea, connect a block, or click a block to understand its job.');
  return <MotionConfig reducedMotion="user"><div className="studio-shell">
    <header className="studio-header"><Link href="/" className="flex items-center gap-3"><Logo className="h-9 w-9"/><span className="text-lg font-semibold tracking-[-.045em]">socrastica<span className="text-iris">.</span></span><span className="ml-4 hidden border-l border-white/10 pl-5 font-mono text-[10px] text-mist xl:block">ARCHITECTURE STUDIO</span></Link><div className="flex items-center gap-2"><Link href="/exercises" className="secondary">Activities</Link><span role="status" className="hidden text-[10px] text-mist md:block">{studio.saveStatus}</span><button className="icon-button" disabled={studio.busy} onClick={() => void studio.save().catch(() => {})} aria-label="Save canvas"><Save size={16}/></button><button className="icon-button" aria-label="Open learning journal" onClick={() => { journal.current?.showModal(); void studio.refreshHistory().catch(() => {}); }}><History size={16}/></button>{guest ? <Link href={`/login?next=/learn/${challenge.id}`} className="primary">Sign in</Link> : <button className="studio-profile" aria-label="Open profile and settings" onClick={() => settings.current?.showModal()}>{studio.email?.slice(0, 2).toUpperCase()}<Settings2 size={13}/></button>}</div></header>
    <main className="studio-main">
      <div className="studio-titlebar"><div className="min-w-0"><p className="studio-crumb"><Link href="/exercises" className="hover:text-white">{challenge.category}</Link><span>·</span><span>{challenge.level}</span></p><h1 className="mt-1">{challenge.title}</h1></div>
        <div className="learning-path !pb-0" aria-label="Learning process">{['Explain your idea', 'Review changes', 'Play & predict', 'Inspect code'].map(label => <span key={label} aria-current={stage === label ? 'step' : undefined} className={stage === label ? 'path-current' : ''}>{label}</span>)}</div>
        <div className="ml-auto flex flex-wrap items-center gap-3"><div className="view-switch" role="group" aria-label="Studio view"><button aria-pressed={!split} onClick={() => setView('canvas')}><LayoutTemplate size={13}/>Blueprint</button><button aria-pressed={split} onClick={() => setView('split')}><Columns2 size={13}/>Blueprint + code</button></div>{guest ? <span className="text-[10px] text-mist">Guest practice</span> : <button className="secondary" onClick={() => join.current?.showModal()}><Users size={12}/>{studio.classroom ? studio.classroom.name : 'Join a class'}</button>}</div></div>
      <div className="studio-brief"><span className="brief-label">THE MISSION</span><p>{challenge.mission}</p><span className="brief-example"><code>{displayValue(challenge.sample)}</code><ArrowRight size={13}/><span className="text-mint">{displayValue(challenge.oracle(challenge.sample))}</span></span></div>
      {studio.error && <div role="alert" className="studio-alert"><TriangleAlert size={16}/><p className="flex-1">{studio.error}{guest && studio.error.startsWith('Sign in') && <> <Link href={`/login?next=/learn/${challenge.id}`} className="underline">Sign in</Link>.</>}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => studio.setError('')}><X size={14}/></button></div>}
      <div className="studio-stage">
        <section className="panel stage-panel" aria-label="Blueprint workspace">
          <div className="studio-toolbar"><div className="flex items-center gap-2"><GitBranch size={15} className="text-iris"/><span className="text-xs font-medium">{studio.preview ? 'Proposed blueprint' : 'Your blueprint'}</span><span className="hidden text-[10px] text-mist xl:inline">{split ? 'The canvas and the code follow the same packet.' : 'Click a block to explore it.'}</span></div><div className="flex gap-1"><button className="icon-button" aria-label="Undo last change" disabled={!studio.canUndo || studio.busy || playing} onClick={studio.undo}><Undo2 size={15}/></button><button className="icon-button" aria-label="Redo last change" disabled={!studio.canRedo || studio.busy || playing} onClick={studio.redo}><Redo2 size={15}/></button><button className="icon-button" aria-label="Reset playback" disabled={studio.busy} onClick={() => { setTrace(null); setCursor(-1); setPlaying(false); setSimulationNote(''); setProblem(null); }}><RotateCcw size={15}/></button></div></div>
          <PacketStrip input={trace ? traceInput : (() => { try { return parseInput(challenge, inputText); } catch { return challenge.sample; } })()} frame={studio.preview ? undefined : frame}/>
          <div className={`stage-body ${split ? 'with-code' : ''}`}>
            <BlueprintCanvas blueprint={studio.preview?.blueprint || studio.blueprint} library={challenge.library} compact={split} onChange={graph => { if (graph.nodes.length) studio.edit(graph); }} busy={locked || playing} frame={studio.preview ? undefined : frame} problemNode={problem || studio.focusNode} focusNode={studio.preview?.focusNode || studio.focusNode} focusToken={studio.focusToken} onSelect={setSelected} loopStats={studio.preview ? undefined : loopStats} breakpoints={breakpoints} onToggleBreakpoint={toggleBreakpoint} onRunTo={runTo} canRunTo={!locked}/>
            {split && <CodeWorkspace fileName={`${challenge.functionName}.ts`} selectedNodeId={selected} selectedNodeLabel={studio.blueprint.nodes.find(node => node.id === selected)?.label} activeNodeId={activeNode?.id ?? null} activeLabel={activeNode?.label} activeNote={frame?.note} code={studio.previewCode || studio.code} onChange={code => studio.edit(studio.blueprint, code)} onRun={studio.runTests} drafting={locked} phase={studio.phase} verified={!!studio.draft_hash} canDraft={canDraft} onDraft={() => void studio.generate()} draftBlocked={draftBlocked} autoDraft={autoDraft} onAutoDraft={setAutoDraft} guest={guest}/>}
          </div>
          <div className="transport"><label className="sr-only" htmlFor="simulation-input">Input packet</label><input id="simulation-input" value={inputText} disabled={playing || locked} onChange={e => { setInputText(e.target.value); setTrace(null); setCursor(-1); setSimulationNote(''); }} className="packet-input"/><select aria-label="Sample input" className="sample-select" disabled={playing || locked} value="" onChange={e => { const test = challenge.sampleCases[Number(e.target.value)]; setInputText(JSON.stringify(test.input)); setTrace(null); setCursor(-1); setSimulationNote(''); }}><option value="" disabled>Try an example</option>{challenge.sampleCases.map((test, index) => <option key={test.name + index} value={index}>{test.name}</option>)}</select>
            <button className="primary !bg-mint !border-mint/50" disabled={locked} onClick={togglePlay}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : trace && !isFinished ? 'Resume' : 'Simulate'}</button><button className="icon-button" disabled={!trace || cursor <= 0 || locked} aria-label="Step backward" onClick={backward}><SkipBack size={15}/></button><button className="icon-button" disabled={!trace || isFinished || locked} aria-label="Advance one simulation step" onClick={forward}><SkipForward size={15}/></button><select aria-label="Simulation speed" className="speed-select" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1000}>Slow</option><option value={650}>1×</option><option value={200}>Fast</option></select>
            <span className="transport-keys" aria-hidden="true"><kbd>space</kbd> play <kbd>←</kbd><kbd>→</kbd> step</span></div>
          {trace && trace.frames.length > 1 && <div className="trace-scrubber"><label htmlFor="trace-position">Step {cursor + 1} of {trace.frames.length}</label><input id="trace-position" type="range" min={0} max={trace.frames.length - 1} value={cursor} onChange={e => { setPlaying(false); setCursor(Number(e.target.value)); }} aria-label="Playback position"/><span className="text-mist">{frame?.note}</span></div>}
          {inputError && <p role="alert" className="px-5 pb-4 text-xs text-rose-300">{inputError}</p>}
          <div className="canvas-feedback" role="status">{canDraft ? <Check size={15} className="text-mint"/> : studio.busy ? <LoaderCircle size={15} className="animate-spin text-iris"/> : <Play size={15} className="text-iris"/>}<p>{feedback}</p>{counterInput !== null && <button className="secondary ml-auto" onClick={() => startSimulation(counterInput)}>Try failing case</button>}{canDraft && !split && !studio.draft_hash && !guest && <button className="primary ml-auto" onClick={() => setView('split')}>Open the code view <ArrowRight size={13}/></button>}</div>
          {suite && suite.results.length > 0 && <SuiteGrid results={suite.results.map((result, index) => ({ ...result, name: challenge.sampleCases[index]?.name }))} onSelect={input => startSimulation(input)} label="Verification inputs"/>}
        </section>
        <TeachingRail studio={studio} frame={frame} trace={trace} cursor={cursor} playing={playing} selected={selected} onReplay={() => startSimulation(counterInput ?? traceInput)} onPredict={answerPrediction} predictionResult={predictionResult} predictionMode={predict} setPredictionMode={setPredictionMode}/>
      </div>
      <footer className="studio-footer"><p>You own the idea. Every experiment makes it clearer.</p><Link href="/instructor" className="text-iris">Instructor workspace <ArrowRight size={12} className="inline"/></Link><span>Sample checks are evidence, not a proof.</span></footer>
    </main>
    <dialog ref={journal} className="teaching-dialog panel"><div className="mb-5 flex justify-end"><button className="icon-button" aria-label="Close learning journal" onClick={() => journal.current?.close()}><X size={17}/></button></div><LearningJournal events={studio.events} current={studio.blueprint} onRestore={graph => { studio.suggest({ blueprint: graph, title: 'Review an earlier version', explanation: 'Compare this version with your current idea. Apply it to restore the blueprint; code stays as it is.', focusNode: graph.nodes[0].id, baseKey: semanticKey }, 'history'); journal.current?.close(); }}/></dialog>
    <dialog ref={join} className="teaching-dialog panel max-w-lg"><div className="flex items-center justify-between"><h2 className="text-lg font-medium">Learn with your class</h2><button className="icon-button" aria-label="Close class dialog" onClick={() => join.current?.close()}><X size={17}/></button></div><p className="mt-4 text-xs leading-6 text-mist">Joining shares your blueprints, code, and future learning activity on every activity with this class’s instructor. Earlier private journal entries stay private. One class is active at a time.</p><form className="mt-5 grid gap-4" onSubmit={e => { e.preventDefault(); setJoinError(''); void studio.joinClass(joinCode.trim(), joinName.trim()).then(() => join.current?.close()).catch(error => setJoinError(error.message)); }}><label className="text-xs">Your name<input className="guide-textarea mt-2" value={joinName} maxLength={50} required onChange={e => setJoinName(e.target.value)}/></label><label className="text-xs">Class code<input className="guide-textarea mt-2 font-mono" value={joinCode} required onChange={e => setJoinCode(e.target.value)}/></label><button className="primary" disabled={studio.busy}>Join class and share this work</button>{joinError && <p role="alert" className="text-xs text-rose-300">{joinError}</p>}</form>{studio.classroom && <div className="mt-4"><p className="text-xs text-mist">Active class: {studio.classroom.name}</p><p className="mt-2 text-xs leading-6 text-mist">Return to private practice to stop sharing future work. Your instructor keeps evidence already shared.</p><button className="secondary mt-3" disabled={studio.busy} onClick={() => void studio.leaveClass().then(() => join.current?.close()).catch(error => setJoinError(error.message))}>Return to private practice</button></div>}</dialog>
    <dialog ref={settings} className="panel m-auto w-[calc(100%-2rem)] max-w-sm bg-[#181b2d] p-6 text-white backdrop:bg-black/70"><div className="flex items-center justify-between"><h2 className="text-lg font-medium">Your studio</h2><button className="icon-button" aria-label="Close settings" onClick={() => settings.current?.close()}><X size={17}/></button></div><p className="mt-5 break-all text-sm text-mist">{studio.email}</p><p className="mt-4 text-xs leading-6 text-mist">Your blueprint and learning journal save to your account. AI direction and code generation share the existing testing allowance. Explanations, repair previews, and simulation use no AI requests.</p><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-medium">Share this blueprint</p><p className="mt-2 text-[10px] leading-5 text-mist">Creates a public read-only snapshot of your saved blueprint and code that anyone with the link can replay. Later edits are not shared.</p><button className="secondary mt-3" disabled={sharing || studio.busy || studio.blueprint.nodes.length < 2} onClick={() => void share()}>{sharing ? 'Creating link…' : 'Create share link'}</button>{shareUrl && <p className="mt-2 break-all font-mono text-[10px] text-iris">{shareUrl} <span className="text-mist">· copied</span></p>}{shareError && <p role="alert" className="mt-2 text-xs text-rose-300">{shareError}</p>}</div><div className="mt-5 flex flex-wrap gap-2"><Link href="/progress" className="secondary">My progress</Link><button className="secondary" disabled={studio.busy} onClick={() => void studio.signOut()}>Save and sign out</button></div></dialog>
  </div></MotionConfig>;
}
