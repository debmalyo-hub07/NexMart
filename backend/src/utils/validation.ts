import { z } from 'zod';

// POST /cart/merge body — MUST match the payload authStore.ts sends:
// { items: [{ product, variant, quantity }] }. (The original schema expected a
// bare array, which the frontend never sends — every login merge 400'd.)
export const cartMergeSchema = z.object({
  items: z.array(z.object({
    product: z.string(),
    variant: z.string(),
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
