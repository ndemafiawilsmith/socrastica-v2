"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles, LoaderCircle } from "lucide-react";
import type { Message } from "@/lib/mentor";

type Props = { messages: Message[]; onSend: (text: string) => Promise<void>; busy: boolean };
export default function SocraticChat({ messages, onSend, busy }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    const text = draft.trim(); setDraft(""); setError("");
    try { await onSend(text); } catch (cause) { setDraft(text); setError(cause instanceof Error ? cause.message : "Your message couldn't be sent. Please try again."); }
  }
  return (
    <section className="panel flex min-h-[470px] flex-col" aria-label="Socratic mentor">
      <div className="panel-title"><Sparkles size={16} className="text-iris"/> Your thinking partner <span className="ml-auto rounded-full bg-mint/10 px-2 py-1 text-[10px] text-mint">AI mentor</span></div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6 max-h-[440px]" role="log" aria-live="polite" aria-relevant="additions">
        <div className="eyebrow text-center">Good code starts with a good question</div>
        {messages.map(message => <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={message.id} className={message.role === "student" ? "ml-8" : "mr-3"}>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-mist">{message.role === "mentor" && <Sparkles size={12} className="text-iris"/>}{message.role === "mentor" ? "Socrastica" : "You"}</div>
          <div className={`whitespace-pre-wrap rounded-2xl border px-4 py-3.5 text-sm leading-7 ${message.role === "mentor" ? "rounded-tl-sm border-white/10 bg-white/[0.035] text-[#d8d9e8]" : "rounded-tr-sm border-iris/20 bg-iris/10 text-[#e4ddff]"}`}>{message.content}</div>
        </motion.div>)}
        {busy && <div className="flex items-center gap-2 text-xs text-mist"><LoaderCircle size={14} className="animate-spin"/> Thinking with you…</div>}
        <div ref={end}/>
      </div>
      <form onSubmit={submit} className="mt-auto border-t border-white/[0.07] p-4">
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/15 p-2 focus-within:border-iris/60 focus-within:shadow-glow">
          <label htmlFor="thought" className="sr-only">Explain your approach</label>
          <textarea id="thought" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} rows={2} placeholder="Explain your approach in plain English…" className="min-w-0 flex-1 resize-none bg-transparent p-2 text-sm leading-6 outline-none placeholder:text-mist/60"/>
          <button type="submit" disabled={!draft.trim() || busy} aria-label="Send your reasoning" className="primary h-9 w-9 shrink-0 rounded-lg p-0"><ArrowUp size={18}/></button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
        <p className="mt-3 text-center text-[10px] text-mist">Your ideas first. Guidance when you need it.</p>
      </form>
    </section>
  );
}
