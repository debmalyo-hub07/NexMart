'use client';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import type { ApiResponse, Product } from '@/types';

interface WishlistResponse { productIds: string[]; products: Product[] }
const key = ['customer', 'wishlist'] as const;

export function useWishlist() {
  const customer = useAuthStore(s => s.isAuthenticated && s.user?.role === 'customer');
  const showToast = useUIStore(s => s.showToast);
  const queryClient = useQueryClient();
  const writes = useIsMutating({ mutationKey: key });
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<ApiResponse<WishlistResponse>>('/customer/wishlist', { signal }).then(r => r.data.data), enabled: customer, staleTime: 60_000 });
  const toggle = useMutation({
    mutationKey: key,
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => saved ? api.delete(`/customer/wishlist/${id}`) : api.post(`/customer/wishlist/${id}`),
    onError: error => showToast(getApiError(error), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const productIds = customer ? query.data?.productIds ?? [] : [];
  return {
    productIds, products: customer ? query.data?.products ?? [] : [],
    isLoading: customer && (query.isPending || writes > 0), isError: customer && query.isError, refetch: query.refetch,
    isWishlisted: (id: string) => productIds.includes(id),
    toggleWishlist: (id: string) => {
      if (!customer) { showToast('Sign in as a customer to save products.', 'info'); return; }
      if (queryClient.isMutating({ mutationKey: key }) > 0) return;
      if (query.isError) { showToast('Saved products could not be checked. Try refreshing them first.', 'error'); void query.refetch(); return; }
      toggle.mutate({ id, saved: productIds.includes(id) });
    },
  };
}
