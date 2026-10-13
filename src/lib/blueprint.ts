import { z } from 'zod';
import { isAllowedValue, sameValue, type Value } from './values';

// The universal block vocabulary. Every challenge offers a subset of these blocks,
// usually as presets with fixed parameters. Labels are descriptions and never execute.
//
// Registers the packet carries:
//   value    the packet itself; starts as the input and is what transform/math blocks change
//   current  the item most recently taken by a loop block
//   seen     the memory shelf (a set of numbers)
//   total    a running number (a sum, a product, the number kept so far)
//   count    a running tally
export const ports = ['next', 'yes', 'no'] as const;
export type Port = typeof ports[number];
export const operations = ['start', 'initSet', 'loop', 'has', 'add', 'set', 'accumulate', 'tally', 'math', 'compare', 'transform', 'return'] as const;
export type Operation = typeof operations[number];

const amount = z.number().finite().min(-1e6).max(1e6);
export const registers = ['value', 'current', 'total', 'count'] as const;
export type Register = typeof registers[number];
export const paramSchemas = {
  start: z.object({}).strict(),
  initSet: z.object({}).strict(),
  loop: z.object({}).strict(),
  has: z.object({}).strict(),
  add: z.object({}).strict(),
  set: z.object({ target: z.enum(['total', 'count']), source: z.enum(['zero', 'one', 'current', 'first']) }).strict(),
  accumulate: z.object({ op: z.enum(['add', 'multiply']) }).strict(),
  tally: z.object({}).strict(),
  math: z.object({ target: z.enum(['value', 'total']), op: z.enum(['multiply', 'divide', 'add', 'subtract', 'round', 'remainder']), amount: z.union([amount, z.enum(['count', 'total'])]) }).strict(),
  compare: z.object({ left: z.enum(registers), op: z.enum(['>', '<', '>=', '<=', '==', '!=', 'even', 'odd', 'sameReversed']), right: z.union([amount, z.enum(['total', 'count', 'current'])]).optional() }).strict(),
  transform: z.object({ kind: z.enum(['reverse', 'lowercase', 'trimSpaces', 'textLength', 'sort', 'length']) }).strict(),
  return: z.object({ what: z.enum(['true', 'false', 'value', 'total', 'count', 'current']) }).strict(),
} as const;
export type Params = Record<string, string | number>;
export type ParamsFor<O extends Operation> = z.infer<typeof paramSchemas[O]>;

export const portsOf: Record<Operation, readonly Port[]> = {
  start: ['next'], initSet: ['next'], add: ['next'], set: ['next'], accumulate: ['next'], tally: ['next'], math: ['next'], transform: ['next'],
  loop: ['yes', 'no'], has: ['yes', 'no'], compare: ['yes', 'no'], return: [],
};
export const isDecision = (op: Operation) => portsOf[op].length === 2;

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/);
const nodeSchema = z.object({ id, op: z.enum(operations), label: z.string().min(1).max(80), x: z.number().finite().min(-5000).max(5000), y: z.number().finite().min(-5000).max(5000), params: z.record(z.string(), z.union([z.string().max(40), z.number().finite()])).optional() }).strict()
  .superRefine((node, ctx) => { if (!paramSchemas[node.op].safeParse(node.params || {}).success) ctx.addIssue({ code: 'custom', message: `Invalid settings for ${node.op}` }); });
export const blueprintSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(24),
  edges: z.array(z.object({ id, source: id, target: id, port: z.enum(ports) }).strict()).max(48),
}).strict().superRefine((graph, ctx) => {
  const ids = new Set(graph.nodes.map(node => node.id));
  if (ids.size !== graph.nodes.length || new Set(graph.edges.map(edge => edge.id)).size !== graph.edges.length || graph.edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) ctx.addIssue({ code: 'custom', message: 'Invalid blueprint references' });
});
export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintNode = Blueprint['nodes'][number];
export const emptyBlueprint: Blueprint = { nodes: [{ id: 'input', op: 'start', label: 'Input', x: 200, y: 70 }], edges: [] };

const describeAmount = (value: string | number | undefined) => typeof value === 'number' ? String(value) : value === 'count' ? 'the count' : value === 'total' ? 'the total' : value === 'current' ? 'the current item' : '…';
const registerName: Record<Register, string> = { value: 'the value', current: 'the current item', total: 'the total', count: 'the count' };

