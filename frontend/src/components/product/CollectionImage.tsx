import Image from 'next/image';
import type { Category } from '@/types';
import { ProductImage } from './ProductImage';

const photography: Record<string, string> = {
  mobiles: 'mobiles', electronics: 'audio', appliances: 'appliances', fashion: 'fashion',
  beauty: 'beauty', home: 'living-room', grocery: 'grocery', sports: 'sports', books: 'books',
};

/** Editorial department photography, separate from images of an actual SKU. */
export function CollectionImage({ category, sizes = '160px', priority = false }: { category: Pick<Category, 'slug' | 'name' | 'image'>; sizes?: string; priority?: boolean }) {
  const photo = photography[category.slug];
  if (photo) return <Image src={`/images/collections/${photo}.webp`} alt="" fill sizes={sizes} priority={priority} className="collection-image object-cover" />;
  if (category.image) return <ProductImage src={category.image} alt="" sizes={sizes} priority={priority} className="p-3" />;
  return <span className="flex h-full items-center justify-center font-display text-4xl text-secondary" aria-hidden>{category.name.slice(0, 1)}</span>;
}
