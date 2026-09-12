'use client';

import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';

const schema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), password: z.string().min(8, 'Use at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Include uppercase, lowercase, and a number'), confirmPassword: z.string() }).refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords must match' });
type Values = z.infer<typeof schema>;
export function PasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const toast = useUIStore(s => s.showToast);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const close = () => { reset(); setError(''); setVisible(false); onClose(); };
  async function submit(values: Values) {
    setError('');
    try { await api.put('/customer/password', { currentPassword: values.currentPassword, password: values.password }); toast('Password updated'); close(); }
    catch (error) { setError(getApiError(error)); }
  }
  return <Overlay open={isOpen} onClose={close} title="Change password" description="Use at least 8 characters with uppercase, lowercase, and a number." busy={isSubmitting}>
    <form onSubmit={handleSubmit(submit)} noValidate><fieldset disabled={isSubmitting} className="space-y-4">
      {([{ name: 'currentPassword', label: 'Current password' }, { name: 'password', label: 'New password' }, { name: 'confirmPassword', label: 'Confirm new password' }] as const).map(field => <div key={field.name}><label htmlFor={`${id}-${field.name}`} className="field-label">{field.label}</label><input {...register(field.name)} id={`${id}-${field.name}`} type={visible ? 'text' : 'password'} className="input" autoComplete={field.name === 'currentPassword' ? 'current-password' : 'new-password'} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined} />{errors[field.name] && <p id={`${id}-${field.name}-error`} className="field-error" role="alert">{errors[field.name]?.message}</p>}</div>)}
      <button type="button" className="btn-secondary" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}{visible ? 'Hide passwords' : 'Show passwords'}</button>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button type="submit" className="btn-primary">{isSubmitting && <Loader2 size={17} className="animate-spin" aria-hidden />}{isSubmitting ? 'Saving…' : 'Save password'}</button></div>
    </fieldset></form>
  </Overlay>;
}
