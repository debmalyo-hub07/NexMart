import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  profilePicture?: string;
  phone?: string;
  gender?: string;
  address?: string; // Legacy, keep if needed or ignore
  city?: string;
  addresses?: {
    _id?: string;
    label: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }[];
  role: string;
  whitelistedIP?: string;
  // Auth tracking — shown in admin Users tab
  emailVerified: boolean;
  isActive: boolean;
  authProviders: string[];   // ['email', 'google'] — can have both
  createdViaCustomerGoogleOverlap?: boolean;
  // OTP flow
  otp?: string;
  otpExpiry?: Date;
  createdAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String, sparse: true, index: true },
    profilePicture: { type: String, default: '' },
    phone: { type: String },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''] },
    address: { type: String },
    city: { type: String },
    addresses: [
      {
        label: { type: String, default: 'Home' },
        fullName: { type: String, required: true },
        phone: { type: String, default: '' },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        isDefault: { type: Boolean, default: false },
      }
    ],
    role: { type: String, default: 'customer' },
    whitelistedIP: { type: String },
    // Verification fields
    emailVerified: { type: Boolean, default: true },  // true = existing customers keep access; new registrations explicitly set false
    isActive: { type: Boolean, default: true },
    authProviders: { type: [String], default: [] },
    createdViaCustomerGoogleOverlap: { type: Boolean, default: false },
    // OTP
    otp: { type: String },
    otpExpiry: { type: Date },
  },
  { timestamps: true }
);

CustomerSchema.index({ role: 1 });
CustomerSchema.index({ email: 1 }, { unique: true });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
