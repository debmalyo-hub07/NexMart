import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/PageHeader';

export const metadata: Metadata = { title: 'Shopping help' };

export default function HelpPage() {
  return <main id="main-content" className="store-page"><div className="page-container">
    <PageHeader title="Shopping help" description="A guide to your cart, payments, and orders." />
    <div className="max-w-3xl divide-y divide-white/10">
      {[
        ['How is my total calculated?', 'Checkout lists the current item prices, shipping, and tax separately before you place the order. Review the final amount and delivery address before continuing.'],
        ['How can I pay?', 'Choose online payment through Razorpay or cash on delivery. The online payment window shows the methods available for your transaction.'],
        ['Where can I track my order?', 'Open Orders in your account, then select an order. Payment status and delivery progress are shown separately, along with the latest available updates.'],
        ['What if a payment is interrupted?', 'Check the payment status in your order details before trying again. If your bank shows a debit but the order is still awaiting payment, do not make another payment until the first transaction is resolved.'],
        ['What are the delivery and return terms?', 'A delivery date and return policy are not currently published by the store. Do not assume a delivery deadline or return window when placing an order.'],
      ].map(([title, copy]) => <section key={title} className="py-6 first:pt-0"><h2 className="text-xl">{title}</h2><p className="mt-2 text-sm leading-relaxed text-secondary">{copy}</p></section>)}
    </div>
    <div className="mt-6 flex flex-wrap gap-3"><Link href="/orders" className="btn-primary">View your orders</Link><Link href="/products" className="btn-secondary">Continue shopping</Link></div>
  </div></main>;
}
