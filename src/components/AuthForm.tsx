"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import { browserClient } from '@/lib/supabase/browser';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
const titles: Record<Mode, string> = { login: 'Welcome back, thinker.', signup: 'Your next idea starts here.', forgot: 'Let’s get you back in.', reset: 'A fresh start.' };
export default function AuthForm({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (new URLSearchParams(window.location.search).has('error')) setError('That confirmation link is invalid or expired. Try signing in or request a new password reset.'); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    try {
      const supabase = browserClient();
      const callback = `${window.location.origin}/auth/callback`;
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Sign-in failed. Check your email, password, and email confirmation.');
        window.location.assign('/studio');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
        if (error) throw new Error('Could not create your account. Try again shortly or sign in if you already have one.');
        if (data.session) window.location.assign('/studio');
        else setMessage('Check your email for a confirmation link. If you already have an account, sign in or reset your password.');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${callback}?next=/reset-password` });
        if (error) throw new Error('Could not send the reset email. Please try again shortly.');
        setMessage('If an account exists for that address, you’ll receive a password reset email.');
      } else {
        if (password !== String(form.get('confirm'))) throw new Error('Your passwords don’t match.');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Open a fresh password reset link from your email first.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error('Could not update your password. Try a new reset link.');
        await supabase.auth.signOut();
        window.location.assign('/login');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12"><Link href="/" className="mb-8 flex items-center justify-center gap-3 text-xl font-semibold"><Logo/>socrastica.</Link><section className="panel p-7"><p className="eyebrow mb-4 text-iris">Your learning space</p><h1 className="text-2xl font-medium tracking-tight">{titles[mode]}</h1><p className="mb-7 mt-3 text-sm leading-6 text-mist">{mode === 'login' ? 'Pick up where your curiosity left off.' : mode === 'signup' ? 'Save your progress and build your coding intuition.' : mode === 'forgot' ? 'Enter your email to receive a reset link.' : 'Choose a new password for your account.'}</p><form onSubmit={submit} className="space-y-4">
    {mode !== 'reset' && <label className="block text-xs text-mist">Email<input className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" name="email" type="email" autoComplete="email" required maxLength={254}/></label>}
    {mode !== 'forgot' && <label className="block text-xs text-mist">Password<input className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 10} maxLength={128}/>{mode !== 'login' && <span className="mt-2 block text-[10px]">Use at least 10 characters.</span>}</label>}
    {mode === 'reset' && <label className="block text-xs text-mist">Confirm password<input className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label>}
    {error && <p role="alert" className="text-sm leading-6 text-rose-300">{error}</p>}{message && <p role="status" className="text-sm leading-6 text-mint">{message}</p>}
    <button disabled={busy} className="primary w-full">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <ArrowRight size={16}/>}{{ login: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Update password' }[mode]}</button>
  </form><div className="mt-6 flex flex-wrap justify-between gap-3 text-xs text-iris">{mode === 'login' ? <><Link href="/signup">Create an account</Link><Link href="/forgot-password">Forgot password?</Link></> : <Link href="/login">Back to sign in</Link>}</div></section><p className="mt-6 text-center text-xs text-mist">Think it through. Then make it real.</p></main>;
}
