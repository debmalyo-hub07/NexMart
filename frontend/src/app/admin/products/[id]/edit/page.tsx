'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/admin/ProductForm';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, Product } from '@/types';

export default function EditProductPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data as ApiResponse<Product>),
    enabled: !!id,
  });

  const product = data?.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary transition-colors hover:text-white">
        <ArrowLeft size={16} aria-hidden /> Back to products
      </Link>

      <div>
        <h1 className="font-outfit text-2xl font-bold text-white">Edit product</h1>
        {/* The product's own name identifies it; the database id is noise. */}
        <p className="mt-1 text-sm text-secondary">{product?.name ?? 'Loading the current details…'}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" role="status" aria-label="Loading product" />
        </div>
      ) : isError ? (
        /* A failed request is not a missing product — saying "not found" would
           invite an operator to recreate a product that already exists. */
        <QueryError
          label="This product"
          onRetry={() => void refetch()}
          detail="The details could not be loaded, so editing is unavailable. Check your connection, then try again."
        />
      ) : product ? (
        <ProductForm initialData={product} productId={id} />
      ) : (
        <EmptyState
          title="Product not found"
          description="This product no longer exists in the catalog. It may have been deleted."
          action={<Link href="/admin/products" className="btn-secondary">Back to products</Link>}
        />
      )}
    </div>
  );
}
