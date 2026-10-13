import { blocks, blueprintKey, blueprintSchema, inspectBlueprint, type Blueprint, type Operation, type TraceFrame } from './blueprint';

export const lessons: Record<Operation, { title: string; receives: string; changes: string; explains: string }> = {
  start: { title: 'Start with the list', receives: 'The numbers in the input packet.', changes: 'Nothing yet. This is the entrance to your idea.', explains: 'Connect its output to the first thing your solution should do.' },
  initSet: { title: 'A shelf for remembered numbers', receives: 'The flow of your solution.', changes: 'Creates empty memory. In code, this is a Set.', explains: 'Start with an empty shelf once per run. Creating it inside the loop would erase what you remembered.' },
  loop: { title: 'Take one number at a time', receives: 'The list and the next unread position.', changes: 'Picks up the next number and moves the read position forward.', explains: 'Yes means a number is available. No means the list is finished, including an empty list.' },
  has: { title: 'Have we met this number?', receives: 'The current number and remembered numbers.', changes: 'Checks memory without changing it.', explains: 'Yes means a repeat. No means this number is new. Check before remembering it, or every number will look like a repeat.' },
  add: { title: 'Remember this number', receives: 'The current number and an existing memory shelf.', changes: 'Adds this number to memory. Earlier numbers stay there.', explains: 'After remembering a new number, return to the loop to take another.' },
  returnTrue: { title: 'We found a repeat', receives: 'A path that has established a duplicate.', changes: 'Ends this run with true.', explains: 'Returning ends the whole run. It does not simply move to the next number.' },
  returnFalse: { title: 'We finished without a repeat', receives: 'A path that has ruled out duplicates.', changes: 'Ends this run with false.', explains: 'Usually this belongs after the list is exhausted. One new number alone does not rule out a later repeat.' },
};

export type Proposal = { blueprint: Blueprint; title: string; explanation: string; focusNode: string; baseKey: string };
export type Guidance = { title: string; explanation: string; nodeId?: string; proposal?: Proposal };
export function blueprintDiff(before: Blueprint, after: Blueprint) {
  const added = after.nodes.filter(node => !before.nodes.some(old => old.id === node.id));
  const removed = before.nodes.filter(node => !after.nodes.some(next => next.id === node.id));
  const changed = after.nodes.filter(node => before.nodes.some(old => old.id === node.id && (old.op !== node.op || old.label !== node.label)));
  const edgeKey = (edge: Blueprint['edges'][number]) => `${edge.source}:${edge.port}:${edge.target}`;
  const connected = after.edges.filter(edge => !before.edges.some(old => edgeKey(old) === edgeKey(edge))).length;
  const disconnected = before.edges.filter(edge => !after.edges.some(next => edgeKey(next) === edgeKey(edge))).length;
  return { added, removed, changed, connected, disconnected };
}
export function guidanceFor(graph: Blueprint, problem?: { nodeId?: string; error?: string }): Guidance {
  const start = graph.nodes.find(node => node.op === 'start');
  const memory = graph.nodes.find(node => node.op === 'initSet');
  const check = graph.nodes.find(node => node.op === 'has' || node.op === 'add');
  const makeProposal = (blueprint: Blueprint, title: string, explanation: string, focusNode: string): Proposal | undefined => {
    const valid = blueprintSchema.safeParse(blueprint);
    return valid.success ? { blueprint: valid.data, title, explanation, focusNode, baseKey: blueprintKey(graph) } : undefined;
  };
  if (start && check && !memory) {
    const id = `memory_${graph.nodes.length}`;
    const exits = graph.edges.filter(edge => edge.source === start.id && edge.port === 'next');
    const next = exits.length === 1 ? exits[0].target : undefined;
    const draft: Blueprint = { nodes: [...graph.nodes, { id, op: 'initSet', label: 'Memory: numbers we have seen', x: start.x + 260, y: start.y + 100 }], edges: [...graph.edges.filter(edge => !exits.includes(edge)), { id: `hint_in_${graph.edges.length}`, source: start.id, target: id, port: 'next' }, ...(next ? [{ id: `hint_out_${graph.edges.length}`, source: id, target: next, port: 'next' as const }] : [])] };
    return { title: 'Your check needs a memory shelf', explanation: 'To recognize a number again, remember earlier numbers somewhere. An empty memory shelf starts each run; remembering fills it as the packet moves.', nodeId: check.id, proposal: exits.length <= 1 ? makeProposal(draft, 'Try a memory block', 'Insert empty memory after Input. Keep the rest of your approach.', id) : undefined };
  }
  const issue = inspectBlueprint(graph)[0];
  const node = graph.nodes.find(node => node.id === (problem?.nodeId || issue?.nodeId));
  if (node) {
    const missing = blocks[node.op].ports.find(port => !graph.edges.some(edge => edge.source === node.id && edge.port === port));
    const nextOps: Partial<Record<Operation, Record<string, Operation>>> = { start: { next: 'loop' }, initSet: { next: 'loop' }, loop: { yes: 'has', no: 'returnFalse' }, has: { yes: 'returnTrue', no: 'add' }, add: { next: 'loop' } };
    const targetOp = missing && nextOps[node.op]?.[missing];
    if (missing && targetOp) {
      const candidates = graph.nodes.filter(n => n.op === targetOp);
      const target = candidates[0] || { id: `suggest_${targetOp}_${graph.nodes.length}`, op: targetOp, label: blocks[targetOp].title, x: node.x + (missing === 'no' ? 270 : 0), y: node.y + 140 };
      const draft: Blueprint = { nodes: candidates.length ? graph.nodes : [...graph.nodes, target], edges: [...graph.edges, { id: `hint_edge_${graph.edges.length}`, source: node.id, target: target.id, port: missing as 'next' | 'yes' | 'no' }] };
      return { title: 'Give this path somewhere to go', explanation: `${issue?.message || problem?.error || 'This packet has no next step.'} ${lessons[node.op].explains}`, nodeId: node.id, proposal: candidates.length <= 1 ? makeProposal(draft, `Try ${blocks[targetOp].title}`, 'Preview one possible next step. The remaining decisions stay yours.', target.id) : undefined };
    }
    return { title: 'Explore this decision', explanation: problem?.error || issue?.message || lessons[node.op].explains, nodeId: node.id };
  }
  return { title: 'Your idea is ready for an experiment', explanation: 'Play a packet through the blueprint. Try an empty list and a repeat at the end, then compare what happens.' };
}
export function predictionChoices(graph: Blueprint, frame?: TraceFrame) {
  if (!frame) return [];
  return graph.edges.filter(edge => edge.source === frame.nodeId).map(edge => ({ answer: edge.target, label: `${edge.port === 'next' ? 'Next' : edge.port}: ${graph.nodes.find(node => node.id === edge.target)?.label || edge.target}` }));
}
