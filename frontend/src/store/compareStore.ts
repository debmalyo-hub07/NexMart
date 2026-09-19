import { create } from 'zustand';
import type { Product } from '@/types';

interface CompareState {
  products: Product[];
  toggle: (product: Product) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  products: [],
  toggle: product => {
    const current = get().products;
    if (current.some(item => item._id === product._id)) { set({ products: current.filter(item => item._id !== product._id) }); return true; }
    if (current.length >= 3) return false;
    set({ products: [...current, product] });
    return true;
  },
  remove: id => set(state => ({ products: state.products.filter(item => item._id !== id) })),
  clear: () => set({ products: [] }),
}));
