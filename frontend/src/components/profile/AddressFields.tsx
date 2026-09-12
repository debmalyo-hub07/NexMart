'use client';

import { useId } from 'react';
import { useFormContext } from 'react-hook-form';
import type { DeliveryAddressValues } from '@/lib/address';

const fields = [
  { name: 'fullName', label: 'Full name', autoComplete: 'shipping name' },
  { name: 'phone', label: 'Mobile number', autoComplete: 'shipping tel-national', type: 'tel', maxLength: 10 },
  { name: 'addressLine1', label: 'House, building and street', autoComplete: 'shipping address-line1', wide: true },
  { name: 'addressLine2', label: 'Area or landmark (optional)', autoComplete: 'shipping address-line2', wide: true },
  { name: 'city', label: 'City', autoComplete: 'shipping address-level2' },
  { name: 'state', label: 'State', autoComplete: 'shipping address-level1' },
  { name: 'pincode', label: 'Pincode', autoComplete: 'shipping postal-code', maxLength: 6 },
] as const;

export function AddressFields() {
  const prefix = useId();
  const { register, formState: { errors } } = useFormContext<DeliveryAddressValues>();
  return <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => {
    const id = `${prefix}-${field.name}`;
    return <div key={field.name} className={'wide' in field ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="field-label">{field.label}</label>
      <input {...register(field.name)} id={id} autoComplete={field.autoComplete} type={'type' in field ? field.type : 'text'} inputMode={field.name === 'pincode' || field.name === 'phone' ? 'numeric' : undefined} maxLength={'maxLength' in field ? field.maxLength : undefined} className="input" aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `${id}-error` : undefined} />
      {errors[field.name] && <p id={`${id}-error`} role="alert" className="field-error">{errors[field.name]?.message}</p>}
    </div>;
  })}</div>;
}
