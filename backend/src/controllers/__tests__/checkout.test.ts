import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHmac } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Request, Response } from 'express';

const effects = vi.hoisted(() => ({ createPayment: vi.fn(), payments: vi.fn(), invoice: vi.fn(), emit: vi.fn() }));
vi.mock('../../services/razorpay.service', () => ({ createRazorpayOrder: effects.createPayment, fetchOrderPayments: effects.payments }));
vi.mock('../../queues/invoiceQueue', () => ({ queueInvoiceGeneration: effects.invoice }));
vi.mock('../../config/socket', () => ({ emitNewOrder: vi.fn(), emitOrderStatusUpdate: effects.emit }));
vi.mock('../../services/email.service', () => ({ sendOrderStatusEmail: vi.fn() }));
vi.mock('../../models/Customer', () => ({ Customer: { findById: () => ({ select: async () => null }) } }));

import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { Cart } from '../../models/Cart';
import { createOrder, verifyPayment } from '../order.controller';
import { resumePayment, getCheckoutOrder, checkoutSchema } from '../checkout.controller';
import { addToCart, updateCartItem, mergeGuestCart } from '../cart.controller';

let database: MongoMemoryReplSet;
const customer = new mongoose.Types.ObjectId();
const otherCustomer = new mongoose.Types.ObjectId();
let productId: string;
const address = { fullName: 'Test Shopper', phone: '9876543210', addressLine1: '12 Test Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' };
function request(body: unknown, id?: string, userId = customer.toString()) {
  return { body, params: { id }, user: { userId, role: 'customer' }, query: {}, headers: {} } as unknown as Request;
}
function response() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), locals: {} };
  return { res: res as unknown as Response, status: res.status, payload: () => res.json.mock.calls[0]?.[0] };
}
function checkout(overrides: Record<string, unknown> = {}) {
  return { checkoutId: randomUUID(), items: [{ product: productId, variant: 'phone', quantity: 1, expectedPrice: 19.99 }], shippingAddress: address, paymentMethod: 'online', expectedTotal: 72.59, ...overrides };
}
async function place(body = checkout()) {
  const result = response();
  await createOrder(request(body), result.res);
  return result;
}
function proof(razorpayOrderId: string, razorpayPaymentId = 'pay_test') {
  return { razorpayOrderId, razorpayPaymentId, razorpaySignature: createHmac('sha256', 'test-razorpay-secret').update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex') };
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  await mongoose.connect(database.getUri(), { dbName: 'nexmart_checkout_tests' });
  await Promise.all([Order.init(), Product.init(), Cart.init()]);
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all([Order.deleteMany({}), Product.deleteMany({}), Cart.deleteMany({})]);
  effects.createPayment.mockImplementation(async () => ({ id: `order_${randomUUID()}`, amount: 7259, currency: 'INR' }));
  effects.payments.mockResolvedValue([]);
  const product = await Product.create({ name: 'Test phone', slug: 'test-phone', description: 'Isolated test fixture', category: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(), isPublished: true, variants: [{ sku: 'phone', price: 19.99, stock: 5 }, { sku: 'other', price: 200, stock: 100 }] });
  productId = String(product._id);
});

describe('checkout identity, reviewed amounts and inventory', () => {
  it('rejects empty or duplicate lines and invalid delivery details', () => {
    expect(checkoutSchema.safeParse(checkout({ items: [] })).success).toBe(false);
    const body = checkout();
    expect(checkoutSchema.safeParse({ ...body, items: [body.items[0], body.items[0]] }).success).toBe(false);
    expect(checkoutSchema.safeParse(checkout({ shippingAddress: { ...address, phone: '+1 123', pincode: 'abcdef' } })).success).toBe(false);
  });
  it('serializes concurrent copies of a checkout into one order and stock reservation', async () => {
    const body = checkout();
    const results = await Promise.all([place(body), place(body)]);
    expect(results[0].payload().data.orderId).toBe(results[1].payload().data.orderId);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(productId))?.variants[0].stock).toBe(4);
  });
  it('reuses a saved checkout after a lost response without reserving stock twice', async () => {
    const body = checkout();
    const first = await place(body);
    const second = await place(body);
    expect(second.payload().data.orderId).toBe(String(first.payload().data.orderId));
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(productId))?.variants[0].stock).toBe(4);
    expect(effects.createPayment).toHaveBeenCalledTimes(1);
  });
  it('rejects a price change before creating a payment order or reserving stock', async () => {
    const result = await place(checkout({ expectedTotal: 70 }));
    expect(result.status).toHaveBeenCalledWith(409);
    expect(result.payload().code).toBe('PRICE_CHANGED');
    expect(await Order.countDocuments()).toBe(0);
    expect(effects.createPayment).not.toHaveBeenCalled();
  });
  it('does not allow unpublished items into checkout', async () => {
    await Product.updateOne({ _id: productId }, { isPublished: false });
    const result = await place();
    expect(result.status).toHaveBeenCalledWith(409);
    expect(await Order.countDocuments()).toBe(0);
  });
  it('binds a checkout identity to its original contents', async () => {
    const body = checkout();
    await place(body);
    const result = await place({ ...body, paymentMethod: 'cod' });
    expect(result.status).toHaveBeenCalledWith(409);
    expect(await Order.countDocuments()).toBe(1);
  });
});

