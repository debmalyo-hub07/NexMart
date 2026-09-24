import mongoose, { Schema } from 'mongoose';

// One full-refund intent per captured order. Never expire this record: its
// receipt must survive timeouts, deploys and repeated operator clicks.
const RefundAttemptSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  paymentId: { type: String, required: true },
  receipt: { type: String, required: true, unique: true },
  amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ['requested', 'pending', 'processed', 'failed', 'needs_review'], default: 'requested', required: true },
  refundId: { type: String, unique: true, sparse: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  leaseUntil: Date,
  leaseOwner: String,
  processedAt: Date,
  lastCheckedAt: Date,
}, { timestamps: true });
RefundAttemptSchema.index({ status: 1, lastCheckedAt: 1 });

export const RefundAttempt = mongoose.model('RefundAttempt', RefundAttemptSchema);
