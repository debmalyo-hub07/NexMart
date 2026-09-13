'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { OtpInput } from '@/components/auth/OtpInput';

function ResetPasswordContent() {
  const router = useRouter();
  const email = decodeURIComponent(useSearchParams().get('email') || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strongEnough = password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
  const ready = otp.join('').length === 6 && strongEnough && password === confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) {
      if (!strongEnough) setError('Use at least 8 characters with uppercase, lowercase, and a number.');
      else if (password !== confirm) setError('Passwords must match.');
      else setError('Enter all 6 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/customer/auth/reset-password', { email, otp: otp.join(''), password });
      setDone(true);
      setTimeout(() => router.push('/customer/login'), 2500);
    } catch (err) {
      setError(getApiError(err));
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-space-950 p-4">
      <div className="absolute inset-0 z-0 bg-hero-gradient opacity-50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-space-800/90 p-6 shadow-glow-violet backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Logo size={34} />
          <span className="font-outfit text-xl font-bold tracking-tight text-white">NexMart</span>
        </div>

        {done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-acid-400/20 bg-acid-400/10">
              <CheckCircle size={32} className="text-acid-400" aria-hidden />
            </div>
            <h1 className="mb-2 font-outfit text-xl font-bold text-white">Password updated</h1>
            <p className="text-sm text-muted">Taking you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <h1 className="mb-2 font-outfit text-xl font-bold text-white">Enter your code</h1>
              <p className="text-sm leading-relaxed text-muted">
                If that address is eligible, we sent a 6-digit code to<br />
                <span className="font-medium text-violet-400">{email}</span>
              </p>
            </div>

            {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{error}</p>}

            <form onSubmit={submit} noValidate>
              <fieldset disabled={loading}>
                <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                <div className="mb-4 space-y-1.5">
                  <label htmlFor="reset-password" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">New password</label>
                  <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30" />
                  <p className="ml-1 text-xs text-muted">At least 8 characters, with uppercase, lowercase, and a number.</p>
                </div>

                <div className="mb-5 space-y-1.5">
                  <label htmlFor="reset-confirm" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">Confirm password</label>
                  <input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30" />
                </div>

                <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-white py-3.5 font-outfit font-semibold text-black transition-opacity disabled:opacity-50">
                  {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Set new password'}
                </button>
              </fieldset>
            </form>

            <div className="mt-6 border-t border-white/[0.05] pt-5 text-center">
              <Link href="/customer/forgot-password" className="inline-flex min-h-11 items-center px-3 text-xs text-secondary transition-colors hover:text-white">
                Need a new code?
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100svh] items-center justify-center bg-space-950"><Loader2 size={28} className="animate-spin text-violet-400" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
