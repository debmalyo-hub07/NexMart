import mongoose, { Document, Schema, Types } from 'mongoose';
import type { InventoryAdjustmentReason } from './SellerInventory';

export interface IInventoryMovement extends Document {
  movementId: string;
  idempotencyKey: string;
  seller: Types.ObjectId;
  listing: Types.ObjectId;
  inventory: Types.ObjectId;
  reason: InventoryAdjustmentReason;
  availableDelta: number;
  reservedDelta: number;
  committedDelta: number;
  returnedDelta: number;
  damagedDelta: number;
  availableAfter: number;
  reservedAfter: number;
  committedAfter: number;
  returnedAfter: number;
  damagedAfter: number;
  actorId: Types.ObjectId;
  actorRole: 'seller' | 'admin' | 'system';
  note?: string;
  requestId?: string;
  createdAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    movementId: { type: String, required: true, unique: true, immutable: true },
    idempotencyKey: { type: String, required: true, immutable: true, maxlength: 128 },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, immutable: true, index: true },
    listing: { type: Schema.Types.ObjectId, ref: 'SellerListing', required: true, immutable: true, index: true },
    inventory: { type: Schema.Types.ObjectId, ref: 'SellerInventory', required: true, immutable: true },
    reason: { type: String, enum: ['opening_balance', 'restock', 'admin_adjustment', 'order_reservation', 'reservation_release', 'shipment_commit', 'return_received', 'damage_reported'], required: true, immutable: true },
    availableDelta: { type: Number, required: true, validate: Number.isInteger, immutable: true },
    reservedDelta: { type: Number, default: 0, validate: Number.isInteger, immutable: true },
    committedDelta: { type: Number, default: 0, validate: Number.isInteger, immutable: true },
    returnedDelta: { type: Number, required: true, validate: Number.isInteger, immutable: true },
    damagedDelta: { type: Number, required: true, validate: Number.isInteger, immutable: true },
    availableAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
    reservedAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
    committedAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
    returnedAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
    damagedAfter: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
    actorId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    actorRole: { type: String, enum: ['seller', 'admin', 'system'], required: true, immutable: true },
    note: { type: String, trim: true, maxlength: 500, immutable: true },
    requestId: { type: String, immutable: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

InventoryMovementSchema.index({ seller: 1, idempotencyKey: 1 }, { unique: true });
InventoryMovementSchema.index({ listing: 1, createdAt: -1 });

export const InventoryMovement = mongoose.model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema);