// Titles and descriptions derived from a block's settings, used by the library, the canvas, and the AI prompts.
export function blockInfo(op: Operation, params: Params = {}): { title: string; description: string } {
  switch (op) {
    case 'start': return { title: 'Input', description: 'Receive the input' };
    case 'initSet': return { title: 'Memory shelf', description: 'Create an empty memory of seen numbers' };
    case 'loop': return { title: 'Next item', description: 'Take the next item, or finish when the list is exhausted' };
    case 'has': return { title: 'Seen before?', description: 'Is the current item already in memory?' };
    case 'add': return { title: 'Remember item', description: 'Add the current item to memory' };
    case 'set': { const p = params as ParamsFor<'set'>; const source = p.source === 'zero' ? '0' : p.source === 'one' ? '1' : p.source === 'first' ? 'the first item' : 'the current item'; return { title: p.source === 'zero' || p.source === 'one' ? `Start ${p.target} at ${source}` : `Keep ${source} as ${p.target}`, description: `Set ${p.target} to ${source}` }; }
    case 'accumulate': { const p = params as ParamsFor<'accumulate'>; return p.op === 'multiply' ? { title: 'Multiply into total', description: 'Multiply the total by the current item' } : { title: 'Add to total', description: 'Add the current item to the total' }; }
    case 'tally': return { title: 'Count one', description: 'Increase the count by one' };
    case 'math': { const p = params as ParamsFor<'math'>; const a = describeAmount(p.amount); const verb = { multiply: `Multiply by ${a}`, divide: `Divide by ${a}`, add: `Add ${a}`, subtract: `Subtract ${a}`, round: `Round to ${a} decimals`, remainder: `Remainder after dividing by ${a}` }[p.op]; return { title: p.target === 'total' ? `${verb} (total)` : verb, description: `${verb}, applied to ${p.target === 'total' ? 'the total' : 'the value'}` }; }
    case 'compare': { const p = params as ParamsFor<'compare'>; const left = registerName[p.left]; const text = p.op === 'even' ? `Is ${left} even?` : p.op === 'odd' ? `Is ${left} odd?` : p.op === 'sameReversed' ? `Is ${left} the same reversed?` : `Is ${left} ${p.op} ${describeAmount(p.right)}?`; return { title: text.charAt(0).toUpperCase() + text.slice(1), description: 'Yes or no decides the next path' }; }
    case 'transform': { const p = params as ParamsFor<'transform'>; return { reverse: { title: 'Reverse text', description: 'Read the characters from the end to the start' }, lowercase: { title: 'Use lowercase', description: 'Make capital and lowercase letters match' }, trimSpaces: { title: 'Remove spaces', description: 'Remove all whitespace from the text' }, textLength: { title: 'Count characters', description: 'The value becomes the number of characters' }, sort: { title: 'Sort low to high', description: 'Arrange the numbers in increasing order' }, length: { title: 'Count items', description: 'The value becomes how many items the list has' } }[p.kind]; }
    case 'return': { const p = params as ParamsFor<'return'>; return { title: p.what === 'true' ? 'Return true' : p.what === 'false' ? 'Return false' : `Return ${registerName[p.what]}`, description: 'Finish the run with this answer' }; }
  }
}

export function blueprintKey(graph: Blueprint) {
  return JSON.stringify({ nodes: graph.nodes.map(({ id, op, params }) => ({ id, op, params: params || {} })).sort((a, b) => a.id.localeCompare(b.id)), edges: graph.edges.map(({ source, target, port }) => ({ source, target, port })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) });
}

export type TraceFrame = { nodeId: string; edgeId?: string; index: number; current: number | null; seen: number[]; value: Value; total: number | null; count: number | null; note: string; result?: Value };
export type Simulation = { passed: boolean; frames: TraceFrame[]; result?: Value; expected?: Value; error?: string; nodeId?: string };
type State = { value: Value; current: number | null; seen: Set<number> | null; total: number | null; count: number | null; index: number };
class StepError extends Error {}

export function inspectBlueprint(graph: Blueprint): { nodeId: string; message: string }[] {
  const issues: { nodeId: string; message: string }[] = [];
  const starts = graph.nodes.filter(node => node.op === 'start');
  if (starts.length !== 1) issues.push({ nodeId: graph.nodes[0].id, message: 'Use exactly one Input block.' });
  for (const node of graph.nodes) {
    const exits = graph.edges.filter(edge => edge.source === node.id);
    for (const port of portsOf[node.op]) { const count = exits.filter(edge => edge.port === port).length; if (count !== 1) issues.push({ nodeId: node.id, message: `Connect one ${port === 'next' ? 'output' : port} path from ${node.label}.` }); }
    if (exits.some(edge => !portsOf[node.op].includes(edge.port))) issues.push({ nodeId: node.id, message: 'This block has a connection on an unsupported output.' });
    if (node.op === 'loop' && exits.some(edge => edge.port === 'yes' && graph.nodes.find(n => n.id === edge.target)?.op === 'return')) issues.push({ nodeId: node.id, message: 'This finishes on the first item. Should you check it first?' });
  }
  if (starts.length === 1) {
    const reached = new Set([starts[0].id]); for (let i = 0; i < graph.nodes.length; i++) for (const edge of graph.edges) if (reached.has(edge.source)) reached.add(edge.target);
    for (const node of graph.nodes) if (!reached.has(node.id)) issues.push({ nodeId: node.id, message: 'This block is disconnected from the input.' });
  }
  return issues;
}

