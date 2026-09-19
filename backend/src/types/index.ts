import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ── Auth types ────────────────────────────────────────────────
export type UserRole = 'customer' | 'admin' | 'delivery' | 'agent' | 'seller';
export type OrderStatus =
  | 'placed' | 'confirmed' | 'processing' | 'shipped'
  | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'online' | 'cod';
export interface JwtPayload {
  userId: string;
  role: UserRole;
  email?: string;
  iat?: number;
  exp?: number;
  iatMs?: number;
  sellerLifecycleStatus?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ── Address ───────────────────────────────────────────────────
export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}



// ── Product ───────────────────────────────────────────────────
export interface IProductVariant {
  sku: string;
  attributes: Record<string, string>;
  price: number;
  comparePrice?: number;
  stock: number;
  images: string[];
}

export interface IProductReview {
  user: Types.ObjectId;
  rating: number;
  title?: string;
  body?: string;
  isVerifiedPurchase: boolean;
  createdAt: Date;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  richDescription?: string;
  category: Types.ObjectId;
  subCategory?: string;
  images: string[];
  videoUrl?: string;
  variants: IProductVariant[];
  tags: string[];
  brand?: string;
  specifications: Record<string, string>;
  ratings: { average: number; count: number };
  reviews: IProductReview[];
  isPublished: boolean;
  isFeatured: boolean;
  isDemo?: boolean;
  demoSource?: string;
  searchText?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryState = 'reserved' | 'committed' | 'released' | 'returned';

// ── Cart ──────────────────────────────────────────────────────
export interface ICartItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId;
  listing?: Types.ObjectId;
  seller?: Types.ObjectId;
  variant: string;
  quantity: number;
  price: number;
}



// ── Order ─────────────────────────────────────────────────────
export interface IOrder extends Document {
  orderId: string;
  checkoutId?: string;
  checkoutFingerprint?: string;
  paymentAttemptedAt?: Date;
  deliveryId?: string;
  customer: Types.ObjectId;
  items: {
    _id?: Types.ObjectId;
    name?: string;
    image?: string;
    product: Types.ObjectId | { name: string; images?: string[] };
    listing?: Types.ObjectId;
    seller?: Types.ObjectId;
    inventory?: Types.ObjectId;
    sellerSku?: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unitPricePaise?: number;
    totalPricePaise?: number;
    discountPaise?: number;
    inventoryState?: InventoryState;
  }[];
  shippingAddress: IAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: {
    status: OrderStatus;
    timestamp: Date;
    updatedBy: Types.ObjectId;
    note?: string;
  }[];
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  total: number;
  moneyVersion?: number;
  subtotalPaise?: number;
  shippingFeePaise?: number;
  taxPaise?: number;
  discountPaise?: number;
  totalPaise?: number;
  fulfillmentGroups?: Types.ObjectId[];
  invoiceUrl?: string;
  deliveryAgent?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
