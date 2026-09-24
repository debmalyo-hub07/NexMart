import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHmac } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Request, Response } from 'express';

const effects = vi.hoisted(() => ({ createPayment: vi.fn(), payments: vi.fn(), fetchPayment: vi.fn(), invoice: vi.fn(), emit: vi.fn() }));
vi.mock('../../services/razorpay.service', () => ({ createRazorpayOrder: effects.createPayment, fetchOrderPayments: effects.payments, fetchPayment: effects.fetchPayment }));
vi.mock('../../queues/invoiceQueue', () => ({ queueInvoiceGeneration: effects.invoice }));
vi.mock('../../config/socket', () => ({ emitNewOrder: vi.fn(), emitOrderStatusUpdate: effects.emit }));
vi.mock('../../services/email.service', () => ({ sendOrderStatusEmail: vi.fn() }));
vi.mock('../../models/Customer', () => ({ Customer: { findById: () => ({ select: async () => null }) } }));

import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { Cart } from '../../models/Cart';
import { Seller } from '../../models/Seller';
import { SellerListing } from '../../models/SellerListing';
import { SellerInventory } from '../../models/SellerInventory';
import { FulfillmentGroup } from '../../models/FulfillmentGroup';
import { InventoryMovement } from '../../models/InventoryMovement';
import { createOrder, verifyPayment } from '../order.controller';
import { resumePayment, getCheckoutOrder, checkoutSchema } from '../checkout.controller';
import { addToCart, updateCartItem, mergeGuestCart } from '../cart.controller';
import { restockOrderItems } from '../../utils/orderRestock';

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
  return { checkoutId: randomUUID(), items: [{ product: productId, variant: 'phone', quantity: 1, expectedPrice: 19.99 }], shippingAddress: address, paymentMethod: 'online', expectedTotal: 68.99, ...overrides };
}
async function place(body = checkout()) {
  const result = response();
  await createOrder(request(body), result.res);
  return result;
}

async function offerFixture(input: {
  suffix: string;
  variant: string;
  pricePaise: number;
  stock: number;
  fulfillmentMode?: 'seller' | 'nexmart';
}) {
  const seller = await Seller.create({
    name: `Seller ${input.suffix}`,
    email: `seller-${input.suffix}@example.test`,
    phone: `98${input.suffix.padStart(8, '0').slice(-8)}`,
    role: 'seller',
    emailVerified: true,
    isActive: true,
    lifecycleStatus: 'active',
    legalBusinessName: `Seller ${input.suffix} Private Limited`,
    storefrontName: `Store ${input.suffix}`,
    businessType: 'private_limited',
  });
  const listing = await SellerListing.create({
    seller: seller._id,
    canonicalProduct: productId,
    canonicalVariantSku: input.variant,
    sellerSku: `SKU-${input.suffix}`,
    pricePaise: input.pricePaise,
    fulfillmentMode: input.fulfillmentMode || 'seller',
    status: 'published',
  });
  const inventory = await SellerInventory.create({
    listing: listing._id,
    seller: seller._id,
    available: input.stock,
  });
  listing.inventory = inventory._id;
  await listing.save();
  return { seller, listing, inventory };
}
function proof(razorpayOrderId: string, razorpayPaymentId = 'pay_test') {
  return { razorpayOrderId, razorpayPaymentId, razorpaySignature: createHmac('sha256', 'test-razorpay-secret').update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex') };
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  await mongoose.connect(database.getUri(), { dbName: 'nexmart_checkout_tests' });
  await Promise.all([Order.init(), Product.init(), Cart.init(), Seller.init(), SellerListing.init(), SellerInventory.init(), FulfillmentGroup.init(), InventoryMovement.init()]);
}, 120_000);
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all([
    Order.deleteMany({}),
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Seller.deleteMany({}),
    SellerListing.deleteMany({}),
    SellerInventory.deleteMany({}),
    FulfillmentGroup.deleteMany({}),
    InventoryMovement.deleteMany({}),
  ]);
  effects.createPayment.mockImplementation(async () => ({ id: `order_${randomUUID()}`, amount: 7259, currency: 'INR' }));
  effects.payments.mockResolvedValue([]);
  effects.fetchPayment.mockImplementation(async (paymentId: string) => ({
    id: paymentId,
    status: 'captured',
    currency: 'INR',
  }));
  const product = await Product.create({ name: 'Test phone', slug: 'test-phone', description: 'Isolated test fixture', taxRateBps: 1800, hsnCode: '8517', returnWindowDays: 7, category: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(), isPublished: true, variants: [{ sku: 'phone', price: 19.99, stock: 5 }, { sku: 'other', price: 200, stock: 100 }] });
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

