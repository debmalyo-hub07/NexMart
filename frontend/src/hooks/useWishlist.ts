'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

interface WishlistResponse {
  productIds: string[];
  // products: full product docs — not consumed by the toggle UI; the storefront
  // already renders products from their own queries, keyed by these productIds.
  products?: unknown[];
}

// Backend envelope: { success, message, data: { productIds, products } } —
// matches the api.get(...).then((r) => r.data.data) pattern used across the app
// (see profile/page.tsx, ReviewSection.tsx).
export function useWishlist() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'wishlist'],
    queryFn: () =>
      api
        .get<{ success: boolean; message: string; data: WishlistResponse }>('/customer/wishlist')
        .then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ productId, wishlisted }: { productId: string; wishlisted: boolean }) => {
      const url = `/customer/wishlist/${productId}`;
      return wishlisted
        ? api.delete(url).then((r) => r.data)
        : api.post(url, {}).then((r) => r.data);
    },
    onMutate: async ({ productId, wishlisted }) => {
      await queryClient.cancelQueries({ queryKey: ['customer', 'wishlist'] });
      const prev = queryClient.getQueryData<WishlistResponse>(['customer', 'wishlist']);
      queryClient.setQueryData<WishlistResponse>(['customer', 'wishlist'], {
        productIds: wishlisted
          ? (prev?.productIds || []).filter((id) => id !== productId)
          : [...(prev?.productIds || []), productId],
      });
      return { prev };
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['customer', 'wishlist'], ctx.prev);
      showToast(getApiError(err), 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', 'wishlist'] });
    },
  });

  const productIds = data?.productIds || [];

  return {
    productIds,
    isLoading,
    isWishlisted: (productId: string) => productIds.includes(productId),
    toggleWishlist: (productId: string) => {
      if (!isAuthenticated) {
        showToast('Sign in to save items to your wishlist', 'info');
        return;
      }
      toggle.mutate({ productId, wishlisted: productIds.includes(productId) });
    },
  };
}
