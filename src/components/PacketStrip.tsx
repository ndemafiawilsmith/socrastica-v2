"use client";
import type { TraceFrame } from '@/lib/blueprint';
import { displayValue, type Value } from '@/lib/values';

// The input as a visible strip. During playback the current item lifts, read items dim,
// and the registers the packet carries (memory, total, count, answer) update alongside.
export default function PacketStrip({ input, frame }: { input: Value; frame?: TraceFrame }) {
  const registers = frame && <div className="packet-registers">
    {frame.seen.length > 0 && <span className="packet-register"><em>memory</em>{frame.seen.slice(0, 12).map(n => <b key={n}>{n}</b>)}{frame.seen.length > 12 && <b>+{frame.seen.length - 12}</b>}</span>}
    {frame.total !== null && <span className="packet-register"><em>total</em><b>{frame.total}</b></span>}
    {frame.count !== null && <span className="packet-register"><em>count</em><b>{frame.count}</b></span>}
    {frame.result !== undefined && <span className="packet-register packet-result"><em>answer</em><b>{displayValue(frame.result)}</b></span>}
  </div>;
  if (Array.isArray(input)) {
    const currentIndex = frame && frame.current !== null ? frame.index - 1 : -1, readUpTo = frame?.index ?? 0;
    return <div className="packet-strip" aria-label="Input packet"><span className="packet-strip-label">INPUT</span><div className="packet-items">{input.length ? input.slice(0, 40).map((n, i) => <span key={i} className={`packet-item ${i === currentIndex ? 'item-current' : i < readUpTo ? 'item-read' : ''}`} aria-current={i === currentIndex ? 'true' : undefined}>{n}</span>) : <span className="packet-empty">an empty list</span>}{input.length > 40 && <span className="packet-empty">+{input.length - 40} more</span>}</div>{registers}</div>;
  }
  const changed = !!frame && JSON.stringify(frame.value) !== JSON.stringify(input);
  return <div className="packet-strip" aria-label="Input packet"><span className="packet-strip-label">INPUT</span><div className="packet-items"><span className="packet-item item-wide">{displayValue(input)}</span><span className="packet-arrow">→</span><span className={`packet-item item-wide ${changed ? 'item-current' : ''}`}>{frame ? displayValue(frame.value) : '…'}</span></div>{registers}</div>;
}
