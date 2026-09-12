/**
 * Auto-sync polling intervals for admin and delivery interfaces.
 * Customer-facing pages use on-demand fetching (no polling needed).
 *
 * These are passed directly to React Query's `refetchInterval` option.
 */

/** Live data polling — orders, agents, customers, deliveries */
export const LIVE_SYNC_MS = 10_000; // 10 seconds

/** Analytics — less critical, syncs every 60s */
export const ANALYTICS_SYNC_MS = 60_000; // 60 seconds

/** Dashboard stats — important, syncs every 10s */
export const STATS_SYNC_MS = 10_000;

/** Common options to attach to any React Query that needs live sync */
export const liveQueryOptions = {
  refetchInterval: 60_000,            // 60s polling backstop — socket layer is primary
  refetchIntervalInBackground: false, // pause polling when the tab is in background
  staleTime: LIVE_SYNC_MS,            // treat data as stale after the interval
} as const;

export const analyticsQueryOptions = {
  refetchInterval: ANALYTICS_SYNC_MS,
  refetchIntervalInBackground: false,
  staleTime: ANALYTICS_SYNC_MS,
} as const;

/** Customer order tracking remains useful when sockets cannot connect. */
export const orderQueryOptions = {
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  staleTime: 10_000,
} as const;
