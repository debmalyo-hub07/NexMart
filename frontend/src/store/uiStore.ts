import { create } from 'zustand';

interface UIState {
  isMobileNavOpen: boolean;
  isSearchOpen: boolean;
  activeModal: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  // Actions
  setMobileNavOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileNavOpen: false,
  isSearchOpen: false,
  activeModal: null,
  toast: null,

  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 4000);
  },
  clearToast: () => set({ toast: null }),
}));
