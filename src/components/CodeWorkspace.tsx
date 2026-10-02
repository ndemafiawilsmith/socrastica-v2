"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Braces, Play, LoaderCircle, Info } from "lucide-react";
import { type Verification } from "@/lib/mentor";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
export default function CodeWorkspace({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  async function verify() {
    setBusy(true); setError(""); setResult(null);
    const submittedCode = code;
    const abort = new AbortController(); controller.current = abort;
    try {
      const start = await fetch('/api/execute', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:submittedCode}),signal:abort.signal});
      const job = await start.json();
      if(!start.ok) throw new Error(job.error || 'Unable to start execution.');
      const deadline = Date.now()+270000;
      while(Date.now()<deadline) {
        await new Promise(resolve=>setTimeout(resolve,3000));
        if(abort.signal.aborted) return;
        const response = await fetch(`/api/execute?id=${encodeURIComponent(job.id)}`,{signal:abort.signal,cache:'no-store'});
        const data = await response.json();
        if(!response.ok) throw new Error(data.error || 'Unable to retrieve results.');
        if(data.status==='completed') { if(mounted.current) setResult(data.result); return; }
        if(data.status==='failed') throw new Error('Execution could not finish. Check for syntax or runtime errors, then try again.');
      }
      throw new Error('Execution timed out. Please retry shortly.');
    } catch(e) { if(mounted.current && !abort.signal.aborted) setError(e instanceof Error?e.message:'Execution is unavailable.'); }
    finally { if(mounted.current) setBusy(false); }
  }
  return <section className="panel" aria-label="Code workspace">
    <div className="panel-title"><Braces size={16} className="text-iris"/> Bring your logic to life <span className="ml-auto font-mono text-[10px] text-mist">TypeScript</span></div>
    <div className="border-b border-white/[0.07] bg-black/15 px-5 py-3 font-mono text-xs text-iris">containsDuplicate.ts</div>
    <Editor height="320px" language="typescript" value={code} onChange={value => { onChange(value ?? ""); setResult(null); }} theme="socrastica" loading={<p className="p-8 text-sm text-mist">Loading editor…</p>} beforeMount={monaco => monaco.editor.defineTheme("socrastica", { base: "vs-dark", inherit: true, rules: [{ token: "comment", foreground: "747b98" }, { token: "keyword", foreground: "B5A3FF" }], colors: { "editor.background": "#111320", "editor.foreground": "#D9DCEF", "editorLineNumber.foreground": "#555B76", "editor.selectionBackground": "#B5A3FF30", "editor.lineHighlightBackground": "#FFFFFF04" } })} options={{ readOnly:busy, minimap: { enabled: false }, fontSize: 13, lineHeight: 24, padding: { top: 20 }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: "on", ariaLabel: "TypeScript code editor" }}/>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4"><span className="flex items-center gap-2 text-[11px] text-mist"><Info size={13}/>{busy ? 'Starting your runner and testing… This can take a minute.' : '8 tests · standalone TypeScript · no imports or network'}</span><button className="primary" onClick={verify} disabled={busy || !code.trim()}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Play size={14}/>} {busy ? "Running…" : "Run tests"}</button></div>
    {error && <p role="alert" className="px-5 pb-5 text-sm text-rose-300">{error}</p>}
    {result && <div role="status" className="mx-4 mb-4 rounded-xl border border-iris/20 bg-iris/5 p-4 text-sm"><p className="mb-3 text-iris">{result.summary}</p><ul className="space-y-2 text-xs text-mist">{result.checks.map(check => <li key={check}>{check}</li>)}</ul></div>}
  </section>;
}
