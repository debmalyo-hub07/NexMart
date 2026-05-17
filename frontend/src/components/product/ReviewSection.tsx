'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { formatDate, getInitials } from '@/lib/utils';
import { Star, ThumbsUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface Review {
  _id: string;
  user: { name: string; profilePicture?: string };
  rating: number;
  title?: string;
  body?: string;
  isVerifiedPurchase: boolean;
  helpful?: number;
  createdAt: string;
}

interface ReviewSectionProps {
  productId: string;
  ratings: { average: number; count: number };
}

function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(s)}
          className={`transition-colors ${onChange ? 'cursor-pointer' : 'cursor-default'}`}>
          <Star size={size}
            className={(hover || value) >= s ? 'fill-amber-400 text-amber-400' : 'text-white/20'} />
        </button>
      ))}
    </div>
  );
}

export function ReviewSection({ productId, ratings }: ReviewSectionProps) {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => api.get(`/products/${productId}/reviews`).then((r) => r.data.data),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/products/${productId}/reviews`, { rating, title, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      showToast('Review submitted! Thank you.');
      setShowForm(false);
      setTitle('');
      setBody('');
      setRating(5);
    },
    onError: () => showToast('Failed to submit review', 'error'),
  });

  const reviews: Review[] = data || [];
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
    pct: ratings.count > 0 ? (reviews.filter((r) => Math.round(r.rating) === star).length / ratings.count) * 100 : 0,
  }));

  return (
    <section className="border-t border-white/5 pt-12 mt-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h2 className="font-syne text-2xl font-bold text-white">Customer Reviews</h2>
        {user && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Write a Review</button>
        )}
      </div>

      {/* Rating overview */}
      {ratings.count > 0 && (
        <div className="glass rounded-2xl p-6 border border-white/5 mb-8 flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <div className="text-center shrink-0">
            <p className="font-syne text-6xl font-black text-acid-400">{ratings.average.toFixed(1)}</p>
            <StarRating value={Math.round(ratings.average)} size={16} />
            <p className="text-xs text-white/40 mt-1">{ratings.count} reviews</p>
          </div>
          <div className="flex-1 w-full space-y-2">
            {ratingBreakdown.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-3">
                <span className="text-xs text-white/40 w-4 shrink-0">{star}</span>
                <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2, duration: 0.8 }}
                    className="h-full bg-amber-400/70 rounded-full" />
                </div>
                <span className="text-xs text-white/30 w-6 shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write review form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl p-6 border border-violet-500/20 mb-8">
            <h3 className="font-syne font-semibold text-white mb-5">Your Review</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 mb-2 block">Rating</label>
                <StarRating value={rating} onChange={setRating} size={24} />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Title (optional)</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize your experience" className="input" />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1.5 block">Review</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                  placeholder="What did you like or dislike? How was the quality?" className="input resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="btn-primary">
                  {submitMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Submit Review'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-white/5 animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-white/5" /><div className="space-y-1.5 flex-1"><div className="h-3 bg-white/5 rounded w-32" /><div className="h-2 bg-white/5 rounded w-24" /></div></div>
              <div className="h-3 bg-white/5 rounded w-full" /><div className="h-3 bg-white/5 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Star size={32} className="mx-auto mb-3 opacity-30" />
          <p>No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review, i) => (
            <motion.div key={review._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-5 border border-white/5">
              <div className="flex items-start gap-3 mb-3">
                {review.user.profilePicture ? (
                  <Image src={review.user.profilePicture} alt="" width={36} height={36} className="rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                    {getInitials(review.user.name)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{review.user.name}</p>
                    {review.isVerifiedPurchase && <span className="badge-acid text-[10px]">Verified Purchase</span>}
                    <span className="text-xs text-white/30 ml-auto">{formatDate(review.createdAt)}</span>
                  </div>
                  <StarRating value={review.rating} size={13} />
                </div>
              </div>
              {review.title && <p className="font-medium text-white text-sm mb-1">{review.title}</p>}
              {review.body && <p className="text-sm text-white/60 leading-relaxed">{review.body}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
