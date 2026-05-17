import mongoose, { Schema, Document, Types } from 'mongoose';
import { ICartItem } from '../types';

export interface ICartDoc extends Document {
  user?: Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  updatedAt: Date;
}

const CartItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true },
});

const CartSchema = new Schema<ICartDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'Customer', sparse: true, unique: true },
    sessionId: { type: String, sparse: true, index: true },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

// Note: user has implicit unique index; sessionId indexed above

export const Cart = mongoose.model<ICartDoc>('Cart', CartSchema);
