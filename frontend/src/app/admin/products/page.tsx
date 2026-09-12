'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column, SortState } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/store/uiStore';
import { Product } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { Plus, Edit2, Trash2, Package, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { liveQueryOptions } from '@/lib/syncConfig';

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Server-driven sort — initial value matches the backend default (-createdAt)
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  // Backend sort syntax: 'field' ascending, '-field' descending
  const sortParam = `${sort.direction === 'desc' ? '-' : ''}${sort.key}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'products', page, search, sortParam],
    queryFn: () => api.get(`/admin/products?page=${page}&limit=15&sort=${sortParam}${search ? `&q=${search}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  // Desktop headers toggle; the mobile select names the direction outright.
  const handleSort = (key: string, direction?: 'asc' | 'desc') => {
    setSort((prev) => ({
      key,
      direction: direction ?? (prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'),
    }));
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      showToast('Product deleted');
      setDeleteId(null);
    },
    onError: () => { showToast('Failed to delete', 'error'); setDeleteId(null); },
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'name', header: 'Product',
      render: (r) => (
        <div className="flex items-center gap-3">
          {(r.images as string[])?.[0] && (
            <Image src={(r.images as string[])[0]} alt="" width={40} height={40} className="rounded-lg object-cover" />
          )}
          <div>
            <p className="text-sm text-white font-medium line-clamp-1">{r.name as string}</p>
            <p className="text-xs text-muted">{(r.category as { name: string })?.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price', header: 'Price',
      render: (r) => <span className="text-acid-400 font-medium">{formatPrice((r.variants as { price: number }[])?.[0]?.price || 0)}</span>,
    },
    {
      key: 'stock', header: 'Stock',
      render: (r) => {
        const stock = (r.variants as { stock: number }[])?.[0]?.stock ?? 0;
        return <span className={stock === 0 ? 'text-red-400' : stock < 10 ? 'text-amber-400' : 'text-white/70'}>{stock}</span>;
      },
    },
    { key: 'isPublished', header: 'Status', render: (r) => <span className={r.isPublished ? 'badge-acid' : 'badge-amber'}>{r.isPublished ? 'Published' : 'Draft'}</span> },
    { key: 'createdAt', header: 'Created', render: (r) => <span className="text-muted text-xs">{formatDate(r.createdAt as string)}</span>, sortable: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-white">Products</h1>
          <p className="text-muted text-sm mt-1">{isError ? 'Product data unavailable' : `${data?.meta?.total ?? 0} total products`}</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary text-sm">
          <Plus size={15} /> Add Product
        </Link>
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
        emptyMessage="No products found"
        actions={(row) => (
          <div className="flex items-center gap-2">
              <Link href={`/products/${row.slug || ''}`} aria-label="Preview product" className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors ${row.slug ? 'text-muted hover:text-violet-400 hover:bg-violet-500/10' : 'text-white/10 pointer-events-none'}`}>
              <Eye size={14} aria-hidden />
            </Link>
            <Link href={`/admin/products/${row._id}/edit`} aria-label="Edit product" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:text-acid-400 hover:bg-acid-400/10 transition-colors">
              <Edit2 size={14} aria-hidden />
            </Link>
            <button type="button" onClick={() => setDeleteId(row._id as string)} aria-label="Delete product" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
