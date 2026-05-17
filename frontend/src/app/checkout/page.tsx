'use client';

import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import api from '@/lib/api';
import { CheckCircle, Loader2, CreditCard, Truck } from 'lucide-react';
import Image from 'next/image';

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().length(6, 'Must be 6 digits'),
});

type AddressForm = z.infer<typeof addressSchema>;

declare global {
  interface Window { Razorpay: new (options: Record<string, unknown>) => { open: () => void }; }
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const total = subtotal();
  const shipping = total > 999 ? 0 : 49;
  const tax = Math.round(total * 0.18);
  const grandTotal = total + shipping + tax;

  const { register, handleSubmit, formState: { errors } } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: user?.name,
      phone: user?.phone || '',
    },
  });

  const onSubmit = async (addressData: AddressForm) => {
    if (items.length === 0) { showToast('Your cart is empty', 'error'); return; }
    setIsPlacing(true);

    try {
      const orderItems = items.map((item) => ({
        product: item.product._id,
        variant: item.variant,
        quantity: item.quantity,
      }));

      const { data } = await api.post('/orders', {
        items: orderItems,
        shippingAddress: { ...addressData, country: 'India' },
        paymentMethod,
      });

      if (paymentMethod === 'cod') {
        clearCart();
        setOrderSuccess(true);
        return;
      }

      // Razorpay
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: data.data.keyId,
          amount: grandTotal * 100,
          currency: 'INR',
          name: 'NexMart',
          description: 'Order Payment',
          order_id: data.data.razorpayOrderId,
          prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: '#7C3AED' },
          handler: async (response: Record<string, string>) => {
            try {
              await api.post('/orders/verify-payment', {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              clearCart();
              setOrderSuccess(true);
            } catch {
              showToast('Payment verification failed. Contact support.', 'error');
            }
          },
        });
        rzp.open();
      };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Order failed';
      showToast(msg, 'error');
    } finally {
      setIsPlacing(false);
    }
  };

  if (orderSuccess) return (
    <div className="min-h-screen bg-space-900 flex items-center justify-center">      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md mx-auto p-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
          className="w-24 h-24 rounded-full bg-acid-400/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-acid-400" />
        </motion.div>
        <h2 className="font-syne text-3xl font-bold text-white mb-3">Order Placed!</h2>
        <p className="text-white/60 mb-8">Your order has been confirmed. You'll receive a confirmation email shortly.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push('/orders')} className="btn-primary">View Orders</button>
          <button onClick={() => router.push('/products')} className="btn-secondary">Continue Shopping</button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-space-900">      <div className="pt-[72px]">
        <div className="page-container py-12">
          <h1 className="font-syne text-3xl font-bold text-white mb-8">Checkout</h1>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Address + Payment */}
              <div className="lg:col-span-2 space-y-6">
                {/* Shipping Address */}
                <div className="glass rounded-2xl p-6 border border-white/5">
                  <h3 className="font-syne font-semibold text-white mb-5 flex items-center gap-2">
                    <Truck size={18} className="text-violet-400" /> Shipping Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: 'fullName', label: 'Full Name', placeholder: 'John Doe' },
                      { name: 'phone', label: 'Phone Number', placeholder: '+91 9876543210' },
                    ].map(({ name, label, placeholder }) => (
                      <div key={name}>
                        <label className="text-xs text-white/60 mb-1 block">{label}</label>
                        <input {...register(name as keyof AddressForm)} placeholder={placeholder} className="input" />
                        {errors[name as keyof AddressForm] && (
                          <p className="text-xs text-red-400 mt-1">{errors[name as keyof AddressForm]?.message}</p>
                        )}
                      </div>
                    ))}
                    <div className="md:col-span-2">
                      <label className="text-xs text-white/60 mb-1 block">Address Line 1</label>
                      <input {...register('addressLine1')} placeholder="House/Flat No, Street Name" className="input" />
                      {errors.addressLine1 && <p className="text-xs text-red-400 mt-1">{errors.addressLine1.message}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-white/60 mb-1 block">Address Line 2 (optional)</label>
                      <input {...register('addressLine2')} placeholder="Landmark, Area" className="input" />
                    </div>
                    {[
                      { name: 'city', label: 'City' },
                      { name: 'state', label: 'State' },
                      { name: 'pincode', label: 'Pincode' },
                    ].map(({ name, label }) => (
                      <div key={name}>
                        <label className="text-xs text-white/60 mb-1 block">{label}</label>
                        <input {...register(name as keyof AddressForm)} placeholder={label} className="input" />
                        {errors[name as keyof AddressForm] && (
                          <p className="text-xs text-red-400 mt-1">{errors[name as keyof AddressForm]?.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="glass rounded-2xl p-6 border border-white/5">
                  <h3 className="font-syne font-semibold text-white mb-5 flex items-center gap-2">
                    <CreditCard size={18} className="text-violet-400" /> Payment Method
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'online', label: 'Pay Online', desc: 'UPI, Cards, Net Banking via Razorpay', icon: '⚡' },
                      { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: '💵' },
                    ].map(({ value, label, desc, icon }) => (
                      <button key={value} type="button" onClick={() => setPaymentMethod(value as 'online' | 'cod')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          paymentMethod === value ? 'border-violet-500 bg-violet-500/15' : 'border-white/10 glass hover:border-white/20'
                        }`}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{icon}</span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === value ? 'border-violet-400' : 'border-white/30'}`}>
                            {paymentMethod === value && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                          </div>
                        </div>
                        <p className="font-medium text-white text-sm">{label}</p>
                        <p className="text-xs text-white/40">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Order Summary */}
              <div className="lg:col-span-1">
                <div className="glass rounded-2xl p-6 border border-white/5 sticky top-24">
                  <h3 className="font-syne font-semibold text-white mb-4">Order Summary</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar mb-4">
                    {items.map((item) => (
                      <div key={item._id} className="flex items-center gap-3">
                        {item.product?.images?.[0] && (
                          <Image src={item.product.images[0]} alt="" width={44} height={44} className="rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{item.product?.name}</p>
                          <p className="text-xs text-white/40">×{item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-white/80 shrink-0">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 border-t border-white/10 pt-4 mb-5">
                    <div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
                    <div className="flex justify-between text-sm text-white/60"><span>Shipping</span><span className={shipping === 0 ? 'text-acid-400' : ''}>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
                    <div className="flex justify-between text-sm text-white/60"><span>GST (18%)</span><span>{formatPrice(tax)}</span></div>
                    <div className="flex justify-between font-syne font-bold text-white border-t border-white/10 pt-2">
                      <span>Grand Total</span><span className="text-acid-400">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>
                  <button type="submit" disabled={isPlacing} className="btn-primary w-full justify-center py-3.5">
                    {isPlacing ? <Loader2 size={16} className="animate-spin" /> : paymentMethod === 'online' ? '⚡ Pay Now' : '✅ Place Order'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
