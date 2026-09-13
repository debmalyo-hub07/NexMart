'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { Logo } from '@/components/common/Logo';

const schema = z.object({ email: z.string().min(1, 'Enter your email').email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function submit(values: Values) {
    setError('');
    try {
      await api.post('/customer/auth/forgot-password', { email: values.email });
      // The response is deliberately opaque — it cannot say whether an account
      // exists — so the next screen's copy is true either way.
      router.push(`/customer/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-space-950 p-4">
      <div className="absolute inset-0 z-0 bg-hero-gradient opacity-50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-space-800/90 p-6 shadow-glow-violet backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-8 inline-flex items-center gap-3">
            <Logo size={38} />
            <span className="font-outfit text-2xl font-bold tracking-tight text-white">NexMart</span>
          </Link>
          <h1 className="mb-2 font-outfit text-3xl font-bold tracking-tight text-white">Reset your password</h1>
          <p className="font-inter text-sm text-muted">Enter your email and we will send a 6-digit code.</p>
        </div>

        {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-300">{error}</p>}

        <form onSubmit={handleSubmit(submit)} noValidate>
          <fieldset disabled={isSubmitting} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">Email address</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white placeholder-white/30 transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                placeholder="Enter your email address…"
              />
              {errors.email && <p id="forgot-email-error" role="alert" className="mt-1 text-xs text-red-300">{errors.email.message}</p>}
            </div>
            <button type="submit" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-white py-3.5 font-outfit font-semibold text-black transition-opacity disabled:opacity-70">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Send reset code'}
            </button>
          </fieldset>
        </form>

        <div className="mt-8 border-t border-white/[0.05] pt-6 text-center">
          <Link href="/customer/login" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-inter text-sm text-secondary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
