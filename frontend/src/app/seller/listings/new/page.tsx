'use client';

import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';

const listingSchema = z.object({
  canonicalProduct: z.string().min(1, 'Product ID is required'),
  sellerSku: z.string().min(1, 'SKU is required'),
  price: z.number({ invalid_type_error: 'Required' }).min(1, 'Price must be at least ₹1'),
  compareAtPrice: z.number().optional().nullable(),
  condition: z.enum(['new', 'used', 'refurbished']),
  handlingTimeDays: z.number({ invalid_type_error: 'Required' }).min(0).max(30),
  fulfillmentMode: z.enum(['seller', 'nexmart']),
  returnWindowDays: z.number().min(0).max(90).optional().nullable(),
  warrantyText: z.string().optional(),
  openingStock: z.number({ invalid_type_error: 'Required' }).min(0, 'Cannot be negative'),
});

type ListingFormValues = z.infer<typeof listingSchema>;

export default function NewListingPage() {
  const router = useRouter();
  const { showToast } = useUIStore();

  const { register, handleSubmit, formState: { errors } } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      condition: 'new',
      handlingTimeDays: 2,
      fulfillmentMode: 'seller',
      returnWindowDays: 14,
      openingStock: 0,
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: ListingFormValues) => {
      const payload = {
        canonicalProduct: data.canonicalProduct,
        sellerSku: data.sellerSku,
        pricePaise: Math.round(data.price * 100),
        compareAtPricePaise: data.compareAtPrice ? Math.round(data.compareAtPrice * 100) : undefined,
        condition: data.condition,
        handlingTimeDays: data.handlingTimeDays,
        fulfillmentMode: data.fulfillmentMode,
        returnWindowDays: data.returnWindowDays,
        warrantyText: data.warrantyText,
        openingStock: data.openingStock,
      };
      return api.post('/seller/listings', payload);
    },
    onSuccess: () => {
      showToast('Listing created successfully', 'success');
      router.push('/seller/listings');
    },
    onError: (error) => showToast(getApiError(error), 'error'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/seller/listings" className="mb-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-white transition-colors">
          <ArrowLeft size={16} aria-hidden /> Back to listings
        </Link>
        <p className="text-sm text-violet-300">Catalog</p>
        <h1 className="mt-1 font-outfit text-3xl font-semibold">New listing</h1>
        <p className="mt-2 text-sm text-secondary">Create a new product listing to sell on NexMart.</p>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6 space-y-4">
          <h2 className="font-outfit text-lg font-semibold">Product & Identification</h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Product ID *</span>
              <input {...register('canonicalProduct')} type="text" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="e.g. 64c...a12" />
              {errors.canonicalProduct && <p className="text-xs text-red-400">{errors.canonicalProduct.message}</p>}
            </label>
            
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Seller SKU *</span>
              <input {...register('sellerSku')} type="text" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="e.g. TSHIRT-BL-M" />
              {errors.sellerSku && <p className="text-xs text-red-400">{errors.sellerSku.message}</p>}
            </label>
          </div>
          
          <label className="block space-y-2">
            <span className="text-sm text-secondary">Condition *</span>
            <select {...register('condition')} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <option value="new">New</option>
              <option value="refurbished">Refurbished</option>
              <option value="used">Used</option>
            </select>
            {errors.condition && <p className="text-xs text-red-400">{errors.condition.message}</p>}
          </label>
        </section>

        <section className="rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6 space-y-4">
          <h2 className="font-outfit text-lg font-semibold">Pricing & Inventory</h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Price (₹) *</span>
              <input {...register('price', { valueAsNumber: true })} type="number" min="0" step="1" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="0.00" />
              {errors.price && <p className="text-xs text-red-400">{errors.price.message}</p>}
            </label>
            
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Compare at price (₹)</span>
              <input {...register('compareAtPrice', { valueAsNumber: true, setValueAs: v => v === '' ? undefined : parseInt(v, 10) })} type="number" min="0" step="1" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="0.00" />
              {errors.compareAtPrice && <p className="text-xs text-red-400">{errors.compareAtPrice.message}</p>}
            </label>
            
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm text-secondary">Opening Stock *</span>
              <input {...register('openingStock', { valueAsNumber: true })} type="number" min="0" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" />
              {errors.openingStock && <p className="text-xs text-red-400">{errors.openingStock.message}</p>}
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-space-900 p-5 sm:p-6 space-y-4">
          <h2 className="font-outfit text-lg font-semibold">Fulfillment & Policies</h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Fulfillment Mode *</span>
              <select {...register('fulfillmentMode')} className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
                <option value="seller">Seller Direct</option>
                <option value="nexmart">NexMart Fulfilled</option>
              </select>
              {errors.fulfillmentMode && <p className="text-xs text-red-400">{errors.fulfillmentMode.message}</p>}
            </label>
            
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Handling Time (Days) *</span>
              <input {...register('handlingTimeDays', { valueAsNumber: true })} type="number" min="0" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" />
              {errors.handlingTimeDays && <p className="text-xs text-red-400">{errors.handlingTimeDays.message}</p>}
            </label>
            
            <label className="block space-y-2">
              <span className="text-sm text-secondary">Return Window (Days)</span>
              <input {...register('returnWindowDays', { valueAsNumber: true, setValueAs: v => v === '' ? undefined : parseInt(v, 10) })} type="number" min="0" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" />
              {errors.returnWindowDays && <p className="text-xs text-red-400">{errors.returnWindowDays.message}</p>}
            </label>
            
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm text-secondary">Warranty Text</span>
              <input {...register('warrantyText')} type="text" className="min-h-11 w-full rounded-lg border border-white/15 bg-space-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" placeholder="e.g. 1 Year Manufacturer Warranty" />
              {errors.warrantyText && <p className="text-xs text-red-400">{errors.warrantyText.message}</p>}
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Link href="/seller/listings" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
            Cancel
          </Link>
          <button type="submit" disabled={mutation.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-black hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:opacity-50">
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
            Save listing
          </button>
        </div>
      </form>
    </div>
  );
}
