"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Handle, Position, Background, Controls, Panel, MarkerType, BaseEdge, getSmoothStepPath, applyNodeChanges, applyEdgeChanges, useReactFlow, type Node, type NodeProps, type Edge, type EdgeProps, type Connection } from '@xyflow/react';
import { useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, Bookmark, Boxes, Calculator, Check, Flag, GitBranch, Hash, LocateFixed, Plus, Repeat2, Sigma, Trash2, WandSparkles, X } from 'lucide-react';
import { blockInfo, isDecision, portsOf, type Blueprint, type BlueprintNode, type Operation, type Params, type TraceFrame } from '@/lib/blueprint';
import { presetTitle, type Preset } from '@/lib/challenges';
type LogicNode = Node<{ op: Operation; title: string; label: string; active: boolean; problem: boolean; passes?: number; progress?: number; breakpoint?: boolean }, 'logic'>;
const icons: Record<Operation, typeof Boxes> = { start: ArrowDownToLine, initSet: Boxes, loop: Repeat2, has: GitBranch, add: Plus, set: Bookmark, accumulate: Sigma, tally: Hash, math: Calculator, compare: GitBranch, transform: WandSparkles, return: Flag };
export const operationIcon = (op: Operation) => icons[op];
function Block({ data, selected }: NodeProps<LogicNode>) {
  const Icon = icons[data.op]; const decision = isDecision(data.op);
  return <div className={`logic-block ${decision ? 'logic-decision' : ''} ${selected ? 'logic-selected' : ''} ${data.active ? 'logic-active' : ''} ${data.problem ? 'logic-problem' : ''}`}>
    {data.op !== 'start' && <Handle type="target" position={Position.Top} aria-label="Input connection"/>}
    {data.op === 'loop' && data.progress !== undefined && <span className="loop-ring" style={{ '--progress': data.progress } as React.CSSProperties} aria-hidden="true"/>}
    {data.op === 'loop' && !!data.passes && <span className="loop-badge" aria-label={`Loop pass ${data.passes}`}>pass {data.passes}</span>}
    {data.breakpoint && <span className="breakpoint-mark" aria-label="Pauses here"/>}
    <div className="flex items-center gap-2.5"><span className="logic-glyph">{data.op === 'return' && data.title === 'Return true' ? <Check size={16}/> : <Icon size={16}/>}</span><span className="min-w-0"><span className="block text-[10px] text-mist">{data.title}</span><span className="mt-1 block max-w-[145px] truncate text-xs font-medium">{data.label}</span></span>{data.active && <span className="packet-dot"/>}</div>
    {portsOf[data.op].map((port, index) => <div key={port} className={`logic-port ${decision ? (index === 0 ? 'port-yes' : 'port-no') : 'port-next'}`}><span>{port === 'next' ? '' : port}</span><Handle id={port} type="source" position={Position.Bottom} style={{ left: decision ? (index === 0 ? '28%' : '74%') : '50%' }} aria-label={`${port} output connection`}/></div>)}
  </div>;
}
const nodeTypes = { logic: Block };
function PacketEdge(props: EdgeProps) {
  const reducedMotion = useReducedMotion();
  const [path, labelX, labelY] = getSmoothStepPath(props);
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} label={props.label} labelX={labelX} labelY={labelY} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle}/>{props.data?.active && !reducedMotion && <circle r="4" fill="#91ddce" style={{ filter: 'drop-shadow(0 0 5px #91ddce)', pointerEvents: 'none' }}><animateMotion dur="0.65s" repeatCount="indefinite" path={path}/></circle>}</>;
}
const edgeTypes = { packet: PacketEdge };
export type LoopStats = Record<string, { passes: number; progress: number }>;
type Props = { blueprint: Blueprint; library: Preset[]; onChange: (graph: Blueprint) => void; busy: boolean; frame?: TraceFrame; problemNode?: string | null; focusNode?: string | null; focusToken?: number; onSelect?: (id: string | null) => void; loopStats?: LoopStats; breakpoints?: Set<string>; onToggleBreakpoint?: (id: string) => void; onRunTo?: (id: string) => void; canRunTo?: boolean; readOnly?: boolean; compact?: boolean };
const numericSetting = (node: BlueprintNode): { key: string; label: string; integer?: boolean; min?: number; max?: number } | null => {
  if (node.op === 'math' && typeof node.params?.amount === 'number') return node.params.op === 'round' ? { key: 'amount', label: 'Decimal places', integer: true, min: 0, max: 6 } : { key: 'amount', label: 'Number' };
  if (node.op === 'compare' && typeof node.params?.right === 'number') return { key: 'right', label: 'Compare with' };
  return null;
};
function Canvas(props: Props) {
  const { blueprint, library, onChange, busy, frame, problemNode, onSelect, loopStats, breakpoints, onToggleBreakpoint, onRunTo, canRunTo } = props; const flow = useReactFlow<LogicNode>(); const wrapper = useRef<HTMLDivElement>(null); const [selected, setSelected] = useState<string | null>(null); const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const nodeIds = blueprint.nodes.map(node => node.id).join(',');
  const fit = useRef(flow.fitView); fit.current = flow.fitView;
  useEffect(() => { const timer = setTimeout(() => void fit.current({ padding: .35, maxZoom: 1, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 }), 100); return () => clearTimeout(timer); }, [nodeIds]);
  useEffect(() => {
    let width = 0, timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width || 0; if (next && next !== width) { width = next; clearTimeout(timer); timer = setTimeout(() => void fit.current({ padding: .35, maxZoom: 1, duration: 0 }), 100); } });
    if (wrapper.current) observer.observe(wrapper.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const node = blueprint.nodes.find(n => n.id === props.focusNode); if (!node) return;
    setSelected(node.id); onSelect?.(node.id);
    const timer = setTimeout(() => void flow.setCenter(node.x + 105, node.y + 35, { zoom: .9, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350 }), 180);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusNode, props.focusToken, nodeIds]);
  const nodes: LogicNode[] = useMemo(() => blueprint.nodes.map(node => ({ id: node.id, type: 'logic', position: { x: node.x, y: node.y }, selected: node.id === selected, data: { op: node.op, title: blockInfo(node.op, node.params).title, label: node.label, active: node.id === frame?.nodeId, problem: node.id === problemNode, passes: loopStats?.[node.id]?.passes, progress: loopStats?.[node.id]?.progress, breakpoint: breakpoints?.has(node.id) } })), [blueprint.nodes, selected, frame?.nodeId, problemNode, loopStats, breakpoints]);
  const edges: Edge[] = useMemo(() => blueprint.edges.map(edge => ({ ...edge, selected: edge.id === selectedEdge, sourceHandle: edge.port, type: 'packet', data: { active: edge.id === frame?.edgeId }, animated: edge.id === frame?.edgeId, label: edge.port === 'next' ? undefined : edge.port, style: { stroke: edge.id === frame?.edgeId ? '#91ddce' : '#71668e', strokeWidth: edge.id === frame?.edgeId ? 2.5 : 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: edge.id === frame?.edgeId ? '#91ddce' : '#71668e' }, labelStyle: { fill: '#bdb5d1', fontSize: 10 }, labelBgStyle: { fill: '#151727', fillOpacity: 1 } })), [blueprint.edges, frame?.edgeId, selectedEdge]);
  const toNode = (node: LogicNode): BlueprintNode => { const original = blueprint.nodes.find(n => n.id === node.id); return { id: node.id, op: node.data.op, label: node.data.label, x: node.position.x, y: node.position.y, ...(original?.params ? { params: original.params } : {}) }; };
  function add(preset: Preset, position?: { x: number; y: number }) {
    if (busy || blueprint.nodes.length >= 24) return;
    const rect = wrapper.current?.getBoundingClientRect(); const p = position || flow.screenToFlowPosition({ x: (rect?.left || 0) + (rect?.width || 600) / 2 - 90, y: (rect?.top || 0) + 180 + (blueprint.nodes.length % 4) * 75 });
    const id = `block_${crypto.randomUUID().slice(0, 8)}`; onChange({ ...blueprint, nodes: [...blueprint.nodes, { id, op: preset.op, label: presetTitle(preset), x: p.x, y: p.y, ...(preset.params ? { params: { ...preset.params } } : {}) }] }); setSelected(id); onSelect?.(id);
  }
  const connect = useCallback((connection: Connection) => {
    if (busy || !connection.source || !connection.target) return; const port = connection.sourceHandle as 'next' | 'yes' | 'no'; const source = blueprint.nodes.find(node => node.id === connection.source);
    if (!source || !portsOf[source.op].includes(port) || blueprint.edges.length >= 48) return;
    onChange({ ...blueprint, edges: [...blueprint.edges.filter(edge => !(edge.source === connection.source && edge.port === port)), { id: `edge_${crypto.randomUUID().slice(0, 8)}`, source: connection.source, target: connection.target, port }] });
  }, [blueprint, onChange, busy]);
  const inspected = blueprint.nodes.find(node => node.id === selected); const inspectedEdge = blueprint.edges.find(edge => edge.id === selectedEdge);
  const setting = inspected ? numericSetting(inspected) : null;
  function updateParam(key: string, raw: string) {
    if (!inspected || !setting) return; const value = Number(raw); if (raw === '' || !Number.isFinite(value) || Math.abs(value) > 1e6 || (setting.integer && !Number.isInteger(value)) || (setting.min !== undefined && value < setting.min) || (setting.max !== undefined && value > setting.max)) return;
    onChange({ ...blueprint, nodes: blueprint.nodes.map(node => node.id === inspected.id ? { ...node, params: { ...(node.params || {}), [key]: value } as Params } : node) });
  }
  const inspector = inspected ? <div className="block-inspector" role="group" aria-label="Selected block"><div className="flex items-start justify-between gap-2"><div><p className="eyebrow">{blockInfo(inspected.op, inspected.params).title}</p><p className="mt-1 text-[10px] leading-4 text-mist">{blockInfo(inspected.op, inspected.params).description}</p></div><button className="icon-button -mr-1 -mt-1" aria-label="Close block settings" onClick={() => { setSelected(null); onSelect?.(null); }}><X size={13}/></button></div><label className="mt-3 block text-[10px] text-mist" htmlFor="block-label">Label<input id="block-label" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" maxLength={80} value={inspected.label} disabled={busy} onChange={event => onChange({ ...blueprint, nodes: blueprint.nodes.map(node => node.id === selected ? { ...node, label: event.target.value || blockInfo(node.op, node.params).title } : node) })}/></label>{setting && <label className="mt-3 block text-[10px] text-mist">{setting.label}<input className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" type="number" step="any" min={setting.min} max={setting.max} disabled={busy} value={String(inspected.params?.[setting.key] ?? '')} onChange={event => updateParam(setting.key, event.target.value)}/></label>}{(onToggleBreakpoint || onRunTo) && inspected.op !== 'start' && <div className="mt-3 flex gap-2">{onToggleBreakpoint && <button className={`secondary flex-1 ${breakpoints?.has(inspected.id) ? '!border-rose-300/60 !text-rose-200' : ''}`} onClick={() => onToggleBreakpoint(inspected.id)} aria-pressed={breakpoints?.has(inspected.id)}>{breakpoints?.has(inspected.id) ? 'Pausing here' : 'Pause here'}</button>}{onRunTo && <button className="secondary flex-1" disabled={busy || !canRunTo} onClick={() => onRunTo(inspected.id)}>Run to here</button>}</div>}{inspected.op !== 'start' && <button className="secondary mt-3 w-full" disabled={busy} onClick={() => { onChange({ nodes: blueprint.nodes.filter(node => node.id !== selected), edges: blueprint.edges.filter(edge => edge.source !== selected && edge.target !== selected) }); setSelected(null); onSelect?.(null); }}><Trash2 size={12}/>Remove block</button>}</div>
    : inspectedEdge ? <div className="block-inspector" role="group" aria-label="Selected connection"><div className="flex items-start justify-between gap-2"><p className="eyebrow">Connection</p><button className="icon-button -mr-1 -mt-1" aria-label="Close connection settings" onClick={() => setSelectedEdge(null)}><X size={13}/></button></div><p className="mt-2 text-xs leading-5 text-mist">{blueprint.nodes.find(node => node.id === inspectedEdge.source)?.label} → {blueprint.nodes.find(node => node.id === inspectedEdge.target)?.label}</p><p className="mt-2 text-[11px] leading-5 text-iris">{inspectedEdge.port === 'next' ? 'Continue to the next operation.' : blueprint.nodes.find(node => node.id === inspectedEdge.source)?.op === 'loop' ? (inspectedEdge.port === 'yes' ? 'Taken when another item is available.' : 'Taken when the list is finished.') : (inspectedEdge.port === 'yes' ? 'Taken when the check answers yes.' : 'Taken when the check answers no.')}</p><button className="secondary mt-3 w-full" disabled={busy} onClick={() => { onChange({ ...blueprint, edges: blueprint.edges.filter(edge => edge.id !== selectedEdge) }); setSelectedEdge(null); }}>Remove connection</button></div> : null;
  return <div className={`studio-canvas-layout ${props.readOnly ? 'read-only' : ''} ${props.compact ? 'compact' : ''}`}>
    {!props.readOnly && <aside className={`block-library ${props.compact ? 'compact' : ''}`} aria-label="Logic block library"><div className="mb-4 flex items-center gap-2"><Boxes size={14} className="text-iris"/><p className="eyebrow">Your building blocks</p></div><p className="mb-5 text-[11px] leading-5 text-mist">Drag a block onto the canvas.<br/>Or click to add it.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">{library.map((preset, index) => { const Icon = icons[preset.op]; const info = blockInfo(preset.op, preset.params); return <button key={index} draggable={!busy} disabled={busy || blueprint.nodes.length >= 24} onDragStart={event => { event.dataTransfer.setData('application/socrastica-preset', String(index)); event.dataTransfer.effectAllowed = 'move'; }} onClick={() => add(preset)} className="library-block" title={`${presetTitle(preset)}: ${info.description}`} aria-label={`Add ${presetTitle(preset)} block`}><Icon size={16}/><span><span className="block text-[11px] font-medium">{presetTitle(preset)}</span><span className="mt-1 hidden text-[9px] leading-4 text-mist lg:block">{info.description}</span></span><Plus size={11} className="ml-auto shrink-0 opacity-50"/></button>; })}</div>
    </aside>}
    <div ref={wrapper} className="blueprint-canvas" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); const preset = library[Number(event.dataTransfer.getData('application/socrastica-preset'))]; if (preset) add(preset, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}>
      <ReactFlow<LogicNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} style={{ background: 'transparent' }} onNodesChange={changes => {
        const selection = changes.find(change => change.type === 'select' && change.selected); if (selection && selection.type === 'select') { setSelected(selection.id); onSelect?.(selection.id); }
        if (busy) return; const changed = applyNodeChanges(changes, nodes); if (!changed.length) return;
        if (changes.some(change => change.type === 'position' || change.type === 'remove')) { const ids = new Set(changed.map(node => node.id)); onChange({ nodes: changed.map(toNode), edges: blueprint.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)) }); }
      }} onEdgesChange={changes => { const selection = changes.find(change => change.type === 'select' && change.selected); if (selection && selection.type === 'select') { setSelectedEdge(selection.id); setSelected(null); } if (busy || !changes.some(change => change.type === 'remove')) return; const changed = applyEdgeChanges(changes, edges); const ids = new Set(changed.map(edge => edge.id)); onChange({ ...blueprint, edges: blueprint.edges.filter(edge => ids.has(edge.id)) }); }} onConnect={connect} onEdgeClick={(_, edge) => { setSelectedEdge(edge.id); setSelected(null); }} onNodeClick={(_, node) => { setSelectedEdge(null); setSelected(node.id); onSelect?.(node.id); }} onPaneClick={() => { setSelectedEdge(null); setSelected(null); onSelect?.(null); }} nodesDraggable={!busy} nodesConnectable={!busy} edgesReconnectable={false} fitView fitViewOptions={{ padding: .35, maxZoom: 1 }} minZoom={.25} maxZoom={1.6} colorMode="dark" deleteKeyCode={busy ? null : ['Backspace', 'Delete']}>
        <Background gap={24} size={1} color="#b5a3ff16"/><Controls showInteractive={false}/><Panel position="top-left"><div className="canvas-caption"><span className="h-1.5 w-1.5 rounded-full bg-mint"/>LIVE BLUEPRINT <span className="ml-4 text-mist/60">{blueprint.nodes.length} blocks</span></div></Panel><Panel position="top-right"><button className="icon-button bg-[#191b2d]" onClick={() => void flow.fitView({ padding: .3, duration: 250, maxZoom: 1 })} aria-label="Fit blueprint to view"><LocateFixed size={16}/></button></Panel>
        {blueprint.nodes.length === 1 && blueprint.edges.length === 0 && <Panel position="bottom-center"><p className="canvas-invitation">Start with an idea.<br/><span>Connect a block, or say what should happen next.</span></p></Panel>}
      </ReactFlow>
      {!props.readOnly && inspector}
    </div>
  </div>;
}
export default function BlueprintCanvas(props: Props) { return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>; }
