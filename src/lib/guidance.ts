import { blockInfo, blueprintKey, blueprintSchema, inspectBlueprint, portsOf, type Blueprint, type BlueprintNode, type Operation, type Params, type TraceFrame } from './blueprint';
import type { Challenge } from './challenges';

export const lessons: Record<Operation, { title: string; receives: string; changes: string; explains: string }> = {
  start: { title: 'Start with the input', receives: 'The input packet.', changes: 'Nothing yet. This is the entrance to your idea.', explains: 'Connect its output to the first thing your solution should do.' },
  initSet: { title: 'A shelf for remembered numbers', receives: 'The flow of your solution.', changes: 'Creates empty memory. In code, this is a Set.', explains: 'Start with an empty shelf once per run. Creating it inside the loop would erase what you remembered.' },
  loop: { title: 'Take one item at a time', receives: 'The list and the next unread position.', changes: 'Picks up the next item as the current item and moves the read position forward.', explains: 'Yes means an item is available. No means the list is finished, including an empty list.' },
  has: { title: 'Have we met this number?', receives: 'The current item and remembered numbers.', changes: 'Checks memory without changing it.', explains: 'Yes means a repeat. No means this number is new. Check before remembering it, or every number will look like a repeat.' },
  add: { title: 'Remember this number', receives: 'The current item and an existing memory shelf.', changes: 'Adds this number to memory. Earlier numbers stay there.', explains: 'After remembering a new number, return to the loop to take another.' },
  set: { title: 'Start or keep a number', receives: 'The current item or a fixed starting value.', changes: 'Sets the total or the count.', explains: 'A running total usually starts at 0, a product at 1, and a “best so far” with the first item.' },
  accumulate: { title: 'Fold the item into the total', receives: 'The current item and the total so far.', changes: 'Adds or multiplies the current item into the total.', explains: 'This belongs inside the loop so every item contributes once. Return to the loop afterwards.' },
  tally: { title: 'Count one more', receives: 'The count so far.', changes: 'Increases the count by one.', explains: 'Place it on the path that should be counted. Items on the other path are skipped.' },
  math: { title: 'Change a number', receives: 'The value or the total.', changes: 'Applies one arithmetic step with a fixed number or with the count or total.', explains: 'Order matters: a formula like ×1.8 then +32 gives a different answer from +32 then ×1.8.' },
  compare: { title: 'Make a decision', receives: 'Two numbers, or the text.', changes: 'Nothing. It chooses the yes or no path.', explains: 'Think about the boundary: does zero belong on the yes side or the no side?' },
  transform: { title: 'Reshape the value', receives: 'The value as text or a list.', changes: 'Replaces the value with its reversed, lowercased, trimmed, sorted, or counted form.', explains: 'Each transform works on the value as it is right now, so order matters.' },
  return: { title: 'Finish with an answer', receives: 'A path that has established the answer.', changes: 'Ends the whole run with the chosen answer.', explains: 'Returning ends everything. It does not move to the next item. Inside a loop, return only when the answer is certain.' },
};

export type Proposal = { blueprint: Blueprint; title: string; explanation: string; focusNode: string; baseKey: string };
export type Guidance = { title: string; explanation: string; nodeId?: string; proposal?: Proposal };
export function blueprintDiff(before: Blueprint, after: Blueprint) {
  const added = after.nodes.filter(node => !before.nodes.some(old => old.id === node.id));
  const removed = before.nodes.filter(node => !after.nodes.some(next => next.id === node.id));
  const changed = after.nodes.filter(node => before.nodes.some(old => old.id === node.id && (old.op !== node.op || old.label !== node.label || JSON.stringify(old.params || {}) !== JSON.stringify(node.params || {}))));
  const edgeKey = (edge: Blueprint['edges'][number]) => `${edge.source}:${edge.port}:${edge.target}`;
  const connected = after.edges.filter(edge => !before.edges.some(old => edgeKey(old) === edgeKey(edge))).length;
  const disconnected = before.edges.filter(edge => !after.edges.some(next => edgeKey(next) === edgeKey(edge))).length;
  return { added, removed, changed, connected, disconnected };
}
const sameBlock = (a: { op: Operation; params?: Params }, b: { op: Operation; params?: Params }) => a.op === b.op && JSON.stringify(a.params || {}) === JSON.stringify(b.params || {});

