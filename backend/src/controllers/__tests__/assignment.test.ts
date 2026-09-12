import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Assignment contract. Assigning an agent writes to two documents (the order
 * and its DeliveryAssignment) and used to do so unguarded and in the wrong
 * order, so it could:
 *   1. drag a delivered/cancelled order back to "shipped", and
 *   2. leave the order marked shipped with no assignment for the agent to see
 *      when the assignment write failed.
 */

const orderFindById = vi.hoisted(() => vi.fn());
const agentFindOne = vi.hoisted(() => vi.fn());
const assignmentUpdate = vi.hoisted(() => vi.fn());
const emitOrderStatus = vi.hoisted(() => vi.fn());
const emitAssigned = vi.hoisted(() => vi.fn());

vi.mock('../../models/Order', () => ({ Order: { findById: (id: any) => orderFindById(id) } }));
vi.mock('../../models/DeliveryAgent', () => ({ DeliveryAgent: { findOne: (q: any) => agentFindOne(q) } }));
vi.mock('../../models/DeliveryAssignment', () => ({
  DeliveryAssignment: { findOneAndUpdate: (...args: any[]) => assignmentUpdate(...args) },
}));
vi.mock('../../models/Customer', () => ({ Customer: {} }));
vi.mock('../../models/Product', () => ({ Product: {} }));
vi.mock('../../models/Admin', () => ({ Admin: {} }));
vi.mock('../../services/email.service', () => ({
  sendAgentAssignmentEmail: vi.fn(async () => undefined),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));
vi.mock('../../config/socket', () => ({
  emitOrderStatusUpdate: (...args: any[]) => emitOrderStatus(...args),
  emitDeliveryAssigned: (...args: any[]) => emitAssigned(...args),
}));
vi.mock('../../services/razorpay.service', () => ({ refundPayment: vi.fn() }));
vi.mock('../../config/redis', () => ({ upstashRedis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { assignDeliveryAgent } from '../../controllers/admin.controller';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    _id: 'order-1',
    orderId: 'ORD-1',
    orderStatus: 'confirmed',
    customer: { toString: () => 'cust-1' },
    shippingAddress: { fullName: 'A Customer' },
    statusHistory: [] as any[],
    save: vi.fn(async function (this: any) { return this; }),
    ...overrides,
  };
}

const agent = { _id: { toString: () => 'agent-1' }, email: 'a@x.test', name: 'Agent' };

function makeReq() {
  return { params: { orderId: 'order-1', agentId: 'agent-1' } } as any;
}
function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((payload: any) => { res.body = payload; return res; });
  return res;
}

function wire(order: any) {
  orderFindById.mockResolvedValue(order);
  agentFindOne.mockResolvedValue(agent);
  assignmentUpdate.mockResolvedValue({ _id: 'assignment-1' });
}

describe('assignDeliveryAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ships a confirmed order and records the assignment', async () => {
    const order = makeOrder({ orderStatus: 'confirmed' });
    wire(order);
    const res = makeRes();

    await assignDeliveryAgent(makeReq(), res);

    expect(order.orderStatus).toBe('shipped');
    expect(order.statusHistory).toHaveLength(1);
    expect(assignmentUpdate).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('never drags a delivered order back to shipped', async () => {
    const order = makeOrder({ orderStatus: 'delivered' });
    wire(order);
    const res = makeRes();

    await assignDeliveryAgent(makeReq(), res);

    expect(order.orderStatus).toBe('delivered');
    expect(order.save).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('refuses to assign a cancelled order', async () => {
    const order = makeOrder({ orderStatus: 'cancelled' });
    wire(order);
    const res = makeRes();

    await assignDeliveryAgent(makeReq(), res);

    expect(order.orderStatus).toBe('cancelled');
    expect(assignmentUpdate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('re-assigns an order already out for delivery without regressing its status', async () => {
    const order = makeOrder({ orderStatus: 'out_for_delivery' });
    wire(order);
    const res = makeRes();

    await assignDeliveryAgent(makeReq(), res);

    // The new agent must receive the assignment, but the customer must not see
    // the order jump backwards from "out for delivery" to "shipped".
    expect(order.orderStatus).toBe('out_for_delivery');
    expect(order.statusHistory).toHaveLength(0);
    expect(assignmentUpdate).toHaveBeenCalled();
    expect(emitAssigned).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('does not mark the order shipped when the assignment write fails', async () => {
    const order = makeOrder({ orderStatus: 'confirmed' });
    wire(order);
    assignmentUpdate.mockRejectedValue(new Error('assignment write failed'));
    const res = makeRes();

    await expect(assignDeliveryAgent(makeReq(), res)).rejects.toThrow('assignment write failed');

    // The agent has no assignment, so the order must not claim to be shipped.
    expect(order.save).not.toHaveBeenCalled();
    expect(order.orderStatus).toBe('confirmed');
  });

  it('reports a missing agent without touching the order', async () => {
    const order = makeOrder();
    wire(order);
    agentFindOne.mockResolvedValue(null);
    const res = makeRes();

    await assignDeliveryAgent(makeReq(), res);

    expect(order.save).not.toHaveBeenCalled();
    expect(assignmentUpdate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });
});
