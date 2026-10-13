"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { blueprintSchema, blueprintKey, emptyBlueprint, simulate, simulateSuite, voicePreview, type Blueprint } from './blueprint';
import { allowedOperations, starterCode, validateInput, verificationInputs, type Challenge } from './challenges';
import { browserClient } from './supabase/browser';
import { predictionChoices, type Proposal } from './guidance';
import type { Classroom, Feedback, LearningEvent } from './classroom';
import type { RunReport } from '@/components/CodeWorkspace';

type Document = { blueprint: Blueprint; code: string; blueprint_revision: number; blueprint_note: string; draft_hash: string | null; email?: string; classroom?: Classroom | null; feedback?: Feedback | null };
export type DraftPreview = Proposal & { source: 'AI' | 'hint' | 'voice' | 'history' | 'example' | 'mistake' };
export class SignInRequired extends Error { constructor(action: string) { super(`Sign in to ${action}. Your canvas stays in this browser until then.`); } }
const guestKey = (challengeId: string) => `socrastica:guest:${challengeId}`;
type GuestStore = { blueprint: Blueprint; code: string; events: LearningEvent[] };
function readGuest(challengeId: string): GuestStore | null {
  try { const raw = localStorage.getItem(guestKey(challengeId)); if (!raw) return null; const parsed = JSON.parse(raw); return { blueprint: blueprintSchema.parse(parsed.blueprint), code: String(parsed.code || ''), events: Array.isArray(parsed.events) ? parsed.events : [] }; } catch { return null; }
}
function writeGuest(challengeId: string, store: GuestStore | null) { try { if (store) localStorage.setItem(guestKey(challengeId), JSON.stringify(store)); else localStorage.removeItem(guestKey(challengeId)); } catch { /* Private browsing or blocked storage: the canvas lives in memory only. */ } }