describe('marketplace checkout allocation', () => {
  it('preserves purchase-time tax and return terms after catalog settings change', async () => {
    const result = await place(checkout({ paymentMethod: 'cod' }));
    expect(result.status).toHaveBeenCalledWith(201);
    await Product.updateOne({ _id: productId }, { taxRateBps: 500, returnWindowDays: 0 });
    const order = (await Order.findById(result.payload().data.orderId))!;
    expect(order.taxStatus).toBe('complete');
    expect(order.items[0]).toMatchObject({ taxRateBps: 1800, hsnCode: '8517', purchaseTerms: { returnWindowDays: 7 } });
    expect(order.taxPaise).toBe(305);
    expect(order.totalPaise).toBe(6899);
  });

  it('distinguishes unconfigured tax from a zero rate without inflating prices', async () => {
    await Product.updateOne({ _id: productId }, { $unset: { taxRateBps: 1 } });
    const result = await place(checkout({ paymentMethod: 'cod' }));
    const order = (await Order.findById(result.payload().data.orderId))!;
    expect(order.taxStatus).toBe('incomplete');
    expect(order.items[0].taxRateBps).toBeUndefined();
    expect(order.taxPaise).toBe(0);
    expect(order.totalPaise).toBe(6899);
  });

  it('allocates mixed product tax rates and preserves cart tax settings', async () => {
    const second = await Product.create({ name: 'Tax fixture', slug: 'tax-fixture', description: 'Test', category: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(), isPublished: true, taxRateBps: 500, variants: [{ sku: 'BOOK', price: 105, stock: 2 }] });
    const result = await place(checkout({ paymentMethod: 'cod', expectedTotal: 173.99, items: [
      { product: productId, variant: 'phone', quantity: 1, expectedPrice: 19.99 },
      { product: String(second._id), variant: 'BOOK', quantity: 1, expectedPrice: 105 },
    ] }));
    expect(result.status).toHaveBeenCalledWith(201);
    const order = (await Order.findById(result.payload().data.orderId))!;
    expect(order.taxPaise).toBe(805);
    expect(order.taxStatus).toBe('complete');
    const cartResponse = response();
    await addToCart(request({ productId, variant: 'phone', quantity: 1 }), cartResponse.res);
    expect(cartResponse.payload().data.items[0].product.taxRateBps).toBe(1800);
  });

  it('creates one parent order with isolated seller groups and inventory reservations', async () => {
    const sellerA = await offerFixture({ suffix: 'a', variant: 'phone', pricePaise: 5_000_000, stock: 1 });
    const sellerB = await offerFixture({ suffix: 'b', variant: 'other', pricePaise: 200_000, stock: 2, fulfillmentMode: 'nexmart' });
    const body = checkout({
      paymentMethod: 'cod',
      expectedTotal: 52_000,
      items: [
        { product: productId, listing: String(sellerA.listing._id), variant: 'phone', quantity: 1, expectedPrice: 50_000 },
        { product: productId, listing: String(sellerB.listing._id), variant: 'other', quantity: 1, expectedPrice: 2_000 },
      ],
    });

    const result = await place(body);
    expect(result.status).toHaveBeenCalledWith(201);
    expect(effects.createPayment).not.toHaveBeenCalled();

    const order = await Order.findById(result.payload().data.orderId);
    expect(order?.items).toHaveLength(2);
    expect(order?.subtotalPaise).toBe(5_200_000);
    // GST is included in the listed price: tax is the contained 18/118 slice,
    // and the total never adds it (audit 2026-09-22 §C2).
    expect(order?.taxPaise).toBe(793_220);
    expect(order?.totalPaise).toBe(5_200_000);
    expect(order?.items.map((item) => String(item.seller))).toEqual([String(sellerA.seller._id), String(sellerB.seller._id)]);
    expect(order?.items.map((item) => item.sellerSku)).toEqual(['SKU-A', 'SKU-B']);
    expect(order?.items.every((item) => item.inventoryState === 'reserved')).toBe(true);

    const groups = await FulfillmentGroup.find({ order: order?._id }).sort('seller');
    expect(groups).toHaveLength(2);
    expect(groups.reduce((sum, group) => sum + group.totalPaise, 0)).toBe(order?.totalPaise);
    expect(new Set(groups.map((group) => String(group.seller)))).toEqual(new Set([String(sellerA.seller._id), String(sellerB.seller._id)]));
    expect(groups.find((group) => String(group.seller) === String(sellerB.seller._id))?.fulfillmentMode).toBe('nexmart');

    const [inventoryA, inventoryB] = await Promise.all([
      SellerInventory.findById(sellerA.inventory._id),
      SellerInventory.findById(sellerB.inventory._id),
    ]);
    expect({ available: inventoryA?.available, reserved: inventoryA?.reserved }).toEqual({ available: 0, reserved: 1 });
    expect({ available: inventoryB?.available, reserved: inventoryB?.reserved }).toEqual({ available: 1, reserved: 1 });
    expect(await InventoryMovement.countDocuments({ reason: 'order_reservation' })).toBe(2);
    expect((await Product.findById(productId))?.variants.map((variant) => variant.stock)).toEqual([5, 100]);
  });

  it('rejects seller-offer price tampering and an inactive seller without reserving stock', async () => {
    const fixture = await offerFixture({ suffix: 'price', variant: 'phone', pricePaise: 10_000, stock: 2 });
    const tampered = await place(checkout({
      paymentMethod: 'cod',
      expectedTotal: 149,
      items: [{ product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 99 }],
    }));
    expect(tampered.status).toHaveBeenCalledWith(409);
    expect(tampered.payload().code).toBe('PRICE_CHANGED');

    await Seller.updateOne({ _id: fixture.seller._id }, { isActive: false });
    const unavailable = await place(checkout({
      paymentMethod: 'cod',
      expectedTotal: 149,
      items: [{ product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 100 }],
    }));
    expect(unavailable.status).toHaveBeenCalledWith(409);
    expect(unavailable.payload().code).toBe('SELLER_UNAVAILABLE');
    expect(await Order.countDocuments()).toBe(0);
    expect((await SellerInventory.findById(fixture.inventory._id))?.available).toBe(2);
  });

  it('allows only one distinct checkout to reserve the final seller unit', async () => {
    const fixture = await offerFixture({ suffix: 'race', variant: 'phone', pricePaise: 10_000, stock: 1 });
    const item = { product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 100 };
    const attempts = await Promise.all([
      place(checkout({ paymentMethod: 'cod', expectedTotal: 149, items: [item] })),
      place(checkout({ paymentMethod: 'cod', expectedTotal: 149, items: [item] })),
    ]);
    expect(attempts.filter((attempt) => attempt.status.mock.calls.some((call) => call[0] === 201))).toHaveLength(1);
    expect(await Order.countDocuments()).toBe(1);
    expect(await FulfillmentGroup.countDocuments()).toBe(1);
    expect((await SellerInventory.findById(fixture.inventory._id))?.toObject()).toMatchObject({ available: 0, reserved: 1 });
    expect(await InventoryMovement.countDocuments({ reason: 'order_reservation' })).toBe(1);
  });

  it('commits seller inventory once when an online payment is captured', async () => {
    const fixture = await offerFixture({ suffix: 'capture', variant: 'phone', pricePaise: 10_000, stock: 2 });
    const placed = await place(checkout({
      expectedTotal: 149,
      items: [{ product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 100 }],
    }));
    const receipt = placed.payload().data;

    await verifyPayment(request(proof(receipt.razorpayOrderId), receipt.orderId), response().res);
    await verifyPayment(request(proof(receipt.razorpayOrderId), receipt.orderId), response().res);

    const [order, inventory] = await Promise.all([
      Order.findById(receipt.orderId),
      SellerInventory.findById(fixture.inventory._id),
    ]);
    expect(order?.paymentStatus).toBe('paid');
    expect(order?.items[0].inventory).toEqual(fixture.inventory._id);
    expect(order?.items[0].inventoryState).toBe('committed');
    expect(inventory?.toObject()).toMatchObject({ available: 1, reserved: 0, committed: 1 });
    expect(await InventoryMovement.countDocuments({ reason: 'shipment_commit' })).toBe(1);
  });

  it('releases a cancelled seller reservation exactly once', async () => {
    const fixture = await offerFixture({ suffix: 'cancel', variant: 'phone', pricePaise: 10_000, stock: 1 });
    const placed = await place(checkout({
      paymentMethod: 'cod',
      expectedTotal: 149,
      items: [{ product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 100 }],
    }));
    const order = await Order.findById(placed.payload().data.orderId);
    expect(order).not.toBeNull();
    order!.orderStatus = 'cancelled';
    await order!.save();

    await restockOrderItems(order!);
    await restockOrderItems(order!);

    const inventory = await SellerInventory.findById(fixture.inventory._id);
    const savedOrder = await Order.findById(order!._id);
    expect(inventory?.toObject()).toMatchObject({ available: 1, reserved: 0, committed: 0 });
    expect(savedOrder?.items[0].inventoryState).toBe('released');
    expect(await InventoryMovement.countDocuments({ reason: 'reservation_release' })).toBe(1);
  });

  it('moves a delivered seller return into inspection stock exactly once', async () => {
    const fixture = await offerFixture({ suffix: 'return', variant: 'phone', pricePaise: 10_000, stock: 1 });
    const placed = await place(checkout({
      expectedTotal: 149,
      items: [{ product: productId, listing: String(fixture.listing._id), variant: 'phone', quantity: 1, expectedPrice: 100 }],
    }));
    const receipt = placed.payload().data;
    await verifyPayment(request(proof(receipt.razorpayOrderId), receipt.orderId), response().res);
    const order = await Order.findById(receipt.orderId);
    expect(order).not.toBeNull();
    order!.orderStatus = 'returned';
    await order!.save();

    await restockOrderItems(order!);
    await restockOrderItems(order!);

    const inventory = await SellerInventory.findById(fixture.inventory._id);
    const savedOrder = await Order.findById(order!._id);
    expect(inventory?.toObject()).toMatchObject({ available: 0, reserved: 0, committed: 0, returned: 1 });
    expect(savedOrder?.items[0].inventoryState).toBe('returned');
    expect(await InventoryMovement.countDocuments({ reason: 'return_received' })).toBe(1);
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
