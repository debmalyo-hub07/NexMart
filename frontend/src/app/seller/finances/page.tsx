'use client';

import { useQuery } from '@tanstack/react-query';
import { IndianRupee, ShieldCheck, ArrowUpRight, ArrowDownLeft, Clock, Wallet } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { formatPrice, formatDate } from '@/lib/utils';

type LedgerTransaction = {
  _id: string;
  eventType: string;
  account: string;
  direction: 'debit' | 'credit';
  amountPaise: number;
  effectiveAt: string;
  createdAt: string;
  order?: {
    _id: string;
    orderId: string;
    total: number;
  };
};

type SellerFinancesResponse = {
  payableBalancePaise: number;
  payableBalanceRupees: number;
  reserveBalancePaise: number;
  reserveBalanceRupees: number;
  totalEarnedPaise: number;
  totalEarnedRupees: number;
  recentEntries: LedgerTransaction[];
};

export default function SellerFinancesPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['seller', 'finances'],
    queryFn: async () => (await api.get('/seller/finances')).data.data as SellerFinancesResponse,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-violet-300">Your financial records</p>
        <h1 className="mt-1 font-outfit text-3xl font-semibold">Finances & settlements</h1>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          Track earnings, platform commission deductions, return reserve escrows, and net settlement balances.
        </p>
      </div>

      {isPending ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
        </div>
      ) : isError ? (
        <QueryError label="Finances" detail={getApiError(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Metrics Overview */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">Recorded payable</span>
                <Wallet size={18} className="text-acid-400" />
              </div>
              <p className="mt-2 font-mono text-3xl font-semibold text-white">
                {formatPrice(data?.payableBalanceRupees || 0)}
              </p>
              <p className="mt-2 text-xs text-muted">
                Accounting balance after fees and reversals. This page does not initiate bank transfers.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">Reserve Withholding</span>
                <ShieldCheck size={18} className="text-amber-400" />
              </div>
              <p className="mt-2 font-mono text-3xl font-semibold text-amber-300">
                {formatPrice(data?.reserveBalanceRupees || 0)}
              </p>
              <p className="mt-2 text-xs text-muted">
                Held during customer return windows. Released automatically upon window expiry.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-space-900 p-5">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">Gross Earnings</span>
                <IndianRupee size={18} className="text-violet-400" />
              </div>
              <p className="mt-2 font-mono text-3xl font-semibold text-violet-300">
                {formatPrice(data?.totalEarnedRupees || 0)}
              </p>
              <p className="mt-2 text-xs text-muted">
                Cumulative revenue credited to your store after platform fees.
              </p>
            </div>
          </div>

          {/* Ledger Journal History */}
          <section className="space-y-4">
            <h2 className="font-outfit text-xl font-semibold">Settlement Journal</h2>
            {!data?.recentEntries?.length ? (
              <EmptyState
                icon={Clock}
                title="No transactions recorded"
                description="When orders are placed and confirmed, financial movements will appear in your ledger."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-space-900">
                <table className="w-full text-left text-sm text-secondary">
                  <thead className="border-b border-white/10 bg-space-950/60 text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Movement</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {data.recentEntries.map((entry) => {
                      const isCredit = entry.direction === 'credit';
                      return (
                        <tr key={entry._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-muted">
                            {formatDate(entry.effectiveAt || entry.createdAt, {
                              dateStyle: 'short',
                              timeStyle: 'short',
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
                          <td className="px-4 py-3 font-sans text-muted">
                            {entry.order ? `Order ${entry.order.orderId}` : 'Platform'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
