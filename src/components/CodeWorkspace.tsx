"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Braces, Play, LoaderCircle, Info } from "lucide-react";
import type { editor } from 'monaco-editor';
import { displayValue } from '@/lib/values';

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
export type RunResult = { name?: string; input: unknown; expected: unknown; actual: unknown; passed: boolean; error?: string };
export type RunReport = { passed: boolean; passedCount: number; total: number; summary: string; results: RunResult[] };
type Props = { code: string; onChange: (code: string) => void; onRun: () => Promise<RunReport>; drafting?: boolean; selectedNodeId?: string | null; selectedNodeLabel?: string };

export default function CodeWorkspace({ code, onChange, onRun, drafting = false, selectedNodeId, selectedNodeLabel }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null), decorations = useRef<editor.IEditorDecorationsCollection | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const lines = code.split('\n'), marker = selectedNodeId ? lines.findIndex(line => line.trim() === `// node: ${selectedNodeId}`) : -1;
  useEffect(() => {
    decorations.current?.clear(); if (!editorRef.current || marker < 0) return;
    let end = lines.findIndex((line, index) => index > marker && line.trim().startsWith('// node: ')); if (end < 0) end = lines.length;
    decorations.current = editorRef.current.createDecorationsCollection([{ range: { startLineNumber: marker + 1, startColumn: 1, endLineNumber: end, endColumn: 1 }, options: { isWholeLine: true, className: 'blueprint-code-focus' } }]);
    editorRef.current.revealLineInCenter(marker + 1);
  }, [code, selectedNodeId, editorReady]);
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
  const failures = report?.results.filter(result => !result.passed) || [];
  return <section className="panel" aria-label="Code workspace">
    <div className="panel-title"><Braces size={16} className="text-iris"/> Bring your logic to life <span className="ml-auto font-mono text-[10px] text-mist">TypeScript</span></div>
    <div className="border-b border-white/[0.07] bg-black/15 px-5 py-3 font-mono text-xs text-iris">containsDuplicate.ts</div>
    {selectedNodeId && <p className="px-5 py-3 text-xs text-mist">{marker >= 0 ? `Highlighted code for “${selectedNodeLabel || selectedNodeId}”.` : 'Select a block to explore its job. This older draft has no block markers; new drafts include them.'}</p>}
    <Editor onMount={instance => { editorRef.current = instance; setEditorReady(true); }} height="320px" language="typescript" value={code} onChange={value => { onChange(value ?? ""); setReport(null); }} theme="socrastica" loading={<p className="p-8 text-sm text-mist">Loading editor…</p>} beforeMount={monaco => monaco.editor.defineTheme("socrastica", { base: "vs-dark", inherit: true, rules: [{ token: "comment", foreground: "747b98" }, { token: "keyword", foreground: "B5A3FF" }], colors: { "editor.background": "#111320", "editor.foreground": "#D9DCEF", "editorLineNumber.foreground": "#555B76", "editor.selectionBackground": "#B5A3FF30", "editor.lineHighlightBackground": "#FFFFFF04" } })} options={{ readOnly: busy || drafting, minimap: { enabled: false }, fontSize: 13, lineHeight: 24, padding: { top: 20 }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: "on", ariaLabel: "TypeScript code editor" }}/>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4"><span className="flex items-center gap-2 text-[11px] text-mist"><Info size={13}/>{busy ? 'Running your code in an isolated sandbox…' : '40 checks · standalone TypeScript · no imports or network'}</span><button className="primary" onClick={run} disabled={busy || drafting || !code.trim()}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Play size={14}/>} {busy ? "Running…" : "Run tests"}</button></div>
    {error && <p role="alert" className="px-5 pb-5 text-sm text-rose-300">{error}</p>}
    {report && <div role="status" className="mx-4 mb-4 rounded-xl border border-iris/20 bg-iris/5 p-4 text-sm"><p className={report.passed ? 'text-mint' : 'text-iris'}>{report.summary}</p>
      {failures.length > 0 && <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs text-mist">{failures.slice(0, 8).map((result, index) => <li key={index}><span className="text-rose-300">Repair</span> · {result.name || 'Input'} <code>{displayValue(result.input)}</code> → <code>{displayValue(result.actual)}</code>, expected <code>{displayValue(result.expected)}</code>{result.error && !result.error.startsWith('The result') ? `. ${result.error}` : ''}</li>)}{failures.length > 8 && <li>{failures.length - 8} more failing inputs.</li>}</ul>}
    </div>}
  </section>;
}
