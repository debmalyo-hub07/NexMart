'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent, Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { Overlay } from '@/components/common/Overlay';
import { useUIStore } from '@/store/uiStore';
import { formatPrice } from '@/lib/utils';

type FeeRuleRow = {
  _id: string;
  ruleId: string;
  ruleKey: string;
  version: number;
  status: 'draft' | 'active' | 'retired';
  effectiveFrom: string;
  category?: { _id: string; name: string };
  fulfillmentMode?: 'seller' | 'nexmart';
  commissionBps: number;
  fixedFeePaise: number;
  shippingCostPaise: number;
  reserveBps: number;
  requiresProfessionalReview: boolean;
};

type FeeRulesResponse = {
  data: FeeRuleRow[];
  meta: { page: number; total: number; totalPages: number };
};

export default function AdminFeeRulesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New rule form state
  const [ruleKey, setRuleKey] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [fixedFeeRupees, setFixedFeeRupees] = useState('15');
  const [reservePercent, setReservePercent] = useState('5');
  const [fulfillmentMode, setFulfillmentMode] = useState<'seller' | 'nexmart' | ''>('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '20', page: String(page) });
    if (status) params.set('status', status);
    return params.toString();
  }, [status, page]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'fee-rules', queryString],
    queryFn: async () => (await api.get(`/admin/fee-rules?${queryString}`)).data as FeeRulesResponse,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'retired' }) =>
      api.patch(`/admin/fee-rules/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fee-rules'] });
      showToast('Fee rule status updated', 'success');
    },
    onError: (err) => showToast(getApiError(err), 'error'),
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const payload = {
        ruleKey: ruleKey.trim(),
        commissionBps: Math.round(parseFloat(commissionPercent) * 100),
        fixedFeePaise: Math.round(parseFloat(fixedFeeRupees) * 100),
        reserveBps: Math.round(parseFloat(reservePercent) * 100),
        fulfillmentMode: fulfillmentMode || undefined,
        status: 'active',
      };
      return api.post('/admin/fee-rules', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fee-rules'] });
      showToast('Fee rule created successfully', 'success');
      setCreateModalOpen(false);
      setRuleKey('');
    },
    onError: (err) => showToast(getApiError(err), 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-violet-300">Monetization & Commission</p>
          <h1 className="mt-1 font-outfit text-3xl font-semibold">Marketplace Fee Rules</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            Configure versioned commission waterfalls, fixed fees, and reserve withholdings by category and fulfillment model.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
          >
            <Plus size={16} aria-hidden /> New fee rule
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3" aria-label="Loading fee rules">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : isError ? (
        <QueryError label="Fee rules" detail={getApiError(error)} onRetry={() => void refetch()} />
      ) : !data?.data.length ? (
        <EmptyState
          icon={Percent}
          title="No fee rules found"
          description="Create your first fee rule to establish platform commissions and escrow reserves."
          action={
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={16} aria-hidden /> Create fee rule
            </button>
          }
        />
      ) : (
        <section className="divide-y divide-white/10 border-y border-white/10" aria-label="Fee rules list">
          {data.data.map((rule) => (
            <article
              key={rule._id}
              className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-outfit text-lg font-semibold text-white">
                    {rule.ruleKey}
                  </h2>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-violet-300">
                    v{rule.version}
                  </span>
                  <StatusBadge status={rule.status} />
                </div>
                <p className="mt-1 text-sm text-secondary">
                  Rule ID: <span className="font-mono text-xs">{rule.ruleId}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Fulfillment: <span className="capitalize">{rule.fulfillmentMode || 'All modes'}</span> · Category: {rule.category?.name || 'Universal (Default)'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Commission</p>
                  <p className="mt-1 font-mono font-medium text-white">
                    {(rule.commissionBps / 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Fixed Fee</p>
                  <p className="mt-1 font-mono font-medium text-white">
                    {formatPrice(rule.fixedFeePaise / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Reserve Hold</p>
                  <p className="mt-1 font-mono font-medium text-white">
                    {(rule.reserveBps / 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {rule.status === 'active' && (
                  <button
                    type="button"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: rule._id, status: 'retired' })}
                    className="btn-danger min-h-11 px-3 text-xs"
                  >
                    <XCircle size={15} aria-hidden /> Retire
                  </button>
                )}
                {rule.status === 'retired' && (
                  <button
                    type="button"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: rule._id, status: 'active' })}
                    className="btn-secondary min-h-11 px-3 text-xs"
                  >
                    <CheckCircle2 size={15} aria-hidden /> Reactivate
                  </button>
                )}
              </div>
            </article>
          ))}

          {data.meta.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </section>
      )}

      {/* New Fee Rule Modal */}
      <Overlay
        open={createModalOpen}
        onClose={() => {
          if (!createRule.isPending) setCreateModalOpen(false);
        }}
        title="Create Marketplace Fee Rule"
        description="Fee rules govern the immutable fee waterfall applied when customer orders are placed."
        busy={createRule.isPending}
        initialFocus="input"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              disabled={createRule.isPending}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createRule.mutate()}
              disabled={createRule.isPending || !ruleKey.trim()}
              className="btn-primary"
            >
              {createRule.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />} Save Rule
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1 text-sm text-secondary">
            <span>Rule Key * (e.g. electronics:standard, universal:default)</span>
            <input
              type="text"
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value)}
              placeholder="e.g. fashion:seller_direct"
              className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-secondary">
              <span>Commission Rate (%) *</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              />
            </label>

            <label className="block space-y-1 text-sm text-secondary">
              <span>Fixed Fee (₹) *</span>
              <input
                type="number"
                min="0"
                value={fixedFeeRupees}
                onChange={(e) => setFixedFeeRupees(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-secondary">
              <span>Reserve Withholding (%) *</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={reservePercent}
                onChange={(e) => setReservePercent(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              />
            </label>

            <label className="block space-y-1 text-sm text-secondary">
              <span>Fulfillment Mode</span>
              <select
                value={fulfillmentMode}
                onChange={(e) => setFulfillmentMode(e.target.value as any)}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-space-900 px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                <option value="">Universal (Applies to all)</option>
                <option value="seller">Seller Direct</option>
                <option value="nexmart">NexMart Fulfilled</option>
              </select>
            </label>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
