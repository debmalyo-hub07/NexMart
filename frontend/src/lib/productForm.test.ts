import { describe, expect, it } from 'vitest';
import { productFormDefaults, productFormPayload, productFormSchema, validateProductImages } from './productForm';
import type { Product } from '@/types';

describe('catalog editing contract', () => {
  const product = {
    name: 'Existing phone', description: 'A real catalog description', category: { _id: 'category' },
    richDescription: 'Additional existing detail', specifications: { Warranty: 'One year' }, tags: ['phone'],
    variants: [{ sku: 'PHONE-BLUE', price: 199.99, comparePrice: 250, stock: 3, attributes: { Color: 'Blue', Storage: '256GB' }, images: ['https://res.cloudinary.com/test/image/upload/phone.webp'] }],
  } as unknown as Product;

  it('preserves variant attributes, images and specifications through validation and a price edit', () => {
    const draft = productFormDefaults(product);
    draft.variants[0].price = 209.99;
    const payload = productFormPayload(productFormSchema.parse(draft));
    expect(payload.variants[0]).toEqual({ ...product.variants[0], price: 209.99 });
    expect(payload.specifications).toEqual(product.specifications);
    expect(payload.richDescription).toBe(product.richDescription);
    expect(payload.tags).toEqual(product.tags);
  });

  it('rejects duplicate SKU/attribute identities and fractional inventory before saving', () => {
    const draft = productFormDefaults(product);
    draft.variants.push({ ...draft.variants[0], stock: 1.5, attributes: [{ key: 'Color', value: 'Blue' }, { key: 'color', value: 'Red' }] });
    const result = productFormSchema.safeParse(draft);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual(expect.arrayContaining(['variants.1.stock', 'variants.1.attributes.1.key', 'variants.1.sku']));
  });

  it('matches the image endpoint limits for selected and dropped files', () => {
    expect(validateProductImages([{ type: 'image/svg+xml', size: 100 }], 0)).toContain('JPEG');
    expect(validateProductImages([{ type: 'image/jpeg', size: 11 * 1024 * 1024 }], 0)).toContain('10 MB');
    expect(validateProductImages([{ type: 'image/webp', size: 100 }], 10)).toContain('10 new');
    expect(validateProductImages([{ type: 'image/webp', size: 100 }], 0)).toBeUndefined();
  });
});
