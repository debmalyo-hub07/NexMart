'use client';

import { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import type { ApiResponse } from '@/types';

function safeInvoice(url?: string) {
  try { const value = new URL(url || ''); return value.protocol === 'https:' && value.hostname === 'res.cloudinary.com' ? value.href : undefined; } catch { return undefined; }
}
export function InvoiceButton({ orderId, invoiceUrl, path }: { orderId: string; invoiceUrl?: string; path?: string }) {
  const [url, setUrl] = useState(safeInvoice(invoiceUrl));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function prepare() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await api.get<ApiResponse<{ invoiceUrl?: string }>>(path || `/orders/${orderId}/invoice`);
      const href = safeInvoice(response.data.data?.invoiceUrl);
      if (href) setUrl(href);
      else setMessage(response.data.message || 'The invoice is being prepared. Check again shortly.');
    } catch (error) { setMessage(getApiError(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary"><Download size={17} aria-hidden />Download invoice<span className="sr-only"> (opens a new tab)</span></a> : <button type="button" className="btn-secondary" disabled={busy} onClick={() => void prepare()}>{busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Download size={17} aria-hidden />}{busy ? 'Checking invoice…' : 'Get invoice'}</button>}{message && <p role="status" className="mt-2 max-w-md text-sm text-secondary">{message}</p>}</div>;
}
