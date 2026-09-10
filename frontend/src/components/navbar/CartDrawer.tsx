'use client';

import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useDrawerBehavior } from '@/hooks/useDrawerBehavior';
import { CartItem } from '@/types';

// Stable animation variants — no recreation per render
const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const drawerVariants = { hidden: { x: '100%' }, visible: { x: 0 } };
const drawerTransition = { type: 'spring' as const, damping: 28, stiffness: 220 };
const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit:   { opacity: 0, x: -20, height: 0, marginBottom: 0 },
};

const CartItemRow = memo(function CartItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="glass rounded-2xl p-4 flex gap-4"
    >
      {item.product?.images?.[0] && (
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5">
          <Image
            src={item.product.images[0]}
            alt={item.product.name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.product?.name}</p>
        <p className="text-xs text-white/40 mt-0.5">SKU: {item.variant}</p>
        <p className="text-sm font-semibold text-acid-400 mt-1">{formatPrice(item.price)}</p>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center glass rounded-lg">
            <button
              onClick={() => item.quantity > 1 ? onUpdate(item._id, item.quantity - 1) : onRemove(item._id)}
              className="p-1.5 hover:bg-white/5 rounded-l-lg transition-colors text-white/60 hover:text-white"
              suppressHydrationWarning
            >
              <Minus size={12} />
            </button>
            <span className="px-3 text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => onUpdate(item._id, item.quantity + 1)}
              className="p-1.5 hover:bg-white/5 rounded-r-lg transition-colors text-white/60 hover:text-white"
              suppressHydrationWarning
            >
              <Plus size={12} />
            </button>
          </div>

          <button
            onClick={() => onRemove(item._id)}
            className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
            suppressHydrationWarning
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export const CartDrawer = memo(function CartDrawer() {
  const { items, isOpen, setOpen, updateItem, removeItem, subtotal } = useCartStore();
  const router = useRouter();

  const total = subtotal();
  const shipping = total > 999 ? 0 : 49;

  const closeDrawer = useCallback(() => setOpen(false), [setOpen]);
  const goToCheckout = useCallback(() => { setOpen(false); router.push('/checkout'); }, [setOpen, router]);
  const goToCart = useCallback(() => { setOpen(false); router.push('/cart'); }, [setOpen, router]);
  const goToProducts = useCallback(() => { setOpen(false); router.push('/products'); }, [setOpen, router]);

  // Same modal contract as the mobile nav and admin sidebar drawers: no
  // document scroll behind the drawer, Escape closes.
  useDrawerBehavior(isOpen, closeDrawer);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={drawerTransition}
            className="fixed right-0 top-0 h-full w-full max-w-[420px] z-50 flex flex-col glass border-l border-white/[0.08]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-violet-400" />
                <h2 className="font-syne font-bold text-lg">Your Cart</h2>
                <span className="badge-violet">{items.length}</span>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
                suppressHydrationWarning
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center">
                    <ShoppingBag size={32} className="text-white/20" />
                  </div>
                  <div>
                    <p className="font-syne font-semibold text-white/60">Your cart is empty</p>
                    <p className="text-sm text-white/30 mt-1">Add products to get started</p>
                  </div>
                  <button onClick={goToProducts} className="btn-primary mt-2" suppressHydrationWarning>
                    Browse Products
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <CartItemRow
                      key={item._id}
                      item={item}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-white/5 space-y-4 shrink-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/60">
                    <span>Subtotal</span><span>{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/60">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-acid-400' : ''}>
                      {shipping === 0 ? 'Free' : formatPrice(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-2">
                    <span>Total</span><span>{formatPrice(total + shipping)}</span>
                  </div>
                </div>

                <button
                  onClick={goToCheckout}
                  className="btn-primary w-full justify-center group"
                  suppressHydrationWarning
                >
                  Checkout <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={goToCart}
                  className="btn-secondary w-full justify-center text-sm"
                  suppressHydrationWarning
                >
                  View Full Cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
