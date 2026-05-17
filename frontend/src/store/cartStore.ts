import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Cart, CartItem } from '@/types';
import api, { getApiError } from '@/lib/api';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  // Actions
  setOpen: (open: boolean) => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, variant: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  // Computed
  itemCount: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isLoading: false,

      setOpen: (open) => set({ isOpen: open }),

      fetchCart: async () => {
        try {
          set({ isLoading: true });
          const { data } = await api.get('/cart');
          set({ items: data.data?.items || [] });
        } catch {
          // Silent fail — cart might not exist yet
        } finally {
          set({ isLoading: false });
        }
      },

      addItem: async (productId, variant, quantity = 1) => {
        try {
          set({ isLoading: true });
          const { data } = await api.post('/cart/items', { productId, variant, quantity });
          set({ items: data.data?.items || [], isOpen: true });
        } finally {
          set({ isLoading: false });
        }
      },

      updateItem: async (itemId, quantity) => {
        try {
          const { data } = await api.put(`/cart/items/${itemId}`, { quantity });
          set({ items: data.data?.items || [] });
        } catch {}
      },

      removeItem: async (itemId) => {
        // Optimistic update
        const prev = get().items;
        set({ items: prev.filter((i) => i._id !== itemId) });
        try {
          const { data } = await api.delete(`/cart/items/${itemId}`);
          set({ items: data.data?.items || [] });
        } catch {
          set({ items: prev }); // rollback
        }
      },

      clearCart: async () => {
        try {
          await api.delete('/cart');
          set({ items: [] });
        } catch {}
      },

      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: 'nexmart-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
