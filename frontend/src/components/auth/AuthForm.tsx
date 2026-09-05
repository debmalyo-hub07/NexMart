'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { signIn } from 'next-auth/react';

interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface AuthFormProps {
  type: 'login' | 'register';
  role: 'admin' | 'customer' | 'agent';
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

export function AuthForm({ type, role, title, fields, submitText, linkText, linkHref, redirectUrl, note, showGoogle }: AuthFormProps) {
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
      const key = role === 'admin'
        ? 'nexmart_last_admin_email'
        : role === 'agent'
          ? 'nexmart_last_delivery_email'
          : null;
      if (key) {
        const savedEmail = localStorage.getItem(key);
        if (savedEmail) {
          setValue('email', savedEmail);
        }
      }
    }
  }, [type, role, setValue]);

  const onSubmit = async (values: AuthFormData) => {
    setLoading(true);
    setError('');

    try {
      if (type === 'register') {
        const res = await api.post(`/${role}/auth/register`, values);
        if (res.data.success) {
          showToast(res.data.message);

          // Customer registration requires OTP verification before login
          if (role === 'customer' && res.data.data?.requiresOtp) {
            const email = encodeURIComponent(res.data.data.email || values.email);
            router.push(`/customer/verify-otp?email=${email}`);
          } else {
            router.push(redirectUrl);
          }
        }
      } else {
        // LOGIN flow
        await useAuthStore.getState().login(values.email, values.password, role);

        // Save email on successful login
        const key = role === 'admin'
          ? 'nexmart_last_admin_email'
          : role === 'agent'
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15)_0%,transparent_70%)] animate-pulse-glow" />
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.1)_0%,transparent_70%)] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[440px] bg-[#111116]/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_0_80px_-20px_rgba(124,58,237,0.3)] border border-white/[0.05] relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-outfit font-bold text-2xl text-white tracking-tight">NexMart</span>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2 font-outfit">{title}</h1>
          <p className="text-sm text-white/40 font-inter">{type === 'login' ? 'Welcome back to your workspace' : 'Join the next-gen platform'}</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-inter"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" suppressHydrationWarning>
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 ml-1 uppercase tracking-wider font-inter">{field.label}</label>
              <div className="relative">
                <input
                  suppressHydrationWarning
                  type={field.type === 'password' && showPassword ? 'text' : field.type}
                  {...register(field.name)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-[#1a1a24] focus:ring-4 focus:ring-violet-500/10 transition-all font-inter pr-10"
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
              {errors[field.name] && (
                <p className="text-xs text-red-400 mt-1">{errors[field.name]?.message}</p>
              )}
            </div>
          ))}

          <button
            suppressHydrationWarning
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden group bg-white text-black hover:text-white font-semibold rounded-xl py-3.5 mt-4 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed font-outfit"
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
              <span className="text-xs text-white/40 font-inter">or</span>
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
            <Link href={linkHref} className="text-sm text-white/40 hover:text-white transition-colors font-inter">
              {linkText}
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
