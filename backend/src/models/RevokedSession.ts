import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: false });

/** Durable revocation survives Redis outages and application restarts. */
export const RevokedSession = mongoose.model('RevokedSession', schema);
