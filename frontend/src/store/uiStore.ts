import { create } from 'zustand';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  isMobileNavOpen: boolean;
  isSearchOpen: boolean;
  activeModal: string | null;
  toasts: ToastItem[];
  // Actions
  setMobileNavOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  showToast: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileNavOpen: false,
  isSearchOpen: false,
  activeModal: null,
  toasts: [],

  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  showToast: (message, type = 'success') => {
    const id = Date.now() + Math.random(); // unique per toast
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }].slice(-3), // max 3, oldest evicted
    }));
    // Per-toast timer, scoped to this toast's id — a firing timer can only
    // remove its own toast, so an older toast's timer never cuts short a newer
    // one. Errors live longer since they often carry server messages worth
    // re-reading. (Pause-on-hover intentionally skipped: timers are store-side,
    // and pausing would require exposing timer handles out of the store.)
    const ttl = type === 'error' ? 6000 : 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
