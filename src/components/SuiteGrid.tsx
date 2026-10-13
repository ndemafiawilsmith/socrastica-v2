"use client";
import { displayValue, type Value } from '@/lib/values';

// Every verification input as a dot. Dots fill in order; a failing dot loads that input.
export default function SuiteGrid({ results, onSelect, label = 'Sample inputs' }: { results: { input: Value; passed: boolean; name?: string }[]; onSelect?: (input: Value) => void; label?: string }) {
  const passed = results.filter(result => result.passed).length;
  return <div className="suite-grid" role="group" aria-label={label}>
    <p className="suite-grid-caption">{label} <span>{passed}/{results.length} passed{onSelect && passed < results.length ? ' · click a red dot to replay it' : ''}</span></p>
    <div className="suite-dots">{results.map((result, index) => <button key={index} type="button" className={`suite-dot ${result.passed ? 'dot-pass' : 'dot-fail'}`} style={{ animationDelay: `${Math.min(index, 60) * 25}ms` }} disabled={!onSelect || result.passed} onClick={() => onSelect?.(result.input)} title={`${result.name ? `${result.name}: ` : ''}${displayValue(result.input)} · ${result.passed ? 'passed' : 'needs a repair'}`} aria-label={`${result.name || 'Input'} ${displayValue(result.input)} ${result.passed ? 'passed' : 'failed'}`}/>)}</div>
  </div>;
}
