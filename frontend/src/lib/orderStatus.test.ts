import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ORDER_TRANSITIONS,
  adminStatusActions,
  deliveryActionsFor,
  isTransitionAllowed,
  DELIVERY_ORDER_STATUS,
} from './orderStatus';

describe('order status graph', () => {
  // The backend owns the state machine; this module is a mirror so the UI can
  // offer only the transitions the server will accept. A drifted mirror shows
  // operators actions that 400 — so the mirror is checked against the source.
  it('matches the server transition graph exactly', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../backend/src/utils/orderTransitions.ts'),
      'utf8',
    );
    const literal = source.match(/ALLOWED_ORDER_TRANSITIONS[^=]*=\s*(\{[\s\S]*?\n\};)/);
    expect(literal, 'backend graph literal not found — update this test').toBeTruthy();
    const server = JSON.parse(
      literal![1]
        .replace(/;$/, '')
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
        .replace(/,(\s*[}\]])/g, '$1'),
    );
    expect(ALLOWED_ORDER_TRANSITIONS).toEqual(server);
  });

  it('never treats a repeat of the same status as a transition', () => {
    for (const status of Object.keys(ALLOWED_ORDER_TRANSITIONS)) {
      expect(isTransitionAllowed(status, status)).toBe(false);
    }
  });

  it('is forward-only out of the terminal states', () => {
    expect(ALLOWED_ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ALLOWED_ORDER_TRANSITIONS.returned).toEqual([]);
    expect(isTransitionAllowed('delivered', 'shipped')).toBe(false);
    expect(isTransitionAllowed('delivered', 'returned')).toBe(true);
  });
});

describe('admin status actions', () => {
  it('offers only the legal next states, never the current one', () => {
    expect(adminStatusActions('placed').map(a => a.status)).toEqual(['confirmed', 'cancelled']);
    expect(adminStatusActions('shipped').map(a => a.status)).toEqual(['out_for_delivery', 'returned']);
    expect(adminStatusActions('cancelled')).toEqual([]);
  });

  it('requires confirmation for the changes that move stock or money', () => {
    const placed = adminStatusActions('placed');
    expect(placed.find(a => a.status === 'confirmed')?.confirm).toBeUndefined();
    expect(placed.find(a => a.status === 'cancelled')?.confirm).toContain('stock');
    expect(adminStatusActions('delivered').find(a => a.status === 'returned')?.confirm).toContain('stock');
  });

  it('labels every offered action for an operator, not with a raw enum', () => {
    for (const status of Object.keys(ALLOWED_ORDER_TRANSITIONS)) {
      for (const action of adminStatusActions(status)) {
        expect(action.label).toMatch(/^[A-Z][a-z]/);
        expect(action.label).not.toContain('_');
      }
    }
  });
});

describe('delivery agent actions', () => {
  it('offers one forward action per stage of a normal delivery', () => {
    expect(deliveryActionsFor('assigned', 'shipped').map(a => a.status)).toEqual(['picked']);
    expect(deliveryActionsFor('picked', 'shipped').map(a => a.status)).toEqual(['out_for_delivery']);
    expect(deliveryActionsFor('out_for_delivery', 'out_for_delivery').map(a => a.status))
      .toEqual(['delivered', 'attempted']);
  });

  it('never offers an action the server would reject', () => {
    const assignmentStatuses = ['assigned', 'picked', 'out_for_delivery', 'attempted', 'delivered', 'returned'];
    for (const assignment of assignmentStatuses) {
      for (const order of Object.keys(ALLOWED_ORDER_TRANSITIONS)) {
        for (const action of deliveryActionsFor(assignment, order)) {
          const target = DELIVERY_ORDER_STATUS[action.status];
          // The server accepts a delivery update when the mapped order status
          // is a legal transition, or when it already equals the current one
          // (an idempotent repeat that only touches the assignment).
          const acceptable = target === order || isTransitionAllowed(order, target);
          expect(acceptable, `${assignment}/${order} → ${action.status}`).toBe(true);
        }
      }
    }
  });

  it('stops offering work once the order has left the agent', () => {
    expect(deliveryActionsFor('delivered', 'cancelled')).toEqual([]);
    expect(deliveryActionsFor('returned', 'returned')).toEqual([]);
    expect(deliveryActionsFor('assigned', 'cancelled')).toEqual([]);
  });

  it('never regresses to an earlier stage of the agent workflow', () => {
    expect(deliveryActionsFor('delivered', 'delivered').map(a => a.status)).not.toContain('picked');
    expect(deliveryActionsFor('out_for_delivery', 'out_for_delivery').map(a => a.status)).not.toContain('picked');
  });

  it('confirms delivery and return — the actions that settle payment or stock', () => {
    const atDoor = deliveryActionsFor('out_for_delivery', 'out_for_delivery');
    expect(atDoor.find(a => a.status === 'delivered')?.confirm).toBeTruthy();
    expect(atDoor.find(a => a.status === 'attempted')?.confirm).toBeUndefined();
    expect(deliveryActionsFor('delivered', 'delivered').find(a => a.status === 'returned')?.confirm).toBeTruthy();
  });

  it('marks exactly one action as the primary next step', () => {
    for (const assignment of ['assigned', 'picked', 'out_for_delivery', 'attempted']) {
      const actions = deliveryActionsFor(assignment, assignment === 'assigned' ? 'shipped' : 'out_for_delivery');
      if (actions.length) expect(actions.filter(a => a.tone === 'primary')).toHaveLength(1);
    }
  });
});
