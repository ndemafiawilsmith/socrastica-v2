"use client";

import Link from 'next/link';
import { useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, GitBranch, GraduationCap, Lightbulb, Menu, Mic, Play, RotateCcw, X } from 'lucide-react';
import Logo from '@/components/Logo';

const steps = [
  ['Explain your idea', 'Speak or type how you would solve the problem.'],
  ['Build your plan', 'Connect blocks. Review AI suggestions before applying them.'],
  ['See what happens', 'Watch numbers move, predict the next step, and fix mistakes.'],
  ['Understand the code', 'Let AI draft the code. Select a block to see the part it belongs to.'],
];
const questions = [
  ['Do I need to know how to code?', 'No. Start with an idea in your own words. Blocks and examples help you understand the logic before you meet the code.'],
  ['What can I learn right now?', 'Choose from 25 activities with money, numbers, lists, and text. Try a naira-to-dollar converter, find an average, reverse a word, or spot a repeated number. You can start without an account.'],
  ['Can I learn with my class?', 'Yes. Join with your instructor’s class code to share your work and get feedback. Your earlier private journal stays private. You can return to private practice anytime.'],
];

function LearningPreview() {
  const [step, setStep] = useState(0);
  const values = [1, 2, 3, 2];
  const seen = values.slice(0, Math.min(step, 3));
  const repeated = step === 4;
  const note = repeated ? '2 is already in memory. We found a repeat.' : step ? `${values[step - 1]} is new. Remember it and continue.` : 'Follow one number at a time. See how the program remembers.';
  return <div className="landing-example panel" aria-label="Interactive example: find a repeated number">
    <div className="landing-example-header"><span className="flex items-center gap-2"><GitBranch size={14}/>Find a repeated number</span><span className="landing-demo-label">TRY AN EXAMPLE</span></div>
    <div className="landing-example-body">
      <p className="landing-example-idea"><Mic size={15}/><span>“I’ll remember each number and check for a repeat.”</span></p>
      <div className="landing-packet" aria-label="Input numbers: 1, 2, 3, 2">{values.map((value, index) => <span key={index} className={`landing-number ${index === step - 1 ? 'number-current' : ''} ${index < step - 1 ? 'number-read' : ''}`}>{value}</span>)}</div>
      <div className="landing-demo-path" aria-hidden="true"><span className={step ? 'path-active' : ''}>Take a number</span><ArrowRight size={15}/><span className={step ? 'path-active' : ''}>Seen it before?</span></div>
      <div className="landing-memory"><div className="flex items-center justify-between"><span>Numbers in memory</span><span className="font-mono text-[10px] text-mist">{step}/4</span></div><div className="landing-memory-values">{seen.length ? seen.map(number => <span className={`landing-memory-chip ${repeated && number === 2 ? 'memory-match' : ''}`} key={number}>{number}{repeated && number === 2 && <Check size={11}/>}</span>) : <span className="text-xs text-mist">Empty. Ready for the first number.</span>}</div></div>
      <p className={`landing-demo-note ${repeated ? 'text-mint' : 'text-mist'}`} role="status" aria-live="polite">{repeated ? <Check size={16}/> : <Lightbulb size={16}/>}<span>{note}</span></p>
      <div className="flex items-center justify-between gap-3"><button className="primary" onClick={() => setStep(value => value + 1)} disabled={repeated}><Play size={13}/>{step ? 'Next number' : 'Run the example'}</button><button className="icon-button" aria-label="Restart example" disabled={!step} onClick={() => setStep(0)}><RotateCcw size={15}/></button></div>
    </div><div className="landing-example-footer"><span className="h-1.5 w-1.5 rounded-full bg-mint"/>A small example of learning by doing.</div>
  </div>;
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <MotionConfig reducedMotion="user"><div className="landing-page">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-iris focus:p-3 focus:text-ink">Skip to content</a>
    <header className="landing-header landing-container">
      <Link href="/" aria-label="Socrastica home" className="flex items-center gap-2.5"><Logo className="h-8 w-8"/><span className="text-xl font-semibold tracking-[-.05em]">socrastica<span className="text-iris">.</span></span></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-6 text-xs text-mist lg:flex"><Link href="/exercises">Exercises</Link><a href="#how-it-works">How it works</a><a href="#for-instructors">For instructors</a><a href="#questions">Questions</a></nav>
      <div className="flex items-center gap-4"><Link href="/login" className="text-xs text-mist hover:text-white">Sign in</Link><Link href="/exercises" className="secondary hidden sm:inline-flex">Browse exercises <ArrowRight size={13}/></Link><button className="icon-button lg:hidden" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button></div>
      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="landing-mobile-nav">{[['How it works', '#how-it-works'], ['For instructors', '#for-instructors'], ['Questions', '#questions']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<Link href="/exercises" className="primary">Browse exercises <ArrowRight size={13}/></Link></nav>}
    </header>
    <main id="main">
      <section className="landing-hero landing-container">
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}} className="landing-hero-copy">
          <p className="eyebrow flex items-center gap-2 text-iris"><span className="h-1.5 w-1.5 rounded-full bg-iris"/>A space to learn coding</p>
          <h1>Learn to code.<br/><span>Understand<br className="hidden lg:block"/> every step.</span></h1>
          <p className="landing-hero-description">Explain your idea. Build a visual plan. Test it with examples. Then let AI write the code.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5"><Link href="/exercises" className="primary">Choose an exercise <ArrowRight size={15}/></Link><a href="#how-it-works" className="landing-text-link">See how it works <ArrowRight size={13}/></a></div>
          <p className="mt-4 text-xs text-mist/80">No coding experience needed. Save your work with an account.</p>
          <div className="landing-hero-footnote"><span className="text-mint">You build the idea.</span><span>AI helps you put it into code.</span></div>
        </motion.div>
        <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.1}} className="landing-example-wrap"><LearningPreview/></motion.div>
      </section>
      <section id="how-it-works" className="landing-process landing-container">
        <div className="landing-section-intro"><div><p className="eyebrow text-iris">How it works</p><h2>Make an idea you can explain.</h2></div><p>You choose the steps.<br/>Socrastica helps you see what they do.</p></div>
        <div className="landing-steps">{steps.map(([title, text], index) => <article key={title}><span className="landing-step-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <div className="landing-support"><span><Check size={13}/>Try suggestions before applying them</span><span><Check size={13}/>Undo changes and replay steps</span><span><Check size={13}/>Save your progress and explanations</span></div>
      </section>
      <section id="for-instructors" className="landing-container landing-instructors">
        <div className="landing-instructor-panel panel"><div className="landing-instructor-copy"><p className="eyebrow flex items-center gap-2 text-iris"><GraduationCap size={15}/>For instructors</p><h2>See the thinking<br/>behind the answer.</h2><p>Create a private class for the duplicate-number activity. Review students’ plans, experiments, and explanations. Choose how much help they get and leave useful feedback.</p><Link href="/instructor" className="landing-text-link">Open instructor workspace <ArrowRight size={14}/></Link></div><div className="landing-review"><p className="landing-review-caption">WHAT YOU CAN REVIEW</p>{[['How the plan changed', 'Saved versions, side by side'], ['What the student tried', 'Hints, predictions, and test results'], ['Why they made a choice', 'Their own explanation and your feedback']].map(([title, description]) => <div key={title}><Check size={15}/><span><strong>{title}</strong><small>{description}</small></span></div>)}<p className="landing-sharing-note">Students choose to join and share their work.</p></div></div>
      </section>
      <section id="questions" className="landing-questions landing-container"><div><p className="eyebrow text-iris">Before you start</p><h2>A few quick answers.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={16}/></summary><p>{answer}</p></details>)}</div></section>
      <section className="landing-final landing-container"><div><p className="eyebrow text-iris">Your first activity</p><h2>Find your first challenge.</h2><p>Convert naira to dollars, work with numbers, or explore words and lists.</p></div><Link href="/exercises" className="primary">Browse all exercises <ArrowRight size={15}/></Link></section>
    </main>
    <footer className="landing-footer landing-container"><Link href="/" className="flex items-center gap-2 text-sm font-medium"><Logo className="h-5 w-5"/>socrastica.</Link><p>Build the idea. Understand the code.</p><Link href="/instructor">For instructors <ArrowRight size={12}/></Link></footer>
  </div></MotionConfig>;
}
