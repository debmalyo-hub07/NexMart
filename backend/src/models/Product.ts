import mongoose, { Schema } from 'mongoose';
import { IProduct } from '../types';

const VariantSchema = new Schema({
  sku: { type: String, required: true },
  attributes: { type: Map, of: String, default: {} },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  images: [String],
});

const ReviewSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: String,
  body: String,
  isVerifiedPurchase: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    richDescription: String,
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: String,
    images: [String],
    videoUrl: String,
    variants: [VariantSchema],
    tags: [String],
    brand: String,
    specifications: { type: Map, of: String, default: {} },
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    reviews: [ReviewSchema],
    isPublished: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Text search index
ProductSchema.index(
  { name: 'text', description: 'text', tags: 'text', brand: 'text' },
  { weights: { name: 10, tags: 5, brand: 3, description: 1 } }
);

// Note: slug has implicit unique index
ProductSchema.index({ category: 1, isPublished: 1 });
ProductSchema.index({ isFeatured: 1, isPublished: 1 });
ProductSchema.index({ 'ratings.average': -1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
