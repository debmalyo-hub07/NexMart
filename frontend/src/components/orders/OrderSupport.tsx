'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Loader2, MessageSquare, RotateCcw, X } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import { QueryError } from '@/components/common/QueryError';

type Kind = 'cancellation' | 'return' | 'help';
type SupportRequest = { _id: string; kind: Kind; itemName?: string; reason: string; status: string; createdAt: string; history: { status: string; note: string; timestamp: string }[] };
type SupportData = { requests: SupportRequest[]; actions: { cancellation: boolean; returnItems: { itemId: string; name: string; eligible: boolean; reason: string; deadline?: string }[] } };
export type RefundSummary = { status: string; refundId?: string; amountPaise: number; requestedAt: string; processedAt?: string };
const labels: Record<Kind, string> = { cancellation: 'Cancellation request', return: 'Return request', help: 'Order help' };
const statusLabels: Record<string, string> = { submitted: 'Received', under_review: 'Under review', approved: 'Approved · next steps below', rejected: 'Declined · reason below', resolved: 'Resolved' };

export function RefundProgress({ refund }: { refund?: RefundSummary }) {
  if (!refund) return null;
  const descriptions: Record<string, string> = {
    requested: 'Your refund request has been recorded. We are confirming its status with the payment provider.',
    pending: 'The payment provider has received your refund. We will update this page when processing is confirmed.',
    processed: 'The payment provider has processed your refund. Your bank determines when the credit appears in your account.',
    failed: 'The payment provider reported a failed refund. Use order help below so the team can follow up.',
    needs_review: 'We are checking the refund outcome with the payment provider. This does not mean the refund has completed.',
  };
  return <section className="mb-6 rounded-xl border border-[var(--border)] bg-white p-5" aria-labelledby="refund-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="refund-heading" className="flex items-center gap-2 text-lg"><RotateCcw size={19} aria-hidden />Refund {refund.status === 'processed' ? 'processed' : 'progress'}</h2><strong>{formatPrice(refund.amountPaise / 100)}</strong></div>
    <p className="mt-3 text-sm leading-6 text-secondary">{descriptions[refund.status] || descriptions.needs_review}</p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted"><span>Requested {formatDate(refund.requestedAt)}</span>{refund.refundId && <span className="break-all">Reference: {refund.refundId}</span>}{refund.processedAt && <span>Processed {formatDate(refund.processedAt)}</span>}</div>
  </section>;
}

