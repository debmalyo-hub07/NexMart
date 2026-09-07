// Single source of truth for the order status machine — shared by the admin
// status path (order.controller) and the delivery-agent status path
// (delivery.controller). An order never moves backwards; cancellation and
// return are the only exits from the happy path (CLAUDE.md §4.0).
export const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'returned'],
  out_for_delivery: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

// Same-status repeats are NOT transitions — callers treat them as idempotent
// no-ops (assignment timestamps still update, but no duplicate history entry).
export function isTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return false;
  return (ALLOWED_ORDER_TRANSITIONS[from] || []).includes(to);
}
