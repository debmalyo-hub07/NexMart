import Link from 'next/link';
import { ArrowUpRight, CreditCard, PackageCheck, ReceiptText, RotateCcw } from 'lucide-react';

/** Reassurance must describe an implemented capability, never a simulated ETA. */
export function PDPTrustStrip() {
  return <section aria-label="Before you order" className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
    <h2 className="mb-4 text-base font-semibold">A little clarity before you order</h2>
    <div className="grid gap-5 sm:grid-cols-2">
      {[{ Icon: PackageCheck, title: 'Delivery, clearly explained', copy: '₹49 delivery on item totals up to ₹999. Free above ₹999. Follow actual dispatch and tracking in your orders.', href: '/shipping' }, { Icon: RotateCcw, title: 'Know your return options', copy: 'Windows vary by seller and item. Review the offer terms and request help from your order.', href: '/returns' }, { Icon: ReceiptText, title: 'Applicable taxes included', copy: 'Review the complete item and delivery total before confirming your order.', href: '/cart' }, { Icon: CreditCard, title: 'Payment handled securely', copy: 'Pay through Razorpay using the methods it offers, or choose cash on delivery at checkout.', href: '/help' }].map(({ Icon, title, copy, href }) => <Link key={title} href={href} className="flex items-start gap-3"><Icon size={19} className="mt-1 shrink-0 text-[var(--brand)]" aria-hidden /><span><strong className="block text-xs font-semibold">{title}</strong><span className="mt-1 block text-xs leading-relaxed text-secondary">{copy}</span><ArrowUpRight size={14} className="mt-1 text-muted" aria-hidden /></span></Link>)}
    </div>
    <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-muted">Delivery dates depend on the seller and destination. A pincode alone does not confirm serviceability or an arrival date.</p>
  </section>;
}
