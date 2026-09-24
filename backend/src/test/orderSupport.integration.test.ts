import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import request from 'supertest';

vi.mock('../config/redis', () => ({
  isTokenBlacklisted: vi.fn(async () => false),
  generalRateLimiter: { limit: vi.fn(async () => ({ success: true, remaining: 99, reset: 0 })) },
  paymentRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  authRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  otpRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  registrationRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
}));
vi.mock('../config/socket', () => ({ emitOrderStatusUpdate: vi.fn() }));
vi.mock('../services/email.service', () => ({ sendOrderStatusEmail: vi.fn() }));

import { startTestDb, stopTestDb, clearCollections, testApp, TEST_ORIGIN } from './helpers';
import { Customer } from '../models/Customer';
import { Admin } from '../models/Admin';
import { Order } from '../models/Order';
import { OrderRequest } from '../models/OrderRequest';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { generateInvoiceBuffer } from '../services/invoice.service';

beforeAll(async () => {
  await startTestDb('nexmart_order_support');
  await Promise.all([Order.init(), OrderRequest.init()]);
}, 120000);
afterAll(stopTestDb);
beforeEach(clearCollections);

async function fixture() {
  const customer = await Customer.create({ name: 'Support Customer', email: 'support@example.test', emailVerified: true });
  const other = await Customer.create({ name: 'Other Customer', email: 'other@example.test', emailVerified: true });
  const admin = await Admin.create({ name: 'Support Operator', email: 'operator@example.test' });
  const token = generateToken({ id: customer.id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '1h');
  const otherToken = generateToken({ id: other.id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '1h');
  const adminToken = generateToken({ id: admin.id, role: 'admin' }, env.JWT_SECRET_ADMIN, '1h');
  const order = await Order.create({
    orderId: 'ORD-SUPPORT', customer: customer._id, orderStatus: 'placed', paymentMethod: 'cod', paymentStatus: 'pending',
    subtotal: 100, total: 149, shippingFee: 49, statusHistory: [{ status: 'placed', timestamp: new Date() }],
    items: [{ product: new mongoose.Types.ObjectId(), name: 'Recorded product name', variant: 'STANDARD', quantity: 1, unitPrice: 100, totalPrice: 100, purchaseTerms: { sellerName: 'Recorded store', returnWindowDays: 7 } }],
    shippingAddress: { fullName: 'Support Customer', phone: '9876543210', addressLine1: '12 Private Street', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  });
  const app = testApp();
  const submit = (body: unknown, bearer = token) => request(app).post(`/api/v1/orders/${order._id}/requests`).set('Origin', TEST_ORIGIN).auth(bearer, { type: 'bearer' }).send(body as object);
  const update = (id: string, status: string, version: number, bearer = adminToken) => request(app).patch(`/api/v1/admin/order-requests/${id}`).set('Origin', TEST_ORIGIN).auth(bearer, { type: 'bearer' }).send({ status, version, note: 'Customer-visible support update.' });
  return { app, order, token, otherToken, adminToken, submit, update };
}

describe('private order help, cancellation and return requests', () => {
  it('enforces order ownership and deduplicates concurrent submissions', async () => {
    const data = await fixture();
    const input = { requestKey: randomUUID(), kind: 'cancellation', reason: 'I no longer need this order.' };
    expect((await data.submit(input, data.otherToken)).status).toBe(404);
    const results = await Promise.all([data.submit(input), data.submit(input)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 201]);
    expect(await OrderRequest.countDocuments()).toBe(1);
    expect((await data.submit({ ...input, reason: 'Different request details.' })).status).toBe(409);
    expect((await data.submit({ ...input, requestKey: randomUUID() })).status).toBe(409);
    const order = (await Order.findById(data.order._id))!;
    expect(order.orderStatus).toBe('placed');
    expect(order.paymentStatus).toBe('pending');
    expect((await request(data.app).get(`/api/v1/orders/${order._id}/requests`).auth(data.otherToken, { type: 'bearer' })).status).toBe(404);
  });

  it('bases return eligibility on delivery and the purchased item terms', async () => {
    const data = await fixture();
    const input = { requestKey: randomUUID(), kind: 'return', itemId: String(data.order.items[0]._id), reason: 'The item arrived with a damaged edge.' };
    expect((await data.submit(input)).status).toBe(409);
    await Order.updateOne({ _id: data.order._id }, { orderStatus: 'delivered', statusHistory: [{ status: 'delivered', timestamp: new Date(Date.now() - 2 * 86400000) }] });
    expect((await data.submit({ ...input, itemId: new mongoose.Types.ObjectId().toString() })).status).toBe(409);
    expect((await data.submit(input)).status).toBe(201);
    // A lost-response retry recovers the original request even after expiry.
    await Order.updateOne({ _id: data.order._id }, { statusHistory: [{ status: 'delivered', timestamp: new Date(Date.now() - 8 * 86400000) }] });
    expect((await data.submit(input)).status).toBe(200);
    await OrderRequest.deleteMany({});
    expect((await data.submit({ ...input, requestKey: randomUUID() })).status).toBe(409);
  });

  it('requires operational completion and rejects stale or unauthorized admin reviews', async () => {
    const data = await fixture();
    const created = await data.submit({ requestKey: randomUUID(), kind: 'cancellation', reason: 'Please cancel this order before dispatch.' });
    const id = created.body.data._id;
    expect((await data.update(id, 'under_review', 0, data.token)).status).toBe(401);
    expect((await data.update(id, 'under_review', 0)).status).toBe(200);
    expect((await data.update(id, 'approved', 0)).status).toBe(409);
    expect((await data.update(id, 'approved', 1)).status).toBe(200);
    expect((await data.update(id, 'resolved', 2)).status).toBe(409);
    await Order.updateOne({ _id: data.order._id }, { orderStatus: 'cancelled' });
    expect((await data.update(id, 'resolved', 2)).status).toBe(200);
    const history = await request(data.app).get(`/api/v1/orders/${data.order._id}/requests`).auth(data.token, { type: 'bearer' });
    expect(history.body.data.requests[0].history).toHaveLength(4);
    expect(history.body.data.requests[0].isOpen).toBe(false);
    expect(history.body.data.requests[0].history.every((entry: { updatedBy?: unknown }) => !entry.updatedBy)).toBe(true);
  });

  it('streams an authenticated receipt with private caching and handles many items', async () => {
    const data = await fixture();
    const url = `/api/v1/orders/${data.order._id}/invoice`;
    expect((await request(data.app).get(url)).status).toBe(401);
    expect((await request(data.app).get(url).auth(data.otherToken, { type: 'bearer' })).status).toBe(404);
    const receipt = await request(data.app).get(url).auth(data.token, { type: 'bearer' });
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');
    expect(receipt.headers['cache-control']).toContain('no-store');
    expect(receipt.headers['content-disposition']).toContain('attachment;');
    expect(receipt.body.subarray(0, 5).toString()).toBe('%PDF-');
    for (let index = 0; index < 25; index++) data.order.items.push(data.order.items[0]);
    const large = await generateInvoiceBuffer(data.order);
    expect((large.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1);
  });
});
