import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryAgent extends Document {
  name: string;
  email: string;
  password?: string;
  vehicleType?: string;
  vehicleModel?: string;
  licensePlate?: string;
  city?: string;
  address?: string;
  aadharNumber?: string;
  role: string;
  status: string;
  whitelistedIP?: string;
  createdAt: Date;
}

const DeliveryAgentSchema = new Schema<IDeliveryAgent>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    vehicleType: { type: String },
    vehicleModel: { type: String },
    licensePlate: { type: String },
    city: { type: String },
    address: { type: String },
    aadharNumber: { type: String },
    role: { type: String, default: 'agent' },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    whitelistedIP: { type: String },
  },
  { timestamps: true }
);

export const DeliveryAgent = mongoose.model<IDeliveryAgent>('DeliveryAgent', DeliveryAgentSchema);
