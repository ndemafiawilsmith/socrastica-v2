"use client";
import { useState } from 'react';
import { History,ArrowLeftRight } from 'lucide-react';
import { eventNames,type LearningEvent } from '@/lib/classroom';
import { blueprintDiff } from '@/lib/guidance';
import type { Blueprint } from '@/lib/blueprint';
import BlueprintMiniMap from './BlueprintMiniMap';
export default function LearningJournal({events,current,onRestore}:{events:LearningEvent[];current?:Blueprint;onRestore?:(graph:Blueprint)=>void}){
  const versions=events.filter(event=>event.blueprint),[left,setLeft]=useState('current'),[right,setRight]=useState('');
  const first=left==='current'?(current||versions[0]?.blueprint):versions.find(event=>event.id===left)?.blueprint;
  const selected=right||versions[0]?.id,second=versions.find(event=>event.id===selected)?.blueprint;
  const diff=first&&second?blueprintDiff(first,second):null;
  return <div className="learning-journal">
    <div className="flex items-center gap-2"><History size={16} className="text-iris"/><h2 className="text-lg font-medium">The story of this solution</h2></div><p className="mt-3 text-xs leading-6 text-mist">The latest 100 activities: revisions, assistance, experiments, and explanations. Results show evidence of progress; they do not automatically grade understanding.</p>
    {versions.length>0&&<section className="journal-compare"><div className="flex flex-wrap items-center gap-3"><ArrowLeftRight size={15}/><label className="text-xs">Compare<select aria-label="First blueprint version" value={left==='current'&&!current?(versions[0]?.id||''):left} onChange={e=>setLeft(e.target.value)}>{current&&<option value="current">Current canvas</option>}{versions.map(event=><option key={event.id} value={event.id}>{eventNames[event.kind]} · revision {event.revision}</option>)}</select></label><label className="text-xs">With<select aria-label="Second blueprint version" value={selected||''} onChange={e=>setRight(e.target.value)}>{versions.map(event=><option key={event.id} value={event.id}>{eventNames[event.kind]} · revision {event.revision}</option>)}</select></label></div>
      {first&&second&&<><div className="mt-4 grid gap-3 sm:grid-cols-2"><BlueprintMiniMap blueprint={first} label="First blueprint version"/><BlueprintMiniMap blueprint={second} label="Second blueprint version"/></div><p className="mt-3 text-xs text-mist">{diff?.added.length} blocks added · {diff?.removed.length} removed · {diff?.changed.length} changed · {diff?.connected} connections added · {diff?.disconnected} removed</p>{onRestore&&<button className="secondary mt-4" onClick={()=>onRestore(second)}>Preview this version on my canvas</button>}</>}
    </section>}
    <ol className="journal-timeline">{events.map(event=><li key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs font-medium">{eventNames[event.kind]||event.kind}</strong><time className="font-mono text-[9px] text-mist">{new Date(event.created_at).toLocaleString()}</time></div>
      {event.kind==='ai_direction'&&<><p>“{String(event.detail.direction||'')}”</p><p className="text-iris">{String(event.detail.note||'')}</p><span className="journal-tag">AI proposal · reviewed separately</span></>}
      {event.kind==='prediction'&&<><p>Predicted a branch: {event.detail.correct?'correct':'a different path was taken'}.</p><span className="journal-tag">Checked by the server simulator</span></>}
      {event.kind==='simulation'&&<><p>Input {JSON.stringify(event.detail.input)} → {event.detail.passed?'expected result':'needs a repair'}. {String(event.detail.error||'')}</p><p>{String(event.detail.passedCount)} / {String(event.detail.total)} sample checks passed.</p></>}
      {event.kind==='reflection'&&<><p>{String(event.detail.text||'')}</p><span className="journal-tag">Student explanation</span></>}
      {event.kind==='hint'&&<p>{String(event.detail.action)}: {String(event.detail.title)}</p>}
      {event.kind==='code_verified'&&<p>Generated code matched the blueprint on {String(event.detail.checked)} sample inputs.</p>}
      {event.blueprint&&<p className="font-mono text-[9px]">{event.blueprint.nodes.length} blocks · {event.blueprint.edges.length} connections · saved revision {event.revision}</p>}
    </li>)}</ol>{!events.length&&<p className="mt-5 text-sm text-mist">Your first edit or experiment starts this journal.</p>}
  </div>;
}
