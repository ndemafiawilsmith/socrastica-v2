"use client";

import { useRef } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, BookOpen, Check, ChevronRight, Code2, Flag, GitBranch, Lightbulb, LockKeyhole, MessageSquare, Settings2, Sparkles, X } from "lucide-react";
import Logo from "@/components/Logo";
import SocraticChat from "@/components/SocraticChat";
import FlowchartViewer from "@/components/FlowchartViewer";
import CodeWorkspace from "@/components/CodeWorkspace";
import { graphToMermaid } from "@/lib/reasoning";
import { useLearningSession } from "@/lib/use-learning-session";

const steps = [ { name: "Understand", hint: "Meet the challenge", icon: BookOpen }, { name: "Reason", hint: "Think out loud", icon: MessageSquare }, { name: "Map", hint: "See the structure", icon: GitBranch }, { name: "Build", hint: "Make it work", icon: Code2 } ];

export default function Home() {
  const { step, setStep, unlocked, messages, graph, reasoningReady, code, setCode, email, ready, loadError, saveStatus, busy, signingOut, send, advance, signOut, save } = useLearningSession();
  const settings = useRef<HTMLDialogElement>(null);
  if (!ready) return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"><Logo/><h1 className="text-2xl">Your learning space</h1><p role={loadError ? "alert" : "status"} className="text-sm leading-7 text-mist">{loadError || "Loading your saved progress…"}</p>{loadError && <button className="primary" onClick={() => window.location.reload()}>Retry loading</button>}<a className="text-sm text-iris" href="/">Back to home</a><button className="secondary" disabled={signingOut} onClick={() => void signOut()}>Sign out</button></main>;
  return <MotionConfig reducedMotion="user"><div className="mx-auto min-h-screen max-w-[1600px] px-4 sm:px-8 lg:px-12">
    <header className="flex h-24 items-center justify-between border-b border-white/[0.07]">
      <a href="/" className="flex items-center gap-3"><Logo/><span className="text-xl font-semibold tracking-[-.045em]">socrastica<span className="text-iris">.</span></span></a>
      <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-xs text-mist sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-mint"/> A little reasoning. A lot of possibility.</div>
      <button className="glass flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-3" onClick={() => settings.current?.showModal()} aria-label="Open profile and settings"><span className="grid h-8 w-8 place-items-center rounded-full border border-iris/25 bg-iris/10 text-xs text-iris">{email.slice(0, 2).toUpperCase()}</span><Settings2 size={15} className="text-mist"/></button>
    </header>
    <main className="py-9 lg:py-11">
      <div className="mb-7 flex items-center gap-2 text-xs text-mist"><span>Learning studio</span><ChevronRight size={12}/><span className="text-[#d7d8e6]">Arrays & hashing</span></div>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-medium tracking-[-.045em] sm:text-[38px]">Think it through. <span className="text-iris">Then make it real.</span></h1><p className="mt-3 text-sm text-mist">A space to build your intuition, one question at a time.</p></div><span className="flex items-center gap-2 rounded-full border border-iris/15 bg-iris/[0.06] px-3 py-1.5 text-[11px] text-iris"><Sparkles size={12}/> Guided practice</span></div>
      <nav aria-label="Learning stages" className="glass mb-7 grid grid-cols-4 rounded-2xl p-2">
        {steps.map((item, index) => <button key={item.name} disabled={busy || index > unlocked} onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`relative flex items-center justify-center gap-3 rounded-xl px-2 py-4 text-left transition sm:justify-start sm:px-5 ${step === index ? "bg-iris/10 ring-1 ring-inset ring-iris/20" : "hover:bg-white/[0.025]"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${step === index ? "border-iris/30 bg-iris/15 text-iris" : "border-white/10 text-mist"}`}>{index < unlocked ? <Check size={15}/> : <item.icon size={15}/>}</span><span className="hidden sm:block"><span className={`block text-xs font-medium ${step === index ? "text-iris" : "text-[#d0d2e3]"}`}>{index + 1}. {item.name}</span><span className="mt-1 hidden text-[10px] text-mist lg:block">{item.hint}</span></span><span className="sr-only sm:hidden">{item.name}</span></button>)}
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="panel">
          <div className="panel-title"><Flag size={15} className="text-iris"/> The challenge <span className="ml-auto text-[10px] text-mist">01 / 01</span></div>
          <div className="p-5"><div className="mb-4 flex gap-2"><span className="rounded-md bg-mint/10 px-2 py-1 text-[10px] text-mint">Beginner</span><span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-mist">Arrays</span></div><h2 className="text-xl font-medium tracking-tight">Spot the duplicate</h2><p className="mt-3 text-sm leading-7 text-mist">Given a list of numbers, determine whether any value appears more than once.</p><p className="mt-3 text-sm leading-7 text-mist">Return <code className="text-iris">true</code> if it does. Otherwise, return <code className="text-iris">false</code>.</p>
            <div className="my-6 rounded-xl border border-white/[0.07] bg-black/15 p-4"><p className="eyebrow mb-3">An example</p><code className="text-xs text-[#d5d8eb]">[1, 2, 3, <span className="rounded bg-iris/20 px-1 text-iris">1</span>]</code><div className="my-3 h-px bg-white/[0.07]"/><div className="flex items-center gap-2 font-mono text-xs"><ArrowRight size={12} className="text-mist"/><span className="text-mint">true</span><span className="ml-auto text-[10px] text-mist">1 appears twice</span></div></div>
            <p className="eyebrow mb-3">Keep in mind</p><ul className="space-y-3 text-xs leading-5 text-mist"><li>• The list can be empty.</li><li>• Numbers can be negative.</li><li>• Can you do it in a single pass?</li></ul>
          </div><div className="flex gap-3 border-t border-white/[0.07] bg-iris/[0.035] p-5"><Lightbulb className="mt-0.5 shrink-0 text-iris" size={16}/><p className="text-xs leading-6 text-mist">The goal isn’t just the right answer. It’s understanding <span className="text-[#dfdaee]">why it works.</span></p></div>
        </aside>
        <div className="min-w-0">
          <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}>
            {step === 0 ? <section className="panel relative flex min-h-[470px] flex-col items-center justify-center px-6 py-12 text-center"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#9b7dea12,transparent_65%)]"/><div className="relative max-w-lg"><div className="mx-auto mb-8 grid h-24 w-24 place-items-center rounded-3xl border border-iris/20 bg-iris/5 shadow-glow"><Logo className="h-16 w-16"/></div><p className="eyebrow text-iris">First, the thinking</p><h2 className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">Every solution starts<br/>with a little curiosity.</h2><p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-mist">Read the challenge on the left. Then talk through your approach with your mentor—no syntax, no pressure.</p><button className="primary mt-7" onClick={advance}>Let’s think it through <ArrowRight size={15}/></button><p className="mt-4 text-[10px] text-mist">Reason → visualize → build</p></div></section> : <div className={`grid gap-5 ${step >= 2 ? "xl:grid-cols-2" : ""}`}><SocraticChat messages={messages} onSend={send} busy={busy}/>{step >= 2 && graph && <FlowchartViewer diagram={graphToMermaid(graph)}/>}</div>}
            {step === 3 && <div className="mt-5"><CodeWorkspace code={code} onChange={setCode}/></div>}
          </motion.div></AnimatePresence>
          {step > 0 && step < 3 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-mist"><LockKeyhole size={13}/>{step === 1 ? "Your mentor will open the map when your approach is ready." : "Review your map, then turn your approach into code."}</p><button className="primary" disabled={busy || (step === 1 && !reasoningReady)} onClick={advance}>{step === 1 ? "Explore the logic map" : "Open code workspace"}<ArrowRight size={14}/></button></div>}
        </div>
      </div>
    </main>
    <footer className="mb-7 mt-3 flex flex-wrap justify-between gap-3 border-t border-white/[0.07] pt-5 text-[10px] text-mist"><span>Socrastica · Learn to think like a developer.</span><span role="status">{saveStatus}</span><button className="text-iris hover:text-white" onClick={() => void save().catch(() => {})}>Save progress</button></footer>
    <dialog ref={settings} className="panel m-auto w-[calc(100%-2rem)] max-w-sm bg-[#181b2d] p-6 text-white backdrop:bg-black/60" onClick={e => { if (e.target === e.currentTarget) settings.current?.close(); }}><div className="flex items-center justify-between"><h2 className="text-lg font-medium">Your learning space</h2><button className="icon-button" aria-label="Close settings" onClick={() => settings.current?.close()}><X size={18}/></button></div><p className="mt-5 text-sm text-mist">Signed in as {email}.</p><p className="mt-3 text-sm leading-6 text-mist">Your code and learning progress are saved to your account. Mentor replies use a shared testing allowance of 20 requests per person per day. Code runs against eight tests, with a limit of 20 runs per person per day.</p><button className="secondary mt-6" onClick={() => settings.current?.close()}>Back to practice</button><button className="secondary ml-3 mt-6" disabled={signingOut || busy} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></dialog>
  </div></MotionConfig>;
}
