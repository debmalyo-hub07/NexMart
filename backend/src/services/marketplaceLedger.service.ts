import mongoose, { ClientSession, Types } from 'mongoose';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { MarketplaceLedgerEntry, type LedgerAccount, type LedgerDirection, type LedgerEventType, type LedgerSource, type IMarketplaceLedgerEntry } from '../models/MarketplaceLedgerEntry';

interface LedgerDraft {
  account: LedgerAccount;
  direction: LedgerDirection;
  amountPaise: number;
  seller?: Types.ObjectId;
  fulfillmentGroup?: Types.ObjectId;
  reason: string;
  metadata?: Record<string, unknown>;
}

interface LedgerEventContext {
  eventId: string;
  eventType: LedgerEventType;
  order: Types.ObjectId | string;
  paymentId?: string;
  transferId?: string;
  source: LedgerSource;
  actorId?: Types.ObjectId | string;
  correlationId?: string;
  effectiveAt?: Date;
}

function asObjectId(value: Types.ObjectId | string): Types.ObjectId {
  if (value instanceof Types.ObjectId) return value;
  if (!mongoose.isValidObjectId(value)) throw new Error('A valid order reference is required for a ledger event.');
  return new Types.ObjectId(value);
}

function optionalObjectId(value?: Types.ObjectId | string): Types.ObjectId | undefined {
  if (!value) return undefined;
  return mongoose.isValidObjectId(value) ? asObjectId(value) : undefined;
}

function addDraft(drafts: LedgerDraft[], draft: LedgerDraft): void {
  if (!Number.isSafeInteger(draft.amountPaise) || draft.amountPaise < 0) {
    throw new Error('Ledger amounts must be non-negative safe integers.');
  }
  if (draft.amountPaise > 0) drafts.push(draft);
}

function signedAmount(entry: { direction: LedgerDirection; amountPaise: number }): number {
  return entry.direction === 'debit' ? entry.amountPaise : -entry.amountPaise;
}

function assertBalanced(drafts: LedgerDraft[]): void {
  const balance = drafts.reduce((sum, draft) => sum + signedAmount(draft), 0);
  if (balance !== 0) throw new Error(`Unbalanced marketplace ledger event (${balance} paise).`);
}

function sameEntry(left: IMarketplaceLedgerEntry, right: LedgerDraft): boolean {
  return left.account === right.account
    && left.direction === right.direction
    && left.amountPaise === right.amountPaise
    && String(left.seller || '') === String(right.seller || '')
    && String(left.fulfillmentGroup || '') === String(right.fulfillmentGroup || '');
}

/** Append an event atomically. Replaying the same idempotency keys is a no-op;
 * reusing a key with different money is rejected instead of silently merging. */
export async function appendLedgerEvent(
  context: LedgerEventContext,
  drafts: LedgerDraft[],
  session?: ClientSession,
): Promise<{ created: boolean; entries: IMarketplaceLedgerEntry[] }> {
  if (drafts.length === 0) throw new Error('A ledger event must contain at least one entry.');
  assertBalanced(drafts);
  const order = asObjectId(context.order);
  const effectiveAt = context.effectiveAt || new Date();
  const actorId = optionalObjectId(context.actorId);
  const documents = drafts.map((draft, index) => ({
    ledgerId: `${context.eventId}:${index}`.slice(0, 180),
    eventId: context.eventId,
    idempotencyKey: `${context.eventId}:${index}`.slice(0, 180),
    order,
    seller: draft.seller,
    fulfillmentGroup: draft.fulfillmentGroup,
    paymentId: context.paymentId,
    transferId: context.transferId,
    eventType: context.eventType,
    account: draft.account,
    direction: draft.direction,
    amountPaise: draft.amountPaise,
    currency: 'INR' as const,
    reason: draft.reason,
    source: context.source,
    actorId,
    correlationId: context.correlationId,
    effectiveAt,
    metadata: draft.metadata,
  }));
  const keys = documents.map((document) => document.idempotencyKey);
  const existingQuery = MarketplaceLedgerEntry.find({ idempotencyKey: { $in: keys } });
  if (session) existingQuery.session(session);
  const existing = await existingQuery.lean();
  if (existing.length > 0) {
    if (existing.length !== documents.length || existing.some((entry) => {
      const expected = documents.find((document) => document.idempotencyKey === entry.idempotencyKey);
      return !expected || !sameEntry(entry as unknown as IMarketplaceLedgerEntry, expected);
    })) {
      throw new Error(`Ledger idempotency conflict for event ${context.eventId}.`);
    }
    return { created: false, entries: existing as unknown as IMarketplaceLedgerEntry[] };
  }

  try {
    const options = session ? { session, ordered: true } : { ordered: true };
    const inserted = await MarketplaceLedgerEntry.create(documents, options);
    return { created: true, entries: inserted };
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const retryQuery = MarketplaceLedgerEntry.find({ idempotencyKey: { $in: keys } });
    if (session) retryQuery.session(session);
    const retry = await retryQuery.lean();
    if (retry.length === documents.length && retry.every((entry) => {
      const expected = documents.find((document) => document.idempotencyKey === entry.idempotencyKey);
      return expected && sameEntry(entry as unknown as IMarketplaceLedgerEntry, expected);
    })) return { created: false, entries: retry as unknown as IMarketplaceLedgerEntry[] };
    throw error;
  }
}

