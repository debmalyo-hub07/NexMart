'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Address } from '@/types';

const addressSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be in E.164 format (e.g., +919876543210)'),
  addressLine1: z.string().min(5, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().length(6, 'Pincode must be 6 digits'),
  country: z.string().min(2, 'Country is required'),
  isDefault: z.boolean().default(false),
});

export type AddressFormData = z.infer<typeof addressSchema>;

interface AddressFormProps {
  initialData?: Partial<Address>;
  onSubmit: (data: AddressFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AddressForm({ initialData, onSubmit, onCancel, isLoading }: AddressFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: initialData?.label || 'Home',
      fullName: initialData?.fullName || '',
      phone: initialData?.phone || '',
      addressLine1: initialData?.addressLine1 || '',
      addressLine2: initialData?.addressLine2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      pincode: initialData?.pincode || '',
      country: initialData?.country || 'India',
      isDefault: initialData?.isDefault || false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 glass p-6 rounded-2xl border border-white/5">
      <h3 className="text-white font-semibold mb-4">{initialData ? 'Edit Address' : 'Add New Address'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Label</label>
          <select {...register('label')} className="input bg-space-900" suppressHydrationWarning>
            <option value="Home" className="bg-space-900">Home</option>
            <option value="Work" className="bg-space-900">Work</option>
            <option value="Other" className="bg-space-900">Other</option>
          </select>
          {errors.label && <p className="text-xs text-red-400 mt-1">{errors.label.message}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Full Name</label>
          <input {...register('fullName')} className="input" placeholder="John Doe" suppressHydrationWarning />
          {errors.fullName && <p className="text-xs text-red-400 mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Phone Number</label>
          <input {...register('phone')} className="input" placeholder="+91 9876543210" suppressHydrationWarning />
          {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Pincode</label>
          <input {...register('pincode')} className="input" placeholder="110001" maxLength={6} suppressHydrationWarning />
          {errors.pincode && <p className="text-xs text-red-400 mt-1">{errors.pincode.message}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-white/60 mb-1.5 block">Address Line 1</label>
          <input {...register('addressLine1')} className="input" placeholder="House No, Building, Street" suppressHydrationWarning />
          {errors.addressLine1 && <p className="text-xs text-red-400 mt-1">{errors.addressLine1.message}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-white/60 mb-1.5 block">Address Line 2 (Optional)</label>
          <input {...register('addressLine2')} className="input" placeholder="Locality, Area" suppressHydrationWarning />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">City</label>
          <input {...register('city')} className="input" placeholder="City" suppressHydrationWarning />
          {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">State</label>
          <input {...register('state')} className="input" placeholder="State" suppressHydrationWarning />
          {errors.state && <p className="text-xs text-red-400 mt-1">{errors.state.message}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <input type="checkbox" id="isDefault" {...register('isDefault')} className="rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500/20" />
        <label htmlFor="isDefault" className="text-sm text-white/70 cursor-pointer">Set as default address</label>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onCancel} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={isLoading} className="btn-primary px-6 py-2 text-sm">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save Address'}
        </button>
      </div>
    </form>
  );
}
