'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Share2, Star, Shield, Truck, RefreshCw, Package, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ProductGallery } from '@/components/product/ProductGallery';
import { VariantSelector } from '@/components/product/VariantSelector';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton, Skeleton } from '@/components/common/SkeletonLoader';
import api from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';
import { ReviewSection } from '@/components/product/ReviewSection';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedSku, setSelectedSku] = useState('');
  const [qty, setQty] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  const { addItem } = useCartStore();
  const { showToast } = useUIStore();

  const { data, isLoading } = useQuery<{ data: Product }>({
    queryKey: ['product', slug],
    queryFn: () => api.get(`/products/${slug}`).then((r) => r.data),
  });

  // Set default SKU when product loads
  useEffect(() => {
    if (data?.data?.variants?.[0]?.sku) {
      setSelectedSku(data.data.variants[0].sku);
    }
  }, [data]);

  const product: Product | undefined = data?.data;
  const variant = product?.variants.find((v) => v.sku === selectedSku);
  const discount = variant?.comparePrice ? Math.round((1 - variant.price / variant.comparePrice) * 100) : 0;

  const { data: relatedData } = useQuery({
    queryKey: ['related', product?.category?._id],
    queryFn: () => api.get(`/products?category=${product?.category?._id}&limit=4`).then((r) => r.data),
    enabled: !!product?.category?._id,
  });

  const handleAddToCart = async () => {
    if (!variant) return;
    setIsAdding(true);
    try {
      await addItem(product!._id, selectedSku, qty);
      showToast(`${product!.name} added to cart!`);
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px] page-container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="aspect-square rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" /><Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-1/4" /><Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center">      <div className="text-center">
        <p className="text-5xl mb-4">😕</p>
        <h2 className="font-syne text-2xl font-bold text-white mb-2">Product not found</h2>
        <Link href="/products" className="btn-primary mt-4 inline-flex">Browse Products</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        {/* Breadcrumb */}
        <div className="border-b border-white/5 bg-space-800/30">
          <div className="page-container py-3 flex items-center gap-2 text-xs text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/products" className="hover:text-white transition-colors">Products</Link>
            {product.category && <>
              <ChevronRight size={12} />
              <Link href={`/categories/${product.category.slug}`} className="hover:text-white transition-colors">{product.category.name}</Link>
            </>}
            <ChevronRight size={12} />
            <span className="text-white/60 truncate max-w-[200px]">{product.name}</span>
          </div>
        </div>

        <div className="page-container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            {/* Gallery */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductGallery images={product.images} name={product.name} />
            </div>

            {/* Info */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                {product.brand && <p className="text-sm text-violet-400 font-medium mb-1">{product.brand}</p>}
                <h1 className="font-syne text-2xl md:text-3xl font-bold text-white leading-tight">{product.name}</h1>
              </div>

              {/* Rating */}
              {product.ratings.count > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={16} className={s <= Math.round(product.ratings.average) ? 'fill-amber-400 text-amber-400' : 'text-white/20'} />
                    ))}
                  </div>
                  <span className="text-sm text-white/60">{product.ratings.average.toFixed(1)} ({product.ratings.count} reviews)</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-end gap-3">
                <span className="font-syne text-4xl font-bold text-acid-400">{formatPrice(variant?.price || 0)}</span>
                {variant?.comparePrice && (
                  <span className="text-xl text-white/30 line-through mb-1">{formatPrice(variant.comparePrice)}</span>
                )}
                {discount > 0 && <span className="badge-acid mb-1">{discount}% OFF</span>}
              </div>

              {/* Variants */}
              {product.variants.length > 1 && (
                <VariantSelector variants={product.variants} selectedSku={selectedSku} onSelect={setSelectedSku} />
              )}

              {/* Quantity */}
              <div>
                <p className="text-xs font-medium text-white/60 mb-2">Quantity</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center glass rounded-xl">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-white/60 hover:text-white transition-colors">−</button>
                    <span className="px-4 text-sm font-semibold">{qty}</span>
                    <button onClick={() => setQty((q) => Math.min(variant?.stock || 1, q + 1))} className="px-3 py-2 text-white/60 hover:text-white transition-colors">+</button>
                  </div>
                  {variant && <p className="text-xs text-white/40">{variant.stock} in stock</p>}
                </div>
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                <button onClick={handleAddToCart} disabled={isAdding || !variant || variant.stock === 0}
                  className="btn-primary flex-1 justify-center py-4 text-base">
                  {isAdding ? <Loader2 size={18} className="animate-spin" /> : <><ShoppingCart size={18} /> Add to Cart</>}
                </button>
                <button onClick={() => setWishlist(!wishlist)} className={`p-4 rounded-xl transition-all border ${wishlist ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'glass border-white/10 text-white/50 hover:text-white'}`}>
                  <Heart size={18} className={wishlist ? 'fill-current' : ''} />
                </button>
                <button className="p-4 rounded-xl glass border border-white/10 text-white/50 hover:text-white transition-colors">
                  <Share2 size={18} />
                </button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[{ Icon: Shield, text: '100% Secure' }, { Icon: Truck, text: 'Fast Delivery' }, { Icon: RefreshCw, text: '30-Day Returns' }, { Icon: Package, text: 'Genuine Product' }].map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-white/50">
                    <Icon size={13} className="text-violet-400" /> {text}
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="border-t border-white/5 pt-6">
                <h3 className="font-syne font-semibold text-white mb-3">About this product</h3>
                <p className="text-sm text-white/60 leading-relaxed">{product.description}</p>
              </div>

              {/* Specifications */}
              {Object.keys(product.specifications || {}).length > 0 && (
                <div className="border-t border-white/5 pt-6">
                  <h3 className="font-syne font-semibold text-white mb-3">Specifications</h3>
                  <div className="space-y-2">
                    {Object.entries(product.specifications).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                        <span className="text-white/50">{k}</span>
                        <span className="text-white font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Related products */}
          {relatedData?.data?.length > 0 && (
            <div>
              <h2 className="font-syne text-2xl font-bold text-white mb-6">You Might Also Like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                {(relatedData.data as Product[]).filter((p: Product) => p.slug !== slug).slice(0, 4).map((p: Product) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {product && <ReviewSection productId={product._id} ratings={product.ratings} />}
        </div>
      </div>    </div>
  );
}
