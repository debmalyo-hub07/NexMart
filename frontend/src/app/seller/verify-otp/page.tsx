'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { OtpInput } from '@/components/auth/OtpInput';

function SellerVerifyContent() {
  const router = useRouter();
  const email = decodeURIComponent(useSearchParams().get('email') || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify() {
    if (otp.join('').length !== 6) { setError('Enter all 6 digits.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/seller/auth/verify-otp', { email, otp: otp.join('') });
      setDone(true);
      window.setTimeout(() => router.push('/seller/login'), 1800);
    } catch (error) { setError(getApiError(error)); }
    finally { setLoading(false); }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true); setError('');
    try {
      await api.post('/seller/auth/resend-otp', { email });
      setCooldown(60); setOtp(['', '', '', '', '', '']);
    } catch (error) { setError(getApiError(error)); }
    finally { setResending(false); }
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-space-950 p-4">
      <section className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-space-800 p-6 sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-3"><Logo size={34} /><span className="font-outfit text-xl font-bold text-white">NexMart seller desk</span></div>
        {done ? (
          <div className="py-8 text-center"><CheckCircle className="mx-auto mb-4 text-acid-400" size={42} aria-hidden /><h1 className="font-outfit text-xl font-bold">Email verified</h1><p className="mt-2 text-sm text-secondary">Sign in to continue your application.</p></div>
        ) : (
          <>
            <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10"><Mail size={22} className="text-violet-400" aria-hidden /></div><h1 className="font-outfit text-xl font-bold">Check your business email</h1><p className="mt-2 text-sm leading-relaxed text-secondary">If the address is eligible, we sent a 6-digit code to<br /><span className="font-medium text-violet-300">{email}</span></p></div>
            {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-center text-sm text-red-300">{error}</p>}
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <button type="button" onClick={verify} disabled={loading || otp.join('').length !== 6} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-white py-3.5 font-outfit font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Verify seller email'}</button>
            <div className="mt-5 text-center"><button type="button" onClick={resend} disabled={cooldown > 0 || resending} className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm text-violet-300 transition-colors hover:text-white disabled:opacity-50">{resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button></div>
            <div className="mt-5 border-t border-white/10 pt-5 text-center"><Link href="/seller/register" className="text-sm text-secondary hover:text-white">Back to seller application</Link></div>
          </>
        )}
      </section>
    </main>
  );
}

export default function SellerVerifyPage() {
  return <Suspense fallback={<main className="flex min-h-[100svh] items-center justify-center bg-space-950"><Loader2 className="animate-spin text-violet-400" size={28} /></main>}><SellerVerifyContent /></Suspense>;
}
