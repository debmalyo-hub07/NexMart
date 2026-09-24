'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { passwordSchema } from '@/lib/password';
import { AccountRecoveryLayout } from '@/components/auth/AccountRecoveryLayout';
import { OtpInput } from '@/components/auth/OtpInput';

function ResetPasswordContent() {
  const email = useSearchParams().get('email') || '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== confirm) { setError('Passwords must match.'); return; }
    if (otp.join('').length !== 6) { setError('Enter all 6 digits.'); return; }
    setLoading(true); setError('');
    try { await api.post('/customer/auth/reset-password', { email, otp: otp.join(''), password }); setDone(true); }
    catch (err) { setError(getApiError(err)); setOtp(['', '', '', '', '', '']); }
    finally { setLoading(false); }
  }
  return <AccountRecoveryLayout>
    {done ? <div role="status"><h1>Password updated</h1><p className="auth-intro leading-6">Sign in with your new password. Your earlier sessions have been signed out.</p><Link href="/customer/login" className="btn-primary w-full">Continue to sign in<ArrowRight size={17} aria-hidden /></Link></div> : <>
      <h1>A new password.<br />Back to you.</h1><p className="auth-intro leading-6">Enter the 6-digit code sent to <strong className="break-all">{email || 'your account email'}</strong> and choose a new password.</p>
      {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <form onSubmit={submit} noValidate><fieldset disabled={loading}>
        <OtpInput value={otp} onChange={setOtp} disabled={loading} />
        <div className="mb-5"><label htmlFor="reset-password" className="field-label mb-2 block">New password</label><input id="reset-password" type="password" autoComplete="new-password" className="input" value={password} onChange={e => setPassword(e.target.value)} aria-describedby="reset-password-hint" /><p id="reset-password-hint" className="mt-2 text-xs leading-5 text-muted">At least 8 characters, with uppercase, lowercase, and a number.</p></div>
        <div className="mb-5"><label htmlFor="reset-confirm" className="field-label mb-2 block">Confirm new password</label><input id="reset-confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <button type="submit" className="btn-primary w-full">{loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowRight size={18} aria-hidden />}Set new password</button>
      </fieldset></form><Link href="/customer/forgot-password" className="text-link mt-4 w-full">Request a new code</Link>
    </>}
  </AccountRecoveryLayout>;
}
export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center" role="status">Loading account recovery…</div>}><ResetPasswordContent /></Suspense>;
}
