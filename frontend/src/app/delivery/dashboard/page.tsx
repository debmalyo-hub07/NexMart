'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getApiError, isUncertainError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { AssignmentCard } from '@/components/delivery/AssignmentCard';
import { useUIStore } from '@/store/uiStore';
import { useOnline } from '@/hooks/useOnline';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/lib/socketEvents';
import { liveQueryOptions } from '@/lib/syncConfig';
import { deliveryActionsFor, type StatusAction } from '@/lib/orderStatus';
import type { DeliveryAssignment } from '@/types';
import { ChevronLeft, ChevronRight, PackageCheck, RefreshCw, Truck } from 'lucide-react';

interface AssignmentsResponse {
  data: DeliveryAssignment[];
  meta?: { total?: number; totalPages?: number };
}

/** A confirmed action still waiting on the agent's yes. */
interface PendingAction {
  assignment: DeliveryAssignment;
  action: StatusAction;
}

const isToday = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

export default function DeliveryDashboardPage() {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  /** Set when a write's response was lost — the agent must not be told it failed. */
  const [uncertain, setUncertain] = useState<string | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();
  const online = useOnline();
  const { on } = useSocket();

  // The backend emits 'delivery:assigned' to the agent's room the moment an
  // admin assigns an order — toast plus refresh, instead of waiting out the
  // polling backstop.
  useEffect(() => {
    const unsubscribe = on<{ orderId: string }>(SOCKET_EVENTS.deliveryAssigned, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my-deliveries'] });
      showToast(`New delivery assigned${payload?.orderId ? ` — ${payload.orderId}` : ''}`, 'success');
    });
    return unsubscribe;
  }, [on, queryClient, showToast]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['delivery', 'my-deliveries', page],
    queryFn: () => api.get(`/delivery/my-orders?page=${page}&limit=10`).then((r) => r.data as AssignmentsResponse),
    ...liveQueryOptions,
  });

  // Today's counts come from one wide fetch (the backend caps limit at 100) so
  // they do not change as the agent pages through the list.
  const { data: statsData, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['delivery', 'my-deliveries', 'stats'],
    queryFn: () => api.get('/delivery/my-orders?page=1&limit=100').then((r) => r.data as AssignmentsResponse),
    ...liveQueryOptions,
  });

  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string; label: string; humanId: string }) =>
      api.patch(`/delivery/orders/${orderId}/status`, { status }),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my-deliveries'] });
      showToast(`${variables.humanId} — ${variables.label.toLowerCase()}`, 'success');
      setBusyId(null);
      setPending(null);
      setUncertain(null);
    },
    onError: (error: unknown, variables) => {
      setBusyId(null);
      setPending(null);
      if (isUncertainError(error)) {
        // The request may well have succeeded. Never claim the status is
        // unchanged — refetch and let the list show what the server holds.
        setUncertain(variables.humanId);
        void refetch();
      } else {
        showToast(getApiError(error), 'error');
      }
    },
  });

  const runAction = (assignment: DeliveryAssignment, action: StatusAction) => {
    const orderId = assignment.order?._id;
    if (!orderId) return;
    setBusyId(assignment._id);
    updateStatus.mutate({ orderId, status: action.status, label: action.label, humanId: assignment.order?.orderId ?? 'This delivery' });
  };

  const handleAction = (assignment: DeliveryAssignment, action: StatusAction) => {
    if (action.confirm) setPending({ assignment, action });
    else runAction(assignment, action);
  };

  const assignments = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const statsAssignments = statsData?.data ?? [];

  // Work first: anything the agent can still act on, then the closed ones.
  const active = assignments.filter((item) => deliveryActionsFor(item.status, item.order?.orderStatus ?? '').length > 0);
  const closed = assignments.filter((item) => !active.includes(item));

  const outForDelivery = statsAssignments.filter((item) => item.status === 'out_for_delivery').length;
  const deliveredToday = statsAssignments.filter((item) => item.status === 'delivered' && isToday(item.deliveredAt)).length;

  return (
    <div className="page-container space-y-6 py-6">
      {/* Today, in three numbers — reference, not the main event. */}
      <section aria-labelledby="delivery-today">
        <h2 id="delivery-today" className="sr-only">Today’s totals</h2>
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: 'Out for delivery', value: outForDelivery, tone: 'text-violet-300' },
            { label: 'Delivered today', value: deliveredToday, tone: 'text-acid-400' },
            { label: 'Assigned in total', value: statsError ? undefined : data?.meta?.total, tone: 'text-white' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/15 bg-space-800 p-3 sm:p-4">
              <dt className="text-xs leading-snug text-secondary">{stat.label}</dt>
              <dd className={`font-outfit mt-1 text-2xl font-bold tabular-nums ${stat.tone}`}>
                {statsError || stat.value === undefined ? '—' : stat.value}
              </dd>
            </div>
          ))}
        </dl>
        {statsError && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm text-amber-200" role="status">
            <span>Today’s totals are unavailable. Your delivery list below is still current.</span>
            <button type="button" onClick={() => void refetchStats()} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-amber-300/30 px-3 text-amber-100 transition-colors hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
              <RefreshCw size={14} aria-hidden /> Retry totals
            </button>
          </div>
        )}
      </section>

      {/* A lost response is not a failure. Say what is actually known. */}
      {uncertain && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100" role="status">
          <p className="font-medium">We couldn’t confirm your update to {uncertain}.</p>
          <p className="mt-1 text-amber-200/90">
            It may have gone through. The list below has been refreshed — check the status before trying again.
          </p>
          <button type="button" onClick={() => setUncertain(null)} className="mt-3 inline-flex min-h-12 items-center rounded-lg border border-amber-300/30 px-3 text-amber-100 transition-colors hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
            Dismiss
          </button>
        </div>
      )}

      <section aria-labelledby="delivery-active" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="delivery-active" className="font-outfit text-xl font-semibold text-white">Your deliveries</h2>
          <button
            type="button"
            onClick={() => { void refetch(); void refetchStats(); }}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <ul className="space-y-4">
            {[0, 1].map((i) => (
              <li key={i} className="space-y-4 rounded-2xl border border-white/10 bg-space-800 p-5">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-16 w-full rounded-xl" />
                <div className="skeleton h-12 w-full rounded-xl" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <QueryError label="Your deliveries" onRetry={() => void refetch()} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No deliveries assigned yet"
            description="When the store assigns you an order it appears here straight away, and this list also refreshes on its own about once a minute."
          />
        ) : (
          <>
            {active.length > 0 && (
              <ul className="space-y-4">
                {active.map((assignment) => (
                  <AssignmentCard
                    key={assignment._id}
                    assignment={assignment}
                    busy={busyId === assignment._id}
                    disabled={!online}
                    onAction={handleAction}
                  />
                ))}
              </ul>
            )}

            {closed.length > 0 && (
              <details className="rounded-2xl border border-white/10 bg-space-800/60">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm text-secondary">
                  <PackageCheck size={16} aria-hidden />
                  {closed.length} finished {closed.length === 1 ? 'delivery' : 'deliveries'} on this page
                </summary>
                <ul className="space-y-4 p-4 pt-0">
                  {closed.map((assignment) => (
                    <AssignmentCard
                      key={assignment._id}
                      assignment={assignment}
                      busy={busyId === assignment._id}
                      disabled={!online}
                      onAction={handleAction}
                    />
                  ))}
                </ul>
              </details>
            )}

            {active.length === 0 && closed.length > 0 && (
              <p className="text-sm text-secondary">Everything assigned to you on this page is finished.</p>
            )}
          </>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3" aria-label="Delivery pages">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden /> Previous
            </button>
            <p className="text-xs text-muted">Page {page} of {totalPages}</p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-40"
            >
              Next <ChevronRight size={16} aria-hidden />
            </button>
          </nav>
        )}
      </section>

      <ConfirmDialog
        open={!!pending}
        title={pending ? `${pending.action.label} — ${pending.assignment.order?.orderId ?? 'this delivery'}` : ''}
        description={pending?.action.confirm ?? ''}
        confirmLabel={pending?.action.label ?? 'Confirm'}
        isLoading={!!busyId}
        onConfirm={() => pending && runAction(pending.assignment, pending.action)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
