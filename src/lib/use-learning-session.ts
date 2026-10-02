"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { starterCode, type Message } from '@/lib/mentor';
import { welcomeMessage } from '@/lib/learning';
import { browserClient } from '@/lib/supabase/browser';
import { graphSchema, type ReasoningGraph } from '@/lib/reasoning';
type Progress = { code: string; step: number; unlocked: number };
export function useLearningSession() {
  const [step, setStep] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [graph, setGraph] = useState<ReasoningGraph | null>(null);
  const [reasoningReady, setReasoningReady] = useState(false);
  const [code, setCode] = useState(starterCode);
  const [email, setEmail] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Loading your progress…');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const version = useRef(0);
  const current = useRef<Progress>({ code, step, unlocked });
  current.current = { code, step, unlocked };
  const enqueueSave = useCallback((snapshot: Progress) => {
    const ticket = ++version.current;
    setSaveStatus('Saving…');
    const task = queue.current.catch(() => {}).then(async () => {
      const response = await fetch('/api/progress', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your progress.');
    });
    queue.current = task;
    void task.then(() => { if (ticket === version.current) setSaveStatus('Progress saved'); }, () => { if (ticket === version.current) setSaveStatus('Not saved — use Save progress to retry'); });
    return task;
  }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/progress', { cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your progress.');
      if (!active) return;
      setCode(data.code); setStep(data.step); setUnlocked(data.unlocked); setMessages(data.messages); setReasoningReady(data.reasoning_ready); setGraph(data.reasoning_graph ? graphSchema.parse(data.reasoning_graph) : null); setEmail(data.email || ''); setReady(true); setSaveStatus('Progress loaded');
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load your progress.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || signingOut) return;
    version.current += 1;
    setSaveStatus('Unsaved changes…');
    const timer = setTimeout(() => { void enqueueSave({ code, step, unlocked }).catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [code, step, unlocked, ready, signingOut, enqueueSave]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (ready && !['Progress saved', 'Progress loaded'].includes(saveStatus)) { event.preventDefault(); } }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [ready, saveStatus]);
  async function send(text: string) {
    setBusy(true);
    try {
      await enqueueSave(current.current);
      const response = await fetch('/api/mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your mentor is unavailable.');
      setMessages(data.messages);
      setReasoningReady(data.reasoning_ready); setGraph(data.reasoning_graph ? graphSchema.parse(data.reasoning_graph) : null);
      setStep(data.step); setUnlocked(data.unlocked);
    } finally { setBusy(false); }
  }
  async function signOut() {
    setSigningOut(true);
    try {
      if (ready) await enqueueSave(current.current);
      const { error } = await browserClient().auth.signOut();
      if (error) throw error;
      window.location.assign('/login');
    } catch { setSaveStatus('Could not save or sign out. Please retry.'); setSigningOut(false); }
  }
  function advance() { if(busy || (step>=1 && !reasoningReady)) return; const next = Math.min(3, step + 1); setStep(next); setUnlocked(value => Math.max(value, next)); }
  return { step, setStep, unlocked, messages, graph, reasoningReady, code, setCode, email, ready, loadError, saveStatus, busy, signingOut, send, advance, signOut, save: () => enqueueSave(current.current) };
}