interface CaptureOrder {
  _id: Types.ObjectId | string;
  totalPaise?: number;
  total: number;
}

/** COD is collected at delivery, but it still enters the same immutable
 * allocation model as an online capture. The deterministic payment key makes
 * repeated delivery callbacks a no-op. */
export function recordCodCaptureLedger(
  order: CaptureOrder,
  source: LedgerSource = 'system',
  session?: ClientSession,
  correlationId?: string,
): Promise<{ created: boolean; entries: IMarketplaceLedgerEntry[] }> {
  return recordPaymentCaptureLedger(order, `cod:${String(order._id)}`, source, session, correlationId);
}

interface GroupMoney {
  sellerPayableAfterHoldPaise: number;
  reservePaise: number;
  platformRevenuePaise: number;
  taxPaise: number;
  paymentCollectionFeePaise: number;
  shippingCostPaise: number;
}

function groupMoney(group: any): GroupMoney {
  const items = Array.isArray(group.items) ? group.items : [];
  const snapshots = items.map((item: any) => item.feeSnapshot).filter(Boolean);
  if (snapshots.length === items.length && snapshots.length > 0) {
    return snapshots.reduce((sum: GroupMoney, snapshot: any) => ({
      sellerPayableAfterHoldPaise: sum.sellerPayableAfterHoldPaise + (snapshot.sellerPayableAfterHoldPaise || 0),
      reservePaise: sum.reservePaise + (snapshot.reservePaise || 0),
      platformRevenuePaise: sum.platformRevenuePaise + (snapshot.platformRevenuePaise || 0),
      taxPaise: sum.taxPaise + (snapshot.taxPaise || 0),
      paymentCollectionFeePaise: sum.paymentCollectionFeePaise + (snapshot.paymentCollectionFeePaise || 0),
      shippingCostPaise: sum.shippingCostPaise + (snapshot.shippingCostPaise || 0),
    }), {
      sellerPayableAfterHoldPaise: 0,
      reservePaise: 0,
      platformRevenuePaise: 0,
      taxPaise: 0,
      paymentCollectionFeePaise: 0,
      shippingCostPaise: 0,
    });
  }

  // Compatibility for groups created before fee snapshots existed. Their
  // seller payable is intentionally a basis, with no inferred platform fee.
  const adjusted = Math.max(0, (group.subtotalPaise || 0) - (group.discountPaise || 0));
  return {
    sellerPayableAfterHoldPaise: adjusted + (group.shippingPaise || 0),
    reservePaise: 0,
    platformRevenuePaise: 0,
    taxPaise: group.taxPaise || 0,
    paymentCollectionFeePaise: 0,
    shippingCostPaise: 0,
  };
}

function addSellerMoney(drafts: LedgerDraft[], group: any, money: GroupMoney): void {
  const seller = asObjectId(group.seller);
  if (money.sellerPayableAfterHoldPaise >= 0) {
    addDraft(drafts, { account: 'seller_payable', direction: 'credit', amountPaise: money.sellerPayableAfterHoldPaise, seller, fulfillmentGroup: group._id, reason: 'Seller payable created from captured customer payment' });
  } else {
    addDraft(drafts, { account: 'seller_receivable', direction: 'debit', amountPaise: Math.abs(money.sellerPayableAfterHoldPaise), seller, fulfillmentGroup: group._id, reason: 'Seller balance became negative after captured customer payment' });
  }
  addDraft(drafts, { account: 'seller_reserve', direction: 'credit', amountPaise: money.reservePaise, seller, fulfillmentGroup: group._id, reason: 'Seller reserve held under the purchase-time fee rule' });
  addDraft(drafts, { account: 'platform_revenue', direction: 'credit', amountPaise: money.platformRevenuePaise, seller, fulfillmentGroup: group._id, reason: 'Configured marketplace fees' });
  addDraft(drafts, { account: 'tax_payable', direction: 'credit', amountPaise: money.taxPaise, seller, fulfillmentGroup: group._id, reason: 'Customer tax pass-through' });
  // These amounts are withheld from the seller allocation and remain payable
  // to the processor/carrier. They are credits in the capture allocation;
  // recording them as debits while also subtracting them from seller payable
  // would manufacture an unallocated balancing remainder.
  addDraft(drafts, { account: 'payment_cost', direction: 'credit', amountPaise: money.paymentCollectionFeePaise, seller, fulfillmentGroup: group._id, reason: 'Payment collection cost withheld for provider settlement' });
  addDraft(drafts, { account: 'shipping_cost', direction: 'credit', amountPaise: money.shippingCostPaise, seller, fulfillmentGroup: group._id, reason: 'Shipping or logistics cost withheld for carrier settlement' });
}

