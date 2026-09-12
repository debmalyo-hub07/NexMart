'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api, { getApiError } from '@/lib/api';
import { loadRazorpay, type PaymentProof, type RazorpayConstructor } from '@/lib/razorpay';
import { paymentVerifyPath } from '@/lib/payment';
import { formatPrice } from '@/lib/utils';
import { useOnline } from '@/hooks/useOnline';
import { useAuthStore } from '@/store/authStore';
import type { ApiResponse, CheckoutReceipt, Order } from '@/types';

type Phase = 'idle' | 'checking' | 'loading' | 'open' | 'verifying' | 'cancelled' | 'failed' | 'uncertain' | 'processing' | 'success';
const messages: Record<Phase, string> = {
  idle: 'Your order is saved and awaiting payment. Complete payment on this order when you are ready.',
  checking: 'Checking payment with the payment provider…',
  loading: 'Preparing the payment window…',
  open: 'Complete payment in the Razorpay window. Keep this order page open.',
  verifying: 'Verifying your payment. Please wait before trying again.',
  cancelled: 'The payment window was closed. Your order is still saved. Check its payment status before trying again.',
  failed: 'The payment attempt did not complete. You can retry in the payment window or check this order again after closing it.',
  uncertain: 'We could not confirm the payment result. If your bank shows a debit, check payment status before paying again.',
  processing: 'The payment provider is still processing your payment. Wait and check again; do not make another payment yet.',
  success: 'Payment confirmed. Your order details are being refreshed.',
};

export function PaymentPanel({ order }: { order: Order }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [windowOpen, setWindowOpen] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const pending = useRef(false);
  const mounted = useRef(true);
  const instance = useRef<InstanceType<RazorpayConstructor> | undefined>(undefined);
  const proof = useRef<PaymentProof | undefined>(undefined);
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const online = useOnline();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; instance.current?.close(); }; }, []);
  const transition = (next: Phase, detail = '') => { phaseRef.current = next; if (mounted.current) { setPhase(next); setMessage(detail); } };
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] });
  }
  async function verify(response: PaymentProof) {
    proof.current = response;
    transition('verifying');
    if (mounted.current) setWindowOpen(false);
    try {
      await api.post(paymentVerifyPath(order._id), { razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature });
      proof.current = undefined;
      transition('success');
      await refresh();
    } catch (error) { transition('uncertain', getApiError(error)); }
    finally { pending.current = false; }
  }
  async function start(openWindow: boolean) {
    if (pending.current || !online) return;
    pending.current = true; transition('checking');
    if (proof.current) { await verify(proof.current); return; }
    try {
      const response = await api.post<ApiResponse<CheckoutReceipt>>(`/orders/${order._id}/payment`, { expectedTotal: order.total });
      const payment = response.data.data;
      if (!payment) throw new Error('Payment details unavailable');
      if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'refunded') { transition('success'); await refresh(); pending.current = false; return; }
      if (payment.processing) { transition('processing'); pending.current = false; return; }
      if (!openWindow) { transition('idle', 'No completed payment was found yet. If your bank shows a debit, wait for it to resolve before trying again.'); await refresh(); pending.current = false; return; }
      transition('loading');
      const Razorpay = await loadRazorpay();
      if (!mounted.current) { pending.current = false; return; }
      if (!payment.keyId || !payment.razorpayOrderId) throw new Error('Payment details unavailable');
      instance.current = new Razorpay({
        key: payment.keyId, order_id: payment.razorpayOrderId, currency: payment.currency,
        name: 'NexMart', description: `Order ${order.orderId}`,
        prefill: { name: order.shippingAddress.fullName, email: user?.email, contact: order.shippingAddress.phone },
        theme: { color: '#7C3AED' },
        handler: response => { void verify(response); },
        modal: { ondismiss: () => {
          if (!mounted.current) return;
          setWindowOpen(false);
          if (phaseRef.current === 'verifying' || phaseRef.current === 'success') return;
          pending.current = false; transition('cancelled'); void refresh();
        } },
      });
      instance.current.on('payment.failed', () => transition('failed'));
      setWindowOpen(true); transition('open'); instance.current.open();
    } catch (error) { transition('uncertain', getApiError(error)); pending.current = false; if (mounted.current) setWindowOpen(false); }
  }
  if (order.paymentMethod !== 'online' || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || order.orderStatus !== 'placed') return null;
  const busy = windowOpen || ['checking', 'loading', 'open', 'verifying'].includes(phase);
  return <section aria-labelledby="payment-title" className="rounded-2xl border border-violet-300/40 bg-space-800 p-4 sm:p-6">
    <h2 id="payment-title" className="flex items-center gap-2 text-xl"><CreditCard size={21} aria-hidden />Complete your payment</h2>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-secondary">{messages[phase]}</p>
    {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="btn-primary" disabled={!online || busy || phase === 'processing' || phase === 'success'} onClick={() => void start(true)}>{busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <CreditCard size={17} aria-hidden />}{busy ? 'Payment in progress…' : `Pay ${formatPrice(order.total)}`}</button>
      <button type="button" className="btn-secondary" disabled={!online || busy} onClick={() => void start(false)}><RefreshCw size={17} aria-hidden />Check payment status</button>
    </div>
    <p className="mt-3 text-xs text-muted">Retries use this saved order. Unpaid orders may be cancelled after 30 minutes without an active payment attempt.</p>
  </section>;
}
