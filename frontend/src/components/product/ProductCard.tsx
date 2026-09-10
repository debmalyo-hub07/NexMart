'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlist } from '@/hooks/useWishlist';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard = memo(function ProductCard({ product, className }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCartStore();
  const { showToast } = useUIStore();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const mainVariant = product.variants?.[0];
  const discount = mainVariant?.comparePrice
    ? Math.round((1 - mainVariant.price / mainVariant.comparePrice) * 100)
    : 0;

  const handleAddToCart = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!mainVariant || mainVariant.stock === 0 || isAdding) return;
    setIsAdding(true);
    try {
      await addItem(product._id, mainVariant.sku);
      showToast(`${product.name} added to cart`);
    } catch {
      showToast('Could not add this product to your cart. Try again.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article className={cn('group relative overflow-hidden rounded-xl border border-white/10 bg-space-800/70 transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-violet-500/45 hover:bg-space-700/70', className)}>
      <Link href={`/products/${product.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400">
        <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 ease-out [@media(hover:hover)]:group-hover:scale-[1.04]"
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/20">
              <ShoppingCart size={36} aria-hidden />
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {discount > 0 && <span className="badge-acid text-xs">{discount}% OFF</span>}
            {product.isFeatured && <span className="badge-violet text-xs">Featured</span>}
            {mainVariant?.stock === 0 && <span className="badge-red text-xs">Out of stock</span>}
          </div>

          <button
            type="button"
            aria-label={isWishlisted(product._id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            onClick={(event) => {
              event.preventDefault();
              void toggleWishlist(product._id);
            }}
            // Saved state stays visible at a glance on every device; only the
            // "add" affordance waits for hover on hover-capable pointers.
            className={cn(
              'absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 bg-space-900/75 text-white/70 backdrop-blur-sm transition-[color,background-color,border-color,opacity] hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300',
              isWishlisted(product._id) ? '' : 'hover-reveal',
            )}
          >
            <Heart size={17} className={isWishlisted(product._id) ? 'fill-red-400 text-red-400' : ''} aria-hidden />
          </button>
        </div>

        <div className="p-3.5 sm:p-4">
          <p className="mb-1 truncate text-meta text-white/55">{product.brand || product.category?.name || 'NexMart catalog'}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] font-outfit text-sm font-semibold leading-tight text-white transition-colors group-hover:text-violet-300">
            {product.name}
          </h3>

          {product.ratings?.count > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5" aria-label={`${product.ratings.average.toFixed(1)} out of 5 stars`}>
              <span className="flex" aria-hidden>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={11} className={star <= Math.round(product.ratings.average) ? 'fill-amber-400 text-amber-400' : 'text-white/20'} />
                ))}
              </span>
              <span className="text-meta text-white/55">({product.ratings.count})</span>
            </div>
          )}

          <div className="mt-3 flex min-h-7 items-baseline gap-2">
            <span className="font-mono text-base font-semibold tabular-nums text-acid-400 sm:text-lg">{formatPrice(mainVariant?.price || 0)}</span>
            {mainVariant?.comparePrice && <span className="text-meta text-white/40 line-through">{formatPrice(mainVariant.comparePrice)}</span>}
          </div>
        </div>
      </Link>

      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAdding || mainVariant?.stock === 0}
          className={cn(
            'min-h-11 w-full touch-manipulation rounded-xl px-3 text-sm font-semibold transition-[color,transform,box-shadow,background-color] duration-200',
            mainVariant?.stock === 0 ? 'cursor-not-allowed bg-white/5 text-white/30' : 'btn-primary',
          )}
        >
          {isAdding ? (
            <span className="inline-flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Adding</span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2"><ShoppingCart size={15} aria-hidden />{mainVariant?.stock === 0 ? 'Out of stock' : 'Add to cart'}</span>
          )}
        </button>
      </div>
    </article>
  );
});
