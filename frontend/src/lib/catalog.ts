import { queryOptions } from '@tanstack/react-query';
import api from './api';
import { type ApiResponse, type Category, type Product } from '@/types';

export const categoryQueryOptions = queryOptions({
  queryKey: ['storefront', 'categories'],
  queryFn: ({ signal }) => api.get<ApiResponse<Category[]>>('/categories', { signal }).then(r => r.data.data ?? []),
  staleTime: 5 * 60_000,
});

export const featuredQueryOptions = queryOptions({
  queryKey: ['storefront', 'featured-products'],
  queryFn: ({ signal }) => api.get<ApiResponse<Product[]>>('/products?featured=true&limit=8', { signal }).then(r => r.data.data ?? []),
  staleTime: 60_000,
});

export function parentId(category: Category): string | undefined {
  return typeof category.parent === 'string' ? category.parent : category.parent?._id;
}

export function rootCategories(categories: Category[]): Category[] {
  return categories.filter(c => !c.parent && c.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}
