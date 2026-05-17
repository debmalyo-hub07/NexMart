import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ── Auth types ────────────────────────────────────────────────
export type UserRole = 'customer' | 'admin' | 'delivery';
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
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ── Cart ──────────────────────────────────────────────────────
export interface ICartItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId;
  variant: string;
  quantity: number;
  price: number;
}



// ── Order ─────────────────────────────────────────────────────
export interface IOrder extends Document {
  orderId: string;
  deliveryId?: string;
  customer: Types.ObjectId;
  items: {
    product: Types.ObjectId | { name: string; images?: string[] };
    variant: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
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
  invoiceUrl?: string;
  deliveryAgent?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
