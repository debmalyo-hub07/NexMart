import { describe, it, expect, vi } from 'vitest';

// The razorpay SDK is a default-export class; we mock its instance methods
// because hitting the live API in unit tests is not viable. We mock the
// CONSTRUCTED INSTANCE's method only — the return shape below is the REAL
// shape razorpay 2.9.2 returns (verified live 2026-09-07):
//   { entity: 'collection', count: 0, items: [...] }
// NOTE: the service instantiates Razorpay at module load, so the mock must
// be fully defined inside the vi.mock factory (hoisted above all imports).
const fetchPaymentsMock = vi.hoisted(() => vi.fn());
vi.mock('razorpay', () => {
  return {
    default: class MockRazorpay {
      constructor() {
        (this as any).orders = { fetchPayments: fetchPaymentsMock };
      }
    },
  };
});

// Import AFTER the mock is registered
import { fetchOrderPayments } from '../razorpay.service';

describe('fetchOrderPayments (audit §3.2: SDK returns a collection, not an array)', () => {
  it('returns a real Array even when the SDK returns {entity,count,items}', async () => {
    // Exact live-observed shape for an order with no payments
    fetchPaymentsMock.mockResolvedValue({ entity: 'collection', count: 0, items: [] });

    const payments = await fetchOrderPayments('order_test123');

    expect(Array.isArray(payments)).toBe(true);
    expect(payments).toEqual([]);
  });

  it('exposes the items array entries with id/status/order_id', async () => {
    fetchPaymentsMock.mockResolvedValue({
      entity: 'collection',
      count: 1,
      items: [{ id: 'pay_abc', status: 'captured', order_id: 'order_test123' }],
    });

    const payments = await fetchOrderPayments('order_test123');

    expect(Array.isArray(payments)).toBe(true);
    expect(payments.find((p) => p.status === 'captured')).toEqual({
      id: 'pay_abc',
      status: 'captured',
      order_id: 'order_test123',
    });
  });
});
