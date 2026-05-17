'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/admin/DataTable';
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, search],
    queryFn: () => api.get(`/admin/products?page=${page}&limit=15${search ? `&q=${search}` : ''}`).then((r) => r.data),
    ...liveQueryOptions,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
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
            <p className="text-xs text-white/40">{(r.category as { name: string })?.name}</p>
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
    { key: 'createdAt', header: 'Created', render: (r) => <span className="text-white/50 text-xs">{formatDate(r.createdAt as string)}</span>, sortable: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne text-2xl font-bold text-white">Products</h1>
          <p className="text-white/50 text-sm mt-1">{data?.meta?.total || 0} total products</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary text-sm">
          <Plus size={15} /> Add Product
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data as Record<string, unknown>[]) || []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        onPageChange={setPage}
        searchable
        onSearch={(q) => { setSearch(q); setPage(1); }}
        emptyMessage="No products found"
        actions={(row) => (
          <div className="flex items-center gap-2">
            <Link href={`/products/${row.slug || ''}`} className={`p-1.5 rounded-lg transition-colors ${row.slug ? 'text-white/40 hover:text-violet-400 hover:bg-violet-500/10' : 'text-white/10 pointer-events-none'}`}>
              <Eye size={14} />
            </Link>
            <Link href={`/admin/products/${row._id}/edit`} className="p-1.5 rounded-lg text-white/40 hover:text-acid-400 hover:bg-acid-400/10 transition-colors">
              <Edit2 size={14} />
            </Link>
            <button onClick={() => setDeleteId(row._id as string)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={14} />
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
