'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/admin/ProductForm';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function EditProductPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => api.get(`/products/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const product = data?.data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Products
      </Link>
      
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">Edit Product</h1>
        <p className="text-white/50 text-sm mt-1">ID: {id}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      ) : product ? (
        <ProductForm initialData={product} productId={id} />
      ) : (
        <div className="text-center py-12 text-white/50">Product not found.</div>
      )}
    </div>
  );
}
