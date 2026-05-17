'use client';

import { useIsFetching } from '@tanstack/react-query';

/**
 * Shows a subtle animated "Live" badge in the admin/delivery header.
 * - Pulses green while fetching
 * - Static green when idle
 */
export function LiveSyncBadge() {
  const isFetching = useIsFetching();
  const isSyncing = isFetching > 0;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wider uppercase select-none"
      style={{
        background: 'rgba(34,197,94,0.08)',
        borderColor: isSyncing
          ? 'rgba(34,197,94,0.35)'
          : 'rgba(34,197,94,0.15)',
        color: '#4ade80',
        transition: 'all 0.3s ease',
      }}
      title={isSyncing ? 'Syncing data…' : 'Live Sync Active'}
    >
      {/* Animated dot */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: '#4ade80',
          animation: isSyncing ? 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
          boxShadow: '0 0 6px rgba(74,222,128,0.6)',
          transition: 'all 0.3s ease',
        }}
      />
      LIVE
    </div>
  );
}
