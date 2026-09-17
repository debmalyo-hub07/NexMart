import mongoose, { Document, Schema, Types } from 'mongoose';

export const FEE_RULE_STATUSES = ['draft', 'active', 'retired'] as const;
export type FeeRuleStatus = typeof FEE_RULE_STATUSES[number];

export interface IPaymentCollectionFeeRule {
  onlineBps: number;
  onlineFixedPaise: number;
  codBps: number;
  codFixedPaise: number;
}

export interface IMarketplaceFeeRule extends Document {
  ruleId: string;
  ruleKey: string;
  version: number;
  status: FeeRuleStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  category?: Types.ObjectId;
  fulfillmentMode?: 'seller' | 'nexmart';
  commissionBps: number;
  fixedFeePaise: number;
  shippingCostPaise: number;
  otherFeePaise: number;
  reserveBps: number;
  paymentCollection: IPaymentCollectionFeeRule;
  returnFeePaise: number;
  requiresProfessionalReview: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentCollectionSchema = new Schema<IPaymentCollectionFeeRule>(
  {
    onlineBps: { type: Number, required: true, min: 0, max: 10000, validate: Number.isInteger },
    onlineFixedPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    codBps: { type: Number, required: true, min: 0, max: 10000, validate: Number.isInteger },
    codFixedPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

const MarketplaceFeeRuleSchema = new Schema<IMarketplaceFeeRule>(
  {
    ruleId: { type: String, required: true, unique: true, immutable: true, trim: true, maxlength: 120 },
    ruleKey: { type: String, required: true, immutable: true, trim: true, maxlength: 120, index: true },
    version: { type: Number, required: true, min: 1, validate: Number.isInteger, immutable: true },
    status: { type: String, enum: FEE_RULE_STATUSES, default: 'draft', index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: Date,
    category: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    fulfillmentMode: { type: String, enum: ['seller', 'nexmart'], index: true },
    commissionBps: { type: Number, required: true, min: 0, max: 10000, validate: Number.isInteger },
    fixedFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shippingCostPaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    otherFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    reserveBps: { type: Number, required: true, min: 0, max: 10000, validate: Number.isInteger },
    paymentCollection: { type: PaymentCollectionSchema, required: true },
    returnFeePaise: { type: Number, required: true, min: 0, validate: Number.isInteger },
    // Legal and tax assumptions must be reviewed by the business before an
    // active rule is used for settlement. The flag is retained in every
    // purchase-time snapshot for auditability.
    requiresProfessionalReview: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

MarketplaceFeeRuleSchema.index({ ruleKey: 1, version: 1 }, { unique: true });
MarketplaceFeeRuleSchema.index({ status: 1, effectiveFrom: -1, version: -1 });

export const MarketplaceFeeRule = mongoose.model<IMarketplaceFeeRule>('MarketplaceFeeRule', MarketplaceFeeRuleSchema);
