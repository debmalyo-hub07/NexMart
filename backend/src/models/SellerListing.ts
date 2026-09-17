import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A listing is the seller's commercial offer for a canonical Product. Product
 * identity, specifications and brand stay on Product; price, seller SKU,
 * handling and policy belong here.
 */
export const LISTING_LIFECYCLE_STATES = [
  'draft',
  'submitted',
  'moderation',
  'approved',
  'published',
  'rejected',
  'paused',
  'suspended',
  'blocked',
] as const;

export type ListingLifecycleState = typeof LISTING_LIFECYCLE_STATES[number];
export type ListingCondition = 'new' | 'used' | 'refurbished';
export type ListingFulfillmentMode = 'seller' | 'nexmart';

export interface ISellerListing extends Document {
  seller: Types.ObjectId;
  canonicalProduct: Types.ObjectId;
  canonicalVariantSku?: string;
  sellerSku: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  condition: ListingCondition;
  handlingTimeDays: number;
  fulfillmentMode: ListingFulfillmentMode;
  returnWindowDays: number;
  warrantyText?: string;
  metadata: Map<string, string>;
  status: ListingLifecycleState;
  inventory?: Types.ObjectId;
  moderationReason?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  publishedAt?: Date;
  pausedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SellerListingSchema = new Schema<ISellerListing>(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    canonicalProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    canonicalVariantSku: { type: String, trim: true, maxlength: 120 },
    sellerSku: { type: String, required: true, trim: true, uppercase: true, maxlength: 120 },
    pricePaise: { type: Number, required: true, min: 1, validate: Number.isInteger },
    compareAtPricePaise: { type: Number, min: 1, validate: Number.isInteger },
    condition: { type: String, enum: ['new', 'used', 'refurbished'], default: 'new' },
    handlingTimeDays: { type: Number, min: 0, max: 30, default: 2, validate: Number.isInteger },
    fulfillmentMode: { type: String, enum: ['seller', 'nexmart'], default: 'seller' },
    returnWindowDays: { type: Number, min: 0, max: 90, default: 7, validate: Number.isInteger },
    warrantyText: { type: String, trim: true, maxlength: 500 },
    metadata: { type: Map, of: String, default: {} },
    status: { type: String, enum: LISTING_LIFECYCLE_STATES, default: 'draft', index: true },
    inventory: { type: Schema.Types.ObjectId, ref: 'SellerInventory', unique: true, sparse: true },
    moderationReason: { type: String, trim: true, maxlength: 1000 },
    submittedAt: Date,
    approvedAt: Date,
    publishedAt: Date,
    pausedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true, toJSON: { virtuals: true } },
);

SellerListingSchema.index({ seller: 1, status: 1, createdAt: -1 });
SellerListingSchema.index({ canonicalProduct: 1, status: 1, pricePaise: 1 });
SellerListingSchema.index({ seller: 1, sellerSku: 1 }, { unique: true });

SellerListingSchema.pre('validate', function (next) {
  if (this.compareAtPricePaise !== undefined && this.compareAtPricePaise < this.pricePaise) {
    this.invalidate('compareAtPricePaise', 'Compare-at price must be at least the selling price');
  }
  next();
});

export const SellerListing = mongoose.model<ISellerListing>('SellerListing', SellerListingSchema);
