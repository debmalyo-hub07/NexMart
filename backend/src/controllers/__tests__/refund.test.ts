import { describe, it, expect, vi, beforeEach } from 'vitest';

// Audit §3.6: refund emails currently say "Order Cancelled" even when the
// order is delivered/confirmed — the refund must be communicated as a refund.

const orderFindById = vi.hoisted(() => vi.fn());
const refundPayment = vi.hoisted(() => vi.fn());
const emailSpy = vi.hoisted(() => vi.fn());
const emitSpy = vi.hoisted(() => vi.fn());

vi.mock('../../models/Order', () => ({
  Order: { findById: (id: any) => orderFindById(id) },
}));
vi.mock('../../services/razorpay.service', () => ({
  refundPayment: (...args: any[]) => refundPayment(...args),
}));
vi.mock('../../services/email.service', () => ({
  sendOrderStatusEmail: async (...args: any[]) => emailSpy(...args),
}));
vi.mock('../../config/socket', () => ({
  emitOrderStatusUpdate: (...args: any[]) => emitSpy(...args),
}));
vi.mock('../../config/redis', () => ({
  upstashRedis: { get: async () => null, set: async () => undefined },
}));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { refundOrder } from '../../controllers/admin.controller';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    _id: 'order-1',
    orderId: 'ORD-TEST-1',
    orderStatus: 'delivered',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    razorpayPaymentId: 'pay_test123',
    customer: { _id: { toString: () => 'cust-1' }, name: 'C', email: 'c@x.test' },
    statusHistory: [] as Array<{ status: string }>,
    save: vi.fn(async function (this: any) { return this; }),
    ...overrides,
  };
}

describe('refundOrder (audit §3.6: honest refund email)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refundPayment.mockResolvedValue({ id: 'rfnd_1', status: 'processed', amount: 5900000 });
  });

  it('emails the customer about the REFUND, not a cancellation', async () => {
    const order = makeOrder(); // delivered order
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return {
        ...doc,
        populate: () => Promise.resolve(doc),
        then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
      };
    })());

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    await refundOrder({ params: { id: 'order-1' }, user: { userId: 'admin-1' } } as any, res);

    expect(emailSpy).toHaveBeenCalled();
    const emailStatusArg = emailSpy.mock.calls[0][3]; // (to, name, orderId, status)
    expect(emailStatusArg).toBe('refunded');
    expect(emailStatusArg).not.toBe('cancelled');
  });

  it('does not change the fulfilment status on refund', async () => {
    const order = makeOrder({ orderStatus: 'delivered' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return {
        ...doc,
        populate: () => Promise.resolve(doc),
        then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
      };
    })());

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    await refundOrder({ params: { id: 'order-1' }, user: { userId: 'admin-1' } } as any, res);

    expect(order.orderStatus).toBe('delivered');
    expect(order.paymentStatus).toBe('refunded');
    expect(order.statusHistory[order.statusHistory.length - 1].status).toBe('delivered'); // unchanged fulfilment status
  });

  it('rejects COD orders cleanly', async () => {
    const order = makeOrder({ paymentMethod: 'cod' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return {
        ...doc,
        populate: () => Promise.resolve(doc),
        then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
      };
    })());

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    await refundOrder({ params: { id: 'order-1' }, user: { userId: 'admin-1' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(refundPayment).not.toHaveBeenCalled();
  });
});
