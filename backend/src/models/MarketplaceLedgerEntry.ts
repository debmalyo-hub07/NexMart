import mongoose, { Document, Schema, Types } from 'mongoose';

export const LEDGER_EVENT_TYPES = [
  'payment_captured',
  'payment_failed',
  'refund',
  'chargeback',
  'transfer_initiated',
  'transfer_settled',
  'transfer_reversed',
  'settlement_hold',
  'settlement_release',
  'adjustment',
] as const;
export type LedgerEventType = typeof LEDGER_EVENT_TYPES[number];

export const LEDGER_ACCOUNTS = [
  'payment_clearing',
  'seller_payable',
  'seller_reserve',
  'seller_receivable',
  'platform_revenue',
  'tax_payable',
  'payment_cost',
  'shipping_cost',
  'unallocated_order_value',
] as const;
export type LedgerAccount = typeof LEDGER_ACCOUNTS[number];

export type LedgerDirection = 'debit' | 'credit';
export type LedgerSource = 'checkout' | 'payment_verify' | 'payment_webhook' | 'reconciliation' | 'admin' | 'system' | 'provider_webhook';

export interface IMarketplaceLedgerEntry extends Document {
  ledgerId: string;
  eventId: string;
  idempotencyKey: string;
  order: Types.ObjectId;
  seller?: Types.ObjectId;
  fulfillmentGroup?: Types.ObjectId;
  paymentId?: string;
  transferId?: string;
  eventType: LedgerEventType;
  account: LedgerAccount;
  direction: LedgerDirection;
  amountPaise: number;
  currency: 'INR';
  reason: string;
  source: LedgerSource;
  actorId?: Types.ObjectId;
  correlationId?: string;
  effectiveAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const MarketplaceLedgerEntrySchema = new Schema<IMarketplaceLedgerEntry>(
  {
    ledgerId: { type: String, required: true, unique: true, immutable: true, maxlength: 180 },
    eventId: { type: String, required: true, immutable: true, index: true, maxlength: 180 },
    idempotencyKey: { type: String, required: true, unique: true, immutable: true, maxlength: 180 },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', immutable: true, index: true },
    fulfillmentGroup: { type: Schema.Types.ObjectId, ref: 'FulfillmentGroup', immutable: true, index: true },
    paymentId: { type: String, immutable: true, index: true },
    transferId: { type: String, immutable: true, index: true },
    eventType: { type: String, enum: LEDGER_EVENT_TYPES, required: true, immutable: true, index: true },
    account: { type: String, enum: LEDGER_ACCOUNTS, required: true, immutable: true, index: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true, immutable: true },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
    currency: { type: String, enum: ['INR'], default: 'INR', immutable: true },
    reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    source: { type: String, enum: ['checkout', 'payment_verify', 'payment_webhook', 'reconciliation', 'admin', 'system', 'provider_webhook'], required: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, immutable: true },
    correlationId: { type: String, immutable: true, index: true, maxlength: 180 },
    effectiveAt: { type: Date, required: true, immutable: true },
    metadata: { type: Schema.Types.Mixed, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

MarketplaceLedgerEntrySchema.index({ order: 1, createdAt: 1 });
MarketplaceLedgerEntrySchema.index({ seller: 1, createdAt: 1 });
MarketplaceLedgerEntrySchema.index({ eventId: 1, account: 1 });

export const MarketplaceLedgerEntry = mongoose.model<IMarketplaceLedgerEntry>('MarketplaceLedgerEntry', MarketplaceLedgerEntrySchema);