function readNumber(state: State, name: 'value' | 'current' | 'total' | 'count', what: string): number {
  const v = state[name];
  if (name === 'value' && typeof v !== 'number') throw new StepError(`${what} needs a number, but the value is ${Array.isArray(v) ? 'a list' : typeof v === 'string' ? 'text' : String(v)}.`);
  if (name === 'current' && v === null) throw new StepError('There is no current item yet. Take one with Next item first.');
  if ((name === 'total' || name === 'count') && v === null) throw new StepError(`The ${name} has not been started. Add a “Start ${name}” block first.`);
  return v as number;
}

function step(node: BlueprintNode, state: State, input: Value): { port: Port; note: string; result?: Value } {
  const p = (node.params || {}) as Params;
  const list = () => { if (!Array.isArray(state.value)) throw new StepError('This block needs a list of numbers.'); return state.value; };
  const text = () => { if (typeof state.value !== 'string') throw new StepError('This block needs text.'); return state.value; };
  switch (node.op) {
    case 'start': return { port: 'next', note: `Receive ${JSON.stringify(input)}` };
    case 'initSet': state.seen = new Set(); return { port: 'next', note: 'Memory starts empty' };
    case 'loop': { const items = list(); if (state.index < items.length) { state.current = items[state.index++]; return { port: 'yes', note: `Take ${state.current} from position ${state.index - 1}` }; } return { port: 'no', note: 'The list is finished' }; }
    case 'has': { if (!state.seen) throw new StepError('Memory has not been created. Add a Memory shelf before this check.'); const current = readNumber(state, 'current', 'This check'); const port = state.seen.has(current) ? 'yes' : 'no'; return { port, note: port === 'yes' ? `${current} is already in memory` : `${current} is new` }; }
    case 'add': { if (!state.seen) throw new StepError('Create a Memory shelf before remembering an item.'); const current = readNumber(state, 'current', 'Remember'); state.seen.add(current); return { port: 'next', note: `Remember ${current}` }; }
    case 'set': { const { target, source } = p as ParamsFor<'set'>; const value = source === 'zero' ? 0 : source === 'one' ? 1 : source === 'current' ? readNumber(state, 'current', 'Keep') : (list()[0] ?? 0); state[target] = value; return { port: 'next', note: source === 'first' && !list().length ? `The list is empty, so ${target} starts at 0` : `${target} is now ${value}` }; }
    case 'accumulate': { const { op } = p as ParamsFor<'accumulate'>; const current = readNumber(state, 'current', 'This block'); const previous = state.total ?? (op === 'multiply' ? 1 : 0); state.total = op === 'multiply' ? previous * current : previous + current; return { port: 'next', note: `${previous} ${op === 'multiply' ? '×' : '+'} ${current} = ${state.total}` }; }
    case 'tally': state.count = (state.count ?? 0) + 1; return { port: 'next', note: `Count is now ${state.count}` };
    case 'math': {
      const { target, op, amount } = p as ParamsFor<'math'>; const left = readNumber(state, target, 'This block'); const right = typeof amount === 'number' ? amount : readNumber(state, amount, 'This block');
      let result: number;
      switch (op) {
        case 'multiply': result = left * right; break;
        case 'divide': if (!right) throw new StepError('Cannot divide by zero. Check this case before dividing.'); result = left / right; break;
        case 'add': result = left + right; break;
        case 'subtract': result = left - right; break;
        case 'remainder': if (!right) throw new StepError('Cannot take a remainder after dividing by zero.'); result = left % right; break;
        case 'round': if (!Number.isInteger(right) || right < 0 || right > 6) throw new StepError('Round to between 0 and 6 decimal places.'); result = Math.round((left + Number.EPSILON) * 10 ** right) / 10 ** right; break;
      }
      if (!Number.isFinite(result) || Math.abs(result) > 1e15) throw new StepError('The result is outside the practice limits.');
      state[target] = result; return { port: 'next', note: `${left} → ${result}` };
    }
    case 'compare': {
      const { left, op, right } = p as ParamsFor<'compare'>;
      if (op === 'sameReversed') { const word = left === 'value' ? text() : String(readNumber(state, left, 'This check')); const same = word === Array.from(word).reverse().join(''); return { port: same ? 'yes' : 'no', note: same ? `“${word}” reads the same backwards` : `“${word}” differs when reversed` }; }
      const a = readNumber(state, left, 'This check');
      if (op === 'even' || op === 'odd') { const even = a % 2 === 0; const yes = op === 'even' ? even : !even; return { port: yes ? 'yes' : 'no', note: `${a} is ${even ? 'even' : 'odd'}` }; }
      if (right === undefined) throw new StepError('Set the number to compare with.');
      const b = typeof right === 'number' ? right : readNumber(state, right, 'This check');
      const yes = op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? sameValue(a, b) : !sameValue(a, b);
      return { port: yes ? 'yes' : 'no', note: `${a} ${op} ${b} is ${yes ? 'yes' : 'no'}` };
    }
    case 'transform': {
      const { kind } = p as ParamsFor<'transform'>;
      switch (kind) {
        case 'reverse': state.value = Array.from(text()).reverse().join(''); break;
        case 'lowercase': state.value = text().toLowerCase(); break;
        case 'trimSpaces': state.value = text().replace(/\s/g, ''); break;
        case 'textLength': state.value = Array.from(text()).length; break;
        case 'sort': state.value = [...list()].sort((a, b) => a - b); break;
        case 'length': state.value = list().length; break;
      }
      return { port: 'next', note: `The value is now ${JSON.stringify(state.value)}` };
    }
    case 'return': {
      const { what } = p as ParamsFor<'return'>;
      const result: Value = what === 'true' ? true : what === 'false' ? false : what === 'value' ? state.value : what === 'current' ? readNumber(state, 'current', 'Return') : (state[what] ?? 0);
      if (!isAllowedValue(result)) throw new StepError('The result is outside the practice limits.');
      return { port: 'next', note: (what === 'total' || what === 'count') && state[what] === null ? `No ${what} was kept, so the answer is 0` : `Return ${JSON.stringify(result)}`, result };
    }
  }
}

