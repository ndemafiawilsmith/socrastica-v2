"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GitBranch, Minus, Plus, RotateCcw, Move } from "lucide-react";

export default function FlowchartViewer({ diagram }: { diagram: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(false); setLoading(true);
    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: { background: "transparent", primaryColor: "#28243f", primaryTextColor: "#eeebff", primaryBorderColor: "#a99ac5", lineColor: "#d1c8e7", secondaryColor: "#182e36", tertiaryColor: "#212237", fontFamily: "sans-serif", fontSize: "13px", edgeLabelBackground: "#191a2b" }, flowchart: { htmlLabels: false, curve: "basis" } });
        const { svg } = await mermaid.render(`flow-${id}-${crypto.randomUUID()}`, diagram);
        if (!cancelled && host.current) host.current.innerHTML = svg;
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void render();
    return () => { cancelled = true; };
  }, [diagram, id]);
  return <section className="panel flex min-h-[470px] flex-col" aria-label="Architecture visualizer">
    <div className="panel-title"><GitBranch size={16} className="text-iris"/> Logic map <span className="ml-auto text-[10px] text-mist">Your approach</span></div>
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:20px_20px] p-6 touch-none cursor-grab active:cursor-grabbing" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }} onPointerMove={e => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {loading && <p role="status" className="absolute text-xs text-mist">Drawing your logic map…</p>}
      {error && <p role="alert" className="absolute px-6 text-sm text-rose-300">This diagram could not be rendered. Check the Mermaid source.</p>}
      <div ref={host} role="img" aria-label="Flowchart of your accepted approach to duplicate detection" className={`diagram w-full max-w-[340px] ${loading || error ? "invisible" : ""}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}/>
    </div>
    <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3">
      <span className="flex items-center gap-2 text-[10px] text-mist"><Move size={12}/> Drag to explore</span>
      <div className="flex items-center gap-1"><button className="icon-button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.5, z - .25))}><Minus size={14}/></button><span className="w-10 text-center text-[10px] text-mist">{Math.round(zoom * 100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(2, z + .25))}><Plus size={14}/></button><button className="icon-button" aria-label="Reset diagram view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw size={14}/></button></div>
    </div>
  </section>;
}
