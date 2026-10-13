"use client";
import { useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { findChallenge } from '@/lib/challenges';
type Share = { token: string; challenge_id: string; note: string; verified: boolean; created_at: string; revoked_at: string | null };
export default function ShareList() {
  const [shares, setShares] = useState<Share[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  async function load() { const response = await fetch('/api/share', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setShares(data.shares); }
  useEffect(() => { void load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function revoke(token: string) { setError(''); try { const response = await fetch(`/api/share?token=${token}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke.'); } }
  const active = shares.filter(share => !share.revoked_at);
  return <div><h2 className="eyebrow flex items-center gap-2 text-iris"><Link2 size={13}/>Shared blueprints</h2>{loading && <p className="mt-3 text-xs text-mist">Loading…</p>}{error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}{!loading && !active.length && <p className="mt-3 text-xs text-mist">No active share links. Create one from an activity’s settings menu.</p>}<ul className="mt-3 grid gap-2">{active.map(share => <li key={share.token} className="guide-card flex flex-wrap items-center justify-between gap-3 !py-3"><div><p className="text-xs font-medium">{findChallenge(share.challenge_id)?.title || share.challenge_id}{share.verified ? ' · code checked' : ''}</p><a className="mt-1 block font-mono text-[10px] text-iris" href={`/share/${share.token}`} target="_blank" rel="noreferrer">/share/{share.token}</a>{share.note && <p className="mt-1 text-[10px] text-mist">“{share.note}”</p>}</div><button className="secondary" onClick={() => void revoke(share.token)}><Trash2 size={12}/>Revoke</button></li>)}</ul></div>;
}