/** Create the balanced capture event after an order becomes paid. */
export async function recordPaymentCaptureLedger(
  order: CaptureOrder,
  paymentId: string,
  source: LedgerSource = 'payment_verify',
  session?: ClientSession,
  correlationId?: string,
): Promise<{ created: boolean; entries: IMarketplaceLedgerEntry[] }> {
  const orderId = asObjectId(order._id);
  const totalPaise = order.totalPaise ?? Math.round(order.total * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) throw new Error('A paid order must have a positive integer total.');
  const groupQuery = FulfillmentGroup.find({ order: orderId }).lean();
  if (session) groupQuery.session(session);
  const groups = await groupQuery;
  const drafts: LedgerDraft[] = [];
  addDraft(drafts, { account: 'payment_clearing', direction: 'debit', amountPaise: totalPaise, reason: 'Customer payment captured' });

  let groupedTotal = 0;
  for (const group of groups) {
    const groupTotal = group.totalPaise || 0;
    groupedTotal += groupTotal;
    const money = groupMoney(group);
    addSellerMoney(drafts, group, money);
    const calculated = money.sellerPayableAfterHoldPaise + money.reservePaise + money.platformRevenuePaise + money.taxPaise
      + money.paymentCollectionFeePaise + money.shippingCostPaise;
    const difference = groupTotal - calculated;
    if (difference > 0) addDraft(drafts, { account: 'unallocated_order_value', direction: 'credit', amountPaise: difference, fulfillmentGroup: group._id, reason: 'Purchase-time group allocation remainder', metadata: { groupTotal, calculated } });
    if (difference < 0) addDraft(drafts, { account: 'unallocated_order_value', direction: 'debit', amountPaise: Math.abs(difference), fulfillmentGroup: group._id, reason: 'Purchase-time group allocation correction', metadata: { groupTotal, calculated } });
  }
  const residual = totalPaise - groupedTotal;
  if (residual > 0) addDraft(drafts, { account: 'unallocated_order_value', direction: 'credit', amountPaise: residual, reason: 'Legacy or unmapped order value retained outside seller settlement' });
  if (residual < 0) addDraft(drafts, { account: 'unallocated_order_value', direction: 'debit', amountPaise: Math.abs(residual), reason: 'Order/group allocation correction' });

  return appendLedgerEvent({
    eventId: `payment-captured:${orderId.toString()}:${paymentId}`,
    eventType: 'payment_captured',
    order: orderId,
    paymentId,
    source,
    correlationId,
  }, drafts, session);
}

/** Reverse a complete captured payment. Partial refunds need an explicit
 * allocation policy and are rejected until that policy is configured. */
export async function recordFullRefundLedger(
  order: CaptureOrder & { razorpayPaymentId?: string },
  refundId: string,
  source: LedgerSource = 'admin',
  session?: ClientSession,
  correlationId?: string,
): Promise<{ created: boolean; entries: IMarketplaceLedgerEntry[] }> {
  const orderId = asObjectId(order._id);
  const paymentId = order.razorpayPaymentId;
  if (!paymentId) throw new Error('Cannot reverse a payment without its provider payment ID.');
  const originalEventId = `payment-captured:${orderId.toString()}:${paymentId}`;
  const originalQuery = MarketplaceLedgerEntry.find({ eventId: originalEventId }).sort('createdAt');
  if (session) originalQuery.session(session);
  const originals = await originalQuery.lean();
  const totalPaise = order.totalPaise ?? Math.round(order.total * 100);
  if (originals.length === 0) {
    const fallback: LedgerDraft[] = [];
    addDraft(fallback, { account: 'payment_clearing', direction: 'credit', amountPaise: totalPaise, reason: 'Captured payment reversed by full refund' });
    addDraft(fallback, { account: 'unallocated_order_value', direction: 'debit', amountPaise: totalPaise, reason: 'Refund reversal for an order without a prior ledger snapshot' });
    return appendLedgerEvent({ eventId: `refund:${orderId.toString()}:${refundId}`, eventType: 'refund', order: orderId, paymentId, source, correlationId }, fallback, session);
  }

  const drafts = originals.map((entry) => ({
    account: entry.account as LedgerAccount,
    direction: entry.direction === 'debit' ? 'credit' as const : 'debit' as const,
    amountPaise: entry.amountPaise,
    seller: entry.seller,
    fulfillmentGroup: entry.fulfillmentGroup,
    reason: `Full refund reversal of ledger entry ${entry.ledgerId}`,
    metadata: { reversedLedgerId: entry.ledgerId },
  }));
  return appendLedgerEvent({ eventId: `refund:${orderId.toString()}:${refundId}`, eventType: 'refund', order: orderId, paymentId, source, correlationId }, drafts, session);
}
