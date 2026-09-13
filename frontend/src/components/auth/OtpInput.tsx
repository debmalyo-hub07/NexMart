'use client';

import { useEffect, useRef } from 'react';

interface OtpInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * The six-box code input (CLAUDE.md §5.5). Extracted from the verify-otp page
 * so email verification and password reset share one implementation: auto
 * advance, backspace-back, full paste, one-time-code autocomplete.
 */
export function OtpInput({ value, onChange, disabled, autoFocus = true }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (autoFocus) inputRefs.current[0]?.focus(); }, [autoFocus]);

  function handleChange(index: number, raw: string) {
    if (!/^\d*$/.test(raw)) return;
    const next = [...value];
    next[index] = raw.slice(-1);
    onChange(next);
    if (raw && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      onChange(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  return (
    <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          aria-label={`Verification digit ${index + 1}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          suppressHydrationWarning
          className="h-[52px] w-11 rounded-xl border border-white/15 bg-black/50 text-center text-xl font-bold text-white transition-[border-color,box-shadow] focus-visible:border-violet-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
