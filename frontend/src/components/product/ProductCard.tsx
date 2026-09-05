'use client';

import { useState, useRef, memo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Heart, Star, Eye } from 'lucide-react';
import { Product } from '@/types';
import { formatPrice, cn } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard = memo(function ProductCard({ product, className }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCartStore();
  const { showToast } = useUIStore();

  // 3D Tilt Effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const [coords, setCoords] = useState({ mouseX: 0, mouseY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
    setCoords({ mouseX, mouseY });
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const mainVariant = product.variants[0];
  const discount = mainVariant?.comparePrice
    ? Math.round((1 - mainVariant.price / mainVariant.comparePrice) * 100)
    : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!mainVariant) return;
    setIsAdding(true);
    try {
      await addItem(product._id, mainVariant.sku);
      showToast(`${product.name} added to cart!`);

      // Confetti burst effect
      const el = (e.target as HTMLElement).closest('button');
      if (el) {
        el.classList.add('animate-confetti');
        setTimeout(() => el.classList.remove('animate-confetti'), 800);
      }
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <motion.div
      className={cn('group relative glass rounded-2xl overflow-hidden glass-hover cursor-pointer transition-colors duration-300 card-glow-wrapper', className)}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
        transformStyle: 'preserve-3d',
        ...({
          '--mouse-x': `${coords.mouseX}px`,
          '--mouse-y': `${coords.mouseY}px`,
        } as React.CSSProperties),
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-glow-overlay" />
      <div style={{ transform: 'translateZ(30px)' }}>
      <Link href={`/products/${product.slug}`}>
        {/* Image */}
        <div className="relative h-52 bg-white/[0.03] overflow-hidden">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/10">
              <ShoppingCart size={40} />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount > 0 && (
              <span className="badge-acid text-xs">{discount}% OFF</span>
            )}
            {product.isFeatured && (
              <span className="badge-violet text-xs">Featured</span>
            )}
            {mainVariant?.stock === 0 && (
              <span className="badge-red text-xs">Out of Stock</span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={(e) => { e.preventDefault(); setIsWishlisted(!isWishlisted); }}
            className="absolute top-3 right-3 p-2 rounded-xl glass opacity-0 group-hover:opacity-100 transition-all duration-200"
            suppressHydrationWarning
          >
            <Heart
              size={16}
              className={isWishlisted ? 'fill-red-400 text-red-400' : 'text-white/60'}
            />
          </button>

          {/* Quick view overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <span className="flex items-center gap-2 text-white text-sm font-medium glass px-4 py-2 rounded-xl">
              <Eye size={14} /> Quick View
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-white/40 mb-1">{product.brand || product.category?.name}</p>
          <h3 className="font-medium text-white text-sm leading-tight line-clamp-2 mb-2 group-hover:text-violet-300 transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          {product.ratings.count > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={11}
                    className={star <= Math.round(product.ratings.average) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}
                  />
                ))}
              </div>
              <span className="text-xs text-white/40">({product.ratings.count})</span>
            </div>
          )}

          {/* Price row */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-syne font-bold text-acid-400 text-lg">
                {formatPrice(mainVariant?.price || 0)}
              </span>
              {mainVariant?.comparePrice && (
                <span className="text-xs text-white/30 line-through ml-2">
                  {formatPrice(mainVariant.comparePrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Add to cart button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleAddToCart}
          disabled={isAdding || mainVariant?.stock === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            mainVariant?.stock === 0
              ? 'bg-white/5 text-white/20 cursor-not-allowed'
              : 'btn-primary'
          )}
          suppressHydrationWarning
        >
          {isAdding ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <ShoppingCart size={14} />
              {mainVariant?.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </>
          )}
        </button>
      </div>
      </div>
    </motion.div>
  );
});
