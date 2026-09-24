'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { safeReturnPath } from '@/lib/apiUrl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Logo } from '@/components/common/Logo';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Loader2, Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react';
import { businessDetails } from '@/lib/businessDetails';
import { signIn } from 'next-auth/react';
import { passwordSchema } from '@/lib/password';

interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface AuthFormProps {
  type: 'login' | 'register';
  /** Which portal this form signs into. Not an ARIA role. */
  portal: 'admin' | 'customer' | 'agent' | 'seller';
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
const fieldSchema = (field: Field, formType: AuthFormProps['type']): z.ZodType<string> => {
  if (field.name === 'email') return z.string().min(1, 'Enter your email').email('Enter a valid email address');
  if (field.type === 'password') {
    if (field.name === 'confirmPassword') return z.string().min(1, 'Confirm your password');
    // Strength is enforced on REGISTER only. On login the rule must stay
    // "not empty": an account whose password predates the policy still has to
    // be able to sign in — and be told by the server, not blocked by the form.
    if (formType === 'login') return z.string().min(1, 'Enter your password');
    // Same policy the backend enforces (utils/validation.ts) — a weaker rule
    // here would let a signup fail server-side after the form said it was fine.
    return passwordSchema;
  }
  if (field.name === 'phone') return z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
  if (field.name === 'pincode') return z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode');
  return z.string().min(1, `${field.label} is required`);
};

export function AuthForm({ type, portal, title, fields, submitText, linkText, linkHref, redirectUrl, note, showGoogle }: AuthFormProps) {
  const router = useRouter();
  const returnDestination = () => safeReturnPath(new URLSearchParams(window.location.search).get('redirect'), redirectUrl);
  const { showToast } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  // Build the zod schema dynamically from the fields prop
  const schema = useMemo(() => {
    const shape = Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f, type)] as [string, z.ZodType<string>]));
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
          : portal === 'seller'
            ? 'nexmart_last_seller_email'
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
          if (portal === 'customer' || portal === 'seller') {
            // The backend answers registration with a deliberately opaque 202 on
            // every existence branch, so `requiresOtp` can never honestly say
            // whether a code was sent. Always route to the code screen — its
            // copy is true whether the address was new, already pending (which
            // really did just receive a code), or already taken.
            router.push(`/${portal}/verify-otp?email=${encodeURIComponent(values.email)}`);
          } else {
            showToast(res.data.message);
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
            : portal === 'seller'
              ? 'nexmart_last_seller_email'
            : null;
        if (key && values.email) {
          localStorage.setItem(key, values.email);
        }

        // Push to dashboard — no router.refresh() to avoid race condition
        // The session is already updated by NextAuth after signIn resolves
        router.push(returnDestination());
      }
    } catch (err: any) {
      // Extract server error message from response if available
      const message = err.response?.data?.message || err.message || 'An error occurred';

      // Redirect to OTP page if server indicates unverified account
      if (err.response?.data?.data?.requiresOtp) {
        const email = encodeURIComponent(values.email);
        showToast('Please verify your email first', 'error');
        router.push(`${portal === 'seller' ? '/seller/verify-otp' : '/customer/verify-otp'}?email=${email}`);
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isSeller = portal === 'seller';
  return (
    <main id="main-content" className="auth-page">
      <aside className="auth-story">
        <Image src={`/images/collections/${isSeller ? 'workspace' : 'living-room'}.webp`} alt="" fill sizes="50vw" priority />
        <div className="auth-story-shade" aria-hidden="true" />
        <Link href="/" className="brand-wordmark"><Logo size={36} /><span>NexMart</span></Link>
        <div className="auth-story-copy">
          <span className="eyebrow">{isSeller ? 'Room for your business to grow' : 'For the way you live'}</span>
          <h2>{isSeller ? <>Your products.<br />Their next great find.</> : <>Good finds.<br />Everyday possibilities.</>}</h2>
          <p>{isSeller ? 'Manage your catalogue, prepare orders and understand your earnings in one focused workspace.' : 'Save the things you love, compare the details and follow your orders. A little more organised. A lot more you.'}</p>
          <div className="auth-story-points" aria-label="Account features">
            {(isSeller ? ['Catalogue & inventory', 'Order management', 'Fee breakdowns'] : ['Saved favourites', 'Useful comparisons', 'Order updates']).map(point => <span key={point}>{point}</span>)}
          </div>
        </div>
      </aside>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-panel-inner">
          <Link href="/" className="auth-back"><ArrowLeft size={16} aria-hidden /> Back to the store</Link>
          <Link href="/" className="brand-wordmark auth-mobile-brand mb-8 mt-5"><Logo size={32} /><span>NexMart</span></Link>
          <p className="eyebrow mt-8">{isSeller ? 'NexMart seller' : portal === 'customer' ? 'Your NexMart account' : `${portal} access`}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-intro">{type === 'login' ? 'Welcome back. Pick up where you left off.' : isSeller ? 'Start with your details. We will guide you through store setup.' : 'Make your next shopping trip a little easier.'}</p>

          {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {fields.map(field => (
              <div key={field.name}>
                <label htmlFor={`auth-${field.name}`} className="field-label mb-2 block font-semibold">{field.label}</label>
                <div className="relative">
                  {field.type === 'select' ? (
                    <select id={`auth-${field.name}`} {...register(field.name)} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `auth-${field.name}-error` : undefined} className="input">
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input id={`auth-${field.name}`} type={field.type === 'password' && visibleFields[field.name] ? 'text' : field.type} {...register(field.name)} autoComplete={autocompleteForField(field, type)} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `auth-${field.name}-error` : undefined} className={`input ${field.type === 'password' ? 'pr-14' : ''}`} placeholder={field.name === 'email' ? 'you@example.com' : undefined} />
                  )}
                  {field.type === 'password' && <button type="button" onClick={() => setVisibleFields(previous => ({ ...previous, [field.name]: !previous[field.name] }))} aria-label={`${visibleFields[field.name] ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} aria-pressed={!!visibleFields[field.name]} className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{visibleFields[field.name] ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}</button>}
                </div>
                {errors[field.name] && <p id={`auth-${field.name}-error`} role="alert" className="mt-2 text-xs text-red-800">{errors[field.name]?.message}</p>}
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full gap-2 py-3.5">{loading ? <><Loader2 size={18} className="animate-spin" aria-hidden /> Signing {type === 'login' ? 'in' : 'up'}…</> : <>{submitText}<ArrowRight size={16} aria-hidden /></>}</button>
            {loading && <p role="status" className="text-xs leading-5 text-muted">Connecting to your account. The first request can take a little longer.</p>}
          </form>

          {type === 'login' && portal === 'customer' && <div className="mt-2 text-center"><Link href="/customer/forgot-password" className="text-link text-sm">Forgot your password?</Link></div>}
          {showGoogle && <>
            <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[var(--border)]" /><span className="text-xs text-muted">or continue with</span><span className="h-px flex-1 bg-[var(--border)]" /></div>
            <button type="button" onClick={() => void signIn('google', { callbackUrl: returnDestination() })} className="btn-secondary w-full gap-3 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.6-1.2 2.9-2.5 3.8v3.1h4c2.4-2.2 3.5-5.4 3.5-9.1z"/>
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-4-3.1c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.3v3.2C3.3 21.3 7.3 24 12 24z"/>
                <path fill="#FBBC05" d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.5H1.3C.5 8.1 0 10 0 12s.5 3.9 1.3 5.5l4.1-3.2z"/>
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.5l4.1 3.2c.9-2.8 3.5-4.9 6.6-4.9z"/>
              </svg>Google
            </button>
          </>}
          {portal === 'customer' && <p className="mt-5 text-center text-xs leading-relaxed text-muted"><Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms & conditions</Link><span aria-hidden> · </span><Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy notice</Link>{!businessDetails.policiesApproved && <span className="block">Policies are drafts pending business approval.</span>}</p>}
          {note && <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">{note}</p>}
          {linkText && <div className="mt-7 border-t border-[var(--border)] pt-4 text-center"><Link href={linkHref} className="text-link text-sm">{linkText}<ArrowRight size={15} aria-hidden /></Link></div>}
        </div>
      </section>
    </main>
  );
}
