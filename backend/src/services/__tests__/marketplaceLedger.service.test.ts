import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { FulfillmentGroup } from '../../models/FulfillmentGroup';
import { MarketplaceLedgerEntry } from '../../models/MarketplaceLedgerEntry';
import { Order } from '../../models/Order';
import { recordFullRefundLedger, recordPaymentCaptureLedger } from '../marketplaceLedger.service';

describe('marketplace ledger', () => {
  let database: MongoMemoryReplSet;
  let orderId: mongoose.Types.ObjectId;
  let sellerId: mongoose.Types.ObjectId;
  let groupId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
    await mongoose.connect(database.getUri(), { dbName: 'nexmart_ledger_tests' });
    await Promise.all([Order.init(), FulfillmentGroup.init(), MarketplaceLedgerEntry.init()]);
  }, 120_000);
  beforeEach(async () => {
    await Promise.all([Order.deleteMany({}), FulfillmentGroup.deleteMany({}), MarketplaceLedgerEntry.deleteMany({})]);
    orderId = new mongoose.Types.ObjectId();
    sellerId = new mongoose.Types.ObjectId();
    groupId = new mongoose.Types.ObjectId();
    await Order.create({
      _id: orderId,
      orderId: 'ORD-LEDGER-1',
      customer: new mongoose.Types.ObjectId(),
      items: [],
      shippingAddress: { fullName: 'Ledger Buyer', phone: '9876543210', addressLine1: '1 Test Road', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' },
      paymentMethod: 'online', paymentStatus: 'pending', orderStatus: 'placed',
      subtotal: 2_000, shippingFee: 49, tax: 369, total: 2_418,
      subtotalPaise: 200_000, shippingFeePaise: 4_900, taxPaise: 36_900, totalPaise: 241_800,
    });
    await FulfillmentGroup.create({
      _id: groupId,
      groupId: 'FG-LEDGER-1', order: orderId, customer: new mongoose.Types.ObjectId(), seller: sellerId,
      fulfillmentMode: 'seller', status: 'placed', shippingAddress: { city: 'Kolkata' },
      subtotalPaise: 200_000, discountPaise: 0, shippingPaise: 4_900, taxPaise: 36_900, totalPaise: 241_800,
      items: [{
        orderItemId: new mongoose.Types.ObjectId(), product: new mongoose.Types.ObjectId(), variant: 'sku', name: 'Phone', quantity: 1,
        unitPricePaise: 200_000, merchandisePaise: 200_000, discountPaise: 0, shippingPaise: 4_900, taxPaise: 36_900, sellerPayableBasisPaise: 200_000,
        feeSnapshot: {
          ruleId: 'rule-v1', ruleKey: 'default', ruleVersion: 1, effectiveFrom: new Date(), requiresProfessionalReview: false,
          merchandisePaise: 200_000, discountPaise: 0, adjustedMerchandisePaise: 200_000, shippingPaise: 4_900, taxPaise: 36_900, customerChargePaise: 241_800,
          commissionPaise: 10_000, fixedFeePaise: 500, paymentCollectionFeePaise: 2_418, shippingCostPaise: 1_000, otherFeePaise: 0,
          platformRevenuePaise: 10_500, sellerPayableBeforeHoldPaise: 190_982, reservePaise: 19_098, sellerPayableAfterHoldPaise: 171_884,
        },
      }],
    });
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await database.stop(); });

  it('writes a balanced capture and treats a duplicate as a no-op', async () => {
    const first = await recordPaymentCaptureLedger({ _id: orderId, total: 2_418, totalPaise: 241_800 }, 'pay_ledger');
    const second = await recordPaymentCaptureLedger({ _id: orderId, total: 2_418, totalPaise: 241_800 }, 'pay_ledger');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const entries = await MarketplaceLedgerEntry.find({ order: orderId }).lean();
    expect(entries.length).toBeGreaterThan(2);
    expect(entries.reduce((sum, entry) => sum + (entry.direction === 'debit' ? entry.amountPaise : -entry.amountPaise), 0)).toBe(0);
    expect(await MarketplaceLedgerEntry.countDocuments({ eventType: 'payment_captured' })).toBe(entries.length);
  });

  it('reverses every capture entry exactly once for a full refund', async () => {
    await recordPaymentCaptureLedger({ _id: orderId, total: 2_418, totalPaise: 241_800 }, 'pay_ledger');
    const first = await recordFullRefundLedger({ _id: orderId, total: 2_418, totalPaise: 241_800, razorpayPaymentId: 'pay_ledger' }, 'rfnd_ledger');
    const second = await recordFullRefundLedger({ _id: orderId, total: 2_418, totalPaise: 241_800, razorpayPaymentId: 'pay_ledger' }, 'rfnd_ledger');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const refunds = await MarketplaceLedgerEntry.find({ order: orderId, eventType: 'refund' }).lean();
    expect(refunds.reduce((sum, entry) => sum + (entry.direction === 'debit' ? entry.amountPaise : -entry.amountPaise), 0)).toBe(0);
    expect(refunds.length).toBe((await MarketplaceLedgerEntry.countDocuments({ eventType: 'payment_captured' })));
  });
});
