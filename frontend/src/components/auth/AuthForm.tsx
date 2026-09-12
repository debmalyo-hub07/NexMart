'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Logo } from '@/components/common/Logo';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';

interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface AuthFormProps {
  type: 'login' | 'register';
  /** Which portal this form signs into. Not an ARIA role. */
  portal: 'admin' | 'customer' | 'agent';
  title: string;
  fields: Field[];
  submitText: string;
  linkText: string;
  linkHref: string;
  redirectUrl: string;
  note?: string;
  showGoogle?: boolean;
}

type AuthFormData = Record<string, string>;

function autocompleteForField(field: Field, formType: AuthFormProps['type']): string | undefined {
  if (field.name === 'email') return 'email';
  if (field.name === 'password') return formType === 'register' ? 'new-password' : 'current-password';
  if (field.name === 'confirmPassword') return 'new-password';
  if (field.name === 'phone') return 'tel';
  return undefined;
}

// Validation rules per field, derived from the fields prop
const fieldSchema = (field: Field): z.ZodString => {
  if (field.name === 'email') return z.string().min(1, 'Enter your email').email('Enter a valid email address');
  if (field.type === 'password') {
    if (field.name === 'confirmPassword') return z.string().min(1, 'Confirm your password');
    return z.string().min(8, 'Password must be at least 8 characters');
  }
  if (field.name === 'phone') return z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
  if (field.name === 'pincode') return z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode');
  return z.string().min(1, `${field.label} is required`);
};

export function AuthForm({ type, portal, title, fields, submitText, linkText, linkHref, redirectUrl, note, showGoogle }: AuthFormProps) {
  const router = useRouter();
  const { showToast } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Build the zod schema dynamically from the fields prop
  const schema = useMemo(() => {
    const shape = Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)] as [string, z.ZodString]));
    const base = z.object(shape);
    return type === 'register'
      ? base.refine((values) => values.password === values.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword'],
        })
      : base;
  }, [fields, type]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AuthFormData>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, ''])),
  });

  useEffect(() => {
    if (type === 'login') {
      const key = portal === 'admin'
        ? 'nexmart_last_admin_email'
        : portal === 'agent'
          ? 'nexmart_last_delivery_email'
          : null;
      if (key) {
        const savedEmail = localStorage.getItem(key);
        if (savedEmail) {
          setValue('email', savedEmail);
        }
      }
    }
  }, [type, portal, setValue]);

  const onSubmit = async (values: AuthFormData) => {
    setLoading(true);
    setError('');

    try {
      if (type === 'register') {
        const res = await api.post(`/${portal}/auth/register`, values);
        if (res.data.success) {
          showToast(res.data.message);

          // Customer registration requires OTP verification before login
          if (portal === 'customer' && res.data.data?.requiresOtp) {
            const email = encodeURIComponent(res.data.data.email || values.email);
            router.push(`/customer/verify-otp?email=${email}`);
          } else {
            router.push(redirectUrl);
          }
        }
      } else {
        // LOGIN flow
        await useAuthStore.getState().login(values.email, values.password, portal);

        // Save email on successful login
        const key = portal === 'admin'
          ? 'nexmart_last_admin_email'
          : portal === 'agent'
            ? 'nexmart_last_delivery_email'
            : null;
        if (key && values.email) {
          localStorage.setItem(key, values.email);
        }

        // Push to dashboard — no router.refresh() to avoid race condition
        // The session is already updated by NextAuth after signIn resolves
        router.push(redirectUrl);
      }
    } catch (err: any) {
      // Extract server error message from response if available
      const message = err.response?.data?.message || err.message || 'An error occurred';

      // Redirect to OTP page if server indicates unverified account
      if (err.response?.data?.data?.requiresOtp) {
        const email = encodeURIComponent(values.email);
        showToast('Please verify your email first', 'error');
        router.push(`/customer/verify-otp?email=${email}`);
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-space-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none bg-hero-gradient opacity-50" aria-hidden="true" />

      <div className="w-full max-w-[440px] bg-space-800/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-glow-violet border border-white/[0.08] relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
            <Logo size={38} className="transition-transform group-hover:scale-105" />
            <span className="font-outfit font-bold text-2xl text-white tracking-tight">NexMart</span>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2 font-outfit">{title}</h1>
          <p className="text-sm text-muted font-inter">{type === 'login' ? 'Welcome back to your workspace' : 'Join the next-gen platform'}</p>
        </div>

        {error && (
          <div role="alert" aria-live="polite" className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center font-inter">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" suppressHydrationWarning>
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label htmlFor={`auth-${field.name}`} className="block text-xs font-medium text-secondary ml-1 uppercase tracking-wider font-inter">{field.label}</label>
              <div className="relative">
                <input
                  id={`auth-${field.name}`}
                  suppressHydrationWarning
                  type={field.type === 'password' && showPassword ? 'text' : field.type}
                  {...register(field.name)}
                  autoComplete={autocompleteForField(field, type)}
                  aria-invalid={errors[field.name] ? 'true' : 'false'}
                  aria-describedby={errors[field.name] ? `auth-${field.name}-error` : undefined}
                  className="w-full min-h-12 bg-black/40 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus-visible:outline-none focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:ring-2 focus-visible:ring-violet-500/30 transition-[background-color,border-color,box-shadow] font-inter pr-10"
                  placeholder={`Enter your ${field.label.toLowerCase()}…`}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                )}
              </div>
              {errors[field.name] && (
                <p id={`auth-${field.name}-error`} role="alert" className="text-xs text-red-300 mt-1">{errors[field.name]?.message}</p>
              )}
            </div>
          ))}

          <button
            suppressHydrationWarning
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden group bg-white text-black hover:text-white font-semibold rounded-xl py-3.5 mt-4 transition-[color,opacity] flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed font-outfit"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 flex items-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : submitText}
            </span>
          </button>
        </form>

        {showGoogle && (
          <>
            <div className="flex items-center gap-3 mt-5">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-muted font-inter">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: redirectUrl })}
              className="w-full mt-4 flex items-center justify-center gap-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl py-3.5 text-sm font-medium text-white transition-colors font-inter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.6-1.2 2.9-2.5 3.8v3.1h4c2.4-2.2 3.5-5.4 3.5-9.1z"/>
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-4-3.1c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.3v3.2C3.3 21.3 7.3 24 12 24z"/>
                <path fill="#FBBC05" d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.5H1.3C.5 8.1 0 10 0 12s.5 3.9 1.3 5.5l4.1-3.2z"/>
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.5l4.1 3.2c.9-2.8 3.5-4.9 6.6-4.9z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {note && (
          <p className="mt-5 text-xs text-amber-400/80 text-center bg-amber-400/10 p-3 rounded-xl border border-amber-400/20 font-inter">
            {note}
          </p>
        )}

        {linkText && (
          <div className="mt-8 text-center pt-6 border-t border-white/[0.05]">
            {/* Switching between sign in and register is a primary action on
                these pages, so it gets a real 44px target, not a 17px line. */}
            <Link href={linkHref} className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-inter text-sm text-secondary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
              {linkText}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
