"use client";

import { useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Boxes,
  Calculator,
  Check,
  GitBranch,
  ListFilter,
  Plus,
  TextCursorInput,
  Trash2,
} from 'lucide-react';
import { operations, type Operation, type Plan } from '@/lib/exercises';

type StepNode = Node<{
  kind: 'input' | 'step' | 'result';
  label: string;
  detail: string;
  op?: Operation;
  index?: number;
  active?: boolean;
  problem?: boolean;
}, 'exerciseStep'>;

const operationIcon = (op?: Operation) => {
  if (!op) return Boxes;
  if (['reverse', 'lowercase', 'trimSpaces', 'palindrome', 'textLength'].includes(op)) return TextCursorInput;
  if (['sum', 'product', 'count', 'even', 'averageCount', 'largest', 'smallest', 'sort'].includes(op)) return ListFilter;
  if (['equals', 'greater', 'remainder'].includes(op)) return GitBranch;
  return Calculator;
};

function StepBlock({ data, selected }: NodeProps<StepNode>) {
  const Icon = data.kind === 'input' ? ArrowDownToLine : data.kind === 'result' ? Check : operationIcon(data.op);
  return <div className={`logic-block exercise-logic-block ${selected ? 'logic-selected' : ''} ${data.active ? 'logic-active' : ''} ${data.problem ? 'logic-problem' : ''}`}>
    {data.kind !== 'input' && <Handle type="target" position={Position.Top} />}
    <div className="flex items-center gap-2.5">
      <span className="logic-glyph"><Icon size={16} /></span>
      <span className="min-w-0">
        <span className="block text-[10px] text-mist">{data.kind === 'step' ? `STEP ${(data.index ?? 0) + 1}` : data.kind.toUpperCase()}</span>
        <span className="mt-1 block max-w-[190px] truncate text-xs font-medium">{data.label}</span>
        <span className="mt-1 block max-w-[190px] truncate text-[9px] text-mist">{data.detail}</span>
      </span>
      {data.active && <span className="packet-dot" />}
    </div>
    {data.kind !== 'result' && <Handle id="next" type="source" position={Position.Bottom} />}
  </div>;
}

function PacketEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath(props);
  return <>
    <BaseEdge {...props} path={path} />
    {props.data?.active && <circle r="4" fill="#91ddce" style={{ filter: 'drop-shadow(0 0 5px #91ddce)', pointerEvents: 'none' }}>
      <animateMotion dur="0.65s" repeatCount="indefinite" path={path} />
    </circle>}
  </>;
}

const nodeTypes = { exerciseStep: StepBlock };
const edgeTypes = { packet: PacketEdge };

type Props = {
  plan: Plan;
  inputLabel: string;
  onChange: (plan: Plan) => void;
  busy: boolean;
  activeStep?: number;
  failedStep?: number | null;
};

