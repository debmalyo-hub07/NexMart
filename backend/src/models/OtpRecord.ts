import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpRecord extends Document {
  email: string;
  otp: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'role_verification';
  expiresAt: Date;
}

const OtpRecordSchema = new Schema<IOtpRecord>(
  {
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    purpose: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }, // TTL index, automatically deletes document upon expiry
  },
  { timestamps: true }
);

export const OtpRecord = mongoose.model<IOtpRecord>('OtpRecord', OtpRecordSchema);
