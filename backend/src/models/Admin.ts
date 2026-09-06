import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  name: string;
  email: string;
  password?: string;
  role: string;
  whitelistedIP?: string;
  createdAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, default: 'admin' },
    whitelistedIP: { type: String },
  },
  { timestamps: true }
);

AdminSchema.index({ role: 1 });

export const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
