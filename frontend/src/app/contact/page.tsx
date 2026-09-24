import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Building2, Headphones, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { businessDetails } from '@/lib/businessDetails';
import { PolicyDraftNotice } from '@/components/layout/PolicyLayout';

export const metadata = {
  title: 'Contact & grievances',
  robots: { index: businessDetails.policiesApproved, follow: true },
};

function StatusChip({ published }: { published: boolean }) {
  return (
    <span className={`contact-chip${published ? ' is-live' : ''}`} role="status">
      {published ? 'Published' : 'Awaiting operator'}
    </span>
  );
}

export default function ContactPage() {
  const details = [
    { label: 'Legal operator', value: businessDetails.legalName, Icon: Building2 },
    { label: 'Registered address', value: businessDetails.registeredAddress, Icon: MapPin },
    { label: 'Customer-care email', value: businessDetails.supportEmail, Icon: Mail },
    {
      label: 'Customer-care phone & hours',
      value:
        [businessDetails.supportPhone, businessDetails.supportHours].filter(Boolean).join(' · ') ||
        null,
      Icon: Headphones,
    },
    { label: 'Grievance officer', value: businessDetails.grievanceOfficer, Icon: ShieldCheck },
    { label: 'Grievance contact', value: businessDetails.grievanceEmail, Icon: Mail },
  ];
  const published = details.filter(({ value }) => value).length;
  return (
    <main id="main-content" className="store-page">
      <div className="page-container">
        <header className="contact-hero">
          <div>
            <p className="eyebrow">We value a clear conversation</p>
            <h1>Contact & support.</h1>
            <p className="contact-lede">
              Order questions, product details, and the information you should be able to
              find about the business.
            </p>
            <p className="contact-meta" role="status">
              {published} of {details.length} details published · updated{' '}
              {businessDetails.policyUpdated}
            </p>
          </div>
          <div className="contact-hero-photo">
            <Image
              src="/images/collections/books.webp"
              alt="A quiet shelf of books in warm light"
              fill
              sizes="(max-width: 767px) 100vw, 420px"
              className="object-cover"
            />
          </div>
        </header>
        <PolicyDraftNotice />
        <div className="contact-grid">
          <section aria-labelledby="contact-details-heading">
            <h2 id="contact-details-heading">Business & contact details</h2>
            <dl className="contact-list">
              {details.map(({ label, value, Icon }) => (
                <div key={label} className="contact-row">
                  <Icon size={21} className="mt-1 shrink-0 text-muted" aria-hidden />
                  <div>
                    <dt>
                      {label} <StatusChip published={Boolean(value)} />
                    </dt>
                    <dd>{value || 'Not yet published — awaiting operator confirmation.'}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {businessDetails.supportEmail && (
              <a href={`mailto:${businessDetails.supportEmail}`} className="btn-primary contact-mail">
                Email customer care <ArrowUpRight size={17} aria-hidden />
              </a>
            )}
          </section>
          <div className="contact-side">
            <section className="contact-card">
              <p className="eyebrow">Your order, in view</p>
              <h2>Looking for an update?</h2>
              <p>
                Your order page shows the recorded payment and delivery status. Keep the
                order reference handy when a support channel becomes available.
              </p>
              <Link href="/orders" className="btn-secondary">
                View orders <ArrowUpRight size={17} aria-hidden />
              </Link>
            </section>
            <section className="contact-card">
              <h2>Before sharing information</h2>
              <p>
                Never send a password, sign-in code, full card number, or banking PIN.
                Don’t post your address or phone number in a public product review.
              </p>
              <p>
                There is no functioning support form on this page yet. Contact channels
                must be verified before the store can promise to receive or resolve
                requests.
              </p>
            </section>
            <section className="contact-card">
              <h2>Consumer grievances</h2>
              <p>
                The operator must publish a named grievance officer and meet applicable
                complaint-handling responsibilities. You can also consult India’s official
                consumer guidance.
              </p>
              <a
                href="https://consumerhelpline.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                National Consumer Helpline <ArrowUpRight size={15} aria-hidden />
              </a>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
