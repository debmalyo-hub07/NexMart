import mongoose, { Document, Schema } from 'mongoose';

export const SELLER_LIFECYCLE_STATES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'active',
  'rejected',
  'suspended',
  'blocked',
  'closed',
] as const;

export type SellerLifecycleState = typeof SELLER_LIFECYCLE_STATES[number];
export type SellerBusinessType =
  | 'individual'
  | 'proprietorship'
  | 'partnership'
  | 'llp'
  | 'private_limited'
  | 'other';

export type SellerVerificationState = 'unverified' | 'pending' | 'verified' | 'failed';

interface ISellerAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface ISellerTaxDetails {
  /** Sensitive identifiers are excluded from normal reads. Encrypt at rest before production use. */
  pan?: string;
  gstin?: string;
  countryOfOrigin?: string;
}

interface ISellerPayoutDetails {
  providerAccountId?: string;
  bankAccountLast4?: string;
  ifscLast4?: string;
  verificationState: SellerVerificationState;
}

export interface ISeller extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'seller';
  sellerKind: 'first_party' | 'third_party';
  systemKey?: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  lifecycleStatus: SellerLifecycleState;
  legalBusinessName: string;
  storefrontName: string;
  businessType: SellerBusinessType;
  businessAddress?: ISellerAddress;
  pickupAddress?: ISellerAddress;
  returnAddress?: ISellerAddress;
  tax?: ISellerTaxDetails;
  payout?: ISellerPayoutDetails;
  kycState: SellerVerificationState;
  complianceState: SellerVerificationState;
  policyAcceptedAt?: Date;
  prohibitedProductsAcknowledgedAt?: Date;
  performance: {
    ratingAverage: number;
    ratingCount: number;
    cancellationRate: number;
    lateDispatchRate: number;
  };
  verificationCodeHash?: string;
  verificationCodeExpiry?: Date;
  verificationCodeAttempts: number;
  credentialsChangedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<ISellerAddress>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true, maxlength: 250 },
    addressLine2: { type: String, trim: true, maxlength: 250 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', enum: ['India'] },
  },
  { _id: false },
);

const SellerSchema = new Schema<ISeller>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, select: false },
    role: { type: String, enum: ['seller'], default: 'seller', immutable: true },
    sellerKind: { type: String, enum: ['first_party', 'third_party'], default: 'third_party', immutable: true, index: true },
    systemKey: { type: String, unique: true, sparse: true, immutable: true, select: false },
    phone: { type: String, required: true, trim: true },
    emailVerified: { type: Boolean, default: false, index: true },
    phoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    lifecycleStatus: {
      type: String,
      enum: SELLER_LIFECYCLE_STATES,
      default: 'draft',
      index: true,
    },
    legalBusinessName: { type: String, required: true, trim: true, maxlength: 160 },
    storefrontName: { type: String, required: true, trim: true, maxlength: 120 },
    businessType: {
      type: String,
      enum: ['individual', 'proprietorship', 'partnership', 'llp', 'private_limited', 'other'],
      required: true,
    },
    businessAddress: { type: AddressSchema },
    pickupAddress: { type: AddressSchema },
    returnAddress: { type: AddressSchema },
    tax: {
      pan: { type: String, select: false, trim: true, uppercase: true },
      gstin: { type: String, select: false, trim: true, uppercase: true },
      countryOfOrigin: { type: String, trim: true, default: 'India' },
    },
    payout: {
      providerAccountId: { type: String, select: false },
      bankAccountLast4: { type: String },
      ifscLast4: { type: String },
      verificationState: { type: String, enum: ['unverified', 'pending', 'verified', 'failed'], default: 'unverified' },
    },
    kycState: { type: String, enum: ['unverified', 'pending', 'verified', 'failed'], default: 'unverified', index: true },
    complianceState: { type: String, enum: ['unverified', 'pending', 'verified', 'failed'], default: 'unverified' },
    policyAcceptedAt: Date,
    prohibitedProductsAcknowledgedAt: Date,
    performance: {
      ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
      ratingCount: { type: Number, default: 0, min: 0 },
      cancellationRate: { type: Number, default: 0, min: 0, max: 1 },
      lateDispatchRate: { type: Number, default: 0, min: 0, max: 1 },
    },
    verificationCodeHash: { type: String, select: false },
    verificationCodeExpiry: { type: Date, select: false },
    verificationCodeAttempts: { type: Number, select: false, default: 0 },
    credentialsChangedAt: Date,
    rejectionReason: { type: String, maxlength: 1000 },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

SellerSchema.index({ lifecycleStatus: 1, createdAt: -1 });
SellerSchema.index({ storefrontName: 1 });

export const Seller = mongoose.model<ISeller>('Seller', SellerSchema);
