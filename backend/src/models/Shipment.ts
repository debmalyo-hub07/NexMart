import mongoose, { Document, Schema, Types } from 'mongoose';

export const SHIPMENT_STATUSES = [
  'created',
  'ready_for_pickup',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
] as const;

export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

export interface IShipment extends Document {
  shipmentId: string;
  order: Types.ObjectId;
  fulfillmentGroup: Types.ObjectId;
  seller: Types.ObjectId;
  customer: Types.ObjectId;
  items: { orderItemId: Types.ObjectId; listing?: Types.ObjectId; quantity: number; name: string; variant: string }[];
  trackingId?: string;
  pickupSource: Record<string, unknown>;
  destination: Record<string, unknown>;
  assignedAgent?: Types.ObjectId;
  status: ShipmentStatus;
  handoffEvents: { event: string; timestamp: Date; actorId?: Types.ObjectId; note?: string }[];
  proofOfDelivery?: { capturedAt: Date; method: 'otp' | 'signature' | 'photo' | 'manual'; reference?: string };
  exceptionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentItemSchema = new Schema(
  {
    orderItemId: { type: Schema.Types.ObjectId, required: true },
    listing: { type: Schema.Types.ObjectId, ref: 'SellerListing' },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    name: { type: String, required: true },
    variant: { type: String, required: true },
  },
  { _id: false },
);

const HandoffSchema = new Schema(
  {
    event: { type: String, required: true, maxlength: 80 },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: Schema.Types.ObjectId },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const ShipmentSchema = new Schema<IShipment>(
  {
    shipmentId: { type: String, required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    fulfillmentGroup: { type: Schema.Types.ObjectId, ref: 'FulfillmentGroup', required: true, unique: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [ShipmentItemSchema], required: true },
    trackingId: { type: String, sparse: true, unique: true, trim: true },
    pickupSource: { type: Schema.Types.Mixed, required: true },
    destination: { type: Schema.Types.Mixed, required: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: 'DeliveryAgent', index: true },
    status: { type: String, enum: SHIPMENT_STATUSES, default: 'created', index: true },
    handoffEvents: { type: [HandoffSchema], default: [] },
    proofOfDelivery: {
      capturedAt: Date,
      method: { type: String, enum: ['otp', 'signature', 'photo', 'manual'] },
      reference: String,
    },
    exceptionNote: { type: String, maxlength: 1000 },
  },
  { timestamps: true, optimisticConcurrency: true, toJSON: { virtuals: true } },
);

ShipmentSchema.index({ seller: 1, status: 1, createdAt: -1 });
ShipmentSchema.index({ assignedAgent: 1, status: 1, createdAt: -1 });

export const Shipment = mongoose.model<IShipment>('Shipment', ShipmentSchema);
