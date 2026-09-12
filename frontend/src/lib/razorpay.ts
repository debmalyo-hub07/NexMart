export interface PaymentProof {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', callback: () => void) => void;
}
interface RazorpayOptions {
  key: string;
  order_id: string;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (response: PaymentProof) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}
export type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;
declare global { interface Window { Razorpay?: RazorpayConstructor } }

let sdk: Promise<RazorpayConstructor> | undefined;
export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (sdk) return sdk;
  sdk = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = window.setTimeout(failed, 15_000);
    function failed() { clearTimeout(timer); script.remove(); reject(new Error('Payment window could not load')); }
    script.onerror = failed;
    script.onload = () => { clearTimeout(timer); if (window.Razorpay) resolve(window.Razorpay); else failed(); };
    document.head.appendChild(script);
  }).catch(error => { sdk = undefined; throw error; });
  return sdk;
}
