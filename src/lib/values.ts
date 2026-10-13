// Values that flow through blueprints, sandboxes, and challenge oracles.
// Shared by the browser and the server; keep it free of server-only imports.
export type Value = number | string | boolean | number[];

export function sameValue(a: Value | null | undefined, b: Value | null | undefined): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  return JSON.stringify(a) === JSON.stringify(b);
}

// Results leaving a sandbox or interpreter must be small, finite, and plain.
export function isAllowedValue(value: unknown): value is Value {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 10000;
  return Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

export const displayValue = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));
