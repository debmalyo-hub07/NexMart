import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface ICategorySpecTemplate extends Document {
  category: Types.ObjectId;
  fields: ISpecField[];
  createdAt: Date;
  updatedAt: Date;
}

const SpecFieldSchema = new Schema<ISpecField>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'select', 'textarea'], default: 'text' },
  options: [String],
  required: { type: Boolean, default: false },
  placeholder: String,
});

const CategorySpecTemplateSchema = new Schema<ICategorySpecTemplate>(
  {
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    fields: [SpecFieldSchema],
  },
  { timestamps: true }
);

export const CategorySpecTemplate = mongoose.model<ICategorySpecTemplate>(
  'CategorySpecTemplate',
  CategorySpecTemplateSchema
);
