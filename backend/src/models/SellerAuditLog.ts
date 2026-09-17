import mongoose, { Document, Schema } from 'mongoose';

export interface ISellerAuditLog extends Document {
  seller: mongoose.Types.ObjectId;
  action: string;
  fromState?: string;
  toState?: string;
  actorId: mongoose.Types.ObjectId;
  actorRole: 'admin' | 'seller' | 'system';
  reason?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const SellerAuditLogSchema = new Schema<ISellerAuditLog>(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    fromState: { type: String, trim: true },
    toState: { type: String, trim: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorRole: { type: String, enum: ['admin', 'seller', 'system'], required: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    requestId: { type: String, trim: true, maxlength: 120 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SellerAuditLogSchema.index({ seller: 1, createdAt: -1 });

export const SellerAuditLog = mongoose.model<ISellerAuditLog>('SellerAuditLog', SellerAuditLogSchema);
