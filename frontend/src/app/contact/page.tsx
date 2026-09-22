import Link from 'next/link';
import { ArrowUpRight, Building2, Headphones, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { businessDetails } from '@/lib/businessDetails';
import { PolicyDraftNotice } from '@/components/layout/PolicyLayout';

export const metadata = { title: 'Contact & grievances', robots: { index: businessDetails.policiesApproved, follow: true } };
export default function ContactPage() {
  const details = [
    { label: 'Legal operator', value: businessDetails.legalName, Icon: Building2 },
    { label: 'Registered address', value: businessDetails.registeredAddress, Icon: MapPin },
    { label: 'Customer-care email', value: businessDetails.supportEmail, Icon: Mail },
    { label: 'Customer-care phone & hours', value: [businessDetails.supportPhone, businessDetails.supportHours].filter(Boolean).join(' · ') || null, Icon: Headphones },
    { label: 'Grievance officer', value: businessDetails.grievanceOfficer, Icon: ShieldCheck },
    { label: 'Grievance contact', value: businessDetails.grievanceEmail, Icon: Mail },
  ];
  return <main id="main-content" className="store-page"><div className="page-container">
    <header className="mb-8 max-w-2xl"><p className="eyebrow mb-3 text-orange-600">We value a clear conversation</p><h1 className="text-4xl font-medium sm:text-5xl">Contact & support.</h1><p className="mt-4 text-secondary">Order questions, product details, and the information you should be able to find about the business.</p></header>
    <PolicyDraftNotice />
    <div className="mt-9 grid gap-8 lg:grid-cols-[1.2fr_1fr]"><section><h2 className="mb-5 text-2xl">Business & contact details</h2><dl className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white px-5">{details.map(({ label, value, Icon }) => <div key={label} className="flex gap-4 py-5"><Icon size={21} className="mt-1 shrink-0 text-muted" aria-hidden /><div><dt className="text-sm font-medium">{label}</dt><dd className="mt-1 break-words text-sm text-secondary">{value || 'Not yet published — awaiting operator confirmation.'}</dd></div></div>)}</dl>{businessDetails.supportEmail && <a href={`mailto:${businessDetails.supportEmail}`} className="btn-primary mt-5">Email customer care <ArrowUpRight size={17} aria-hidden /></a>}</section>
      <div className="space-y-6"><section className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="eyebrow mb-3">Your order, in view</p><h2 className="text-2xl">Looking for an update?</h2><p className="mt-3 text-sm leading-relaxed text-secondary">Your order page shows the recorded payment and delivery status. Keep the order reference handy when a support channel becomes available.</p><Link href="/orders" className="btn-secondary mt-5">View orders <ArrowUpRight size={17} aria-hidden /></Link></section><section className="rounded-xl border border-[var(--border)] bg-white p-6"><h2 className="text-xl">Before sharing information</h2><p className="mt-3 text-sm leading-relaxed text-secondary">Never send a password, sign-in code, full card number, or banking PIN. Don’t post your address or phone number in a public product review.</p><p className="mt-3 text-sm leading-relaxed text-secondary">There is no functioning support form on this page yet. Contact channels must be verified before the store can promise to receive or resolve requests.</p></section><section className="rounded-xl border border-[var(--border)] bg-white p-6"><h2 className="text-xl">Consumer grievances</h2><p className="mt-3 text-sm leading-relaxed text-secondary">The operator must publish a named grievance officer and meet applicable complaint-handling responsibilities. You can also consult India’s official consumer guidance.</p><a href="https://consumerhelpline.gov.in/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-orange-600 underline underline-offset-4">National Consumer Helpline <ArrowUpRight size={15} aria-hidden /></a></section></div>
    </div>
  </div></main>;
}
