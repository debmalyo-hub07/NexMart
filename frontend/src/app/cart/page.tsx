'use client';

import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const { items, updateItem, removeItem, clearCart, subtotal } = useCartStore();
  const router = useRouter();
  const total = subtotal();
  const shipping = total > 999 ? 0 : 49;
  const tax = Math.round(total * 0.18);
  const grandTotal = total + shipping + tax;

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        <div className="page-container py-12">
          <h1 className="font-syne text-3xl font-bold text-white mb-8 flex items-center gap-3">
            <ShoppingBag size={28} className="text-violet-400" />
            Shopping Cart
            {items.length > 0 && <span className="badge-violet">{items.length} items</span>}
          </h1>

          {items.length === 0 ? (
            <div className="text-center py-32">
              <div className="w-24 h-24 rounded-3xl glass flex items-center justify-center mx-auto mb-6">
                <ShoppingBag size={40} className="text-white/20" />
              </div>
              <h2 className="font-syne text-2xl font-bold text-white mb-3">Your cart is empty</h2>
              <p className="text-white/40 mb-8">Add some products to get started</p>
              <Link href="/products" className="btn-primary inline-flex">Browse Products <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div key={item._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }}
                      className="glass rounded-2xl p-4 flex gap-4 border border-white/5">
                      {item.product?.images?.[0] && (
                        <Link href={`/products/${item.product.slug}`} className="shrink-0">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5">
                            <Image src={item.product.images[0]} alt={item.product.name} width={80} height={80} className="object-cover w-full h-full" />
                          </div>
                        </Link>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${item.product?.slug}`}>
                          <h3 className="font-medium text-white text-sm hover:text-violet-300 transition-colors line-clamp-2">{item.product?.name}</h3>
                        </Link>
                        <p className="text-xs text-white/40 mt-0.5">SKU: {item.variant}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center glass rounded-lg">
                            <button onClick={() => item.quantity > 1 ? updateItem(item._id, item.quantity - 1) : removeItem(item._id)}
                              className="px-3 py-1.5 text-white/60 hover:text-white transition-colors"><Minus size={13} /></button>
                            <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                            <button onClick={() => updateItem(item._id, item.quantity + 1)}
                              className="px-3 py-1.5 text-white/60 hover:text-white transition-colors"><Plus size={13} /></button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-syne font-bold text-acid-400">{formatPrice(item.price * item.quantity)}</span>
                            <button onClick={() => removeItem(item._id)} className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="flex items-center justify-between pt-2">
                  <Link href="/products" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                    <ArrowLeft size={14} /> Continue Shopping
                  </Link>
                  <button onClick={() => clearCart()} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Clear Cart</button>
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="glass rounded-2xl p-6 border border-white/5 sticky top-24">
                  <h3 className="font-syne font-semibold text-white mb-5">Order Summary</h3>
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between text-sm text-white/60">
                      <span>Subtotal ({items.length} items)</span><span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-white/60">
                      <span>Shipping</span>
                      <span className={shipping === 0 ? 'text-acid-400' : ''}>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-white/60">
                      <span>GST (18%)</span><span>{formatPrice(tax)}</span>
                    </div>
                    {total < 999 && (
                      <div className="glass rounded-lg p-3 text-xs text-white/50">
                        Add {formatPrice(999 - total)} more for <span className="text-acid-400 font-medium">FREE shipping</span>
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-3 flex justify-between font-syne font-bold text-white">
                      <span>Total</span><span className="text-acid-400">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>

                  <button onClick={() => router.push('/checkout')} className="btn-primary w-full justify-center py-3.5 text-base">
                    Proceed to Checkout <ArrowRight size={16} />
                  </button>

                  <div className="flex items-center justify-center gap-3 mt-4">
                    {['Razorpay', 'UPI', 'COD'].map((p) => (
                      <span key={p} className="text-[10px] px-2 py-1 glass rounded text-white/30 border border-white/5">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>    </div>
  );
}
