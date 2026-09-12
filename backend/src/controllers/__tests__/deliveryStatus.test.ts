import { describe, it, expect, vi, beforeEach } from 'vitest';

// Audit §3.3/§3.5 for the AGENT status path: returned → restock,
// delivered COD → paymentStatus paid.

const assignmentFindOne = vi.hoisted(() => vi.fn());
const orderFindById = vi.hoisted(() => vi.fn());
const restockSpy = vi.hoisted(() => vi.fn());
const emitSpy = vi.hoisted(() => vi.fn());
const invoiceSpy = vi.hoisted(() => vi.fn());

vi.mock('../../models/Order', () => ({
  Order: { findById: (id: any) => orderFindById(id) },
}));
vi.mock('../../models/DeliveryAssignment', () => ({
  DeliveryAssignment: { findOne: (q: any) => assignmentFindOne(q) },
}));
vi.mock('../../utils/orderRestock', () => ({
  restockOrderItems: async (...args: any[]) => restockSpy(...args),
}));
vi.mock('../../config/socket', () => ({
  emitOrderStatusUpdate: (...args: any[]) => emitSpy(...args),
}));
vi.mock('../../services/email.service', () => ({
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));
vi.mock('../../queues/invoiceQueue', () => ({
  queueInvoiceGeneration: async (...args: any[]) => invoiceSpy(...args),
}));

import { updateDeliveryStatus } from '../../controllers/delivery.controller';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    _id: 'order-1',
    orderId: 'ORD-TEST-1',
    orderStatus: 'shipped',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    items: [{ product: 'p1', variant: 'sku1', quantity: 2 }],
    customer: { name: 'C', email: 'c@x.test', _id: { toString: () => 'cust-1' } },
    statusHistory: [],
    save: vi.fn(async function (this: any) { return this; }),
    ...overrides,
  };
}
interface TestAssignment {
  agent: string;
  order: string;
  status: string;
  pickedAt?: Date;
  attemptedAt?: Date;
  deliveredAt?: Date;
  save: ReturnType<typeof vi.fn>;
}
function makeAssignment(overrides: Partial<TestAssignment> = {}): TestAssignment {
  return {
    agent: 'agent-1', order: 'order-1', status: 'assigned',
    save: vi.fn(async function (this: any) { return this; }),
    ...overrides,
  };
}
function makeReq(status: string) {
  return { body: { status }, params: { id: 'order-1' }, user: { userId: 'agent-1', role: 'agent' } } as any;
}
function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

function wireMocks(order: any, assignment: any) {
  assignmentFindOne.mockReturnValue(Promise.resolve(assignment));
  // controller: `Order.findById(...)` — a mongoose query awaited directly
  orderFindById.mockImplementation(() => {
    const doc: any = order;
    return {
      then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
      populate: (_path: string, _select: string) => ({
        then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
      }),
    };
  });
}

describe('updateDeliveryStatus (audit §3.3/§3.5, agent path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks COD paid when the agent delivers (§3.5)', async () => {
    const order = makeOrder({ orderStatus: 'out_for_delivery' });
    wireMocks(order, makeAssignment());

    await updateDeliveryStatus(makeReq('delivered'), makeRes());

    expect(order.orderStatus).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
  });

  it('restocks when the agent returns an order (§3.3)', async () => {
    const order = makeOrder({ orderStatus: 'out_for_delivery' });
    wireMocks(order, makeAssignment());

    await updateDeliveryStatus(makeReq('returned'), makeRes());

    expect(order.orderStatus).toBe('returned');
    expect(restockSpy).toHaveBeenCalledWith(order);
  });

  it('does not restock on normal forward transitions', async () => {
    const order = makeOrder({ orderStatus: 'shipped' });
    wireMocks(order, makeAssignment());

    await updateDeliveryStatus(makeReq('out_for_delivery'), makeRes());

    expect(order.orderStatus).toBe('out_for_delivery');
    expect(restockSpy).not.toHaveBeenCalled();
  });

  it('does not touch online payment status on delivery', async () => {
    const order = makeOrder({ orderStatus: 'out_for_delivery', paymentMethod: 'online', paymentStatus: 'paid' });
    wireMocks(order, makeAssignment());

    await updateDeliveryStatus(makeReq('delivered'), makeRes());

    expect(order.paymentStatus).toBe('paid');
  });

  it('queues an invoice when delivered (B12 regression)', async () => {
    const order = makeOrder({ orderStatus: 'out_for_delivery' });
    wireMocks(order, makeAssignment());

    await updateDeliveryStatus(makeReq('delivered'), makeRes());

    expect(invoiceSpy).toHaveBeenCalledWith('order-1');
  });
  it('keeps the original milestone timestamp when a status is repeated', async () => {
    // A second tap on "Delivered" (double tap, or a retry after a lost
    // response) must not move the recorded delivery time.
    const firstDelivery = new Date('2026-09-12T09:30:00.000Z');
    const order = makeOrder({ orderStatus: 'delivered', paymentStatus: 'paid' });
    const assignment = makeAssignment({ status: 'delivered', deliveredAt: firstDelivery });
    wireMocks(order, assignment);

    await updateDeliveryStatus(makeReq('delivered'), makeRes());

    expect(assignment.deliveredAt).toBe(firstDelivery);
    // The order itself is untouched: no duplicate history, email or invoice.
    expect(order.save).not.toHaveBeenCalled();
    expect(invoiceSpy).not.toHaveBeenCalled();
  });

  it('keeps the original pickup time when the agent re-sends "picked"', async () => {
    const firstPickup = new Date('2026-09-12T08:00:00.000Z');
    const order = makeOrder({ orderStatus: 'shipped' });
    const assignment = makeAssignment({ status: 'picked', pickedAt: firstPickup });
    wireMocks(order, assignment);

    await updateDeliveryStatus(makeReq('picked'), makeRes());

    expect(assignment.pickedAt).toBe(firstPickup);
  });

  it('records the latest failed attempt, because each attempt is a new event', async () => {
    const firstAttempt = new Date('2026-09-12T10:00:00.000Z');
    const order = makeOrder({ orderStatus: 'out_for_delivery' });
    const assignment = makeAssignment({ status: 'attempted', attemptedAt: firstAttempt });
    wireMocks(order, assignment);

    await updateDeliveryStatus(makeReq('attempted'), makeRes());

    expect(assignment.attemptedAt).not.toBe(firstAttempt);
  });
});
