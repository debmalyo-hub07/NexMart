'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { CreditCard, Loader2, Truck } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { deliveryAddressSchema, indianPhone, type DeliveryAddressValues } from '@/lib/address';
import { calculateTotals, getCartItemState } from '@/lib/commerce';
import { formatPrice } from '@/lib/utils';
import type { ApiResponse, CheckoutReceipt, User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useOnline } from '@/hooks/useOnline';
import { AddressFields } from '@/components/profile/AddressFields';
import { OrderTotals } from '@/components/cart/OrderTotals';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryError } from '@/components/common/QueryError';

export default function CheckoutPage() {
  const cart = useCartStore();
  const user = useAuthStore(s => s.user);
  const online = useOnline();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<'online' | 'cod'>('online');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const checkoutId = useRef('');
  const storageKey = 'nexmart-checkout:' + (user?.email || user?._id || 'customer');
  const profile = useQuery({ queryKey: ['customer', 'profile'], queryFn: ({ signal }) => api.get<ApiResponse<User>>('/customer/profile', { signal }).then(r => r.data.data), enabled: !!user });
  const form = useForm<DeliveryAddressValues>({ resolver: zodResolver(deliveryAddressSchema), defaultValues: { fullName: user?.name || '', phone: indianPhone(user?.phone), addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', country: 'India' } });
  const { reset, formState: { isDirty } } = form;
  useEffect(() => {
    if (!profile.data || isDirty) return;
    const address = profile.data.addresses?.find(item => item.isDefault);
    reset({ fullName: address?.fullName || profile.data.name, phone: indianPhone(address?.phone || profile.data.phone), addressLine1: address?.addressLine1 || '', addressLine2: address?.addressLine2 || '', city: address?.city || '', state: address?.state || '', pincode: address?.pincode || '', country: 'India' });
  }, [profile.data, isDirty, reset]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    try { checkoutId.current = sessionStorage.getItem(storageKey) || ''; }
    catch { if (active) setError('Your browser could not save checkout progress. Allow site storage before placing an order.'); }
    if (!checkoutId.current) { setRecovering(false); return; }
    api.get<ApiResponse<CheckoutReceipt>>(`/orders/checkout/${checkoutId.current}`).then(response => {
      if (!active || !response.data.data) return;
      sessionStorage.removeItem(storageKey);
      void useCartStore.getState().fetchCart();
      router.replace(`/orders/${response.data.data.orderId}`);
    }).catch(error => {
      if (!active) return;
      if (!(error instanceof AxiosError && error.response?.status === 404)) { setUncertain(true); setError('We could not check your previous checkout. Check your orders before continuing.'); }
    }).finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [user, storageKey, router]);
  const totals = calculateTotals(cart.items.map(item => ({ price: getCartItemState(item).price, quantity: item.quantity })));
  const unavailable = cart.items.some(item => !getCartItemState(item).available);
  const blocked = !online || !cart.ready || cart.isLoading || !!cart.error || unavailable || recovering;
  async function submit(address: DeliveryAddressValues) {
    if (pending.current || blocked || !cart.items.length) return;
    pending.current = true; setBusy(true); setError('');
    try {
      checkoutId.current ||= crypto.randomUUID();
      // Save only the recovery identity, never the address or payment details.
      sessionStorage.setItem(storageKey, checkoutId.current);
      const response = await api.post<ApiResponse<CheckoutReceipt>>('/orders', {
        checkoutId: checkoutId.current,
        items: cart.items.map(item => ({ product: item.product!._id, variant: item.variant, quantity: item.quantity, expectedPrice: getCartItemState(item).price })),
        shippingAddress: address, paymentMethod: method, expectedTotal: totals.total,
      });
      if (!response.data.data) throw new Error('Order response missing');
      sessionStorage.removeItem(storageKey);
      void cart.fetchCart();
      void queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] });
      router.replace(`/orders/${response.data.data.orderId}`);
    } catch (error) {
      const known = error instanceof AxiosError && !!error.response && error.response.status < 500;
      setUncertain(!known);
      setError(known ? getApiError(error) : 'We could not confirm whether your order was saved. Check your orders, or retry this checkout to recover the same order.');
      if (known) void cart.fetchCart();
      pending.current = false; setBusy(false);
    }
  }
  return <main id="main-content" className="store-page"><div className="page-container">
    <PageHeader title="Checkout" description="Review your delivery address and the final amount before placing your order." />
    {error && <div role="alert" className="mb-6 rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200"><p>{error}</p><Link href="/orders" className="mt-2 inline-flex min-h-11 items-center underline">Check your orders</Link></div>}
    {recovering || !cart.ready && !cart.error ? <p role="status" className="flex items-center gap-2 py-10 text-secondary"><Loader2 className="animate-spin" size={20} aria-hidden />Checking checkout information…</p>
      : cart.error || unavailable ? <div className="card space-y-4"><p className="text-secondary">Your cart needs attention before you can order.</p><Link href="/cart" className="btn-primary">Review cart</Link></div>
      : !cart.items.length ? <EmptyState title="Your cart is empty" description={uncertain ? 'Check your orders to see whether your checkout was saved.' : 'Add a product to start a new order.'} action={<><Link href="/orders" className="btn-secondary">Your orders</Link><Link href="/products" className="btn-primary">Browse products</Link></>} />
      : <FormProvider {...form}><form onSubmit={form.handleSubmit(submit)} noValidate><fieldset disabled={busy || recovering} className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6"><section className="card"><h2 className="mb-5 flex items-center gap-2 text-xl"><Truck size={21} aria-hidden />Delivery address</h2>
          {profile.isError && <div className="mb-4"><QueryError label="Saved addresses" onRetry={() => void profile.refetch()} /></div>}
          {!!profile.data?.addresses?.length && <div className="mb-5"><label htmlFor="checkout-address" className="field-label">Use a saved address</label><select id="checkout-address" className="input" defaultValue="" onChange={event => { const address = profile.data?.addresses.find(item => item._id === event.target.value); if (address) reset({ ...address, phone: indianPhone(address.phone), country: 'India' }); }}><option value="">Enter or edit an address below</option>{profile.data.addresses.map(address => <option key={address._id} value={address._id}>{address.label} — {address.addressLine1}, {address.city}</option>)}</select></div>}
          <AddressFields /><p className="field-hint mt-4">Delivery country: India. Changes here apply to this order.</p>
        </section><fieldset className="card"><legend className="px-1 text-xl font-semibold">Payment method</legend><div className="grid gap-3 sm:grid-cols-2">{[{ value: 'online', title: 'Pay online', text: 'Continue to Razorpay after the order is saved.' }, { value: 'cod', title: 'Cash on delivery', text: 'Pay the order total when your order arrives.' }].map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${method === option.value ? 'border-violet-300 bg-violet-500/10' : 'border-white/30'}`}><input type="radio" name="paymentMethod" checked={method === option.value} onChange={() => setMethod(option.value as 'online' | 'cod')} className="mt-1 h-5 w-5 shrink-0 accent-violet-500" /><span><span className="block text-sm font-medium">{option.title}</span><span className="mt-1 block text-xs text-secondary">{option.text}</span></span></label>)}</div></fieldset></div>
        <aside className="card h-fit space-y-5 lg:sticky lg:top-24"><h2 className="text-xl">Review your order</h2><ul className="space-y-3">{cart.items.map(item => <li key={item._id} className="flex justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words">{item.product?.name}</p><p className="break-words text-xs text-muted">{item.variant} · Quantity {item.quantity}</p>{getCartItemState(item).priceChanged && <p className="text-xs text-amber-200">Updated price shown</p>}</div><span className="shrink-0 font-mono">{formatPrice(getCartItemState(item).price * item.quantity)}</span></li>)}</ul><OrderTotals totals={totals} /><p className="text-xs text-secondary">{method === 'online' ? 'Your order will be saved first. You can then complete payment on its order page.' : 'Your order will be placed and will await store confirmation.'}</p><button type="submit" disabled={blocked || busy} className="btn-primary w-full">{busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <CreditCard size={18} aria-hidden />}{busy ? 'Saving order…' : uncertain ? 'Retry this checkout' : method === 'online' ? 'Place order & continue' : 'Place order'}</button><Link href="/cart" className="inline-flex min-h-11 items-center text-sm text-secondary underline">Return to cart</Link></aside>
      </fieldset></form></FormProvider>}
  </div></main>;
}
