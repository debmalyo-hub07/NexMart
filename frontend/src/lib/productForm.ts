import { z } from 'zod';
import type { Product } from '@/types';

const detailsSchema = z.array(z.object({
  key: z.string().trim().min(1, 'Enter a name').max(80),
  value: z.string().trim().min(1, 'Enter a value'),
})).superRefine((details, context) => {
  const seen = new Set<string>();
  details.forEach((detail, index) => {
    const key = detail.key.toLowerCase();
    if (seen.has(key)) context.addIssue({ code: 'custom', path: [index, 'key'], message: 'Use each name once' });
    seen.add(key);
  });
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(200),
  description: z.string().trim().min(10, 'Describe the product in at least 10 characters'),
  richDescription: z.string().optional(),
  category: z.string().min(1, 'Choose a category'),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  tags: z.string(),
  specifications: detailsSchema,
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  variants: z.array(z.object({
    sku: z.string().trim().min(1, 'Enter a SKU'),
    price: z.number().finite().positive('Price must be greater than zero'),
    comparePrice: z.number().finite().positive('MRP must be greater than zero').optional(),
    stock: z.number().int('Stock must be a whole number').min(0, 'Stock cannot be negative'),
    attributes: detailsSchema,
    images: z.array(z.string()),
  })).min(1, 'Add at least one variant'),
}).superRefine((product, context) => {
  const skus = new Set<string>();
  product.variants.forEach((variant, index) => {
    if (skus.has(variant.sku)) context.addIssue({ code: 'custom', path: ['variants', index, 'sku'], message: 'Each variant needs a unique SKU' });
    skus.add(variant.sku);
    if (variant.comparePrice !== undefined && variant.comparePrice < variant.price) context.addIssue({ code: 'custom', path: ['variants', index, 'comparePrice'], message: 'MRP cannot be less than the selling price' });
  });
});

export type ProductFormData = z.infer<typeof productFormSchema>;
const pairs = (value: Record<string, string> = {}) => Object.entries(value).map(([key, item]) => ({ key, value: item }));

export function productFormDefaults(product?: Product): ProductFormData {
  return {
    name: product?.name ?? '', description: product?.description ?? '', richDescription: product?.richDescription ?? '',
    category: typeof product?.category === 'string' ? product.category : product?.category?._id ?? '',
    subCategory: product?.subCategory ?? '', brand: product?.brand ?? '', tags: product?.tags?.join(', ') ?? '',
    specifications: pairs(product?.specifications), isPublished: product?.isPublished ?? false, isFeatured: product?.isFeatured ?? false,
    variants: product?.variants?.map(variant => ({ ...variant, attributes: pairs(variant.attributes), images: variant.images ?? [] }))
      ?? [{ sku: '', price: 0, stock: 0, attributes: [], images: [] }],
  };
}

export function productFormPayload(data: ProductFormData) {
  return {
    ...data,
    tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    specifications: Object.fromEntries(data.specifications.map(detail => [detail.key, detail.value])),
    variants: data.variants.map(variant => ({ ...variant, attributes: Object.fromEntries(variant.attributes.map(detail => [detail.key, detail.value])) })),
  };
}

export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export function validateProductImages(files: { type: string; size: number }[], selectedCount: number) {
  if (selectedCount + files.length > 10) return 'Choose up to 10 new images at a time.';
  if (files.some(file => !PRODUCT_IMAGE_TYPES.includes(file.type))) return 'Choose JPEG, PNG, WebP or GIF images.';
  if (files.some(file => file.size > 10 * 1024 * 1024)) return 'Each image must be 10 MB or smaller.';
  return undefined;
}
