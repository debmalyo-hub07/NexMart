'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

/** Copy a deep link to a policy section. Inline feedback, no toast spam. */
export function CopySectionLink({ id, title }: { id: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement('input');
      field.value = url;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="policy-copy"
      aria-label={copied ? `Link to ${title} copied` : `Copy link to ${title}`}
    >
      {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
    </button>
  );
}