describe('saved order recovery', () => {
  it('looks up a checkout only for its owner', async () => {
    const body = checkout();
    const placed = (await place(body)).payload().data;
    const req = request({}); req.params = { checkoutId: body.checkoutId };
    const own = response(); await getCheckoutOrder(req, own.res);
    expect(own.payload().data.orderId).toBe(placed.orderId);
    const other = request({}, undefined, otherCustomer.toString()); other.params = req.params;
    const denied = response(); await getCheckoutOrder(other, denied.res);
    expect(denied.status).toHaveBeenCalledWith(404);
  });
  it('resumes the same Razorpay order without reserving more inventory', async () => {
    const placed = (await place()).payload().data;
    const result = response();
    await resumePayment(request({ expectedTotal: placed.total }, placed.orderId), result.res);
    expect(result.payload().data.razorpayOrderId).toBe(placed.razorpayOrderId);
    expect(effects.createPayment).toHaveBeenCalledTimes(1);
    expect((await Order.findById(placed.orderId))?.paymentAttemptedAt).toBeInstanceOf(Date);
    expect((await Product.findById(productId))?.variants[0].stock).toBe(4);
  });
  it('blocks payment resume for cancelled orders and a changed reviewed amount', async () => {
    const placed = (await place()).payload().data;
    const changed = response();
    await resumePayment(request({ expectedTotal: 1 }, placed.orderId), changed.res);
    expect(changed.status).toHaveBeenCalledWith(409);
    await Order.updateOne({ _id: placed.orderId }, { orderStatus: 'cancelled' });
    const closed = response();
    await resumePayment(request({ expectedTotal: placed.total }, placed.orderId), closed.res);
    expect(closed.status).toHaveBeenCalledWith(409);
  });
});

describe('payment callbacks', () => {
  it('binds payment verification to the route order as well as the customer', async () => {
    const first = await place();
    const second = await place();
    const result = response();
    await verifyPayment(request(proof(first.payload().data.razorpayOrderId), String(second.payload().data.orderId)), result.res);
    expect(result.status).toHaveBeenCalledWith(404);
    expect(await Order.countDocuments({ paymentStatus: 'paid' })).toBe(0);
  });
  it('accepts duplicate valid callbacks without duplicate history or invoices', async () => {
    const placed = (await place()).payload().data;
    const body = proof(placed.razorpayOrderId);
    await verifyPayment(request(body, String(placed.orderId)), response().res);
    const again = response();
    await verifyPayment(request(body, String(placed.orderId)), again.res);
    expect(again.status).toHaveBeenCalledWith(200);
    expect((await Order.findById(placed.orderId))?.statusHistory).toHaveLength(2);
    expect(effects.invoice).toHaveBeenCalledTimes(1);
  });
  it('never reopens a cancelled order when a late valid payment arrives', async () => {
    const placed = (await place()).payload().data;
    await Order.updateOne({ _id: placed.orderId }, { orderStatus: 'cancelled' });
    await verifyPayment(request(proof(placed.razorpayOrderId), String(placed.orderId)), response().res);
    const order = await Order.findById(placed.orderId);
    expect(order?.paymentStatus).toBe('paid');
    expect(order?.orderStatus).toBe('cancelled');
  });
  it('does not downgrade a paid order after an invalid callback', async () => {
    const placed = (await place()).payload().data;
    await Order.updateOne({ _id: placed.orderId }, { paymentStatus: 'paid', orderStatus: 'shipped' });
    await verifyPayment(request({ ...proof(placed.razorpayOrderId), razorpaySignature: 'invalid' }, String(placed.orderId)), response().res);
    expect((await Order.findById(placed.orderId))?.paymentStatus).toBe('paid');
  });
  it('does not reveal or mutate another customer’s order', async () => {
    const placed = (await place()).payload().data;
    const result = response();
    await verifyPayment(request(proof(placed.razorpayOrderId), String(placed.orderId), otherCustomer.toString()), result.res);
    expect(result.status).toHaveBeenCalledWith(404);
    expect((await Order.findById(placed.orderId))?.paymentStatus).toBe('pending');
  });
});

describe('cart inventory and guest migration', () => {
  it('checks cumulative quantity against the selected option’s inventory', async () => {
    await Cart.create({ user: customer, items: [{ product: productId, variant: 'phone', quantity: 4, price: 19.99 }] });
    const result = response();
    await addToCart(request({ productId, variant: 'phone', quantity: 2 }), result.res);
    expect(result.status).toHaveBeenCalledWith(400);
    expect((await Cart.findOne({ user: customer }))?.items[0].quantity).toBe(4);
  });
  it('rejects an update above stock even when another option has enough stock', async () => {
    const cart = await Cart.create({ user: customer, items: [{ product: productId, variant: 'phone', quantity: 2, price: 19.99 }] });
    const req = request({ quantity: 6 }); req.params = { itemId: String(cart.items[0]._id) };
    const result = response(); await updateCartItem(req, result.res);
    expect(result.status).toHaveBeenCalledWith(400);
    expect((await Cart.findOne({ user: customer }))?.items[0].quantity).toBe(2);
  });
  it('merges a guest session once, preserving the existing account cart', async () => {
    await Cart.create({ sessionId: 'guest-test', items: [{ product: productId, variant: 'phone', quantity: 2, price: 19.99 }] });
    await Cart.create({ user: customer, items: [{ product: productId, variant: 'phone', quantity: 1, price: 19.99 }] });
    const req = request({ fromSession: true, items: [] }); req.headers = { 'x-session-id': 'guest-test' };
    await mergeGuestCart(req, response().res);
    await mergeGuestCart(req, response().res);
    expect((await Cart.findOne({ user: customer }))?.items[0].quantity).toBe(3);
    expect(await Cart.countDocuments({ sessionId: 'guest-test' })).toBe(0);
  });
});
