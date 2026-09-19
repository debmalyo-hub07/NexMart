import { Suspense } from 'react';
import { CategoryDirectory } from '@/components/product/CategoryDirectory';
import { publicCatalog } from '@/lib/publicCatalog';
import type { Category } from '@/types';

export const metadata = { title: 'Explore every category', description: 'Discover NexMart departments, from everyday technology and fashion to home, books, and more.' };
async function Directory() {
  const categories = await publicCatalog<Category[]>('/categories');
  return <CategoryDirectory initialCategories={categories?.data} />;
}
export default function CategoriesPage() {
  return <Suspense fallback={<CategoryDirectory />}><Directory /></Suspense>;
}
