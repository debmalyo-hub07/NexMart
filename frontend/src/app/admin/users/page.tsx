'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { DataTable, Column, SortState } from '@/components/admin/DataTable';
import { formatDate } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import Image from 'next/image';
import { UserX, UserCheck } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { liveQueryOptions } from '@/lib/syncConfig';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Server-driven sort — initial value matches the backend default (-createdAt)
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  const [statusTarget, setStatusTarget] = useState<{ id: string; activate: boolean } | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  // Backend sort syntax: 'field' ascending, '-field' descending
  const sortParam = `${sort.direction === 'desc' ? '-' : ''}${sort.key}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search, sortParam],
    queryFn: () => api.get(`/admin/users?page=${page}&limit=15&sort=${sortParam}${search ? `&search=${search}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  const handleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
    setPage(1);
  };

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/customers/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      showToast('Customer status updated');
      setStatusTarget(null);
    },
    onError: (err: unknown) => showToast(getApiError(err), 'error'),
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'name', header: 'Customer',
      render: (r) => (
        <div className="flex items-center gap-3">
          {(r as { profilePicture?: string }).profilePicture ? (
            <Image src={(r as { profilePicture: string }).profilePicture} alt="" width={32} height={32} className="rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
              {getInitials(r.name as string)}
            </div>
          )}
          <div>
            <p className="text-sm text-white">{r.name as string}</p>
            <p className="text-xs text-white/40">{r.email as string}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (r) => <span className="text-white/60 text-sm">{(r.phone as string) || '—'}</span> },
    {
      key: 'authProviders', header: 'Auth',
      render: (r) => (
        <div className="flex gap-1">
          {((r.authProviders as string[]) || []).map((p) => (
            <span key={p} className="badge-violet text-[10px]">{p}</span>
          ))}
        </div>
      ),
    },
    { key: 'emailVerified', header: 'Verified', render: (r) => <span className={r.emailVerified ? 'badge-acid' : 'badge-amber'}>{r.emailVerified ? '✓ Yes' : '✗ No'}</span> },
    { key: 'isActive', header: 'Status', render: (r) => <span className={r.isActive ? 'badge-acid' : 'badge-red'}>{r.isActive ? 'Active' : 'Suspended'}</span> },
    { key: 'createdAt', header: 'Joined', render: (r) => <span className="text-white/50 text-xs">{formatDate(r.createdAt as string)}</span>, sortable: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">Customers</h1>
          <p className="text-white/50 text-sm mt-1">{isError ? 'Customer data unavailable' : `${data?.meta?.total ?? 0} registered customers`}</p>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data as Record<string, unknown>[]) || []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        onPageChange={setPage}
        searchable
        onSearch={(q) => { setSearch(q); setPage(1); }}
        sort={sort}
        onSortChange={handleSort}
        emptyMessage="No customers found"
        actions={(row) => (
          <button
            type="button"
            onClick={() => setStatusTarget({ id: row._id as string, activate: !(row.isActive as boolean) })}
            disabled={toggleStatus.isPending}
            className={(row.isActive
              ? 'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50'
              : 'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/40 hover:text-acid-400 hover:bg-acid-400/10 transition-colors disabled:opacity-50')}
            title={row.isActive ? 'Suspend customer' : 'Activate customer'}
          >
            {row.isActive ? <UserX size={14} aria-hidden /> : <UserCheck size={14} aria-hidden />}
          </button>
        )}
        expandableRender={(row) => {
          const addresses = (row.addresses as any[]) || [];
          const address = addresses.find((a) => a.isDefault) || addresses[0];
          
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/40 uppercase text-xs tracking-wider mb-1">Default Address</p>
                {address ? (
                  <div className="text-white/80">
                    <p className="font-medium text-white">{address.fullName}</p>
                    <p>{address.addressLine1}</p>
                    <p>{address.city}{address.state ? `, ${address.state}` : ''} {address.pincode}</p>
                    <p className="text-white/50 text-xs mt-1">Phone: {address.phone}</p>
                  </div>
                ) : (
                  <p className="text-white/40 italic">No addresses saved</p>
                )}
              </div>
              <div>
                <p className="text-white/40 uppercase text-xs tracking-wider mb-1">Account Info</p>
                <p className="text-white/80">Joined: {formatDate(row.createdAt as string)}</p>
                <p className="text-white/80">User ID: <span className="font-mono text-xs">{row._id as string}</span></p>
              </div>
            </div>
          );
        }}
      />
      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.activate ? 'Activate customer' : 'Suspend customer'}
        description={statusTarget?.activate ? 'Restore this customer’s ability to use the storefront?' : 'Suspend this customer? Existing sessions will lose access to customer actions.'}
        confirmLabel={statusTarget?.activate ? 'Activate' : 'Suspend'}
        onConfirm={() => statusTarget && toggleStatus.mutate({ id: statusTarget.id, isActive: statusTarget.activate })}
        onCancel={() => setStatusTarget(null)}
        isLoading={toggleStatus.isPending}
      />
    </div>
  );
}
