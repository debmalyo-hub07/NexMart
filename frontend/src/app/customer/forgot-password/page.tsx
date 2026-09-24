'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { AccountRecoveryLayout } from '@/components/auth/AccountRecoveryLayout';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });
  async function submit(values: Values) {
    setError('');
    try {
      await api.post('/customer/auth/forgot-password', { email: values.email });
      router.push(`/customer/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) { setError(getApiError(err)); }
  }
  return <AccountRecoveryLayout>
    <h1>Reset your password</h1><p className="auth-intro leading-6">Enter your account email. If it is eligible, we’ll send a code to help you sign in again.</p>
    {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <form onSubmit={handleSubmit(submit)} noValidate><fieldset disabled={isSubmitting} className="space-y-5">
      <div><label htmlFor="forgot-email" className="field-label mb-2 block">Email address</label><input id="forgot-email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'forgot-email-error' : undefined} className="input" placeholder="you@example.com" />{errors.email && <p id="forgot-email-error" role="alert" className="mt-2 text-xs text-red-800">{errors.email.message}</p>}</div>
      <button type="submit" className="btn-primary w-full">{isSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowRight size={18} aria-hidden />}Send reset code</button>
    </fieldset></form>
    <p className="mt-5 text-xs leading-6 text-muted">Use Google sign-in if you created your account with Google and haven’t added a password.</p>
  </AccountRecoveryLayout>;
}
