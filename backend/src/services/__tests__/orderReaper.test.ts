import { describe, it, expect, vi, beforeEach } from 'vitest';

// The reaper is a private module (startOrderReaper only). We test through the
// exported restartable surface: import the module with mocked dependencies,
// call startOrderReaper(), and wait for the first sweep. Mocks:
//  - Order.find returns our stale orders; findById returns fresh docs
//  - fetchOrderPayments returns the Razorpay collection shape (the §3.2 bug)
//  - restockOrderItems / queueInvoiceGeneration / email / socket: spies

const foundOrders: any[] = [];
const savedDocs: any[] = [];

const orderFindById = vi.hoisted(() => vi.fn());
const orderFind = vi.hoisted(() => vi.fn());
const restockSpy = vi.hoisted(() => vi.fn());
const fetchPaymentsMock = vi.hoisted(() => vi.fn());

vi.mock('../../models/Order', () => ({
  Order: {
    find: (query: any) => orderFind(query),
    findById: (id: any) => orderFindById(id),
  },
}));
vi.mock('../../models/Product', () => ({ Product: {} }));
vi.mock('../razorpay.service', () => ({
  fetchOrderPayments: (id: string) => fetchPaymentsMock(id),
}));
vi.mock('../email.service', () => ({
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../config/socket', () => ({
  emitOrderStatusUpdate: vi.fn(),
}));
vi.mock('../../queues/invoiceQueue', () => ({
  queueInvoiceGeneration: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/helpers', () => ({
  generateDeliveryId: () => 'DL-TEST',
}));
vi.mock('../../utils/orderRestock', () => ({
  restockOrderItems: (...args: any[]) => restockSpy(...args),
}));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { sweepNow } from '../orderReaper';

function makeOrder(opts: { orderId: string; paymentStatus: string; rzpId?: string }) {
  const doc: any = {
    _id: { toString: () => opts.orderId },
    orderId: opts.orderId,
    razorpayOrderId: opts.rzpId ?? `order_${opts.orderId}`,
    paymentStatus: opts.paymentStatus,
    orderStatus: 'placed',
    customer: { toString: () => 'cust1' },
    items: [{ product: 'p1', variant: 'sku1', quantity: 2 }],
    statusHistory: [],
    // save() records the state at save-time — the assertion point for tests
    save: vi.fn(async function (this: any) {
      savedDocs.push({ orderId: this.orderId, orderStatus: this.orderStatus, paymentStatus: this.paymentStatus, razorpayPaymentId: this.razorpayPaymentId });
      return this;
    }),
    // Mongoose docs are thenable; awaiting findById returns the doc itself.
    // Resolving `doc` (not a snapshot) keeps reaper mutations observable.
    then: (resolve: any, reject: any) => Promise.resolve({ ...doc, then: undefined, populate: undefined, save: doc.save }).then(resolve, reject),
    // The reaper chains .populate() for the email lookup
    populate: () => Promise.resolve({ ...doc, customer: { name: 'C', email: 'c@x.test' } }),
  };
  // then() spread drops `then`/`populate` from the resolved copy so awaiting
  // terminates; save stays shared so mutations persist to assertions.
  return doc;
}

describe('orderReaper sweep (audit §3.2/§3.2b/§3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    foundOrders.length = 0;
    savedDocs.length = 0;
    orderFind.mockImplementation(() => ({
      // mongoose query is chainable + thenable; the reaper calls .limit(50)
      limit: () => Promise.resolve(foundOrders),
    }));
    orderFindById.mockImplementation((id: any) => {
      const key = typeof id === 'string' ? id : id?.toString?.();
      return foundOrders.find((o) => o.orderId === key) || null;
    });
    fetchPaymentsMock.mockReset();
  });

  it('cancels + restocks a stale abandoned pending order (the crash that made the reaper dead)', async () => {
    const order = makeOrder({ orderId: 'ORD-ABANDONED', paymentStatus: 'pending' });
    foundOrders.push(order);
    // At the reaper boundary the (fixed) service returns a real array —
    // the collection-shape crash is covered by razorpay.service.test.ts
    fetchPaymentsMock.mockResolvedValue([]);

    await sweepNow();

    // findById resolves a copy; save() records the state at save-time
    const saved = savedDocs.find((d) => d.orderId === 'ORD-ABANDONED');
    expect(saved?.orderStatus).toBe('cancelled');
    expect(restockSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ORD-ABANDONED' }));
  });

  it('cancels + restocks a stale FAILED order (§3.4 zombie fix)', async () => {
    const order = makeOrder({ orderId: 'ORD-FAILED', paymentStatus: 'failed' });
    foundOrders.push(order);
    fetchPaymentsMock.mockResolvedValue([]);

    await sweepNow();

    const saved = savedDocs.find((d) => d.orderId === 'ORD-FAILED');
    expect(saved?.orderStatus).toBe('cancelled');
    expect(restockSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ORD-FAILED' }));
    // No Razorpay call needed for known-failed orders
    expect(fetchPaymentsMock).not.toHaveBeenCalled();
  });

  it('isolates failures: one bad order does not block the next (§3.2b)', async () => {
    const bad = makeOrder({ orderId: 'ORD-BAD', paymentStatus: 'pending' });
    // findById for the bad order throws (e.g. DB hiccup) → reconcileOrCancel throws
    orderFindById.mockImplementation((id: any) => {
      const key = typeof id === 'string' ? id : id?.toString?.();
      if (key === 'ORD-BAD') return Promise.reject(new Error('db hiccup'));
      return Promise.resolve(foundOrders.find((o) => o.orderId === key) || null);
    });
    const good = makeOrder({ orderId: 'ORD-GOOD', paymentStatus: 'pending' });
    foundOrders.push(bad, good);
    fetchPaymentsMock.mockResolvedValue([]);

    await sweepNow();

    // GOOD order still cancelled despite BAD order throwing
    const saved = savedDocs.find((d) => d.orderId === 'ORD-GOOD');
    expect(saved?.orderStatus).toBe('cancelled');
    expect(restockSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ORD-GOOD' }));
  });

  it('reconciles a secretly-paid order instead of cancelling', async () => {
    const order = makeOrder({ orderId: 'ORD-PAID', paymentStatus: 'pending' });
    foundOrders.push(order);
    fetchPaymentsMock.mockResolvedValue([
      { id: 'pay_ok', status: 'captured', order_id: 'order_ORD-PAID' },
    ]);

    await sweepNow();

    const saved = savedDocs.find((d) => d.orderId === 'ORD-PAID');
    expect(saved?.orderStatus).toBe('confirmed');
    expect(saved?.paymentStatus).toBe('paid');
    expect(saved?.razorpayPaymentId).toBe('pay_ok');
    expect(restockSpy).not.toHaveBeenCalled();
  });
});