// One hook drives the studio for a signed-in learner (server-backed) or a guest (browser-local).
export function useBlueprintStudio(challenge: Challenge, guest = false) {
  const initial: Document = { blueprint: emptyBlueprint, code: starterCode(challenge), blueprint_revision: 0, blueprint_note: '', draft_hash: null };
  const endpoint = `/api/studio/${challenge.id}`;
  const [document, setDocument] = useState<Document>(initial), [ready, setReady] = useState(false), [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState('Loading canvas…'), [busy, setBusy] = useState(false), [phase, setPhase] = useState(''), [previewCode, setPreviewCode] = useState(''), [focusNode, setFocusNode] = useState<string | null>(null);
  const [preview, setPreview] = useState<DraftPreview | null>(null), [events, setEvents] = useState<LearningEvent[]>([]), [evidenceError, setEvidenceError] = useState(''), [evidenceBusy, setEvidenceBusy] = useState(false), [, setHistoryVersion] = useState(0), [imported, setImported] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  function focusOn(id: string) { setFocusNode(id); setFocusToken(v => v + 1); }
  const current = useRef(document), revision = useRef(0), queue = useRef<Promise<void>>(Promise.resolve()), busyRef = useRef(false), mounted = useRef(true), dirty = useRef(false), undoStack = useRef<Document[]>([]), redoStack = useRef<Document[]>([]), lastEdit = useRef({ key: '', time: 0 }), guestEvents = useRef<LearningEvent[]>([]);
  current.current = document;
  const accept = useCallback((data: Document) => {
    const parsed = { ...data, blueprint: blueprintSchema.parse(data.blueprint) };
    revision.current = parsed.blueprint_revision; current.current = { ...current.current, ...parsed }; dirty.current = false; setDocument(current.current); setSaveStatus(guest ? 'Saved in this browser' : 'Canvas saved');
  }, [guest]);
  const refreshHistory = useCallback(async () => {
    if (guest) { if (mounted.current) setEvents([...guestEvents.current]); return; }
    const response = await fetch(`${endpoint}/history`, { cache: 'no-store' }), data = await response.json(); if (!response.ok) throw new Error(data.error || 'Your journal could not load.');
    if (mounted.current) { setEvents(data.events); setEvidenceError(''); }
  }, [endpoint, guest]);
  const load = useCallback(async () => {
    if (guest) {
      const stored = readGuest(challenge.id);
      guestEvents.current = stored?.events || [];
      if (mounted.current) { accept({ ...initial, blueprint: stored?.blueprint || emptyBlueprint, code: stored?.code ?? initial.code }); setReady(true); }
      return;
    }
    const response = await fetch(endpoint, { cache: 'no-store' }), data = await response.json(); if (!response.ok) throw new Error(data.error); if (!mounted.current) return;
    accept(data); setReady(true);
    // Work started as a guest in this browser moves into the account the first time the activity opens empty.
    const stored = readGuest(challenge.id);
    if (stored && data.blueprint.nodes.length <= 1 && stored.blueprint.nodes.length > 1) { commit(stored.blueprint, stored.code || data.code, false); writeGuest(challenge.id, null); setImported(true); setSaveStatus('Imported your guest canvas; saving…'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept, endpoint, guest, challenge.id]);
  useEffect(() => {
    mounted.current = true; void load().then(refreshHistory).catch(error => { if (mounted.current) setError(error.message || 'Your studio could not load.'); }); return () => { mounted.current = false; };
  }, [load, refreshHistory]);
  const save = useCallback(() => {
    if (!dirty.current) return queue.current; const snapshot = current.current; setSaveStatus('Saving canvas…');
    const task = queue.current.catch(() => {}).then(async () => {
      if (guest) { writeGuest(challenge.id, { blueprint: snapshot.blueprint, code: snapshot.code, events: guestEvents.current }); if (mounted.current && current.current.blueprint === snapshot.blueprint && current.current.code === snapshot.code) accept({ ...snapshot, blueprint_revision: revision.current }); return; }
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blueprint: snapshot.blueprint, code: snapshot.code, revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save the canvas.'); revision.current = data.blueprint_revision;
      if (mounted.current) { if (current.current.blueprint === snapshot.blueprint && current.current.code === snapshot.code) accept(data); else setSaveStatus('Unsaved changes…'); }
    }); queue.current = task; void task.then(() => refreshHistory().catch(() => { if (mounted.current) setEvidenceError('Canvas saved. Journal could not refresh.'); })).catch(error => { if (mounted.current) { setSaveStatus('Not saved — retry saving'); setError(error.message); } }); return task;
  }, [accept, refreshHistory, endpoint, guest, challenge.id]);
  function checkpoint() { undoStack.current = [...undoStack.current.slice(-29), current.current]; redoStack.current = []; setHistoryVersion(v => v + 1); }
  function commit(blueprint: Blueprint, code: string, remember = true) {
    if (busyRef.current) return; if (code === current.current.code && JSON.stringify(blueprint) === JSON.stringify(current.current.blueprint)) return;
    const semanticChange = blueprintKey(blueprint) !== blueprintKey(current.current.blueprint), groupKey = blueprintKey(blueprint) + (code === current.current.code ? '|canvas' : '|code'), now = Date.now();
    if (remember && (groupKey !== lastEdit.current.key || now - lastEdit.current.time > 1200)) checkpoint(); lastEdit.current = { key: groupKey, time: now };
    current.current = { ...current.current, blueprint, code, blueprint_note: semanticChange ? '' : current.current.blueprint_note, draft_hash: semanticChange || code !== current.current.code ? null : current.current.draft_hash }; dirty.current = true; setDocument(current.current); setSaveStatus('Unsaved changes…'); setPhase(''); if (semanticChange) setFocusNode(null);
  }
  function edit(blueprint: Blueprint, code = current.current.code) { setPreview(null); commit(blueprint, code); }
  function undo() { if (busyRef.current) return; const snapshot = undoStack.current.pop(); if (!snapshot) return; redoStack.current.push(current.current); setPreview(null); commit(snapshot.blueprint, snapshot.code, false); lastEdit.current = { key: '', time: 0 }; setHistoryVersion(v => v + 1); }
  function redo() { if (busyRef.current) return; const snapshot = redoStack.current.pop(); if (!snapshot) return; undoStack.current.push(current.current); setPreview(null); commit(snapshot.blueprint, snapshot.code, false); lastEdit.current = { key: '', time: 0 }; setHistoryVersion(v => v + 1); }
  function suggest(proposal: Proposal, source: DraftPreview['source'] = 'hint') { if (busyRef.current) return; setPreview({ ...proposal, source }); focusOn(proposal.focusNode); }
  function applyPreview() {
    if (!preview || preview.source === 'voice' || busyRef.current) return; if (preview.baseKey !== blueprintKey(current.current.blueprint)) { setPreview(null); setError('Your idea changed. Review a new suggestion before applying it.'); return; }
    checkpoint(); commit(preview.blueprint, current.current.code, false); setFocusNode(preview.focusNode); setPreview(null); lastEdit.current = { key: '', time: 0 };
    if (preview.source === 'hint') void recordActivity({ kind: 'hint', action: 'applied', title: preview.title }).catch(() => {});
    if (preview.source === 'example' || preview.source === 'mistake') void recordActivity({ kind: 'hint', action: preview.source, title: preview.title }).catch(() => {});
  }
  function showVoicePreview(text: string) {
    if (busyRef.current) return; const graph = voicePreview(current.current.blueprint, text, allowedOperations(challenge)); if (graph.nodes.length !== current.current.blueprint.nodes.length) setPreview({ blueprint: graph, title: 'Concepts from your voice', explanation: 'These are listening notes. Send your direction to draft the connections.', focusNode: graph.nodes.at(-1)!.id, baseKey: blueprintKey(current.current.blueprint), source: 'voice' });
  }
  useEffect(() => { if (!ready || busy || !dirty.current) return; const timer = setTimeout(() => void save().catch(() => {}), 900); return () => clearTimeout(timer); }, [document.blueprint, document.code, ready, busy, save]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty.current || busyRef.current) { event.preventDefault(); } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, []);
  // Guests get the same evidence locally: predictions and simulations are checked by the same interpreter.
  function localEvent(activity: Record<string, unknown>): { id: string; detail: Record<string, unknown> } {
    const graph = current.current.blueprint; let detail: Record<string, unknown>;
    if (activity.kind === 'prediction') {
      const input = validateInput(challenge, activity.input), trace = simulate(graph, input, { expected: challenge.oracle(input) }), step = Number(activity.step), frame = trace.frames[step], choices = predictionChoices(graph, frame);
      if (!frame || choices.length < 2 || !trace.frames[step + 1]) throw new Error('Choose a branch on a valid simulation step.');
      detail = { input, step, nodeId: frame.nodeId, answer: activity.answer, correct: activity.answer === trace.frames[step + 1].nodeId, expected: trace.frames[step + 1].nodeId, graphKey: blueprintKey(graph) };
    } else if (activity.kind === 'simulation') {
      const input = validateInput(challenge, activity.input), trace = simulate(graph, input, { expected: challenge.oracle(input) }), suite = simulateSuite(graph, verificationInputs(challenge), challenge.oracle);
      detail = { input, passed: trace.passed, error: trace.error || null, nodeId: trace.nodeId || null, suitePassed: suite.passed, passedCount: suite.passedCount, total: suite.total, graphKey: blueprintKey(graph) };
    } else if (activity.kind === 'reflection') detail = { text: activity.text }; else detail = { action: activity.action, title: activity.title };
    const event: LearningEvent = { id: crypto.randomUUID(), kind: String(activity.kind), detail, blueprint: activity.kind === 'simulation' ? graph : null, created_at: new Date().toISOString(), revision: revision.current, challenge_id: challenge.id };
    guestEvents.current = [event, ...guestEvents.current].slice(0, 100); writeGuest(challenge.id, { blueprint: graph, code: current.current.code, events: guestEvents.current });
    return { id: event.id, detail };
  }
  async function recordActivity(activity: Record<string, unknown>) {
    setEvidenceBusy(true); setEvidenceError(''); try {
      await save();
      if (guest) { const data = localEvent(activity); await refreshHistory(); return data; }
      const response = await fetch(`${endpoint}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...activity, revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await refreshHistory(); return data;
    } catch (error) { setEvidenceError(error instanceof Error ? error.message : 'Learning evidence could not save.'); throw error; } finally { if (mounted.current) setEvidenceBusy(false); }
  }
  async function direct(text: string) {
    if (guest) { setError(new SignInRequired('direct the AI drafter').message); throw new SignInRequired('direct the AI drafter'); }
    if (busyRef.current) throw new Error('The drafter is already working.'); busyRef.current = true; setBusy(true); setError(''); setPhase('Shaping your idea…');
    try {
      await save(); const baseKey = blueprintKey(current.current.blueprint); const response = await fetch(`${endpoint}/direct`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (mounted.current) { const blueprint = blueprintSchema.parse(data.blueprint); setPreview({ blueprint, title: 'Here is what I understood', explanation: data.note, focusNode: data.focusNode || blueprint.nodes[0].id, baseKey, source: 'AI' }); setFocusNode(data.focusNode); await refreshHistory().catch(() => setEvidenceError('Proposal ready. Journal could not refresh.')); }
    } catch (error) { setError(error instanceof Error ? error.message : 'The drafter could not update your canvas.'); setPreview(null); throw error; } finally { busyRef.current = false; if (mounted.current) { setBusy(false); setPhase(''); } }
  }
  async function generate() {
    if (guest) { setError(new SignInRequired('draft code with AI').message); return; }
    if (busyRef.current || preview) return; busyRef.current = true; setBusy(true); setError(''); setPreviewCode(''); setPhase('Drafting from your blueprint…'); const before = current.current;
    try {
      await save(); const response = await fetch(`${endpoint}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: revision.current }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.error); } if (!response.body) throw new Error('The code stream is unavailable.');
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', finished = false;
      try { while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let boundary; while ((boundary = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1); if (!line) continue; const event = JSON.parse(line); if (event.type === 'error') throw new Error(event.message);
        if (mounted.current) { if (event.type === 'code') setPreviewCode(event.code); if (event.type === 'phase') setPhase(event.message); if (event.type === 'done') { undoStack.current = [...undoStack.current.slice(-29), before]; redoStack.current = []; setHistoryVersion(v => v + 1); accept(event.document); setPreviewCode(''); setPhase(`Draft checked on ${event.checked} sample inputs`); finished = true; } }
      } } } finally { reader.releaseLock(); } if (!finished) throw new Error('The draft was interrupted. Reload to check whether it was saved.'); await refreshHistory().catch(() => setEvidenceError('Draft saved. Journal could not refresh.'));
    } catch (error) { if (mounted.current) { setError(error instanceof Error ? error.message : 'The draft could not be completed.'); setPreviewCode(''); setPhase(''); } } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function runTests(): Promise<RunReport> {
    if (guest) throw new SignInRequired('run your code in the sandbox');
    if (busyRef.current) throw new Error('The studio is busy. Try again in a moment.'); busyRef.current = true; setBusy(true); setError('');
    try {
      await save(); const response = await fetch(`${endpoint}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: revision.current }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Code could not run.'); return data;
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function joinClass(code: string, name: string) { if (guest) throw new SignInRequired('join a class'); if (busyRef.current) return; busyRef.current = true; setBusy(true); try { await save(); const response = await fetch('/api/classrooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name, challenge: challenge.id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); await refreshHistory(); } finally { busyRef.current = false; setBusy(false); } }
  async function leaveClass() { if (busyRef.current) return; busyRef.current = true; setBusy(true); try { await save(); const response = await fetch('/api/classrooms/join', { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); } finally { busyRef.current = false; setBusy(false); } }
  async function signOut() { try { if (busyRef.current) return; await save(); const { error } = await browserClient().auth.signOut(); if (error) throw error; window.location.assign('/login'); } catch { setError('Save your canvas and try signing out again.'); } }
  return { ...document, challenge, guest, imported, ready, error, setError, saveStatus, busy, phase, previewCode, focusNode, focusToken, focusOn, edit, save, direct, generate, runTests, signOut, preview, discardPreview: () => setPreview(null), suggest, applyPreview, showVoicePreview, undo, redo, canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0, events, refreshHistory, recordActivity, evidenceBusy, evidenceError, joinClass, leaveClass, reload: load };
}
