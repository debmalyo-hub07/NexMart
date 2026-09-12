import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiResponse, Cart, CartItem } from '@/types';
import api, { getApiError } from '@/lib/api';

interface CartState {
  items: CartItem[];
  owner: string;
  ready: boolean;
  error: string | null;
  notice: string | null;
  isOpen: boolean;
  isLoading: boolean;
  setOpen: (open: boolean) => void;
  synchronize: (owner: string) => Promise<void>;
  reset: () => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, variant: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: () => number;
  subtotal: () => number;
}

type CartPayload = ApiResponse<Cart & { adjustments?: string[] }>;
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
let pending = 0;

export const useCartStore = create<CartState>()(persist((set, get) => {
  // Serialize writes. A lost response is reconciled with the server instead of
  // rolling back a snapshot that may predate another successful operation.
  const enqueue = (operation: (current: () => boolean) => Promise<void>) => {
    const epoch = generation;
    pending += 1;
    set({ isLoading: true });
    const task = queue.catch(() => undefined).then(async () => {
      const current = () => generation === epoch;
      if (current()) await operation(current);
    }).finally(() => { pending -= 1; set({ isLoading: pending > 0 }); });
    queue = task.catch(() => undefined);
    return task;
  };
  const accept = (payload: CartPayload) => set({ items: payload.data?.items ?? [], ready: true, notice: payload.data?.adjustments?.join(' ') || null });
  const mutate = (request: () => Promise<{ data: CartPayload }>, open = false) => enqueue(async current => {
    set({ error: null });
    try {
      const response = await request();
      if (current()) { accept(response.data); if (open) set({ isOpen: true }); }
    } catch (error) {
      if (current()) {
        set({ error: getApiError(error), ready: false });
        try {
          const response = await api.get<CartPayload>('/cart');
          if (current()) accept(response.data);
        } catch { /* Keep the visible error and last known cart until a retry. */ }
      }
      if (open && current()) throw error;
    }
  });
  return {
    items: [], owner: 'unknown', ready: false, error: null, notice: null, isOpen: false, isLoading: false,
    setOpen: open => set({ isOpen: open }),
    reset: () => { generation += 1; set({ items: [], owner: 'unknown', ready: false, error: null, notice: null, isOpen: false }); },
    synchronize: async owner => {
      if (owner !== get().owner) { generation += 1; set({ owner, items: [], ready: false, error: null, notice: null }); }
      await get().fetchCart();
    },
    fetchCart: () => enqueue(async current => {
      set({ error: null });
      try {
        const response = !get().ready && get().owner.startsWith('customer:')
          ? await api.post<CartPayload>('/cart/merge', { fromSession: true, items: [] })
          : await api.get<CartPayload>('/cart');
        if (current()) accept(response.data);
      } catch (error) { if (current()) set({ error: getApiError(error), ready: false }); }
    }),
    addItem: (productId, variant, quantity = 1) => mutate(() => api.post<CartPayload>('/cart/items', { productId, variant, quantity }), true),
    updateItem: (id, quantity) => mutate(() => api.put<CartPayload>(`/cart/items/${id}`, { quantity })),
    removeItem: id => mutate(() => api.delete<CartPayload>(`/cart/items/${id}`)),
    clearCart: () => mutate(() => api.delete<CartPayload>('/cart')),
    itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}, { name: 'nexmart-cart', partialize: state => ({ items: state.items, owner: state.owner }) }));
