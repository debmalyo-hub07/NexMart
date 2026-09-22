import Link from 'next/link';
import { ArrowUpRight, FileText, Info } from 'lucide-react';
import { businessDetails, policyLinks } from '@/lib/businessDetails';
import type { StorefrontPolicy } from '@/lib/storefrontPolicies';

export function PolicyDraftNotice({ compact = false }: { compact?: boolean }) {
  if (businessDetails.policiesApproved) return null;
  return <div className={`flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 ${compact ? 'p-3' : 'p-5'}`}><Info size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden /><div><p className="text-sm font-medium text-amber-800">Draft · pending business approval</p><p className="mt-1 text-xs leading-relaxed text-secondary">Legal identity, support contacts, and commercial delivery/return terms are not yet confirmed. These pages are not final policies; do not assume unlisted guarantees. <Link href="/contact" className="underline underline-offset-4">View publication status</Link>.</p></div></div>;
}

export function PolicyLayout({ policy, path }: { policy: StorefrontPolicy; path: string }) {
  return <main id="main-content" className="store-page"><div className="page-container">
    <header className="mb-8 max-w-3xl"><p className="eyebrow mb-3 text-[var(--accent-violet)]">The small print, made clearer</p><h1 className="text-4xl font-medium sm:text-5xl">{policy.title}</h1><p className="mt-4 text-secondary">{policy.description}</p><p className="mt-4 text-xs text-muted">Draft updated {businessDetails.policyUpdated}</p></header>
    <PolicyDraftNotice />
    <div className="mt-9 grid gap-9 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
      <aside className="self-start lg:sticky lg:top-[calc(var(--navbar-height)+24px)]"><p className="eyebrow mb-3">On this page</p><nav aria-label="Policy sections"><ul>{policy.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="flex min-h-11 items-center py-2 text-sm text-secondary hover:text-[var(--text-primary)]">{section.title}</a></li>)}</ul></nav><nav className="mt-5 border-t border-[var(--border)] pt-5" aria-label="Shopping policies"><ul>{policyLinks.map(link => <li key={link.href}><Link href={link.href} aria-current={path === link.href ? 'page' : undefined} className={`flex min-h-11 items-center justify-between gap-2 text-sm ${path === link.href ? 'text-[var(--accent-violet)]' : 'text-muted hover:text-[var(--text-primary)]'}`}>{link.label}<ArrowUpRight size={13} aria-hidden /></Link></li>)}</ul></nav></aside>
      <div className="max-w-3xl"><section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-6"><h2 className="mb-4 flex items-center gap-2 text-lg"><FileText size={19} className="text-[var(--accent-violet)]" aria-hidden />At a glance</h2><ul className="space-y-3">{policy.summary.map(item => <li key={item} className="flex gap-3 text-sm text-secondary"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent-violet)]" aria-hidden />{item}</li>)}</ul></section>
        {policy.sections.map(section => <section key={section.id} id={section.id} className="policy-content border-b border-[var(--border)] py-7 first:pt-0"><h2 className="mb-4 text-2xl">{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mb-3 last:mb-0">{paragraph}</p>)}{section.points && <ul className="list-disc space-y-2 pl-5">{section.points.map(point => <li key={point}>{point}</li>)}</ul>}</section>)}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"><div><h2 className="text-lg">Need a little more clarity?</h2><p className="mt-1 text-sm text-muted">Start with shopping help or the contact information.</p></div><Link href="/help" className="btn-secondary">Shopping help <ArrowUpRight size={16} aria-hidden /></Link></div>
      </div>
    </div>
  </div></main>;
}
