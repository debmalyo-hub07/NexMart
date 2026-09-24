'use client';

import { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';

export function InvoiceButton({ orderId, path }: { orderId: string; invoiceUrl?: string; path?: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function download() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await api.get<Blob>(path || `/orders/${orderId}/invoice`, { responseType: 'blob' });
      if (!String(response.headers['content-type']).includes('application/pdf')) throw new Error('The receipt could not be prepared. Please try again.');
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `NexMart-${orderId}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { setMessage(getApiError(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div><button type="button" className="btn-secondary" disabled={busy} onClick={() => void download()}>{busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Download size={17} aria-hidden />}{busy ? 'Preparing receipt…' : 'Download receipt'}</button>{message && <p role="status" className="mt-2 max-w-md text-sm text-secondary">{message}</p>}</div>;
}
