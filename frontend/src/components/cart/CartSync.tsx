'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';

export function CartSync() {
  const { data: session, status } = useSession();
  const loggingIn = useAuthStore(s => s.isLoading);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const owner = status === 'authenticated' ? `customer:${session?.user?.email ?? session?.user?.id}` : 'guest';
  const synchronize = useCartStore(s => s.synchronize);
  useEffect(() => {
    if (status === 'loading' || loggingIn || role && role !== 'customer') return;
    void synchronize(owner);
    const refresh = () => { if (document.visibilityState === 'visible') void useCartStore.getState().fetchCart(); };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [owner, status, role, loggingIn, synchronize]);
  return null;
}
