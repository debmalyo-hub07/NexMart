'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';
import { OtpInput } from '@/components/auth/OtpInput';
import { passwordSchema } from '@/lib/password';

/**
 * First password for an account created through Google. There is no current
 * password to prove ownership with, so the backend emails a code instead —
 * the same machinery the reset flow uses, not a second code path.
 */
export function SetPasswordModal({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: () => void }) {
  const id = useId();
  const toast = useUIStore((s) => s.showToast);
  const [stage, setStage] = useState<'request' | 'enter'>('request');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    setStage('request'); setOtp(['', '', '', '', '', '']); setPassword(''); setError(''); onClose();
  }

  async function requestCode() {
    setBusy(true); setError('');
    try { await api.post('/customer/set-password/request', {}); setStage('enter'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true); setError('');
    try {
      await api.post('/customer/set-password', { otp: otp.join(''), password });
      toast('Password set. You can now sign in with your email too.');
      onDone(); close();
    } catch (err) { setError(getApiError(err)); setOtp(['', '', '', '', '', '']); }
    finally { setBusy(false); }
  }

  return (
    <Overlay open={isOpen} onClose={close} title="Add a password" description="Your account signs in with Google. Add a password to sign in by email as well." busy={busy}>
      {error && <p role="alert" className="field-error mb-4">{error}</p>}
      {stage === 'request' ? (
        <div className="space-y-4">
          <p className="text-sm text-secondary">We will email you a 6-digit code to confirm it is you.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void requestCode()} disabled={busy}>
              {busy && <Loader2 size={17} className="animate-spin" aria-hidden />}{busy ? 'Sending…' : 'Email me a code'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy} className="space-y-4">
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            <div>
              <label htmlFor={`${id}-password`} className="field-label">New password</label>
              <input id={`${id}-password`} type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="field-hint">At least 8 characters, with uppercase, lowercase, and a number.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="submit" className="btn-primary">{busy && <Loader2 size={17} className="animate-spin" aria-hidden />}{busy ? 'Saving…' : 'Set password'}</button>
            </div>
          </fieldset>
        </form>
      )}
    </Overlay>
  );
}
