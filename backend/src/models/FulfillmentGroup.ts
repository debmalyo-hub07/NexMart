import mongoose, { Document, Schema, Types } from 'mongoose';

export const FULFILLMENT_GROUP_STATUSES = [
  'placed',
  'confirmed',
  'processing',
  'ready_for_pickup',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type FulfillmentGroupStatus = typeof FULFILLMENT_GROUP_STATUSES[number];

export interface IFulfillmentGroupItem {
  orderItemId: Types.ObjectId;
  listing?: Types.ObjectId;
  sellerSku?: string;
  product: Types.ObjectId;
  variant: string;
  name: string;
  image?: string;
  quantity: number;
  unitPricePaise: number;
  merchandisePaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  sellerPayableBasisPaise: number;
  /** Immutable purchase-time economics. It is optional for pre-marketplace
   * records created before fee snapshots were introduced. */
  feeSnapshot?: IFeeSnapshot;
}

export interface IFeeSnapshot {
  ruleId: string;
  ruleKey: string;
  ruleVersion: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  requiresProfessionalReview: boolean;
  merchandisePaise: number;
  discountPaise: number;
  adjustedMerchandisePaise: number;
  shippingPaise: number;
  taxPaise: number;
  customerChargePaise: number;
  commissionPaise: number;
  fixedFeePaise: number;
  paymentCollectionFeePaise: number;
  shippingCostPaise: number;
  otherFeePaise: number;
  platformRevenuePaise: number;
  sellerPayableBeforeHoldPaise: number;
  reservePaise: number;
  sellerPayableAfterHoldPaise: number;
}

export interface IFulfillmentGroup extends Document {
  groupId: string;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  seller: Types.ObjectId;
  fulfillmentMode: 'seller' | 'nexmart';
  items: IFulfillmentGroupItem[];
  shippingAddress: Record<string, unknown>;
  status: FulfillmentGroupStatus;
  statusHistory: { status: FulfillmentGroupStatus; timestamp: Date; updatedBy?: Types.ObjectId; note?: string }[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  shipment?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GroupItemSchema = new Schema<IFulfillmentGroupItem>(
  {
    orderItemId: { type: Schema.Types.ObjectId, required: true },
    listing: { type: Schema.Types.ObjectId, ref: 'SellerListing' },
    sellerSku: { type: String, trim: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: String, required: true },
    name: { type: String, required: true },
    image: String,
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPricePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    merchandisePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    discountPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shippingPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    taxPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    sellerPayableBasisPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    feeSnapshot: {
      ruleId: { type: String, required: true, immutable: true, maxlength: 120 },
      ruleKey: { type: String, required: true, immutable: true, maxlength: 120 },
      ruleVersion: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      effectiveFrom: { type: Date, required: true, immutable: true },
      effectiveTo: { type: Date, immutable: true },
      requiresProfessionalReview: { type: Boolean, required: true, immutable: true },
      merchandisePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      discountPaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      adjustedMerchandisePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      shippingPaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      taxPaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      customerChargePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      commissionPaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      fixedFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      paymentCollectionFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      shippingCostPaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      otherFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      platformRevenuePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      sellerPayableBeforeHoldPaise: { type: Number, required: true, validate: Number.isInteger, immutable: true },
      reservePaise: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
      sellerPayableAfterHoldPaise: { type: Number, required: true, validate: Number.isInteger, immutable: true },
    },
  },
  { _id: false },
);

const StatusHistorySchema = new Schema(
  {
    status: { type: String, enum: FULFILLMENT_GROUP_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const FulfillmentGroupSchema = new Schema<IFulfillmentGroup>(
  {
    groupId: { type: String, required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    fulfillmentMode: { type: String, enum: ['seller', 'nexmart'], required: true },
    items: { type: [GroupItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
    shippingAddress: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: FULFILLMENT_GROUP_STATUSES, default: 'placed', index: true },
    statusHistory: { type: [StatusHistorySchema], default: [] },
    subtotalPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    discountPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shippingPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    taxPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    totalPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shipment: { type: Schema.Types.ObjectId, ref: 'Shipment' },
  },
  { timestamps: true, optimisticConcurrency: true, toJSON: { virtuals: true } },
);

FulfillmentGroupSchema.index({ order: 1, seller: 1, fulfillmentMode: 1 }, { unique: true });
FulfillmentGroupSchema.index({ seller: 1, createdAt: -1 });
FulfillmentGroupSchema.index({ seller: 1, status: 1, createdAt: -1 });

export const FulfillmentGroup = mongoose.model<IFulfillmentGroup>('FulfillmentGroup', FulfillmentGroupSchema);
