import { describe, it, expect, vi, beforeEach } from 'vitest';

// Audit §3.3: admin cancel must restock; §3.5: agent-delivered COD must be
// marked paid. Tests the updateOrderStatus controller paths with the restock
// helper and side effects mocked.

const orderFindById = vi.hoisted(() => vi.fn());
const restockSpy = vi.hoisted(() => vi.fn());
const emitSpy = vi.hoisted(() => vi.fn());
const invoiceSpy = vi.hoisted(() => vi.fn());

vi.mock('../../models/Order', () => ({
  Order: { findById: (id: any) => orderFindById(id) },
}));
vi.mock('../../models/Product', () => ({ Product: {} }));
vi.mock('../../utils/orderRestock', () => ({
  restockOrderItems: (...args: any[]) => restockSpy(...args),
}));
vi.mock('../../config/socket', () => ({
  emitOrderStatusUpdate: (...args: any[]) => emitSpy(...args),
}));
vi.mock('../../services/email.service', () => ({
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));
vi.mock('../../queues/invoiceQueue', () => ({
  queueInvoiceGeneration: (...args: any[]) => invoiceSpy(...args),
}));

import { updateOrderStatus } from '../../controllers/order.controller';

function makeOrderDoc(overrides: Record<string, any> = {}) {
  return {
    _id: 'order-1',
    orderId: 'ORD-TEST-1',
    orderStatus: 'placed',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    items: [{ product: 'p1', variant: 'sku1', quantity: 2 }],
    customer: { _id: { toString: () => 'cust-1' }, name: 'C', email: 'c@x.test' },
    statusHistory: [],
    save: vi.fn(async function (this: any) { return this; }),
    ...overrides,
  };
}

function makeReq(status: string) {
  return {
    body: { status },
    params: { id: 'order-1' },
    user: { userId: 'admin-1', role: 'admin' },
  } as any;
}
function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

describe('updateOrderStatus (audit §3.3/§3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restocks every item when an admin cancels a placed order (§3.3)', async () => {
    const order = makeOrderDoc();
    orderFindById.mockReturnValue((() => {
      // thenable like a mongoose doc (the controller awaits findById + chains populate)
      const doc: any = order;
      const thenable: any = { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
      return thenable;
    })());

    await updateOrderStatus(makeReq('cancelled'), makeRes());

    expect(order.orderStatus).toBe('cancelled');
    expect(restockSpy).toHaveBeenCalledWith(order);
  });

  it('restocks when cancelling a confirmed order (mid-pipeline cancel)', async () => {
    const order = makeOrderDoc({ orderStatus: 'confirmed' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
    })());

    await updateOrderStatus(makeReq('cancelled'), makeRes());

    expect(order.orderStatus).toBe('cancelled');
    expect(restockSpy).toHaveBeenCalledTimes(1);
  });

  it('restocks on returned orders (goods come back to sellable stock)', async () => {
    const order = makeOrderDoc({ orderStatus: 'delivered' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
    })());

    await updateOrderStatus(makeReq('returned'), makeRes());

    expect(order.orderStatus).toBe('returned');
    expect(restockSpy).toHaveBeenCalledWith(order);
  });

  it('does NOT restock on fulfilment transitions (confirmed/shipped/delivered)', async () => {
    const order = makeOrderDoc({ orderStatus: 'placed' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
    })());

    await updateOrderStatus(makeReq('confirmed'), makeRes());

    expect(restockSpy).not.toHaveBeenCalled();
  });

  it('marks COD orders as paymentStatus=paid when delivered (§3.5)', async () => {
    const order = makeOrderDoc({ orderStatus: 'out_for_delivery', paymentMethod: 'cod', paymentStatus: 'pending' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
    })());

    await updateOrderStatus(makeReq('delivered'), makeRes());

    expect(order.orderStatus).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
  });

  it('does not touch paymentStatus of online orders on delivery', async () => {
    const order = makeOrderDoc({ orderStatus: 'out_for_delivery', paymentMethod: 'online', paymentStatus: 'paid' });
    orderFindById.mockReturnValue((() => {
      const doc: any = order;
      return { ...doc, populate: () => Promise.resolve(doc), then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej) };
    })());

    await updateOrderStatus(makeReq('delivered'), makeRes());

    expect(order.paymentStatus).toBe('paid');
  });
});
