import { publicCatalog } from '@/lib/publicCatalog';
import { catalogParams } from '@/lib/catalogFilters';
import type { Category, Product } from '@/types';
import { CatalogBrowser } from './CatalogBrowser';

export type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function CatalogSnapshot({ searchParams, categorySlug, mode = 'products' }: { searchParams: CatalogSearchParams; categorySlug?: string; mode?: 'products' | 'search' }) {
  const input = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) search.set(key, Array.isArray(value) ? value[0] : value);
  const params = catalogParams(search, categorySlug);
  const [products, categories] = await Promise.all([
    mode === 'search' && !params.get('q') ? undefined : publicCatalog<Product[]>(`/products?${params}`),
    publicCatalog<Category[]>('/categories'),
  ]);
  return <CatalogBrowser mode={mode} categorySlug={categorySlug} initialData={products} initialQuery={params.toString()} initialCategories={categories?.data} />;
}
