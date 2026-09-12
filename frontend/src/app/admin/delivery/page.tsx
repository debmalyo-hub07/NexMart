'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Truck, UserCheck, UserX, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { liveQueryOptions } from '@/lib/syncConfig';

const STATUS_TABS = [
  { label: 'Pending Approval', value: 'pending', icon: Clock, color: 'amber' },
  { label: 'Approved Agents', value: 'approved', icon: CheckCircle, color: 'acid' },
  { label: 'Rejected', value: 'rejected', icon: XCircle, color: 'red' },
];

export default function AdminDeliveryPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [orderPage, setOrderPage] = useState(1);
  const [revokeAgentId, setRevokeAgentId] = useState<string | null>(null);
  const [revokeWord, setRevokeWord] = useState('');
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  // All agents with status filter
  const { data: agentsData, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useQuery({
    queryKey: ['admin', 'agents', activeTab],
    queryFn: () => api.get(`/admin/agents?status=${activeTab}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  // Pending-agent total for the "Awaiting Approval" stat — fetched independently
  // of the active tab so the count never depends on which tab is open. Shares
  // the ['admin', 'agents', 'pending'] cache entry with the tab query above
  // when the pending tab is active (React Query dedupes identical keys).
  const { data: pendingAgentsData, isError: pendingAgentsError } = useQuery({
    queryKey: ['admin', 'agents', 'pending'],
    queryFn: () => api.get('/admin/agents?status=pending').then((r) => r.data),
    ...liveQueryOptions,
  });

  // Confirmed orders for assignment
  const { data: ordersData, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['admin', 'orders', 'pending', orderPage],
    queryFn: () => api.get(`/admin/orders?page=${orderPage}&limit=15&status=confirmed`).then((r) => r.data),
    ...liveQueryOptions,
  });

  // Only approved agents for assignment dropdown
  const { data: approvedAgentsData, isError: approvedAgentsError } = useQuery({
    queryKey: ['admin', 'delivery-agents'],
    queryFn: () => api.get('/admin/delivery-agents').then((r) => r.data.data),
    ...liveQueryOptions,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/agents/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-agents'] });
      showToast('Agent approved successfully');
    },
    onError: () => showToast('Approval failed', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/agents/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      showToast('Agent rejected');
    },
    onError: () => showToast('Rejection failed', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-agents'] });
      showToast('Agent role revoked and removed');
      setRevokeAgentId(null);
      setRevokeWord('');
    },
    onError: () => showToast('Failed to revoke agent', 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, agentId }: { orderId: string; agentId: string }) =>
      api.post(`/admin/orders/${orderId}/assign/${agentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'pending'] });
      showToast('Delivery agent assigned');
    },
    onError: () => showToast('Assignment failed', 'error'),
  });

  const agents = agentsData?.data || [];
  const approvedAgents: { _id: string; name: string }[] = approvedAgentsData || [];

  // Agent table columns
  const agentColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'name', header: 'Agent',
      render: (r) => (
        <div>
          <p className="text-sm text-white">{r.name as string}</p>
          <p className="text-xs text-muted">{r.email as string}</p>
        </div>
      ),
    },
    {
      key: 'vehicleType', header: 'Vehicle Info',
      render: (r) => (
        <div>
          <p className="text-white/80 text-sm capitalize">{(r.vehicleType as string) || '—'} <span className="text-muted">({(r.vehicleModel as string) || '—'})</span></p>
          <p className="font-mono text-xs text-acid-400 mt-0.5">{(r.licensePlate as string) || '—'}</p>
        </div>
      )
    },
    { key: 'city', header: 'City', render: (r) => <span className="text-secondary text-sm">{(r.city as string) || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
    { key: 'createdAt', header: 'Applied', render: (r) => <span className="text-muted text-xs">{formatDate(r.createdAt as string)}</span> },
  ];

  // Orders table columns
  const orderColumns: Column<Record<string, unknown>>[] = [
    { key: 'orderId', header: 'Order ID', render: (r) => <span className="font-mono text-xs text-violet-400">{r.orderId as string}</span> },
    { key: 'customer', header: 'Customer', render: (r) => <span>{(r.customer as { name: string })?.name}</span> },
    { key: 'shippingAddress', header: 'Delivery City', render: (r) => <span className="text-secondary">{(r.shippingAddress as { city: string })?.city}</span> },
    { key: 'orderStatus', header: 'Status', render: (r) => <StatusBadge status={r.orderStatus as string} /> },
    { key: 'deliveryAgent', header: 'Assigned Agent', render: (r) => <span className="text-secondary">{(r.deliveryAgent as { name: string })?.name || '—'}</span> },
    { key: 'createdAt', header: 'Date', render: (r) => <span className="text-muted text-xs">{formatDate(r.createdAt as string)}</span> },
  ];

  // Always the real pending count, regardless of which tab is active
  // (getAllAgents returns meta.total = countDocuments for the status filter).
  const pendingCount = pendingAgentsData?.meta?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-outfit text-2xl font-bold text-white">Delivery Management</h1>
        <p className="text-muted text-sm mt-1">Manage agents and assign deliveries</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-acid-400/10 text-acid-400"><Truck size={16} /></div>
            <p className="text-xs text-muted">Active Agents</p>
          </div>
          <p className="font-outfit text-2xl font-bold text-acid-400">{approvedAgentsError ? '—' : approvedAgents.length}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-amber-500/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400"><Clock size={16} /></div>
            <p className="text-xs text-muted">Awaiting Approval</p>
          </div>
          <p className="font-outfit text-2xl font-bold text-amber-400">{pendingAgentsError ? '—' : pendingCount}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400"><UserCheck size={16} /></div>
            <p className="text-xs text-muted">Awaiting Assignment</p>
          </div>
          <p className="font-outfit text-2xl font-bold text-violet-400">{ordersError ? '—' : (ordersData?.meta?.total ?? 0)}</p>
        </div>
      </div>

      {/* ── Agent Management ─────────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/5" role="tablist" aria-label="Filter agents by status">
          {STATUS_TABS.map(({ label, value, icon: Icon, color }) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              key={value}
              onClick={() => setActiveTab(value as typeof activeTab)}
              suppressHydrationWarning
              className={cn(
                'flex min-h-12 items-center gap-2 px-3 py-3.5 text-sm font-medium transition-colors flex-1 justify-center',
                activeTab === value
                  ? `text-white border-b-2 ${color === 'amber' ? 'border-amber-400' : color === 'acid' ? 'border-acid-400' : 'border-red-400'}`
                  : 'text-muted hover:text-white/70 border-b-2 border-transparent',
              )}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* Agent table */}
        <div className="p-5">
          <DataTable
            columns={agentColumns}
            data={(agents as Record<string, unknown>[]) || []}
            isLoading={agentsLoading}
            isError={agentsError}
            onRetry={() => void refetchAgents()}
            emptyMessage={`No ${activeTab} agents`}
            expandLabel="agent details"
            rowLabelKey="name"
            actions={
              activeTab === 'pending'
                ? (row) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveMutation.mutate(row._id as string)}
                      disabled={approveMutation.isPending}
                      suppressHydrationWarning
                      className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-acid-400/10 text-acid-400 hover:bg-acid-400/20 border border-acid-400/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={12} aria-hidden /> Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(row._id as string)}
                      disabled={rejectMutation.isPending}
                      suppressHydrationWarning
                      className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={12} aria-hidden /> Reject
                    </button>
                  </div>
                )
                : activeTab === 'approved'
                ? (row) => (
                  <button
                    onClick={() => setRevokeAgentId(row._id as string)}
                    suppressHydrationWarning
                    className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    <UserX size={12} aria-hidden /> Revoke Role
                  </button>
                )
                : undefined
            }
            expandableRender={(row) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted uppercase text-xs tracking-wider mb-1">Full Address</p>
                  <p className="text-white/80">{(row.address as string) || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-muted uppercase text-xs tracking-wider mb-1">Aadhar Number (Verified)</p>
                  <p className="text-white/80 font-mono tracking-widest">{(row.aadharNumber as string) || 'Not provided'}</p>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      {/* ── Order Assignment ─────────────────────────────────────────── */}
      <div>
        <h2 className="font-outfit font-semibold text-white mb-4">Assign Deliveries</h2>
        <DataTable
          columns={orderColumns}
          data={(ordersData?.data as Record<string, unknown>[]) || []}
          isLoading={ordersLoading}
          isError={ordersError}
          onRetry={() => void refetchOrders()}
          page={orderPage}
          totalPages={ordersData?.meta?.totalPages || 1}
          onPageChange={setOrderPage}
          emptyMessage="No confirmed orders awaiting assignment"
          actions={(row) =>
            approvedAgents.length > 0 && !(row.deliveryAgent as { name: string })?.name ? (
              <select
                onChange={(e) => e.target.value && assignMutation.mutate({ orderId: row._id as string, agentId: e.target.value })}
                aria-label="Assign delivery agent"
                className="min-h-11 text-xs glass border border-white/10 rounded-lg px-2 py-1.5 appearance-none cursor-pointer text-secondary hover:text-white"
                defaultValue=""
                suppressHydrationWarning
              >
                <option value="" disabled>Assign agent</option>
                {approvedAgents.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            ) : <span className="text-xs text-muted">{approvedAgents.length === 0 ? 'No agents' : 'Assigned'}</span>
          }
        />
      </div>

      {/* 2FA Revoke Modal */}
      {revokeAgentId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl p-8 max-w-md w-full border border-red-500/20 shadow-[0_0_80px_-20px_rgba(239,68,68,0.3)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
            <h3 className="font-outfit text-xl font-bold text-white mb-2 relative z-10">Revoke Agent Role</h3>
            <p className="text-sm text-secondary mb-6 relative z-10">
              This action is destructive and will completely remove this delivery agent from the panel.
              To confirm, type <strong className="text-red-400">REVOKE</strong> below.
            </p>
            <input
              type="text"
              value={revokeWord}
              onChange={(e) => setRevokeWord(e.target.value)}
              placeholder="Type REVOKE to confirm"
              className="w-full bg-black/40 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 mb-6 relative z-10"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus must enter the confirmation dialog the operator just opened
              autoFocus
            />
            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => { setRevokeAgentId(null); setRevokeWord(''); }}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-secondary hover:text-white hover:bg-white/5 transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate(revokeAgentId)}
                disabled={revokeWord !== 'REVOKE' || removeMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removeMutation.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirm Removal'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
