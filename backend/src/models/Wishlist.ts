import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlist extends Document {
  user: mongoose.Types.ObjectId; // Reference to Customer
  products: mongoose.Types.ObjectId[]; // Array of Product references
}

const WishlistSchema = new Schema<IWishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);
