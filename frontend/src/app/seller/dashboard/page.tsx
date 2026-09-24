'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, Clock3, ShieldAlert, Store, Plus, Package, ArrowUpRight, RefreshCw, type LucideIcon } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { QueryError } from '@/components/common/QueryError';
import { ProductImage } from '@/components/product/ProductImage';
import { formatDate, formatPrice } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';

type SellerProfile = {
  _id?: string;
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
  active: { title: 'Your store is active', detail: 'Your store is ready for listing and order management.', icon: CircleCheck, tone: 'text-acid-400' },
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
  if (profile.lifecycleStatus === 'active') return <SellerOperations profile={profile} />;
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

type Overview = {
  asOf: string; listings: Record<string, number>; fulfillment: Record<string, number>; balances: Record<string, number>; lowStockCount: number;
  actionQueue: { _id: string; groupId: string; orderId: string; status: string; productName: string; image?: string; itemCount: number; totalPaise: number; createdAt: string; shipment?: string }[];
  lowStock: { listingId: string; name: string; image?: string; sku: string; available: number; reserved: number }[];
};

function SellerOperations({ profile }: { profile: SellerProfile }) {
  const query = useQuery({ queryKey: ['seller', 'dashboard'], queryFn: async () => (await api.get('/seller/dashboard')).data.data as Overview, staleTime: 15000, refetchInterval: 30000 });
  const data = query.data;
  const nextAction: Record<string, string> = { placed: 'Confirm order', confirmed: 'Start preparing', processing: 'Prepare for pickup', ready_for_pickup: 'Arrange shipment' };
  return <div className="seller-overview space-y-7">
    <header className="seller-welcome"><div><p className="eyebrow mb-3">Your store, at a glance</p><h1 className="text-3xl font-semibold sm:text-4xl">{profile.storefrontName || 'Your store'}</h1><p className="mt-3 text-sm text-secondary">A clear next step for every order. Room to focus on your business.</p></div><div className="flex flex-wrap gap-3"><Link href="/seller/listings/new" className="btn-primary"><Plus size={17} aria-hidden />Create listing</Link>{profile._id && <Link href={`/sellers/${profile._id}`} className="btn-secondary">View store<ArrowUpRight size={16} aria-hidden /></Link>}</div></header>
    {query.isError && <QueryError label="Store overview" detail={getApiError(query.error)} onRetry={() => void query.refetch()} />}
    {!data ? query.isPending && <div className="grid animate-pulse gap-4 sm:grid-cols-4" aria-label="Loading store activity">{[1, 2, 3, 4].map(value => <div key={value} className="h-28 rounded-xl bg-[var(--bg-raised)]" />)}</div> : <>
      <section className="seller-metrics" aria-label="Store activity">
        {[{ title: 'To prepare', value: (data.fulfillment.placed || 0) + (data.fulfillment.confirmed || 0) + (data.fulfillment.processing || 0), detail: 'Paid online or cash on delivery', href: '/seller/orders' }, { title: 'Ready for pickup', value: data.fulfillment.ready_for_pickup || 0, detail: 'Prepared packages to hand over', href: '/seller/shipments' }, { title: 'Published listings', value: data.listings.published || 0, detail: `${data.lowStockCount} with 5 or fewer available`, href: '/seller/listings' }, { title: 'Recorded payable', value: formatPrice((data.balances.seller_payable || 0) / 100), detail: 'Ledger balance, before bank settlement', href: '/seller/finances' }].map(metric => <Link key={metric.title} href={metric.href} className="seller-metric"><span>{metric.title}</span><strong>{metric.value}</strong><small>{metric.detail}</small><ArrowUpRight size={15} aria-hidden /></Link>)}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card" aria-labelledby="seller-actions-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow mb-2">Your next actions</p><h2 id="seller-actions-heading" className="text-2xl">Keep orders moving.</h2></div><Link href="/seller/orders" className="text-link">All orders<ArrowRight size={15} aria-hidden /></Link></div><p className="mt-3 text-xs leading-6 text-muted">Oldest orders first. Online orders appear here after payment is captured.</p>
          {!data.actionQueue.length ? <div className="mt-5 rounded-lg bg-[var(--bg-raised)] p-6"><CircleCheck size={25} className="text-green-800" aria-hidden /><p className="mt-3 text-base font-semibold">No orders waiting for preparation</p><p className="mt-2 text-sm leading-6 text-secondary">New orders will appear here when they are ready for your attention.</p><Link href="/seller/listings" className="text-link mt-3">Review your catalogue<ArrowRight size={15} aria-hidden /></Link></div> : <ul className="mt-4 divide-y divide-[var(--border)]">{data.actionQueue.map(order => <li key={order._id} className="py-4"><div className="flex items-start gap-3"><div className="product-stage relative h-16 w-16 shrink-0 rounded-md"><ProductImage src={order.image} alt="" sizes="64px" className="p-1" /></div><div className="min-w-0 flex-1"><Link href={`/seller/orders/${order._id}`} className="text-sm font-semibold hover:underline">{order.orderId}</Link><p className="mt-1 line-clamp-1 text-sm text-secondary">{order.productName}</p><p className="mt-1 text-xs text-muted">{order.itemCount} items · {formatDate(order.createdAt)}</p></div><span className="shrink-0 text-sm font-semibold">{formatPrice(order.totalPaise / 100)}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><StatusBadge status={order.status} /><Link href={`/seller/orders/${order._id}`} className="text-link text-xs">{order.status === 'ready_for_pickup' && order.shipment ? 'View shipment' : nextAction[order.status]}<ArrowRight size={15} aria-hidden /></Link></div></li>)}</ul>}
        </section>
        <div className="space-y-6"><section className="card" aria-labelledby="seller-stock-heading"><p className="eyebrow mb-2">Stay ahead of stock</p><h2 id="seller-stock-heading" className="text-2xl">Time for a top-up?</h2><p className="mt-3 text-xs leading-6 text-muted">Published offers with 5 or fewer units available to sell.</p>{!data.lowStock.length ? <p className="mt-5 rounded-lg bg-[var(--bg-raised)] p-4 text-sm text-secondary">No published offers are low on stock.</p> : <ul className="mt-3 divide-y divide-[var(--border)]">{data.lowStock.map(item => <li key={item.listingId} className="py-4"><Link href={`/seller/listings/${item.listingId}`} className="flex min-h-11 items-center gap-3"><div className="product-stage relative h-12 w-12 shrink-0 rounded"><ProductImage src={item.image} alt="" sizes="48px" className="p-1" /></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted">{item.sku}</p></div><span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${item.available === 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>{item.available} left</span></Link></li>)}</ul>}<Link href="/seller/listings" className="text-link mt-3">Manage inventory<ArrowRight size={15} aria-hidden /></Link></section>
          <section className="card"><p className="eyebrow mb-3">Build a better listing</p><h2 className="text-xl">Details make the difference.</h2><p className="mt-3 text-sm leading-6 text-secondary">Use accurate photos, complete specifications and clear return terms. Keep your price and available stock up to date.</p><div className="mt-3 flex items-center gap-2 text-sm text-secondary"><Package size={17} aria-hidden />{data.listings.draft || 0} drafts · {data.listings.under_review || 0} under review</div><Link href="/seller/listings" className="text-link mt-3">Continue your listings<ArrowRight size={15} aria-hidden /></Link></section>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-muted">Updated {formatDate(data.asOf, { dateStyle: 'medium', timeStyle: 'short' })}</p><button type="button" className="text-link" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={15} aria-hidden />Refresh overview</button></div>
    </>}
  </div>;
}
