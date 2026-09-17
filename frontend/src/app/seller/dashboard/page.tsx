'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, Clock3, ShieldAlert, Store, type LucideIcon } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { EmptyState } from '@/components/common/EmptyState';

type SellerProfile = {
  storefrontName?: string;
  legalBusinessName?: string;
  lifecycleStatus: string;
  emailVerified: boolean;
  kycState: string;
  complianceState: string;
  rejectionReason?: string;
  performance?: { ratingAverage: number; ratingCount: number };
};

const stateCopy: Record<string, { title: string; detail: string; icon: LucideIcon; tone: string }> = {
  draft: { title: 'Finish your store setup', detail: 'Add pickup and return details, accept marketplace policies, then submit for review.', icon: Store, tone: 'text-amber-300' },
  submitted: { title: 'Application submitted', detail: 'NexMart has received your application. We will show the next state here after review.', icon: Clock3, tone: 'text-amber-300' },
  under_review: { title: 'Application under review', detail: 'Your business details are being reviewed. You can still inspect your submitted information.', icon: Clock3, tone: 'text-amber-300' },
  approved: { title: 'Approval recorded', detail: 'Your account is approved. Complete activation checks before publishing a listing.', icon: CircleCheck, tone: 'text-acid-400' },
  active: { title: 'Your store is active', detail: 'You can begin operating your store as marketplace capabilities become available.', icon: CircleCheck, tone: 'text-acid-400' },
  rejected: { title: 'Changes are required', detail: 'Review the note from NexMart, update your information, and submit again.', icon: ShieldAlert, tone: 'text-red-300' },
  suspended: { title: 'Store access is suspended', detail: 'Contact NexMart support for the reason and next steps.', icon: ShieldAlert, tone: 'text-red-300' },
  blocked: { title: 'Store access is blocked', detail: 'Contact NexMart support if you believe this is incorrect.', icon: ShieldAlert, tone: 'text-red-300' },
  closed: { title: 'Store is closed', detail: 'This seller account is no longer operational.', icon: ShieldAlert, tone: 'text-red-300' },
};

export default function SellerDashboardPage() {
  const query = useQuery({
    queryKey: ['seller', 'profile'],
    queryFn: async () => (await api.get('/seller/profile')).data.data as SellerProfile,
  });

  if (query.isPending) return <div className="animate-pulse space-y-4" aria-label="Loading seller workspace"><div className="h-8 w-64 rounded bg-white/10" /><div className="h-32 rounded-xl bg-white/10" /></div>;
  if (query.isError) return <QueryError label="Seller workspace" detail={getApiError(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Seller workspace unavailable" description="No seller profile was returned. Refresh to try again." />;

  const profile = query.data;
  const state = stateCopy[profile.lifecycleStatus] || stateCopy.draft;
  const Icon = state.icon;

  return (
    <div className="space-y-8">
      <div><p className="text-sm text-violet-300">Seller workspace</p><h1 className="mt-1 font-outfit text-3xl font-semibold">{profile.storefrontName || 'Your store'}</h1><p className="mt-2 max-w-2xl text-sm text-secondary">A clear view of what your account can do next. Publishing and selling remain locked until NexMart activates the account.</p></div>
      <section className="border-y border-white/10 py-6" aria-labelledby="seller-state-heading">
        <div className="flex items-start gap-4"><Icon size={24} className={`mt-0.5 shrink-0 ${state.tone}`} aria-hidden /><div className="min-w-0 flex-1"><h2 id="seller-state-heading" className="font-outfit text-xl font-semibold">{state.title}</h2><p className="mt-2 text-sm leading-6 text-secondary">{state.detail}</p>{profile.rejectionReason && <p className="mt-3 border-l-2 border-red-400/60 pl-3 text-sm text-red-200">Review note: {profile.rejectionReason}</p>}</div>{['draft', 'rejected'].includes(profile.lifecycleStatus) && <Link href="/seller/onboarding" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-black hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">Continue setup <ArrowRight size={16} aria-hidden /></Link>}</div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Seller account checks">
        <div className="border border-white/10 bg-space-900 p-4"><p className="text-xs uppercase tracking-wide text-secondary">Email</p><p className="mt-2 text-sm">{profile.emailVerified ? 'Verified' : 'Verification required'}</p></div>
        <div className="border border-white/10 bg-space-900 p-4"><p className="text-xs uppercase tracking-wide text-secondary">Business review</p><p className="mt-2 text-sm">{profile.kycState.replace('_', ' ')}</p></div>
        <div className="border border-white/10 bg-space-900 p-4"><p className="text-xs uppercase tracking-wide text-secondary">Policy checks</p><p className="mt-2 text-sm">{profile.complianceState.replace('_', ' ')}</p></div>
      </section>
    </div>
  );
}
