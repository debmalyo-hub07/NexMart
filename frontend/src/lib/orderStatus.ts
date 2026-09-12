/**
 * Mirror of `backend/src/utils/orderTransitions.ts`.
 *
 * The server owns the order state machine. This copy exists so the operator
 * and agent interfaces can offer *only* the transitions the server accepts —
 * a dropdown listing all eight statuses is a menu of mostly-400s. The mirror
 * is asserted against the backend source in `orderStatus.test.ts`, so drift
 * fails the suite rather than reaching an operator.
 */
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

/** A repeat of the current status is an idempotent no-op, never a transition. */
export function isTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return false;
  return (ALLOWED_ORDER_TRANSITIONS[from] || []).includes(to);
}

export interface StatusAction {
  /** The value the API expects. */
  status: string;
  /** What the operator is actually doing, in their language. */
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  /**
   * Present when the change moves stock or money and therefore needs a
   * confirmation step. The copy states the consequence, not "are you sure".
   */
  confirm?: string;
}

const ADMIN_LABELS: Record<string, { label: string; tone: StatusAction['tone']; confirm?: string }> = {
  confirmed: { label: 'Confirm order', tone: 'primary' },
  processing: { label: 'Start processing', tone: 'primary' },
  shipped: { label: 'Mark shipped', tone: 'primary' },
  out_for_delivery: { label: 'Mark out for delivery', tone: 'primary' },
  delivered: { label: 'Mark delivered', tone: 'primary' },
  cancelled: {
    label: 'Cancel order',
    tone: 'danger',
    confirm: 'Cancelling returns every item to sellable stock and emails the customer. It cannot be undone.',
  },
  returned: {
    label: 'Mark returned',
    tone: 'danger',
    confirm: 'A return puts every item back into sellable stock and emails the customer. It cannot be undone.',
  },
};

/** The legal next states for an order, described for an operator. */
export function adminStatusActions(current: string): StatusAction[] {
  return (ALLOWED_ORDER_TRANSITIONS[current] || []).map(status => ({
    status,
    ...ADMIN_LABELS[status],
  }));
}

/** How a delivery status update lands on the order (server `orderStatusMap`). */
export const DELIVERY_ORDER_STATUS: Record<string, string> = {
  picked: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  attempted: 'out_for_delivery',
  returned: 'returned',
};

/**
 * What the agent can do next, by the stage they have reached. Forward-only:
 * a picked-up parcel never goes back to "assigned".
 */
const AGENT_NEXT: Record<string, string[]> = {
  assigned: ['picked'],
  picked: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'attempted'],
  attempted: ['out_for_delivery', 'delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
};

const AGENT_LABELS: Record<string, { label: string; tone: StatusAction['tone']; confirm?: string }> = {
  picked: { label: 'Picked up', tone: 'primary' },
  out_for_delivery: { label: 'Out for delivery', tone: 'primary' },
  delivered: {
    label: 'Delivered',
    tone: 'primary',
    confirm: 'Confirm you handed this order to the customer. For cash orders this also records the payment as collected.',
  },
  attempted: { label: 'Attempt failed', tone: 'secondary' },
  returned: {
    label: 'Return to store',
    tone: 'danger',
    confirm: 'Returning this order puts every item back into stock and tells the customer it was returned.',
  },
};

/**
 * The agent's legal actions, given how far they have got (`assignmentStatus`)
 * and where the order actually stands on the server (`orderStatus`). Anything
 * the server would reject is filtered out rather than shown and then failed.
 */
export function deliveryActionsFor(assignmentStatus: string, orderStatus: string): StatusAction[] {
  const candidates = AGENT_NEXT[assignmentStatus] ?? [];
  const actions = candidates
    .filter(status => {
      const target = DELIVERY_ORDER_STATUS[status];
      // Accepted when it moves the order legally, or when the order is already
      // there and only the assignment advances.
      return target === orderStatus || isTransitionAllowed(orderStatus, target);
    })
    .map(status => ({ status, ...AGENT_LABELS[status] }));

  // Exactly one primary action: the first forward step. Any others become
  // secondary so the agent sees a single obvious next tap.
  let primaryTaken = false;
  return actions.map(action => {
    if (action.tone !== 'primary') return action;
    if (primaryTaken) return { ...action, tone: 'secondary' as const };
    primaryTaken = true;
    return action;
  });
}