export function OrderSupport({ orderId }: { orderId: string }) {
  const cache = useQueryClient();
  const [kind, setKind] = useState<Kind | null>(null);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const key = useRef<string | null>(null);
  const query = useQuery({ queryKey: ['customer', 'orders', 'requests', orderId], queryFn: async () => (await api.get(`/orders/${orderId}/requests`)).data.data as SupportData, refetchInterval: 15000 });
  const mutation = useMutation({
    mutationFn: async () => {
      key.current ||= crypto.randomUUID();
      return api.post(`/orders/${orderId}/requests`, { requestKey: key.current, kind, reason: reason.trim(), ...(kind === 'return' ? { itemId } : {}) });
    },
    onSuccess: () => {
      setKind(null); setReason(''); key.current = null;
      setMessage('Request received. Follow the updates below.');
      void cache.invalidateQueries({ queryKey: ['customer', 'orders', 'requests', orderId] });
    },
  });
  const edit = () => { key.current = null; mutation.reset(); setMessage(''); };
  const open = (value: Kind) => { edit(); setKind(value); setItemId(query.data?.actions.returnItems.find(item => item.eligible)?.itemId || ''); };
  const eligible = query.data?.actions.returnItems.filter(item => item.eligible) || [];

  return <section className="card" aria-labelledby="order-help-heading">
    <p className="eyebrow mb-3">Here after checkout, too</p>
    <h2 id="order-help-heading" className="text-2xl">How can we help?</h2>
    <p className="mt-3 text-sm leading-6 text-secondary">Ask about this order and keep every response in one place. A request is reviewed before any cancellation, return or refund is carried out.</p>
    {query.isPending ? <p role="status" className="mt-5 text-sm text-muted">Loading your support options…</p> : query.isError ? <div className="mt-5"><QueryError label="Order support" onRetry={() => void query.refetch()} /></div> : <>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => open('help')}><MessageSquare size={17} aria-hidden />Get order help</button>
        {query.data.actions.cancellation && <button type="button" className="btn-secondary" onClick={() => open('cancellation')}><X size={17} aria-hidden />Request cancellation</button>}
        {eligible.length > 0 && <button type="button" className="btn-secondary" onClick={() => open('return')}><RotateCcw size={17} aria-hidden />Request a return</button>}
      </div>
      {query.data.actions.returnItems.some(item => !item.eligible) && <details className="mt-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm text-secondary underline underline-offset-4">Return options for your items</summary><ul className="space-y-3 border-l-2 border-[var(--border)] pl-4 text-xs leading-6 text-secondary">{query.data.actions.returnItems.map(item => <li key={item.itemId}><strong className="block text-primary">{item.name}</strong>{item.eligible ? `Eligible until ${formatDate(item.deadline!)}` : item.reason}</li>)}</ul></details>}
      {kind && <form className="mt-5 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] p-4" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg">{labels[kind]}</h3><button type="button" className="icon-button" aria-label="Close request form" onClick={() => setKind(null)} disabled={mutation.isPending}><X size={18} aria-hidden /></button></div>
        {kind === 'return' && <div><label htmlFor="request-item" className="field-label">Which item?</label><select id="request-item" className="input mt-2" value={itemId} onChange={event => { edit(); setItemId(event.target.value); }} required disabled={mutation.isPending}>{eligible.map(item => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}</select></div>}
        <div><label htmlFor="request-reason" className="field-label">Tell us what happened</label><textarea id="request-reason" className="input mt-2 min-h-28" value={reason} onChange={event => { edit(); setReason(event.target.value); }} minLength={10} maxLength={1000} required disabled={mutation.isPending} placeholder="Describe the issue and the help you need." /><p className="mt-1 text-xs text-muted">10–1,000 characters. Your message is sent with this order’s details.</p></div>
        {mutation.isError && <p role="alert" className="text-sm text-red-800">{getApiError(mutation.error)}</p>}
        <button type="submit" className="btn-primary" disabled={mutation.isPending || reason.trim().length < 10}>{mutation.isPending ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <ArrowRight size={17} aria-hidden />}Send request</button>
      </form>}
      {message && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-green-800"><Check size={17} aria-hidden />{message}</p>}
      {query.data.requests.length > 0 && <div className="mt-7 border-t border-[var(--border)] pt-5"><h3 className="mb-4 text-lg">Your requests</h3><div className="space-y-4">{query.data.requests.map(request => <details key={request._id} className="rounded-lg border border-[var(--border)] p-4" open={['submitted', 'under_review', 'approved'].includes(request.status)}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold"><span className="mr-2">{labels[request.kind]}</span><span className="text-xs font-normal text-secondary">{statusLabels[request.status] || request.status}</span></summary>
        {request.itemName && <p className="mb-2 text-xs text-muted">{request.itemName}</p>}<p className="break-words text-sm leading-6 text-secondary">{request.reason}</p>
        <ol className="mt-4 space-y-4 border-l-2 border-[var(--border)] pl-4">{request.history.map((event, index) => <li key={index}><p className="text-xs font-semibold">{statusLabels[event.status] || event.status} <time className="ml-2 font-normal text-muted" dateTime={event.timestamp}>{formatDate(event.timestamp)}</time></p><p className="mt-1 break-words text-sm leading-6 text-secondary">{event.note}</p></li>)}</ol>
        <p className="mt-4 break-all text-xs text-muted">Reference: {request._id}</p>
      </details>)}</div></div>}
    </>}
  </section>;
}