export type SimulateOptions = { expected?: Value; record?: boolean };
export function simulate(graph: Blueprint, input: Value, options: SimulateOptions = {}): Simulation {
  const record = options.record !== false;
  const frames: TraceFrame[] = [];
  const starts = graph.nodes.filter(node => node.op === 'start');
  if (starts.length !== 1) return { passed: false, frames, error: 'Use exactly one Input block.', nodeId: graph.nodes[0]?.id };
  let node = starts[0];
  const state: State = { value: Array.isArray(input) ? [...input] : input, current: null, seen: null, total: null, count: null, index: 0 };
  const snapshot = (note: string, extra: Partial<TraceFrame> = {}): TraceFrame => ({ nodeId: node.id, index: state.index, current: state.current, seen: [...(state.seen || [])], value: Array.isArray(state.value) ? [...state.value] : state.value, total: state.total, count: state.count, note, ...extra });
  const fail = (error: string): Simulation => ({ passed: false, frames, error, nodeId: node.id });
  const size = Array.isArray(input) ? input.length : typeof input === 'string' ? input.length : 1;
  for (let steps = 0; steps < Math.min(20000, size * 60 + 200); steps++) {
    let outcome: ReturnType<typeof step>;
    try { outcome = step(node, state, input); } catch (error) { return fail(error instanceof StepError ? error.message : 'This block could not run.'); }
    if (outcome.result !== undefined) {
      if (record) frames.push(snapshot(outcome.note, { result: outcome.result }));
      const passed = options.expected === undefined || sameValue(outcome.result, options.expected);
      return { passed, frames, result: outcome.result, expected: options.expected, nodeId: node.id, ...(passed ? {} : { error: `This path returns ${JSON.stringify(outcome.result)}; this input needs ${JSON.stringify(options.expected)}.` }) };
    }
    const exits = graph.edges.filter(edge => edge.source === node.id && edge.port === outcome.port);
    if (record) frames.push(snapshot(outcome.note, { edgeId: exits.length === 1 ? exits[0].id : undefined }));
    if (exits.length !== 1) return fail(exits.length ? `Choose one ${outcome.port} path; this output has several.` : `The packet reached a dead end. Connect the ${outcome.port} output.`);
    const next = graph.nodes.find(n => n.id === exits[0].target); if (!next) return fail('This connection points to a missing block.'); node = next;
  }
  return fail('The packet is looping without finishing. Check your loop-back connection.');
}

