'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { parentId } from '@/lib/catalog';
import { PRODUCT_IMAGE_TYPES, productFormDefaults, productFormPayload, productFormSchema, validateProductImages, type ProductFormData } from '@/lib/productForm';
import { useUIStore } from '@/store/uiStore';
import { QueryError } from '@/components/common/QueryError';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ProductImage } from '@/components/product/ProductImage';
import type { ApiResponse, Category, Product } from '@/types';

function DetailFields({ form, name, label }: { form: UseFormReturn<ProductFormData>; name: 'specifications' | `variants.${number}.attributes`; label: string }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name });
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium text-secondary">{label}</h3>
      <button type="button" className="btn-secondary px-3" onClick={() => append({ key: '', value: '' })}><Plus size={15} aria-hidden />Add detail</button>
    </div>
    {fields.map((field, index) => {
      const keyPath = `${name}.${index}.key` as const;
      const valuePath = `${name}.${index}.value` as const;
      const keyError = form.getFieldState(keyPath, form.formState).error?.message;
      const valueError = form.getFieldState(valuePath, form.formState).error?.message;
      return <div key={field.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div><label htmlFor={keyPath} className="field-label">Name</label><input id={keyPath} {...form.register(keyPath)} className="input" placeholder="e.g. Colour" aria-invalid={!!keyError} aria-describedby={keyError ? `${keyPath}-error` : undefined} />{keyError && <p id={`${keyPath}-error`} className="field-error">{keyError}</p>}</div>
        <div className="col-start-1 sm:col-start-auto"><label htmlFor={valuePath} className="field-label">Value</label><input id={valuePath} {...form.register(valuePath)} className="input" placeholder="e.g. Blue" aria-invalid={!!valueError} aria-describedby={valueError ? `${valuePath}-error` : undefined} />{valueError && <p id={`${valuePath}-error`} className="field-error">{valueError}</p>}</div>
        <button type="button" className="icon-button col-start-2 row-start-1 self-end sm:col-start-auto" aria-label={`Remove ${label.toLowerCase()} detail ${index + 1}`} onClick={() => remove(index)}><X size={18} aria-hidden /></button>
      </div>;
    })}
  </div>;
}

function UploadPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url ? <Image src={url} alt={file.name} fill sizes="160px" unoptimized className="object-contain" /> : null;
}

