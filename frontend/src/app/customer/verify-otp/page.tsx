'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { OtpInput } from '@/components/auth/OtpInput';
import { Loader2, CheckCircle, Mail } from 'lucide-react';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = decodeURIComponent(searchParams.get('email') || '');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/customer/auth/verify-otp', { email, otp: code });
      setSuccess(true);
      setTimeout(() => router.push('/customer/login'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError('');
    try {
      await api.post('/customer/auth/resend-otp', { email });
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-space-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none bg-hero-gradient opacity-50" aria-hidden="true" />

      <div className="w-full max-w-[400px] bg-space-800/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-glow-violet border border-white/[0.08] relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Logo size={34} />
          <span className="font-outfit font-bold text-xl text-white tracking-tight">NexMart</span>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white font-outfit mb-2">Email Verified!</h1>
            <p className="text-muted text-sm">Redirecting you to login…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-7">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                <Mail size={22} className="text-violet-400" />
              </div>
              <h1 className="text-xl font-bold text-white font-outfit mb-2">Check your email</h1>
              <p className="text-sm text-muted leading-relaxed">
                If that address is eligible, we sent a 6-digit code to<br />
                <span className="text-violet-400 font-medium">{email}</span>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" aria-live="polite" className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            <OtpInput value={otp} onChange={setOtp} disabled={loading} />

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={loading || otp.join('').length !== 6}
              suppressHydrationWarning
              className="w-full relative overflow-hidden group bg-white text-black font-semibold rounded-xl py-3.5 transition-opacity flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed font-outfit mb-5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors">
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Verify & Continue'}
              </span>
            </button>

            {/* Resend */}
            <div className="text-center space-y-1.5">
              <p className="text-xs text-muted">Didn't receive the code?</p>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                suppressHydrationWarning
                className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 rounded-lg"
              >
                {resending ? (
                  <span className="flex items-center gap-1.5 justify-center">
                    <Loader2 size={12} className="animate-spin" /> Sending…
                  </span>
                ) : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.05] text-center">
              <Link href="/customer/register" className="text-xs text-secondary transition-colors hover:text-white">
                ← Back to register
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100svh] bg-space-950 flex items-center justify-center">
        <Loader2 size={28} className="text-violet-400 animate-spin" />
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  );
}
