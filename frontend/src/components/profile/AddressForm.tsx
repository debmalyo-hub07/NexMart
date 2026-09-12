'use client';

import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useId } from 'react';
import type { Address } from '@/types';
import { deliveryAddressSchema, indianPhone } from '@/lib/address';
import { AddressFields } from './AddressFields';

const addressSchema = deliveryAddressSchema.extend({ label: z.string().min(1).max(40), isDefault: z.boolean() });
export type AddressFormData = z.infer<typeof addressSchema>;
export function AddressForm({ initialData, onSubmit, onCancel, isLoading }: { initialData?: Partial<Address>; onSubmit: (data: AddressFormData) => Promise<void>; onCancel: () => void; isLoading?: boolean }) {
  const id = useId();
  const form = useForm<AddressFormData>({ resolver: zodResolver(addressSchema), defaultValues: { label: initialData?.label || 'Home', fullName: initialData?.fullName || '', phone: indianPhone(initialData?.phone), addressLine1: initialData?.addressLine1 || '', addressLine2: initialData?.addressLine2 || '', city: initialData?.city || '', state: initialData?.state || '', pincode: initialData?.pincode || '', country: 'India', isDefault: initialData?.isDefault || false } });
  return <FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} noValidate><fieldset disabled={isLoading || form.formState.isSubmitting} className="space-y-5">
    <div><label htmlFor={`${id}-label`} className="field-label">Address label</label><select id={`${id}-label`} {...form.register('label')} className="input"><option>Home</option><option>Work</option><option>Other</option></select></div>
    <AddressFields />
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" {...form.register('isDefault')} className="h-5 w-5 accent-violet-500" />Use as my default address</label>
    <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={onCancel} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{isLoading && <Loader2 size={17} className="animate-spin" aria-hidden />}{isLoading ? 'Saving…' : 'Save address'}</button></div>
  </fieldset></form></FormProvider>;
}
