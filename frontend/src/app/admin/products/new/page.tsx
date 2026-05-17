'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Products
      </Link>
      
      <div>
        <h1 className="font-syne text-2xl font-bold text-white">Add New Product</h1>
        <p className="text-white/50 text-sm mt-1">Create a new product listing</p>
      </div>

      <ProductForm />
    </div>
  );
}
