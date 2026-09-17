import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import type { ListingLifecycleState } from '../models/SellerListing';
import { ListingAuditLog } from '../models/ListingAuditLog';

/** Server-owned listing graph. Sellers can submit, but never approve or publish. */
export const LISTING_LIFECYCLE_TRANSITIONS: Record<ListingLifecycleState, ListingLifecycleState[]> = {
  draft: ['submitted'],
  submitted: ['moderation', 'rejected'],
  moderation: ['approved', 'rejected'],
  approved: ['published', 'paused', 'submitted'],
  published: ['submitted', 'paused', 'suspended', 'blocked'],
  rejected: ['draft'],
  paused: ['submitted', 'published', 'suspended', 'blocked'],
  suspended: ['published', 'blocked'],
  blocked: [],
};

export function isListingTransitionAllowed(from: ListingLifecycleState, to: ListingLifecycleState): boolean {
  return (LISTING_LIFECYCLE_TRANSITIONS[from] || []).includes(to);
}

export async function recordListingAudit(input: {
  listing: string;
  seller: string;
  action: string;
  actorId: string;
  actorRole: 'admin' | 'seller' | 'system';
  fromState?: string;
  toState?: string;
  reason?: string;
  req?: Request;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
}): Promise<void> {
  await ListingAuditLog.create([{
    listing: input.listing,
    seller: input.seller,
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    fromState: input.fromState,
    toState: input.toState,
    reason: input.reason,
    requestId: (input.req as (Request & { requestId?: string }) | undefined)?.requestId,
    metadata: input.metadata,
  }], input.session ? { session: input.session } : undefined);
}
