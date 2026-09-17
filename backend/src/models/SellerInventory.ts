import mongoose, { Document, Schema, Types } from 'mongoose';

export type InventoryAdjustmentReason =
  | 'opening_balance'
  | 'restock'
  | 'admin_adjustment'
  | 'order_reservation'
  | 'reservation_release'
  | 'shipment_commit'
  | 'return_received'
  | 'damage_reported';

export interface ISellerInventory extends Document {
  listing: Types.ObjectId;
  seller: Types.ObjectId;
  available: number;
  reserved: number;
  committed: number;
  returned: number;
  damaged: number;
  lastAdjustmentReason?: InventoryAdjustmentReason;
  lastAdjustmentNote?: string;
  lastAdjustedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SellerInventorySchema = new Schema<ISellerInventory>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'SellerListing', required: true, unique: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    available: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    reserved: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    committed: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    returned: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    damaged: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    lastAdjustmentReason: { type: String, enum: ['opening_balance', 'restock', 'admin_adjustment', 'order_reservation', 'reservation_release', 'shipment_commit', 'return_received', 'damage_reported'] },
    lastAdjustmentNote: { type: String, trim: true, maxlength: 500 },
    lastAdjustedAt: Date,
  },
  { timestamps: true },
);

SellerInventorySchema.index({ seller: 1, updatedAt: -1 });

export const SellerInventory = mongoose.model<ISellerInventory>('SellerInventory', SellerInventorySchema);
