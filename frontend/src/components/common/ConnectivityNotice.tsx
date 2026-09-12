'use client';

import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';

export function ConnectivityNotice() {
  const online = useOnline();
  if (online) return null;
  return <div role="status" className="border-b border-amber-400/25 bg-space-800 px-4 py-3 text-sm text-amber-200">
    <div className="mx-auto flex max-w-7xl items-start gap-2"><WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden /><p>You’re offline. Displayed information may be out of date. Reconnect before making changes or paying.</p></div>
  </div>;
}