export function guidanceFor(graph: Blueprint, challenge: Challenge, problem?: { nodeId?: string; error?: string }): Guidance {
  const start = graph.nodes.find(node => node.op === 'start');
  const memory = graph.nodes.find(node => node.op === 'initSet');
  const check = graph.nodes.find(node => node.op === 'has' || node.op === 'add');
  const makeProposal = (blueprint: Blueprint, title: string, explanation: string, focusNode: string): Proposal | undefined => {
    const valid = blueprintSchema.safeParse(blueprint);
    return valid.success ? { blueprint: valid.data, title, explanation, focusNode, baseKey: blueprintKey(graph) } : undefined;
  };
  if (start && check && !memory && challenge.library.some(preset => preset.op === 'initSet')) {
    const id = `memory_${graph.nodes.length}`;
    const exits = graph.edges.filter(edge => edge.source === start.id && edge.port === 'next');
    const next = exits.length === 1 ? exits[0].target : undefined;
    const draft: Blueprint = { nodes: [...graph.nodes, { id, op: 'initSet', label: 'Memory: numbers we have seen', x: start.x + 260, y: start.y + 100 }], edges: [...graph.edges.filter(edge => !exits.includes(edge)), { id: `hint_in_${graph.edges.length}`, source: start.id, target: id, port: 'next' }, ...(next ? [{ id: `hint_out_${graph.edges.length}`, source: id, target: next, port: 'next' as const }] : [])] };
    return { title: 'Your check needs a memory shelf', explanation: 'To recognize a number again, remember earlier numbers somewhere. An empty memory shelf starts each run; remembering fills it as the packet moves.', nodeId: check.id, proposal: exits.length <= 1 ? makeProposal(draft, 'Try a memory block', 'Insert empty memory after Input. Keep the rest of your approach.', id) : undefined };
  }
  const issue = inspectBlueprint(graph)[0];
  const node = graph.nodes.find(node => node.id === (problem?.nodeId || issue?.nodeId));
  if (node) {
    const missing = portsOf[node.op].find(port => !graph.edges.some(edge => edge.source === node.id && edge.port === port));
    // Suggest what the reference solution connects after a block like this one.
    const twin = challenge.reference.nodes.find(candidate => sameBlock(candidate, node)) || challenge.reference.nodes.find(candidate => candidate.op === node.op);
    const referenceEdge = twin && missing ? challenge.reference.edges.find(edge => edge.source === twin.id && edge.port === missing) : undefined;
    const suggested = referenceEdge ? challenge.reference.nodes.find(candidate => candidate.id === referenceEdge.target) : undefined;
    if (missing && suggested) {
      const candidates = graph.nodes.filter(candidate => sameBlock(candidate, suggested));
      const target: BlueprintNode = candidates[0] || { id: `suggest_${suggested.op}_${graph.nodes.length}`, op: suggested.op, label: blockInfo(suggested.op, suggested.params).title, x: node.x + (missing === 'no' ? 270 : 0), y: node.y + 140, ...(suggested.params ? { params: suggested.params } : {}) };
      const draft: Blueprint = { nodes: candidates.length ? graph.nodes : [...graph.nodes, target], edges: [...graph.edges, { id: `hint_edge_${graph.edges.length}`, source: node.id, target: target.id, port: missing }] };
      return { title: 'Give this path somewhere to go', explanation: `${issue?.message || problem?.error || 'This packet has no next step.'} ${lessons[node.op].explains}`, nodeId: node.id, proposal: candidates.length <= 1 ? makeProposal(draft, `Try ${blockInfo(suggested.op, suggested.params).title}`, 'Preview one possible next step. The remaining decisions stay yours.', target.id) : undefined };
    }
    return { title: 'Explore this decision', explanation: problem?.error || issue?.message || lessons[node.op].explains, nodeId: node.id };
  }
  return { title: 'Your idea is ready for an experiment', explanation: `Play a packet through the blueprint. Try ${JSON.stringify(challenge.sampleCases[1]?.input ?? challenge.sample)} and ${JSON.stringify(challenge.sampleCases[2]?.input ?? challenge.sample)}, then compare what happens.` };
}
export function predictionChoices(graph: Blueprint, frame?: TraceFrame) {
  if (!frame) return [];
  return graph.edges.filter(edge => edge.source === frame.nodeId).map(edge => ({ answer: edge.target, label: `${edge.port === 'next' ? 'Next' : edge.port}: ${graph.nodes.find(node => node.id === edge.target)?.label || edge.target}` }));
}
