import mongoose, { Schema } from 'mongoose';

export const REQUEST_KINDS = ['cancellation', 'return', 'help'] as const;
export const REQUEST_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'resolved'] as const;
const OrderRequestSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  requestKey: { type: String, required: true },
  kind: { type: String, enum: REQUEST_KINDS, required: true },
  itemKey: { type: String, default: 'order', required: true },
  itemName: String,
  reason: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: REQUEST_STATUSES, default: 'submitted', required: true },
  isOpen: { type: Boolean, default: true, required: true },
  history: [{
    status: { type: String, enum: REQUEST_STATUSES, required: true },
    note: { type: String, maxlength: 1000 },
    timestamp: { type: Date, required: true },
    updatedBy: { type: Schema.Types.ObjectId, select: false },
  }],
}, { timestamps: true, optimisticConcurrency: true });
OrderRequestSchema.index({ customer: 1, requestKey: 1 }, { unique: true });
OrderRequestSchema.index({ order: 1, customer: 1, kind: 1, itemKey: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
OrderRequestSchema.index({ status: 1, createdAt: 1 });
OrderRequestSchema.index({ order: 1, customer: 1, createdAt: -1 });
export const OrderRequest = mongoose.model('OrderRequest', OrderRequestSchema);
