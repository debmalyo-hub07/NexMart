'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { OtpInput } from '@/components/auth/OtpInput';
import { AccountRecoveryLayout } from '@/components/auth/AccountRecoveryLayout';
import { ArrowRight, Loader2 } from 'lucide-react';

function VerifyOtpContent() {
  const email = useSearchParams().get('email') || '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => { if (resendCooldown <= 0) return; const timer = setTimeout(() => setResendCooldown(value => value - 1), 1000); return () => clearTimeout(timer); }, [resendCooldown]);
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (loading || otp.join('').length !== 6) return;
    setLoading(true); setError('');
    try { await api.post('/customer/auth/verify-otp', { email, otp: otp.join('') }); setSuccess(true); }
    catch (err) { setError(getApiError(err)); }
    finally { setLoading(false); }
  }
  async function resend() {
    if (resendCooldown || resending) return;
    setResending(true); setError('');
    try { await api.post('/customer/auth/resend-otp', { email }); setResendCooldown(60); setOtp(['', '', '', '', '', '']); }
    catch (err) { setError(getApiError(err)); }
    finally { setResending(false); }
  }
  return <AccountRecoveryLayout>
    {success ? <div role="status"><h1>Email verified</h1><p className="auth-intro">Your account is ready. Sign in to start exploring.</p><Link href="/customer/login" className="btn-primary w-full">Continue to sign in<ArrowRight size={17} aria-hidden /></Link></div> : <>
      <h1>Check your email</h1><p className="auth-intro leading-6">If this address is eligible, we sent a 6-digit code to <strong className="break-all">{email || 'your email address'}</strong>.</p>
      {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <form onSubmit={verify}><fieldset disabled={loading || resending}><OtpInput value={otp} onChange={setOtp} disabled={loading || resending} /><button type="submit" className="btn-primary w-full" disabled={otp.join('').length !== 6}>{loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowRight size={18} aria-hidden />}Verify email</button></fieldset></form>
      <div className="mt-5 text-center"><p className="text-xs text-muted">Check your spam folder if the email hasn’t arrived.</p><button type="button" className="text-link mt-2" onClick={() => void resend()} disabled={resending || loading || resendCooldown > 0}>{resending ? 'Sending…' : resendCooldown ? `Resend in ${resendCooldown}s` : 'Resend code'}</button></div>
      <Link href="/customer/register" className="text-link mt-4 w-full">Use a different email</Link>
    </>}
  </AccountRecoveryLayout>;
}
export default function VerifyOtpPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center" role="status">Loading email verification…</div>}><VerifyOtpContent /></Suspense>;
}
