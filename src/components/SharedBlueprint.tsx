"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Pause, Play, SkipBack, SkipForward, Check, Code2 } from 'lucide-react';
import Logo from './Logo';
import BlueprintCanvas, { type LoopStats } from './BlueprintCanvas';
import PacketStrip from './PacketStrip';
import { simulate, type Blueprint, type Simulation } from '@/lib/blueprint';
import { findChallenge } from '@/lib/challenges';
import { parseInput } from './StudioWorkspace';
import { displayValue, type Value } from '@/lib/values';
import '@xyflow/react/dist/style.css';

type Props = { challengeId: string; blueprint: Blueprint; code: string; note: string; verified: boolean; createdAt: string };
export default function SharedBlueprint({ challengeId, blueprint, code, note, verified, createdAt }: Props) {
  const challenge = findChallenge(challengeId)!;
  const [inputText, setInputText] = useState(JSON.stringify(challenge.sample)), [input, setInput] = useState<Value>(challenge.sample), [trace, setTrace] = useState<Simulation | null>(null), [cursor, setCursor] = useState(-1), [playing, setPlaying] = useState(false), [error, setError] = useState(''), [showCode, setShowCode] = useState(false);
  const frame = trace?.frames[cursor], finished = !!trace && cursor >= trace.frames.length - 1;
  useEffect(() => { if (!playing || !trace) return; if (cursor >= trace.frames.length - 1) { setPlaying(false); return; } const timer = setTimeout(() => setCursor(value => value + 1), 650); return () => clearTimeout(timer); }, [playing, cursor, trace]);
  function start() {
    try { const value = parseInput(challenge, inputText); setInput(value); setInputText(JSON.stringify(value)); setError(''); const result = simulate(blueprint, value, { expected: challenge.oracle(value) }); setTrace(result); setCursor(result.frames.length ? 0 : -1); setPlaying(result.frames.length > 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Use a valid input.'); }
  }
  const loopStats = useMemo<LoopStats | undefined>(() => {
    if (!trace || !frame || !Array.isArray(input)) return undefined; const stats: LoopStats = {};
    for (const past of trace.frames.slice(0, cursor + 1)) if (blueprint.nodes.find(node => node.id === past.nodeId)?.op === 'loop') stats[past.nodeId] = { passes: (stats[past.nodeId]?.passes || 0) + (past.current !== null && past.index > 0 ? 1 : 0), progress: input.length ? Math.min(1, frame.index / input.length) : 1 };
    return stats;
  }, [trace, cursor, input, frame, blueprint.nodes]);
  return <div className="studio-shell">
    <header className="studio-header"><Link href="/" className="flex items-center gap-3"><Logo className="h-9 w-9"/><span className="text-lg font-semibold tracking-[-.045em]">socrastica<span className="text-iris">.</span></span><span className="ml-4 hidden border-l border-white/10 pl-5 font-mono text-[10px] text-mist xl:block">SHARED BLUEPRINT</span></Link><div className="flex items-center gap-2"><Link href={`/learn/${challenge.id}`} className="primary">Build your own <ArrowRight size={13}/></Link></div></header>
    <main className="studio-main">
      <p className="mb-3 flex items-center gap-2 text-[10px] text-mist">{challenge.category} · {challenge.level} <span className="text-iris">{challenge.title}</span> · shared {new Date(createdAt).toLocaleDateString()}</p>
      <h1 className="text-[clamp(1.8rem,3vw,2.7rem)] font-medium leading-tight tracking-[-.045em]">Someone’s idea, <span className="text-iris">ready to replay.</span></h1>
      {note && <p className="mt-4 max-w-2xl text-sm leading-7 text-mist">“{note}”</p>}
      <div className="studio-brief mt-5"><span className="brief-label">THE MISSION</span><p>{challenge.mission}</p><span className="brief-example"><code>{displayValue(challenge.sample)}</code><ArrowRight size={13}/><span className="text-mint">{displayValue(challenge.oracle(challenge.sample))}</span></span></div>
      {error && <p role="alert" className="studio-alert">{error}</p>}
      <section className="panel studio-blueprint-panel mt-5" aria-label="Shared blueprint">
        <div className="studio-toolbar"><span className="text-xs font-medium">Read-only blueprint</span><span className="text-[10px] text-mist">{verified ? <span className="flex items-center gap-1 text-mint"><Check size={12}/>Code checked on sample inputs</span> : 'Code not yet checked'}</span></div>
        <PacketStrip input={input} frame={frame}/>
        <BlueprintCanvas blueprint={blueprint} library={[]} onChange={() => {}} busy readOnly frame={frame} loopStats={loopStats}/>
        <div className="simulation-controls"><div className="flex min-w-0 flex-1 items-center gap-3"><label className="sr-only" htmlFor="share-input">Input packet</label><input id="share-input" value={inputText} disabled={playing} onChange={e => { setInputText(e.target.value); setTrace(null); setCursor(-1); }} className="packet-input"/><select aria-label="Sample input" className="sample-select" disabled={playing} value="" onChange={e => { setInputText(JSON.stringify(challenge.sampleCases[Number(e.target.value)].input)); setTrace(null); setCursor(-1); }}><option value="" disabled>Try an example</option>{challenge.sampleCases.map((test, index) => <option key={test.name + index} value={index}>{test.name}</option>)}</select></div>
          <button className="primary !bg-mint !border-mint/50" onClick={() => playing ? setPlaying(false) : trace && !finished ? setPlaying(true) : start()}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : trace && !finished ? 'Resume' : 'Simulate'}</button><button className="icon-button" disabled={!trace || cursor <= 0} aria-label="Step backward" onClick={() => { setPlaying(false); setCursor(v => Math.max(0, v - 1)); }}><SkipBack size={15}/></button><button className="icon-button" disabled={!trace || finished} aria-label="Step forward" onClick={() => { setPlaying(false); setCursor(v => Math.min(v + 1, (trace?.frames.length || 1) - 1)); }}><SkipForward size={15}/></button></div>
        {trace && trace.frames.length > 1 && <div className="trace-scrubber"><label htmlFor="share-position">Step {cursor + 1} of {trace.frames.length}</label><input id="share-position" type="range" min={0} max={trace.frames.length - 1} value={cursor} onChange={e => { setPlaying(false); setCursor(Number(e.target.value)); }} aria-label="Playback position"/><span className="text-mist">{frame?.note}</span></div>}
        <div className="canvas-feedback" role="status"><Play size={15} className="text-iris"/><p>{trace && finished ? (trace.passed ? `This input reached the expected answer ${displayValue(trace.result)}.` : trace.error || 'This input did not reach the expected answer.') : 'Send an input through the blueprint and watch each block work.'}</p></div>
      </section>
      {code.trim() && <section className="mt-5 panel"><div className="panel-title"><Code2 size={16} className="text-iris"/> The code behind it <button className="secondary ml-auto" onClick={() => setShowCode(v => !v)}>{showCode ? 'Hide' : 'Show'}</button></div>{showCode && <pre className="max-h-96 overflow-auto p-5 text-xs leading-6">{code}</pre>}</section>}
      <footer className="studio-footer"><p>Shared blueprints are snapshots; the owner keeps editing their own copy.</p><Link href="/exercises" className="text-iris">All activities <ArrowRight size={12} className="inline"/></Link><span>Sample checks are evidence, not a proof.</span></footer>
    </main>
  </div>;
}
