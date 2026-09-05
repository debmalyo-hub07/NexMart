import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeliveryAssignment extends Document {
  order: Types.ObjectId;
  agent: Types.ObjectId;
  assignedAt: Date;
  pickedAt?: Date;
  deliveredAt?: Date;
  attemptedAt?: Date;
  status: 'assigned' | 'picked' | 'delivered' | 'attempted' | 'returned';
}

const DeliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    agent: { type: Schema.Types.ObjectId, ref: 'DeliveryAgent', required: true },
    assignedAt: { type: Date, default: Date.now },
    pickedAt: Date,
    deliveredAt: Date,
    attemptedAt: Date,
    status: {
      type: String,
      // 'out_for_delivery' must be here: updateDeliveryStatus accepts it (zod) and
      // assigns it to assignment.status — mongoose rejected the save without it.
      enum: ['assigned', 'picked', 'out_for_delivery', 'delivered', 'attempted', 'returned'],
      default: 'assigned',
    },
  },
  { timestamps: true }
);

DeliveryAssignmentSchema.index({ agent: 1, status: 1 });
// Note: order has implicit unique index via unique:true above

export const DeliveryAssignment = mongoose.model<IDeliveryAssignment>(
  'DeliveryAssignment',
  DeliveryAssignmentSchema
);
