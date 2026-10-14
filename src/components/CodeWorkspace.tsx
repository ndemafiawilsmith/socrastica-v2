"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Braces, Play, LoaderCircle, Check, Code2, Sparkles } from "lucide-react";
import type { editor } from 'monaco-editor';
import SuiteGrid from './SuiteGrid';
import { displayValue, type Value } from '@/lib/values';

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
export type RunResult = { name?: string; input: unknown; expected: unknown; actual: unknown; passed: boolean; error?: string };
export type RunReport = { passed: boolean; passedCount: number; total: number; summary: string; results: RunResult[] };
type Props = {
  code: string; onChange: (code: string) => void; onRun: () => Promise<RunReport>;
  drafting?: boolean; selectedNodeId?: string | null; activeNodeId?: string | null; activeLabel?: string; activeNote?: string; selectedNodeLabel?: string; fileName?: string;
  // Drafting controls live in the pane header so code and canvas stay side by side.
  verified?: boolean; canDraft?: boolean; onDraft?: () => void; draftBlocked?: string; phase?: string;
  autoDraft?: boolean; onAutoDraft?: (value: boolean) => void; guest?: boolean;
};

// The code pane: one window onto the same packet as the canvas. It fills the height it is given.
export default function CodeWorkspace({ code, onChange, onRun, drafting = false, selectedNodeId, activeNodeId, activeLabel, activeNote, selectedNodeLabel, fileName = 'solution.ts', verified = false, canDraft = false, onDraft, draftBlocked, phase, autoDraft = false, onAutoDraft, guest = false }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null), decorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  // During playback the packet's current block wins; otherwise the block the student selected.
  const highlightId = activeNodeId || selectedNodeId;
  const lines = code.split('\n'), marker = highlightId ? lines.findIndex(line => line.trim() === `// node: ${highlightId}`) : -1;
  useEffect(() => {
    decorations.current?.clear(); if (!editorRef.current || marker < 0) return;
    let end = lines.findIndex((line, index) => index > marker && line.trim().startsWith('// node: ')); if (end < 0) end = lines.length;
    decorations.current = editorRef.current.createDecorationsCollection([{ range: { startLineNumber: marker + 1, startColumn: 1, endLineNumber: end, endColumn: 1 }, options: { isWholeLine: true, className: activeNodeId ? 'blueprint-code-active' : 'blueprint-code-focus' } }]);
    if (activeNodeId) editorRef.current.revealLineInCenterIfOutsideViewport(marker + 1); else editorRef.current.revealLineInCenter(marker + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, highlightId, activeNodeId, editorReady]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { setReport(null); setError(""); }, [code]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run() {
    setBusy(true); setError(""); setReport(null);
    try { const result = await onRun(); if (mounted.current) setReport(result); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Code could not run.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  const hasMarkers = lines.some(line => line.trim().startsWith('// node: '));
  const status = drafting && phase ? phase : verified ? 'Matched your blueprint on 40 inputs' : hasMarkers ? 'Edited since the last check' : 'Not drafted yet';
  const firstFailure = report?.results.find(result => !result.passed);
  return <section className="code-pane" aria-label="Code workspace">
    <div className="code-pane-head">
      <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-iris"><Braces size={14}/><span className="truncate">{fileName}</span></span>
      <span className={`code-status ${verified ? 'is-verified' : ''}`}>{verified && <Check size={11}/>}{status}</span>
      <div className="ml-auto flex items-center gap-2">
        <button className="secondary" onClick={run} disabled={busy || drafting || !code.trim() || guest} title={guest ? 'Sign in to run code in the sandbox' : 'Run your code on the 40 verification inputs'}>{busy ? <LoaderCircle size={13} className="animate-spin"/> : <Play size={13}/>}{busy ? 'Running…' : 'Run tests'}</button>
        {onDraft && <button className="primary" disabled={!canDraft || drafting || guest || !!draftBlocked} onClick={onDraft} title={draftBlocked || (guest ? 'Sign in to draft code with AI' : !canDraft ? 'Simulate a blueprint that passes all 40 inputs first' : 'Let the drafter write this blueprint as code')}>{drafting ? <LoaderCircle size={13} className="animate-spin"/> : <Sparkles size={13}/>}Draft code</button>}
      </div>
    </div>
    <div className="code-pane-context" aria-live="polite">
      {activeNodeId ? <><span className="packet-dot !ml-0"/><span className="truncate"><b className="text-mint">{activeLabel || activeNodeId}</b>{activeNote ? ` · ${activeNote}` : ''}</span>{marker < 0 && hasMarkers && <span className="text-mist">· no code for this block</span>}{!hasMarkers && <span className="text-mist">· draft code to follow the packet here</span>}</>
        : highlightId ? <span className="truncate">{marker >= 0 ? `Code for “${selectedNodeLabel || selectedNodeId}”` : hasMarkers ? 'No code for this block' : 'AI drafts carry block markers so you can follow the packet through the code.'}</span>
        : <span className="text-mist">{draftBlocked || (guest ? 'Sign in to draft code from your blueprint and run it in the sandbox.' : canDraft ? 'Your blueprint passed. Draft the code, then play the packet to see each block in code.' : 'Pass the simulation first, then the drafter follows your connections exactly.')}</span>}
      {onAutoDraft && !guest && <label className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-mist"><input type="checkbox" checked={autoDraft} disabled={!!draftBlocked} onChange={e => onAutoDraft(e.target.checked)}/>Auto-draft when it passes</label>}
    </div>
    <div className="code-pane-editor">
      <Editor onMount={instance => { editorRef.current = instance; setEditorReady(true); }} height="100%" language="typescript" value={code} onChange={value => { onChange(value ?? ""); setReport(null); }} theme="socrastica" loading={<p className="p-8 text-sm text-mist">Loading editor…</p>} beforeMount={monaco => monaco.editor.defineTheme("socrastica", { base: "vs-dark", inherit: true, rules: [{ token: "comment", foreground: "747b98" }, { token: "keyword", foreground: "B5A3FF" }], colors: { "editor.background": "#111320", "editor.foreground": "#D9DCEF", "editorLineNumber.foreground": "#555B76", "editor.selectionBackground": "#B5A3FF30", "editor.lineHighlightBackground": "#FFFFFF04" } })} options={{ readOnly: busy || drafting, minimap: { enabled: false }, fontSize: 13, lineHeight: 24, padding: { top: 16 }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: "on", ariaLabel: "TypeScript code editor" }}/>
    </div>
    {(error || report) && <div className="code-pane-results" role="status">
      {error && <p className="text-xs leading-5 text-rose-300">{error}</p>}
      {report && <><p className={`text-xs ${report.passed ? 'text-mint' : 'text-iris'}`}>{report.summary}</p><SuiteGrid results={report.results.map(result => ({ input: result.input as Value, passed: result.passed, name: result.name }))} label="Code checks"/>{firstFailure && <p className="mt-1 text-[11px] leading-5 text-mist">First failure: {firstFailure.name || 'input'} <code>{displayValue(firstFailure.input)}</code> returned <code>{displayValue(firstFailure.actual)}</code>, expected <code>{displayValue(firstFailure.expected)}</code>.{firstFailure.error && !firstFailure.error.startsWith('The result') ? ` ${firstFailure.error}` : ''}</p>}</>}
    </div>}
    {!code.trim() && <p className="px-5 py-3 text-xs text-mist"><Code2 size={12} className="inline"/> Empty file. Draft it from the blueprint, or write <code>{fileName.replace('.ts', '')}</code> yourself.</p>}
  </section>;
}
