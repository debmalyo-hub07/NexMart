'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, MessageSquare } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';

type RequestRow = {
  _id: string; __v: number; kind: string; itemName?: string; reason: string; status: string; createdAt: string;
  customer?: { name: string; email: string };
  order?: { _id: string; orderId: string; orderStatus: string; paymentStatus: string; total: number; refund?: { status: string } };
  history: { status: string; note: string; timestamp: string }[];
};
const transitions = (row: RequestRow) => ({ submitted: ['under_review', 'rejected'], under_review: ['approved', 'rejected', ...(row.kind === 'help' ? ['resolved'] : [])], approved: ['resolved'] }[row.status] || []);
const words = (value: string) => value.replaceAll('_', ' ');

export default function SupportQueuePage() {
  const cache = useQueryClient();
  const [filter, setFilter] = useState('open');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('under_review');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: ['admin', 'support', filter, kind, page], queryFn: async () => (await api.get('/admin/order-requests', { params: { status: filter, kind, page, limit: 15 } })).data as { data: RequestRow[]; meta: { total: number; totalPages: number } }, refetchInterval: 30000 });
  const update = useMutation({
    mutationFn: (row: RequestRow) => api.patch(`/admin/order-requests/${row._id}`, { version: row.__v, status: nextStatus, note }),
    onSuccess: () => { setSelected(null); setNote(''); setSaved(true); void cache.invalidateQueries({ queryKey: ['admin', 'support'] }); },
  });
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-3">Customer care</p><h1 className="text-3xl">Order requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">Review cancellations, returns and questions. Every update here is visible to the customer. Approved requests still require the corresponding order and payment operations.</p></div><Link href="/admin/orders" className="btn-secondary">Manage orders<ArrowUpRight size={16} aria-hidden /></Link></div>
    <div className="flex flex-wrap gap-3"><div><label htmlFor="support-state" className="field-label">Status</label><select id="support-state" className="input mt-2" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>{['open', 'submitted', 'under_review', 'approved', 'rejected', 'resolved', ''].map(status => <option key={status} value={status}>{status ? words(status) : 'All statuses'}</option>)}</select></div><div><label htmlFor="support-kind" className="field-label">Request</label><select id="support-kind" className="input mt-2" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}>{['', 'help', 'cancellation', 'return'].map(value => <option key={value} value={value}>{value || 'All requests'}</option>)}</select></div></div>
    {saved && <p role="status" className="flex items-center gap-2 text-sm text-green-800"><Check size={16} aria-hidden />Customer-visible update saved.</p>}
    {query.isPending ? <p role="status" className="text-sm text-muted">Loading requests…</p> : query.isError ? <QueryError label="Support queue" detail={getApiError(query.error)} onRetry={() => void query.refetch()} /> : <>
      <p className="text-sm text-muted">{query.data.meta.total} requests · oldest first</p>
      {!query.data.data.length && <EmptyState title="No requests in this view" description="New customer requests will appear here as they arrive." />}
      <div className="space-y-4">{query.data.data.map(row => <article key={row._id} className="card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow mb-2">{row.kind} request</p><h2 className="text-xl">{row.order?.orderId || 'Order unavailable'}</h2><p className="mt-2 text-xs text-muted">{row.customer?.name || 'Customer'} · {formatDate(row.createdAt)}</p></div><span className="rounded-md bg-[var(--bg-raised)] px-3 py-2 text-sm font-semibold capitalize">{words(row.status)}</span></div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-secondary"><span>Fulfillment: <StatusBadge status={row.order?.orderStatus || 'pending'} /></span><span>Payment: <StatusBadge status={row.order?.paymentStatus || 'pending'} /></span><strong>{formatPrice(row.order?.total || 0)}</strong>{row.order?.refund && <span>Refund: {words(row.order.refund.status)}</span>}</div>
        {row.itemName && <p className="mt-4 text-sm font-semibold">{row.itemName}</p>}<p className="mt-4 break-words rounded-lg bg-[var(--bg-raised)] p-4 text-sm leading-6">{row.reason}</p>
        <details className="mt-2"><summary className="flex min-h-11 cursor-pointer items-center text-sm text-secondary underline underline-offset-4">Request history & contact</summary><p className="mb-3 break-all text-sm">{row.customer?.email}</p><ol className="space-y-3 border-l-2 border-[var(--border)] pl-4">{row.history.map((event, index) => <li key={index}><p className="text-xs capitalize text-muted">{words(event.status)} · {formatDate(event.timestamp)}</p><p className="mt-1 break-words text-sm leading-6">{event.note}</p></li>)}</ol><p className="mt-3 break-all text-xs text-muted">Request {row._id}</p></details>
        {selected === row._id ? <form className="mt-4 space-y-4 border-t border-[var(--border)] pt-4" onSubmit={e => { e.preventDefault(); update.mutate(row); }}>
          <div><label htmlFor={`request-status-${row._id}`} className="field-label">Next status</label><select id={`request-status-${row._id}`} className="input mt-2" value={nextStatus} onChange={e => setNextStatus(e.target.value)} disabled={update.isPending}>{transitions(row).map(status => <option key={status} value={status}>{words(status)}</option>)}</select></div>
          <div><label htmlFor={`request-note-${row._id}`} className="field-label">Message to the customer</label><textarea id={`request-note-${row._id}`} value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={1000} required className="input mt-2 min-h-28" disabled={update.isPending} placeholder="Explain your decision and any next steps." /></div>
          {update.isError && <p role="alert" className="text-sm text-red-800">{getApiError(update.error)}</p>}
          <div className="flex flex-wrap gap-3"><button className="btn-primary" type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save customer update'}</button><button type="button" className="btn-secondary" onClick={() => setSelected(null)} disabled={update.isPending}>Close</button></div>
        </form> : transitions(row).length > 0 && <button type="button" className="btn-secondary mt-4" onClick={() => { setSelected(row._id); setNextStatus(transitions(row)[0]); setSaved(false); update.reset(); setNote(''); }}><MessageSquare size={16} aria-hidden />Review & respond</button>}
      </article>)}</div>
      {query.data.meta.totalPages > 1 && <nav aria-label="Support pages" className="flex items-center justify-between gap-3"><button className="btn-secondary" type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span className="text-sm">Page {page} of {query.data.meta.totalPages}</span><button className="btn-secondary" type="button" disabled={page >= query.data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
    </>}
  </div>;
}