function Canvas({ plan, inputLabel, onChange, busy, activeStep, failedStep }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>('multiply');
  const nodes = useMemo<StepNode[]>(() => {
    const all: StepNode[] = [{ id: 'input', type: 'exerciseStep', position: { x: 210, y: 20 }, data: { kind: 'input', label: inputLabel, detail: 'The value entering your plan' } }];
    plan.forEach((step, index) => all.push({
      id: `step-${index}`,
      type: 'exerciseStep',
      position: { x: 210, y: 145 + index * 125 },
      selected: selected === index,
      data: {
        kind: 'step',
        index,
        op: step.op,
        label: operations[step.op][0],
        detail: operations[step.op][2] ? `${operations[step.op][1]} ${step.amount ?? 'Set a number'}` : operations[step.op][1],
        active: activeStep === index,
        problem: failedStep === index,
      },
    }));
    all.push({ id: 'result', type: 'exerciseStep', position: { x: 210, y: 145 + plan.length * 125 }, data: { kind: 'result', label: 'Return the result', detail: 'The answer leaving your plan' } });
    return all;
  }, [plan, inputLabel, selected, activeStep, failedStep]);
  const edges = useMemo<Edge[]>(() => nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${index}`,
    source: node.id,
    target: nodes[index + 1].id,
    type: 'packet',
    data: { active: activeStep !== undefined && activeStep === index - 1 },
    style: { stroke: activeStep === index - 1 ? '#91ddce' : '#71668e', strokeWidth: activeStep === index - 1 ? 2.5 : 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: activeStep === index - 1 ? '#91ddce' : '#71668e' },
  })), [nodes, activeStep]);
  const chosen = selected === null ? null : plan[selected];

  function add(op: Operation) {
    if (busy || plan.length >= 12) return;
    const next = [...plan, { op, ...(operations[op][2] ? { amount: op === 'round' ? 2 : 1 } : {}) }];
    onChange(next);
    setSelected(next.length - 1);
  }

  function moveSelected(direction: -1 | 1) {
    if (selected === null) return;
    const destination = selected + direction;
    if (destination < 0 || destination >= plan.length) return;
    const next = [...plan];
    [next[destination], next[selected]] = [next[selected], next[destination]];
    onChange(next);
    setSelected(destination);
  }

  return <div className="studio-canvas-layout exercise-studio-canvas-layout">
    <aside className="block-library" aria-label="Logic block library">
      <div className="mb-4 flex items-center gap-2"><Boxes size={14} className="text-iris" /><p className="eyebrow">Your building blocks</p></div>
      <p className="mb-5 text-[11px] leading-5 text-mist">Choose a block to add it to the blueprint. The packet runs from top to bottom.</p>
      <div className="exercise-block-picker">
        <label className="sr-only" htmlFor="exercise-operation">Choose a block</label>
        <select id="exercise-operation" value={operation} onChange={event => setOperation(event.target.value as Operation)} disabled={busy}>
          {Object.entries(operations).map(([op, [label]]) => <option value={op} key={op}>{label}</option>)}
        </select>
        <button className="primary w-full" disabled={busy || plan.length >= 12} onClick={() => add(operation)}><Plus size={13} />Add block</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
        {(['multiply', 'divide', 'add', 'subtract', 'round', 'sum', 'count', 'reverse'] as Operation[]).map(op => {
          const Icon = operationIcon(op);
          return <button key={op} className="library-block" disabled={busy || plan.length >= 12} onClick={() => add(op)}><Icon size={15} /><span className="text-left text-[11px]">{operations[op][0]}</span><Plus size={11} className="ml-auto opacity-50" /></button>;
        })}
      </div>
      {chosen && <div className="mt-6 border-t border-white/10 pt-5">
        <p className="eyebrow">Selected block</p>
        <h3 className="mt-3 text-sm font-medium">{operations[chosen.op][0]}</h3>
        <p className="mt-2 text-[10px] leading-5 text-mist">{operations[chosen.op][1]}</p>
        {operations[chosen.op][2] && <label className="mt-4 block text-[10px] text-mist">{chosen.op === 'round' ? 'Decimal places' : 'Number'}
          <input className="exercise-amount mt-2 w-full" type="number" step="any" value={chosen.amount ?? ''} disabled={busy} onChange={event => {
            const amount = event.target.value === '' ? undefined : Number(event.target.value);
            if (amount !== undefined && (!Number.isFinite(amount) || Math.abs(amount) > 1e6)) return;
            const selectedIndex = selected;
            if (selectedIndex !== null) onChange(plan.map((step, index) => index === selectedIndex ? { ...step, amount } : step));
          }} />
        </label>}
        <div className="mt-4 flex gap-2">
          <button className="icon-button" aria-label="Move selected block up" disabled={busy || selected === 0} onClick={() => moveSelected(-1)}><ArrowUp size={14} /></button>
          <button className="icon-button" aria-label="Move selected block down" disabled={busy || selected === plan.length - 1} onClick={() => moveSelected(1)}><ArrowDown size={14} /></button>
          <button className="secondary ml-auto" disabled={busy} onClick={() => { onChange(plan.filter((_, index) => index !== selected)); setSelected(null); }}><Trash2 size={12} />Remove</button>
        </div>
      </div>}
    </aside>
    <div className="blueprint-canvas exercise-blueprint-canvas">
      <ReactFlow<StepNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={(_, node) => setSelected(node.data.index ?? null)} onPaneClick={() => setSelected(null)} nodesDraggable={!busy} nodesConnectable={false} elementsSelectable fitView fitViewOptions={{ padding: .2, maxZoom: 1 }} minZoom={.25} maxZoom={1.5} colorMode="dark">
        <Background gap={24} size={1} color="#b5a3ff16" />
        <Controls showInteractive={false} />
        <Panel position="top-left"><div className="canvas-caption"><span className="h-1.5 w-1.5 rounded-full bg-mint" />LIVE BLUEPRINT <span className="ml-4 text-mist/60">{plan.length} blocks</span></div></Panel>
        {!plan.length && <Panel position="bottom-center"><p className="canvas-invitation">Start with one clear step.<br /><span>Choose a block from the library to build your idea.</span></p></Panel>}
      </ReactFlow>
    </div>
  </div>;
}

export default function ExerciseBlueprintCanvas(props: Props) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
