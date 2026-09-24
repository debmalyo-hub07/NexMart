import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
const provider = vi.hoisted(() => ({ create: vi.fn(), find: vi.fn(), fetch: vi.fn(), email: vi.fn() }));
vi.mock('../../services/razorpay.service', () => ({ refundPayment: provider.create, findRefundByReceipt: provider.find, fetchRefund: provider.fetch }));
vi.mock('../../services/email.service', () => ({ sendOrderStatusEmail: provider.email }));
vi.mock('../../config/socket', () => ({ emitOrderStatusUpdate: vi.fn() }));
import { Order } from '../../models/Order';
import { Customer } from '../../models/Customer';
import { RefundAttempt } from '../../models/RefundAttempt';
import { MarketplaceLedgerEntry } from '../../models/MarketplaceLedgerEntry';
import { requestFullRefund, reconcileRefundEvent } from '../../services/refund.service';
import * as ledger from '../../services/marketplaceLedger.service';
import { startReplicaTestDb, stopTestDb, clearCollections } from '../../test/helpers';

beforeAll(async () => {
  await startReplicaTestDb('nexmart_refund_lifecycle');
  await Promise.all([Order.init(), RefundAttempt.init(), MarketplaceLedgerEntry.init()]);
}, 120000);
afterAll(stopTestDb);
beforeEach(async () => {
  vi.restoreAllMocks(); vi.clearAllMocks(); await clearCollections();
  provider.find.mockResolvedValue(undefined);
  provider.create.mockResolvedValue(remote('created'));
  provider.fetch.mockResolvedValue(remote('processed'));
  provider.email.mockResolvedValue(undefined);
});
function remote(status: string) { return { id: 'rfnd_test', status, amount: 10000, payment_id: 'pay_test', currency: 'INR' }; }
async function paidOrder() {
  const customer = await Customer.create({ name: 'Refund Customer', email: 'refund@example.test', emailVerified: true });
  return Order.create({
    orderId: 'ORD-REFUND', customer: customer._id, items: [{ product: new mongoose.Types.ObjectId(), variant: 'TEST', quantity: 1, unitPrice: 100, totalPrice: 100 }],
    shippingAddress: { fullName: 'Test Customer', phone: '9876543210', addressLine1: '12 Test Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    paymentMethod: 'online', paymentStatus: 'paid', razorpayPaymentId: 'pay_test', orderStatus: 'delivered',
    subtotal: 100, total: 100, totalPaise: 10000, statusHistory: [],
  });
}
describe('full refund lifecycle and durable idempotency', () => {
  it('keeps a created refund pending, with no reversal or completion email', async () => {
    const order = await paidOrder();
    const result = await requestFullRefund(String(order._id));
    expect(result.refundStatus).toBe('pending');
    expect((await Order.findById(order._id))?.paymentStatus).toBe('paid');
    expect(await MarketplaceLedgerEntry.countDocuments({ eventType: 'refund' })).toBe(0);
    expect(provider.email).not.toHaveBeenCalled();
    expect(provider.create).toHaveBeenCalledWith('pay_test', 10000, `nm_rf_${order._id}`);
  });
  it('handles concurrent clicks with a single provider request', async () => {
    const order = await paidOrder();
    await Promise.all([requestFullRefund(String(order._id)), requestFullRefund(String(order._id))]);
    expect(provider.create).toHaveBeenCalledTimes(1);
    expect(await RefundAttempt.countDocuments()).toBe(1);
  });
  it('recovers an ambiguous provider timeout by receipt without resending money', async () => {
    const order = await paidOrder();
    provider.create.mockRejectedValueOnce(new Error('Connection lost after provider accepted request'));
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('needs_review');
    provider.find.mockResolvedValue(remote('processed'));
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('processed');
    expect(provider.create).toHaveBeenCalledTimes(1);
    expect((await Order.findById(order._id))?.paymentStatus).toBe('refunded');
  });
  it('commits payment status and balanced reversal once while preserving fulfillment', async () => {
    const order = await paidOrder();
    provider.create.mockResolvedValue(remote('processed'));
    await requestFullRefund(String(order._id));
    await reconcileRefundEvent('rfnd_test');
    await requestFullRefund(String(order._id));
    const updated = await Order.findById(order._id);
    expect(updated?.orderStatus).toBe('delivered');
    expect(updated?.paymentStatus).toBe('refunded');
    expect(updated?.statusHistory).toHaveLength(1);
    const entries = await MarketplaceLedgerEntry.find({ eventType: 'refund' });
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, e) => sum + (e.direction === 'debit' ? e.amountPaise : -e.amountPaise), 0)).toBe(0);
    await vi.waitFor(() => expect(provider.email).toHaveBeenCalledWith('refund@example.test', 'Refund Customer', 'ORD-REFUND', 'refunded'));
    expect(provider.create).toHaveBeenCalledTimes(1);
  });
  it('does not report completion if the reversal transaction fails', async () => {
    const order = await paidOrder();
    provider.create.mockResolvedValue(remote('processed'));
    vi.spyOn(ledger, 'recordFullRefundLedger').mockRejectedValueOnce(new Error('Ledger write failed'));
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('needs_review');
    expect((await Order.findById(order._id))?.paymentStatus).toBe('paid');
    expect(await MarketplaceLedgerEntry.countDocuments()).toBe(0);
    provider.find.mockResolvedValue(remote('processed'));
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('processed');
    expect(provider.create).toHaveBeenCalledTimes(1);
  });
  it('rejects a mismatched amount and a COD refund without changing money', async () => {
    const order = await paidOrder();
    provider.create.mockResolvedValue({ ...remote('processed'), amount: 1 });
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('needs_review');
    expect((await Order.findById(order._id))?.paymentStatus).toBe('paid');
    await Order.updateOne({ _id: order._id }, { paymentMethod: 'cod' });
    await expect(requestFullRefund(String(order._id))).rejects.toThrow('Cash-on-delivery');
    expect(provider.create).toHaveBeenCalledTimes(1);
  });
  it('keeps provider failures visible and never creates a fresh attempt automatically', async () => {
    const order = await paidOrder();
    provider.create.mockResolvedValue(remote('failed'));
    expect((await requestFullRefund(String(order._id))).refundStatus).toBe('failed');
    await requestFullRefund(String(order._id));
    expect(provider.create).toHaveBeenCalledTimes(1);
    expect((await Order.findById(order._id))?.paymentStatus).toBe('paid');
  });
});
