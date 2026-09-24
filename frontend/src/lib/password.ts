import { z } from 'zod';

export const passwordSchema = z.string()
  .min(8, 'Use at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Include uppercase, lowercase, and a number')
  .refine(value => new TextEncoder().encode(value).length <= 72, 'Password must fit within 72 UTF-8 bytes; use fewer characters.');
