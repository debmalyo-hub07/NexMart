import { describe, it, expect } from 'vitest';
import { isTransitionAllowed, ALLOWED_ORDER_TRANSITIONS } from '../orderTransitions';

describe('order transition guard (B2: forward-only on every status path)', () => {
  it('allows every step of the happy path', () => {
    expect(isTransitionAllowed('placed', 'confirmed')).toBe(true);
    expect(isTransitionAllowed('confirmed', 'shipped')).toBe(true);
    expect(isTransitionAllowed('shipped', 'out_for_delivery')).toBe(true);
    expect(isTransitionAllowed('out_for_delivery', 'delivered')).toBe(true);
  });

  it('allows cancellation exits', () => {
    expect(isTransitionAllowed('placed', 'cancelled')).toBe(true);
    expect(isTransitionAllowed('confirmed', 'cancelled')).toBe(true);
    expect(isTransitionAllowed('processing', 'cancelled')).toBe(true);
  });

  it('allows returns from fulfilment states', () => {
    expect(isTransitionAllowed('shipped', 'returned')).toBe(true);
    expect(isTransitionAllowed('out_for_delivery', 'returned')).toBe(true);
    expect(isTransitionAllowed('delivered', 'returned')).toBe(true);
  });

  it('rejects the E2E-verified regression: delivered → picked (→ shipped)', () => {
    expect(isTransitionAllowed('delivered', 'shipped')).toBe(false);
  });

  it('rejects all other backwards moves', () => {
    expect(isTransitionAllowed('out_for_delivery', 'shipped')).toBe(false);
    expect(isTransitionAllowed('shipped', 'processing')).toBe(false);
    expect(isTransitionAllowed('shipped', 'confirmed')).toBe(false);
    expect(isTransitionAllowed('confirmed', 'placed')).toBe(false);
  });

  it('treats terminal states as terminal', () => {
    expect(isTransitionAllowed('cancelled', 'confirmed')).toBe(false);
    expect(isTransitionAllowed('returned', 'shipped')).toBe(false);
  });

  it('does not treat a same-status repeat as a transition (callers handle no-ops)', () => {
    expect(isTransitionAllowed('shipped', 'shipped')).toBe(false);
    expect(isTransitionAllowed('delivered', 'delivered')).toBe(false);
  });

  it('exposes the full graph so both admin and delivery paths share one source', () => {
    expect(Object.keys(ALLOWED_ORDER_TRANSITIONS)).toEqual(
      expect.arrayContaining(['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'])
    );
  });
});
