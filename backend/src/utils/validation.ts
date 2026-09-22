import { z } from 'zod';

// POST /cart/merge body — MUST match the payload authStore.ts sends:
// { items: [{ product, variant, quantity }] }. (The original schema expected a
// bare array, which the frontend never sends — every login merge 400'd.)
export const cartMergeSchema = z.object({
  fromSession: z.boolean().optional(),
  items: z.array(z.object({
    product: z.string(),
    variant: z.string(),
    listing: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid seller offer').optional(),
    quantity: z.number().int().positive().max(10),
  })).max(50),
});

// PUT /customer/password body — current password plus the same strength policy
// the frontend PasswordModal enforces (min 8, upper + lower + digit).
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

// Password reset. The email is the only input on request; the code plus the
// new password on completion. The strength policy is identical to
// passwordChangeSchema — one policy, stated once per schema so the messages
// reach the client through the standard `errors` key.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

// POST /customer/set-password — for accounts created through Google, which
// have no current password to prove ownership with. The emailed code is the
// proof instead.
export const setPasswordSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

// The single server-side password policy for EVERY registration path
// (customer / agent / admin). Frontend-only rules are not validation: an API
// caller could previously create an account whose password was the empty
// string (audit 2026-09-22 §B3).
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number');

// POST/PUT /customer/address — previously `push(req.body)` and
// `Object.assign(addr, req.body)`: unvalidated mass assignment into the
// subdocument (audit §C1). Mirrors frontend lib/address.ts; unknown keys
// (e.g. `country`) are stripped by zod rather than persisted.
export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  fullName: z.string().trim().min(2, 'Enter the recipient’s full name').max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  addressLine1: z.string().trim().min(5, 'Enter a complete street address').max(250),
  addressLine2: z.string().trim().max(250).optional(),
  city: z.string().trim().min(2, 'Enter a city').max(100),
  state: z.string().trim().min(2, 'Enter a state').max(100),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().optional().default(false),
});

// PUT /customer/profile — previously unvalidated: req.body fields were spread
// straight into $set. Mongoose ignores unknown paths, so privilege fields were
// never actually writable, but that was incidental rather than guaranteed.
// This states the contract: these four fields, nothing else.
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').or(z.literal('')).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '']).optional(),
  city: z.string().trim().max(100).optional(),
});
