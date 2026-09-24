import Link from 'next/link';
import { ArrowUpRight, FileText, Info } from 'lucide-react';
import { businessDetails, policyLinks } from '@/lib/businessDetails';
import type { StorefrontPolicy } from '@/lib/storefrontPolicies';
import { PolicyProgress } from './PolicyProgress';
import { PolicyTOC } from './PolicyTOC';
import { CopySectionLink } from './CopySectionLink';
import { PolicyPrintButton } from './PolicyPrintButton';

export function PolicyDraftNotice({ compact = false }: { compact?: boolean }) {
  if (businessDetails.policiesApproved) return null;
  return (
    <div
      className={`policy-draft${compact ? ' is-compact' : ''}`}
      role="note"
      aria-label="Draft policy notice"
    >
      <Info size={19} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-semibold">Draft · pending business approval</p>
        <p className="mt-1 text-xs leading-relaxed text-secondary">
          Legal identity, support contacts, and commercial delivery/return terms are not yet
          confirmed. These pages are not final policies; do not assume unlisted guarantees.{' '}
          <Link href="/contact" className="underline underline-offset-4">
            View publication status
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export function PolicyLayout({ policy, path }: { policy: StorefrontPolicy; path: string }) {
  return (
    <main id="main-content" className="store-page policy-page">
      <PolicyProgress />
      <div className="page-container">
        <header className="policy-hero">
          <div>
            <p className="eyebrow">The small print, made clearer</p>
            <h1>{policy.title}</h1>
            <p className="policy-lede">{policy.description}</p>
            <p className="policy-meta">
              <span>Draft updated {businessDetails.policyUpdated}</span>
              <span aria-hidden>·</span>
              <span>{policy.sections.length} sections</span>
              <span aria-hidden>·</span>
              <span>~{Math.max(2, Math.round(policy.sections.length * 1.5))} min read</span>
            </p>
            <div className="policy-actions">
              <PolicyPrintButton />
              <Link href="/help" className="policy-action is-link">
                Shopping help <ArrowUpRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
          <div className="policy-hero-card" aria-label="At a glance">
            <h2>
              <FileText size={18} aria-hidden /> At a glance
            </h2>
            <ul>
              {policy.summary.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </header>
        <PolicyDraftNotice />
        <div className="policy-body">
          <aside className="policy-side">
            <p className="eyebrow">On this page</p>
            <PolicyTOC sections={policy.sections.map(({ id, title }) => ({ id, title }))} />
            <nav className="policy-switcher" aria-label="Shopping policies">
              <p className="eyebrow">Good to know</p>
              <ul>
                {policyLinks.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={path === link.href ? 'page' : undefined}
                      className={path === link.href ? 'is-current' : undefined}
                    >
                      {link.label}
                      <ArrowUpRight size={13} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <div className="policy-article">
            {policy.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="policy-content"
                aria-labelledby={`${section.id}-heading`}
              >
                <p className="policy-index" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </p>
                <div className="policy-heading-row">
                  <h2 id={`${section.id}-heading`}>{section.title.replace(/^\d+\.\s*/, '')}</h2>
                  <CopySectionLink id={section.id} title={section.title} />
                </div>
                {section.paragraphs.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.points && (
                  <ul className="policy-points">
                    {section.points.map(point => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <div className="policy-footer-card">
              <div>
                <h2>Need a little more clarity?</h2>
                <p>Start with shopping help or check what contact details are published.</p>
              </div>
              <div className="policy-footer-actions">
                <Link href="/help" className="btn-secondary">
                  Shopping help <ArrowUpRight size={16} aria-hidden />
                </Link>
                <Link href="/contact" className="text-link">
                  Contact status <ArrowUpRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
