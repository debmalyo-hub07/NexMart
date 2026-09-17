'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Clock3, Loader2, Search, ShieldAlert, Store, XCircle } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';

type SellerState = 'draft' | 'submitted' | 'under_review' | 'approved' | 'active' | 'rejected' | 'suspended' | 'blocked' | 'closed';
type SellerRow = { _id: string; name: string; email: string; storefrontName: string; legalBusinessName: string; businessType: string; lifecycleStatus: SellerState; emailVerified: boolean; kycState: string; rejectionReason?: string; createdAt: string };
type SellerResponse = { data: SellerRow[]; meta: { page: number; total: number; totalPages: number } };

const actions: Partial<Record<SellerState, { next: SellerState; label: string; tone: 'primary' | 'danger' }[]>> = {
  submitted: [{ next: 'under_review', label: 'Start review', tone: 'primary' }, { next: 'rejected', label: 'Reject', tone: 'danger' }],
  under_review: [{ next: 'approved', label: 'Approve', tone: 'primary' }, { next: 'rejected', label: 'Reject', tone: 'danger' }],
  approved: [{ next: 'active', label: 'Activate', tone: 'primary' }, { next: 'suspended', label: 'Suspend', tone: 'danger' }],
  active: [{ next: 'suspended', label: 'Suspend', tone: 'danger' }, { next: 'blocked', label: 'Block', tone: 'danger' }],
  suspended: [{ next: 'active', label: 'Reactivate', tone: 'primary' }, { next: 'blocked', label: 'Block', tone: 'danger' }],
  blocked: [{ next: 'active', label: 'Reactivate', tone: 'primary' }, { next: 'closed', label: 'Close', tone: 'danger' }],
};
const reasonRequired = new Set<SellerState>(['rejected', 'suspended', 'blocked']);

export default function AdminSellersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ seller: SellerRow; next: SellerState } | null>(null);
  const [reason, setReason] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [status, search]);

  const sellers = useQuery({ queryKey: ['admin', 'sellers', queryString], queryFn: async () => (await api.get(`/admin/sellers?${queryString}`)).data as SellerResponse });
  const update = useMutation({
    mutationFn: async ({ seller, next, reason }: { seller: SellerRow; next: SellerState; reason?: string }) => api.patch(`/admin/sellers/${seller._id}/status`, { status: next, ...(reason ? { reason } : {}) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'sellers'] }); showToast('Seller status updated', 'success'); setSelected(null); setReason(''); },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  function requestAction(seller: SellerRow, next: SellerState) {
    if (reasonRequired.has(next)) { setSelected({ seller, next }); setReason(''); return; }
    update.mutate({ seller, next });
  }

  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-violet-300">Marketplace governance</p><h1 className="mt-1 font-outfit text-3xl font-semibold">Seller applications</h1><p className="mt-2 max-w-2xl text-sm text-secondary">Review business accounts through controlled lifecycle states. Every status change is recorded in the seller audit log.</p></div><div className="flex flex-wrap gap-3"><label className="relative"><span className="sr-only">Search sellers</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sellers" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-800 pl-9 pr-3 text-sm text-white sm:w-56" /></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white"><option value="">All states</option>{['draft','submitted','under_review','approved','active','rejected','suspended','blocked','closed'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></label></div></div>
    {sellers.isPending ? <div className="space-y-2" aria-label="Loading seller applications">{[0,1,2].map((item) => <div key={item} className="h-24 animate-pulse border-y border-white/10 bg-white/[0.03]" />)}</div> : sellers.isError ? <QueryError label="Seller applications" detail={getApiError(sellers.error)} onRetry={() => void sellers.refetch()} /> : !sellers.data?.data.length ? <EmptyState icon={Store} title="No seller applications" description="Applications matching this filter will appear here." /> : <section className="divide-y divide-white/10 border-y border-white/10" aria-label="Seller applications">{sellers.data.data.map((seller) => <article key={seller._id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-outfit text-lg font-semibold">{seller.storefrontName}</h2><StatusBadge status={seller.lifecycleStatus} /></div><p className="mt-1 truncate text-sm text-secondary">{seller.legalBusinessName}</p><p className="mt-1 truncate text-xs text-muted">{seller.name} · {seller.email}</p>{seller.rejectionReason && <p className="mt-2 text-sm text-red-200">Review note: {seller.rejectionReason}</p>}</div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted">Email</p><p className="mt-1">{seller.emailVerified ? 'Verified' : 'Pending'}</p></div><div><p className="text-xs text-muted">Business type</p><p className="mt-1 capitalize">{seller.businessType.replace('_', ' ')}</p></div></div><div className="flex flex-wrap gap-2 lg:justify-end">{(actions[seller.lifecycleStatus] || []).map((action) => <button key={action.next} type="button" disabled={update.isPending} onClick={() => requestAction(seller, action.next)} className={action.tone === 'danger' ? 'btn-danger min-h-11 px-3' : 'btn-secondary min-h-11 px-3'}>{action.next === 'approved' || action.next === 'active' ? <CheckCircle2 size={15} aria-hidden /> : action.tone === 'danger' ? <XCircle size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}{action.label}</button>)}</div></article>)}</section>}
    <Overlay
      open={Boolean(selected)}
      onClose={() => { if (!update.isPending) setSelected(null); }}
      title={selected ? `${selected.next === 'rejected' ? 'Reject' : selected.next === 'blocked' ? 'Block' : 'Suspend'} ${selected.seller.storefrontName}` : 'Seller action'}
      description="The reason is retained in the audit trail and shown to the seller where appropriate."
      busy={update.isPending}
      initialFocus="textarea"
      footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} disabled={update.isPending} className="btn-secondary">Cancel</button><button type="button" onClick={() => selected && update.mutate({ seller: selected.seller, next: selected.next, reason: reason.trim() })} disabled={update.isPending || !reason.trim()} className="btn-danger">{update.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Clock3 size={16} aria-hidden />} Confirm</button></div>}
    >
      <label className="block space-y-2 text-sm text-secondary"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} className="w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" /></label>
    </Overlay>
  </div>;
}
