import { findChallenge } from './challenges';
export function authDestination(next: string | null | undefined) {
  if (next === '/studio' || next === '/instructor' || next === '/exercises' || next === '/progress') return next;
  if (next?.startsWith('/learn/') && findChallenge(next.slice(7))) return next;
  return '/exercises';
}
