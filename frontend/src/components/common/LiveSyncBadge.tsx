'use client';

import { useIsFetching } from '@tanstack/react-query';

/**
 * Shows a subtle animated "Sync" badge in the admin/delivery header.
 * - Pulses green while a React Query fetch is in flight
 * - Static green when idle
 *
 * Honest labeling: admin/delivery data comes from 60s React Query polling
 * (see `liveQueryOptions` in src/lib/syncConfig.ts), not a socket connection.
 * "LIVE" would overstate it — "SYNC" describes what actually happens.
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
      title="Auto-refreshes every 60 seconds"
    >
      {/* Animated dot — decorative; the visible "SYNC" text carries the meaning */}
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: '#4ade80',
          // syncPulse keyframe is defined in globals.css — self-contained, so it
          // does not depend on Tailwind emitting the `pulse` keyframes (which only
          // happens when `animate-pulse` is used somewhere in the markup).
          animation: isSyncing ? 'syncPulse 1s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
          boxShadow: '0 0 6px rgba(74,222,128,0.6)',
          transition: 'all 0.3s ease',
        }}
      />
      SYNC
    </div>
  );
}
