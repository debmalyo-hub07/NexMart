import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IListingAuditLog extends Document {
  listing: Types.ObjectId;
  seller: Types.ObjectId;
  action: string;
  actorId: Types.ObjectId | string;
  actorRole: 'admin' | 'seller' | 'system';
  fromState?: string;
  toState?: string;
  reason?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ListingAuditLogSchema = new Schema<IListingAuditLog>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'SellerListing', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    action: { type: String, required: true, trim: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorRole: { type: String, enum: ['admin', 'seller', 'system'], required: true },
    fromState: String,
    toState: String,
    reason: { type: String, maxlength: 1000 },
    requestId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ListingAuditLogSchema.index({ listing: 1, createdAt: -1 });

export const ListingAuditLog = mongoose.model<IListingAuditLog>('ListingAuditLog', ListingAuditLogSchema);
