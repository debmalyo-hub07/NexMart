'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, Loader2, Star } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/lib/utils';
import { QueryError } from '@/components/common/QueryError';
import type { ApiResponse, ProductReview } from '@/types';

const schema = z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().max(100, 'Use at most 100 characters'), body: z.string().max(2000, 'Use at most 2,000 characters') });
function Stars({ value }: { value: number }) {
  return <span className="inline-flex gap-1" role="img" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={15} aria-hidden className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted'} />)}</span>;
}
export function ReviewSection({ productId, ratings }: { productId: string; ratings: { average: number; count: number } }) {
  const id = useId();
  const path = usePathname();
  const user = useAuthStore(s => s.user);
  const toast = useUIStore(s => s.showToast);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(6);
  const pending = useRef(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { rating: 5, title: '', body: '' }, mode: 'onTouched' });
  const query = useQuery({ queryKey: ['storefront', 'reviews', productId], queryFn: ({ signal }) => api.get<ApiResponse<ProductReview[]>>(`/products/${productId}/reviews`, { signal }).then(r => r.data.data ?? []) });
  const submit = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => api.post(`/products/${productId}/reviews`, values),
    onSuccess: () => { form.reset(); setOpen(false); toast('Review submitted'); },
    onSettled: () => { pending.current = false; void client.invalidateQueries({ queryKey: ['storefront'] }); },
  });
  const reviews = query.data ?? [];
  const count = query.data ? reviews.length : ratings?.count ?? 0;
  const average = query.data ? reviews.reduce((sum, review) => sum + review.rating, 0) / (count || 1) : ratings?.average ?? 0;
  return <section className="border-t border-white/15 pt-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 className="section-heading">Customer reviews</h2>{user?.role === 'customer' && !open && <button type="button" className="btn-secondary" onClick={() => { submit.reset(); setOpen(true); }}>Write a review</button>}{!user && <Link className="inline-flex min-h-11 items-center text-sm text-violet-200 underline" href={`/customer/login?redirect=${encodeURIComponent(path)}`}>Sign in to write a review</Link>}</div>
    {count > 0 && <p className="mb-5 flex flex-wrap items-center gap-3 text-sm text-secondary"><Stars value={average} /><span>{average.toFixed(1)} out of 5 · {count} reviews</span></p>}
    {open && <form onSubmit={form.handleSubmit(values => { if (pending.current) return; pending.current = true; submit.mutate(values); })} className="card mb-6 space-y-4" noValidate><fieldset disabled={submit.isPending} className="space-y-4"><legend className="mb-4 text-lg font-semibold">Your review</legend>
      <fieldset><legend className="field-label">Rating</legend><div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/30 px-3 text-sm"><input type="radio" value={value} {...form.register('rating')} className="h-4 w-4 accent-violet-500" />{value}<Star size={14} aria-hidden /><span className="sr-only">{value === 1 ? 'star' : 'stars'}</span></label>)}</div></fieldset>
      <div><label htmlFor={`${id}-title`} className="field-label">Title (optional)</label><input id={`${id}-title`} {...form.register('title')} className="input" maxLength={100} aria-invalid={!!form.formState.errors.title} /></div>
      <div><label htmlFor={`${id}-body`} className="field-label">Your experience (optional)</label><textarea id={`${id}-body`} {...form.register('body')} className="input" rows={4} maxLength={2000} aria-invalid={!!form.formState.errors.body} /></div>
      {submit.isError && <p role="alert" className="field-error">{getApiError(submit.error)}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary">{submit.isPending && <Loader2 size={17} className="animate-spin" aria-hidden />}{submit.isPending ? 'Submitting…' : 'Submit review'}</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button></div>
    </fieldset></form>}
    {query.isError ? <QueryError label="Customer reviews" onRetry={() => void query.refetch()} /> : query.isPending ? <p role="status" className="py-6 text-sm text-secondary">Loading reviews…</p> : !reviews.length ? <p className="py-6 text-sm text-muted">No reviews have been submitted for this product.</p> : <ul className="divide-y divide-white/10">{reviews.slice(0, limit).map(review => <li key={review._id} className="py-5"><div className="mb-2 flex flex-wrap items-center gap-3"><p className="break-words text-sm font-semibold">{review.user?.name || 'Customer'}</p>{review.isVerifiedPurchase && <span className="badge-acid"><BadgeCheck size={14} aria-hidden />Verified purchase</span>}<time dateTime={review.createdAt} className="text-xs text-muted">{formatDate(review.createdAt)}</time></div><Stars value={review.rating} />{review.title && <h3 className="mt-3 break-words text-base">{review.title}</h3>}{review.body && <p className="mt-2 whitespace-pre-line break-words text-sm text-secondary">{review.body}</p>}</li>)}</ul>}
    {reviews.length > limit && <button type="button" className="btn-secondary mt-4" onClick={() => setLimit(limit + 6)}>Show more reviews</button>}
  </section>;
}