export function ProductForm({ initialData, productId }: { initialData?: Product; productId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  const form = useForm<ProductFormData>({ resolver: zodResolver(productFormSchema), defaultValues: productFormDefaults(initialData) });
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;
  const variants = useFieldArray({ control: form.control, name: 'variants' });
  const [savedId, setSavedId] = useState(productId);
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(initialData?.images ?? []);
  const [imageError, setImageError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [removeVariant, setRemoveVariant] = useState<number>();
  const category = watch('category');
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: ({ signal }) => api.get<ApiResponse<Category[]>>('/categories?includeInactive=true', { signal }).then(response => response.data.data ?? []),
    staleTime: 30_000,
  });
  const parents = categories.data?.filter(item => !item.parent) ?? [];
  const children = categories.data?.filter(item => parentId(item) === category) ?? [];

  function addImages(files: File[]) {
    const error = validateProductImages(files, images.length);
    setImageError(error);
    if (!error) setImages(previous => [...previous, ...files]);
  }

  async function onSubmit(data: ProductFormData) {
    if (uncertain) return;
    setSaveError(undefined);
    let detailsSaved = false;
    let id = savedId;
    try {
      const payload = { ...productFormPayload(data), images: existingImages };
      // Save details first so an upload failure never requires creating another product.
      const response = id
        ? await api.put<ApiResponse<Product>>(`/products/${id}`, payload)
        : await api.post<ApiResponse<Product>>('/products', payload);
      id = response.data.data?._id ?? id;
      if (!id) throw new Error('Missing product identity');
      setSavedId(id);
      detailsSaved = true;
      if (images.length) {
        const body = new FormData();
        images.forEach(file => body.append('images', file));
        await api.post(`/products/${id}/images`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'product', id] });
      showToast(productId ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } catch (error) {
      const unknownOutcome = !(error instanceof AxiosError) || !error.response || error.response.status >= 500;
      setUncertain(unknownOutcome);
      setSaveError(`${detailsSaved ? 'Product details were saved. The image upload could not be confirmed. ' : ''}${getApiError(error)}${unknownOutcome ? ' Check the saved product before submitting again.' : ''}`);
    }
  }

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
    {saveError && <div className="card border-amber-400/40 text-sm" role="alert"><p>{saveError}</p>{uncertain && <a className="btn-secondary mt-3" href={savedId ? `/admin/products/${savedId}/edit` : '/admin/products'}>{savedId ? 'Review saved product' : 'Check product list'}</a>}</div>}
    <fieldset disabled={isSubmitting || uncertain} className="min-w-0 space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="card space-y-4" aria-labelledby="product-basics">
            <h2 id="product-basics" className="text-xl">Product information</h2>
            <div><label htmlFor="product-name" className="field-label">Product name</label><input id="product-name" {...register('name')} className="input" maxLength={200} aria-invalid={!!errors.name} aria-describedby="product-name-error" />{errors.name && <p id="product-name-error" className="field-error">{errors.name.message}</p>}</div>
            <div><label htmlFor="product-description" className="field-label">Description</label><textarea id="product-description" {...register('description')} rows={5} className="input" aria-invalid={!!errors.description} aria-describedby="product-description-error" />{errors.description && <p id="product-description-error" className="field-error">{errors.description.message}</p>}</div>
            <div><label htmlFor="product-brand" className="field-label">Brand <span className="text-muted">(optional)</span></label><input id="product-brand" {...register('brand')} className="input" /></div>
            <details><summary className="min-h-11 cursor-pointer py-2 text-sm text-secondary">Additional description</summary><label htmlFor="product-rich-description" className="sr-only">Additional description</label><textarea id="product-rich-description" {...register('richDescription')} rows={4} className="input" /></details>
            <DetailFields form={form} name="specifications" label="Specifications" />
          </section>
          <section className="card space-y-5" aria-labelledby="product-variants">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="product-variants" className="text-xl">Pricing & inventory</h2><p className="field-hint">One SKU for each purchasable option. Prices are in rupees.</p></div><button type="button" className="btn-secondary" onClick={() => variants.append({ sku: '', price: 0, stock: 0, attributes: [], images: [] })}><Plus size={16} aria-hidden />Add variant</button></div>
            {variants.fields.map((variant, index) => <fieldset key={variant.id} className="min-w-0 space-y-4 rounded-xl border border-white/15 p-3 sm:p-4">
              <legend className="px-2 text-sm font-semibold">Variant {index + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor={`sku-${index}`} className="field-label">SKU</label><input id={`sku-${index}`} {...register(`variants.${index}.sku`)} className="input font-mono" aria-invalid={!!errors.variants?.[index]?.sku} aria-describedby={`sku-error-${index}`} />{errors.variants?.[index]?.sku && <p id={`sku-error-${index}`} className="field-error">{errors.variants[index]?.sku?.message}</p>}</div>
                <div><label htmlFor={`stock-${index}`} className="field-label">Stock quantity</label><input id={`stock-${index}`} type="number" min="0" step="1" inputMode="numeric" {...register(`variants.${index}.stock`, { valueAsNumber: true })} className="input" aria-invalid={!!errors.variants?.[index]?.stock} aria-describedby={`stock-error-${index}`} />{errors.variants?.[index]?.stock && <p id={`stock-error-${index}`} className="field-error">{errors.variants[index]?.stock?.message}</p>}</div>
                <div><label htmlFor={`price-${index}`} className="field-label">Selling price (₹)</label><input id={`price-${index}`} type="number" min="0.01" step="0.01" inputMode="decimal" {...register(`variants.${index}.price`, { valueAsNumber: true })} className="input" aria-invalid={!!errors.variants?.[index]?.price} aria-describedby={`price-error-${index}`} />{errors.variants?.[index]?.price && <p id={`price-error-${index}`} className="field-error">{errors.variants[index]?.price?.message}</p>}</div>
                <div><label htmlFor={`mrp-${index}`} className="field-label">MRP (₹, optional)</label><input id={`mrp-${index}`} type="number" min="0.01" step="0.01" inputMode="decimal" {...register(`variants.${index}.comparePrice`, { setValueAs: value => value === '' ? undefined : Number(value) })} className="input" aria-invalid={!!errors.variants?.[index]?.comparePrice} aria-describedby={`mrp-error-${index}`} />{errors.variants?.[index]?.comparePrice && <p id={`mrp-error-${index}`} className="field-error">{errors.variants[index]?.comparePrice?.message}</p>}</div>
              </div>
              <DetailFields form={form} name={`variants.${index}.attributes`} label="Variant attributes" />
              {!!variant.images.length && <p className="field-hint">{variant.images.length} existing variant image{variant.images.length === 1 ? '' : 's'} will be retained.</p>}
              {variants.fields.length > 1 && <button type="button" className="btn-secondary text-red-300" onClick={() => setRemoveVariant(index)}><Trash2 size={16} aria-hidden />Remove variant {index + 1}</button>}
            </fieldset>)}
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <section className="card space-y-4" aria-labelledby="product-organization">
            <h2 id="product-organization" className="text-xl">Category & publishing</h2>
            {categories.isError ? <QueryError label="Categories" onRetry={() => void categories.refetch()} /> : <>
              <div><label htmlFor="product-category" className="field-label">Category</label><select id="product-category" {...register('category', { onChange: () => setValue('subCategory', '', { shouldDirty: true }) })} className="input" disabled={categories.isPending} aria-invalid={!!errors.category} aria-describedby="product-category-error"><option value="">{categories.isPending ? 'Loading categories…' : 'Choose a category'}</option>{parents.map(item => <option key={item._id} value={item._id}>{item.name}{item.isActive === false ? ' (inactive)' : ''}</option>)}</select>{errors.category && <p id="product-category-error" className="field-error">{errors.category.message}</p>}</div>
              <div><label htmlFor="product-subcategory" className="field-label">Subcategory <span className="text-muted">(optional)</span></label><select id="product-subcategory" {...register('subCategory')} className="input" disabled={!category || categories.isPending}><option value="">No subcategory</option>{children.map(item => <option key={item._id} value={item._id}>{item.name}{item.isActive === false ? ' (inactive)' : ''}</option>)}</select></div>
              {!categories.isPending && !parents.length && <p className="field-hint">Add a category before publishing a product.</p>}
            </>}
            <Link href="/admin/categories" className="inline-flex min-h-11 items-center text-sm text-violet-300">Manage categories</Link>
            <div><label htmlFor="product-tags" className="field-label">Search tags <span className="text-muted">(optional)</span></label><input id="product-tags" {...register('tags')} className="input" aria-describedby="product-tags-hint" /><p id="product-tags-hint" className="field-hint">Separate tags with commas.</p></div>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" {...register('isPublished')} className="h-5 w-5 accent-violet-600" />Published in the store</label>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" {...register('isFeatured')} className="h-5 w-5 accent-violet-600" />Featured on the homepage</label>
          </section>
          <section className="card space-y-4" aria-labelledby="product-media">
            <h2 id="product-media" className="text-xl">Product images</h2>
            <p className="text-sm text-secondary">Use clear, consistent product photos. The first image appears in the catalog.</p>
            <div className="rounded-xl border border-dashed border-white/40 p-4" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!isSubmitting && !uncertain) addImages(Array.from(event.dataTransfer.files)); }}>
              <label htmlFor="product-images" className="field-label flex items-center gap-2"><Upload size={18} aria-hidden />Add images</label>
              <input id="product-images" type="file" multiple accept={PRODUCT_IMAGE_TYPES.join(',')} className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-space-700 file:px-3 file:py-3 file:text-white" aria-describedby="product-images-hint product-images-error" onChange={event => { addImages(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
              <p id="product-images-hint" className="field-hint">Drop files here or choose files. JPEG, PNG, WebP or GIF; up to 10 MB each, 10 new images per save.</p>
            </div>
            {imageError && <p id="product-images-error" className="field-error" role="alert">{imageError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {existingImages.map((url, index) => <div key={`${url}-${index}`} className="space-y-1"><div className="product-stage relative aspect-square overflow-hidden rounded-xl"><ProductImage src={url} alt={`Product image ${index + 1}`} sizes="160px" /></div><button type="button" className="btn-secondary w-full px-2" onClick={() => setExistingImages(previous => previous.filter((_, imageIndex) => imageIndex !== index))}><X size={14} aria-hidden />Remove {index + 1}</button></div>)}
              {images.map((file, index) => <div key={`${file.name}-${index}`} className="space-y-1"><div className="product-stage relative aspect-square overflow-hidden rounded-xl"><UploadPreview file={file} /></div><button type="button" className="btn-secondary w-full px-2" onClick={() => setImages(previous => previous.filter((_, imageIndex) => imageIndex !== index))}><X size={14} aria-hidden />Remove new {index + 1}</button></div>)}
            </div>
          </section>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5"><Link href="/admin/products" className="btn-secondary">Back to products</Link><button type="submit" className="btn-primary" disabled={isSubmitting || categories.isPending || categories.isError || uncertain}>{isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden />}{isSubmitting ? 'Saving product…' : savedId ? 'Save changes' : 'Create product'}</button></div>
    </fieldset>
    <ConfirmDialog open={removeVariant !== undefined} title="Remove variant" description="Remove this option from the product? It will no longer be available to buy after you save changes." confirmLabel="Remove variant" onCancel={() => setRemoveVariant(undefined)} onConfirm={() => { if (removeVariant !== undefined) variants.remove(removeVariant); setRemoveVariant(undefined); }} />
  </form>;
}