export type Suite = { passed: boolean; total: number; passedCount: number; error?: string; nodeId?: string; input?: Value; results: { input: Value; passed: boolean }[] };
export function simulateSuite(graph: Blueprint, inputs: Value[], oracle: (input: Value) => Value): Suite {
  const structural = inspectBlueprint(graph).filter(issue => !issue.message.startsWith('This finishes'));
  if (structural.length) return { passed: false, total: inputs.length, passedCount: 0, error: structural[0].message, nodeId: structural[0].nodeId, results: [] };
  const results: Suite['results'] = []; let first: Simulation | undefined; let firstInput: Value | undefined;
  for (const input of inputs) { const result = simulate(graph, input, { record: false, expected: oracle(input) }); results.push({ input, passed: result.passed }); if (!result.passed && !first) { first = result; firstInput = input; } }
  const passedCount = results.filter(result => result.passed).length;
  return first ? { passed: false, total: inputs.length, passedCount, error: first.error, nodeId: first.nodeId, input: firstInput, results } : { passed: true, total: inputs.length, passedCount, results };
}

// Lays out nodes that have no position: a column per branch depth, rows by distance from the input.
export function autoLayout(graph: { nodes: { id: string; op: Operation; label: string; params?: Params; x?: number; y?: number }[]; edges: Blueprint['edges'] }, previous?: Blueprint): Blueprint {
  const column = new Map<string, number>(), row = new Map<string, number>();
  const start = graph.nodes.find(node => node.op === 'start') || graph.nodes[0];
  const queue = [start.id]; column.set(start.id, 0); row.set(start.id, 0);
  while (queue.length) {
    const current = queue.shift()!; const exits = graph.edges.filter(edge => edge.source === current);
    for (const edge of exits) {
      if (row.has(edge.target)) continue;
      row.set(edge.target, row.get(current)! + 1); column.set(edge.target, column.get(current)! + (edge.port === 'no' ? 1 : 0)); queue.push(edge.target);
    }
  }
  let orphan = 0;
  const nodes = graph.nodes.map(node => {
    const old = previous?.nodes.find(n => n.id === node.id);
    const r = row.get(node.id) ?? ++orphan + 1, c = column.get(node.id) ?? 2;
    return { ...node, params: node.params, x: node.x ?? old?.x ?? 170 + c * 300, y: node.y ?? old?.y ?? 70 + r * 110 };
  });
  return blueprintSchema.parse({ nodes, edges: graph.edges });
}

// Cheap immediate voice preview: adds mentioned concepts, never invents connections.
export function voicePreview(graph: Blueprint, text: string, allowed: Operation[]): Blueprint {
  const hints: [Operation, RegExp, Params | undefined][] = [
    ['initSet', /\b(set|hash ?map|memory|remember(ed)? numbers)\b/i, undefined], ['loop', /\b(loop|iterate|each (number|item)|every (number|item)|one at a time)\b/i, undefined],
    ['has', /\b(seen (it )?before|already seen|already in|in memory)\b/i, undefined], ['add', /\b(remember|store|keep track)\b/i, undefined],
    ['tally', /\b(count|tally)\b/i, undefined], ['accumulate', /\b(running total|add (it |them )?up|sum|total)\b/i, { op: 'add' }],
    ['return', /\b(return true|flag it|found (a|the) (duplicate|repeat))\b/i, { what: 'true' }], ['return', /\b(return false|no duplicate|no repeat)\b/i, { what: 'false' }],
  ];
  const nodes = [...graph.nodes];
  for (const [op, pattern, params] of hints) if (allowed.includes(op) && pattern.test(text) && !nodes.some(node => node.op === op && (!params || JSON.stringify(node.params || {}) === JSON.stringify(params))) && nodes.length < 24) nodes.push({ id: `voice_${op}_${nodes.length}`, op, label: blockInfo(op, params).title, x: 170, y: 70 + nodes.length * 105, ...(params ? { params } : {}) });
  return { ...graph, nodes };
}

export function partialCode(json: string) {
  const start = /"code"\s*:\s*"/.exec(json); if (!start) return '';
  let value = '', escaped = false;
  for (const char of json.slice(start.index + start[0].length)) {
    if (!escaped && char === '"') break;
    value += char;
    if (!escaped && char === '\\') escaped = true; else escaped = false;
  }
  if (escaped) value = value.slice(0, -1);
  try { return JSON.parse('"' + value + '"') as string; } catch { return ''; }
}
