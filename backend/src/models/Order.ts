import mongoose, { Schema } from 'mongoose';
import { IOrder } from '../types';

const AddressSchema = new Schema({
  label: String,
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
});

const OrderItemSchema = new Schema({
  // `_id` is retained for immutable references from fulfillment groups.
  name: String,
  image: String,
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  listing: { type: Schema.Types.ObjectId, ref: 'SellerListing' },
  seller: { type: Schema.Types.ObjectId, ref: 'Seller' },
  inventory: { type: Schema.Types.ObjectId, ref: 'SellerInventory' },
  sellerSku: String,
  variant: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  unitPricePaise: { type: Number, min: 0, validate: Number.isInteger },
  totalPricePaise: { type: Number, min: 0, validate: Number.isInteger },
  taxRateBps: { type: Number, min: 0, max: 10000, validate: Number.isInteger },
  taxPaise: { type: Number, min: 0, validate: Number.isInteger },
  hsnCode: String,
  discountPaise: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  inventoryState: { type: String, enum: ['reserved', 'committed', 'released', 'returned'] },
  purchaseTerms: {
    type: new Schema({ sellerName: String, returnWindowDays: Number, handlingTimeDays: Number, warrantyText: String }, { _id: false }),
    default: undefined,
  },
});

const StatusHistorySchema = new Schema({
  status: {
    type: String,
    enum: ['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId }, // Polymorphic (Admin or Agent)
  note: String,
});

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    checkoutId: String,
    checkoutFingerprint: { type: String, select: false },
    paymentAttemptedAt: Date,
    items: [OrderItemSchema],
    shippingAddress: { type: AddressSchema, required: true },
    paymentMethod: { type: String, enum: ['online', 'cod'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String, sparse: true, unique: true },
    razorpaySignature: String,
    refund: {
      type: new Schema({
        status: { type: String, enum: ['requested', 'pending', 'processed', 'failed', 'needs_review'], required: true },
        amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
        refundId: String,
        requestedAt: { type: Date, required: true },
        processedAt: Date,
      }, { _id: false }),
      default: undefined,
    },
    orderStatus: {
      type: String,
      enum: ['placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned'],
      default: 'placed',
    },
    statusHistory: [StatusHistorySchema],
    deliveryAgent: { type: Schema.Types.ObjectId, ref: 'DeliveryAgent' },
    deliveryId: { type: String, sparse: true, unique: true },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    invoiceUrl: String,
    notes: String,
    moneyVersion: { type: Number, default: 1, index: true },
    subtotalPaise: { type: Number, min: 0, validate: Number.isInteger },
    shippingFeePaise: { type: Number, min: 0, validate: Number.isInteger },
    taxPaise: { type: Number, min: 0, validate: Number.isInteger },
    taxStatus: { type: String, enum: ['complete', 'incomplete'] },
    discountPaise: { type: Number, min: 0, validate: Number.isInteger },
    totalPaise: { type: Number, min: 0, validate: Number.isInteger },
    fulfillmentGroups: [{ type: Schema.Types.ObjectId, ref: 'FulfillmentGroup' }],
  },
  { timestamps: true, optimisticConcurrency: true, toJSON: { virtuals: true } }
);

OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ customer: 1, checkoutId: 1 }, { unique: true, partialFilterExpression: { checkoutId: { $type: 'string' } } });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ fulfillmentGroups: 1 });
OrderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
