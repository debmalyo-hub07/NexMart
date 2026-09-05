/**
 * Canonical Socket.IO event names — must match the emitters in
 * backend/src/config/socket.ts exactly. The old inline string
 * 'order:status_update' (missing 'd') never fired.
 */
export const SOCKET_EVENTS = {
  orderStatusUpdated: 'order:status_updated',
  orderNew: 'order:new',
  deliveryAssigned: 'delivery:assigned',
  stockUpdated: 'product:stock_updated',
  dashboardStats: 'dashboard:stats_updated',
  agentStatusUpdated: 'agent:status_updated',
} as const;
