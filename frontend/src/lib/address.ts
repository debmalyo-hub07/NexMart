import { z } from 'zod';

export const deliveryAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the recipient’s full name').max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
  addressLine1: z.string().trim().min(5, 'Enter a complete street address').max(250),
  addressLine2: z.string().trim().max(250).optional(),
  city: z.string().trim().min(2, 'Enter a city').max(100),
  state: z.string().trim().min(2, 'Enter a state').max(100),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  country: z.literal('India'),
});
export type DeliveryAddressValues = z.infer<typeof deliveryAddressSchema>;
export const indianPhone = (phone = '') => phone.replace(/^\+91[\s-]?/, '').replace(/\s/g, '');
