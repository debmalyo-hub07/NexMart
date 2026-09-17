'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ArrowUpRight, ArrowDownLeft, Filter, Scale } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { formatPrice, formatDate } from '@/lib/utils';

type LedgerRow = {
  _id: string;
  ledgerId: string;
  eventId: string;
  eventType: string;
  account: string;
  direction: 'debit' | 'credit';
  amountPaise: number;
  description?: string;
  order?: { _id: string; orderId: string; total: number };
  seller?: { _id: string; storefrontName: string };
  effectiveAt: string;
  createdAt: string;
};

type LedgerResponse = {
  data: LedgerRow[];
  meta: { page: number; total: number; totalPages: number };
};

type LedgerSummary = Record<
  string,
  {
    balancePaise: number;
    balanceRupees: number;
    creditRupees: number;
    debitRupees: number;
  }
>;

export default function AdminLedgerPage() {
  const [account, setAccount] = useState('');
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '25', page: String(page) });
    if (account) params.set('account', account);
    if (eventType) params.set('eventType', eventType);
    return params.toString();
  }, [account, eventType, page]);

  const summaryQuery = useQuery({
    queryKey: ['admin', 'ledger', 'summary'],
    queryFn: async () => (await api.get('/admin/ledger/summary')).data.data as LedgerSummary,
  });

  const entriesQuery = useQuery({
    queryKey: ['admin', 'ledger', queryString],
    queryFn: async () => (await api.get(`/admin/ledger?${queryString}`)).data as LedgerResponse,
  });

  const summary = summaryQuery.data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-violet-300">Financial Audit & Accounting</p>
          <h1 className="mt-1 font-outfit text-3xl font-semibold">Marketplace Ledger</h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            Immutable double-entry journal. Every payment, commission split, reserve hold, and refund is balanced to the exact minor unit (paise).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filter by account</span>
            <select
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <option value="">All accounts</option>
              {[
                'platform_revenue',
                'seller_payable',
                'seller_reserve',
                'payment_clearing',
                'payment_cost',
                'shipping_cost',
                'tax_payable',
              ].map((acc) => (
                <option key={acc} value={acc}>
                  {acc.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filter by event</span>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-lg border border-white/15 bg-space-800 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            >
              <option value="">All event types</option>
              {[
                'payment_captured',
                'payment_failed',
                'refund',
                'chargeback',
                'transfer_initiated',
                'transfer_settled',
                'settlement_hold',
                'settlement_release',
              ].map((ev) => (
                <option key={ev} value={ev}>
                  {ev.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Account Balances Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-space-900 p-4">
          <p className="text-xs text-muted">Platform Revenue Net</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-acid-400">
            {formatPrice(summary.platform_revenue?.balanceRupees || 0)}
          </p>
          <p className="mt-1 text-[11px] text-secondary">Earned commissions & fixed fees</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-space-900 p-4">
          <p className="text-xs text-muted">Seller Payable (Liability)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {formatPrice(summary.seller_payable?.balanceRupees || 0)}
          </p>
          <p className="mt-1 text-[11px] text-secondary">Awaiting seller settlement</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-space-900 p-4">
          <p className="text-xs text-muted">Seller Reserves (Escrow)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-300">
            {formatPrice(summary.seller_reserve?.balanceRupees || 0)}
          </p>
          <p className="mt-1 text-[11px] text-secondary">Held for return/dispute window</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-space-900 p-4">
          <p className="text-xs text-muted">Payment Provider Costs</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-violet-300">
            {formatPrice(summary.payment_cost?.balanceRupees || 0)}
          </p>
          <p className="mt-1 text-[11px] text-secondary">Gateway processing fees</p>
        </div>
      </div>

      {/* Journal Table */}
      {entriesQuery.isPending ? (
        <div className="space-y-2" aria-label="Loading journal entries">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : entriesQuery.isError ? (
        <QueryError
          label="Ledger entries"
          detail={getApiError(entriesQuery.error)}
          onRetry={() => void entriesQuery.refetch()}
        />
      ) : !entriesQuery.data?.data.length ? (
        <EmptyState
          icon={Scale}
          title="No ledger entries found"
          description="When transactions occur through checkout or refunds, immutable entries will be recorded here."
        />
      ) : (
        <section className="overflow-x-auto rounded-xl border border-white/10 bg-space-900">
          <table className="w-full text-left text-sm text-secondary">
            <thead className="border-b border-white/10 bg-space-950/60 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Order / Reference</th>
                <th className="px-4 py-3">Seller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {entriesQuery.data.data.map((entry) => {
                const isCredit = entry.direction === 'credit';
                return (
                  <tr key={entry._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-muted">
                      {formatDate(entry.effectiveAt || entry.createdAt, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-white capitalize">
                      {entry.eventType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-violet-300">
                      {entry.account.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          isCredit
                            ? 'bg-acid-400/15 text-acid-400'
                            : 'bg-red-400/15 text-red-300'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft size={12} aria-hidden />
                        ) : (
                          <ArrowUpRight size={12} aria-hidden />
                        )}
                        {entry.direction}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        isCredit ? 'text-white' : 'text-secondary'
                      }`}
                    >
                      {formatPrice(entry.amountPaise / 100)}
                    </td>
                    <td className="px-4 py-3 font-sans text-secondary">
                      {entry.order ? (
                        <span>Order {entry.order.orderId}</span>
                      ) : (
                        <span className="text-muted">{entry.description || 'System entry'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted">
                      {entry.seller?.storefrontName || 'Platform'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {entriesQuery.data.meta.totalPages > 1 && (
            <div className="p-4 border-t border-white/10">
              <Pagination
                page={entriesQuery.data.meta.page}
                totalPages={entriesQuery.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
