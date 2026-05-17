import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  parent?: Types.ObjectId;
  image?: string;
  icon?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    image: String,
    icon: String,
    description: String,
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// Note: slug has implicit unique index; compound indexes below
CategorySchema.index({ parent: 1, isActive: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
