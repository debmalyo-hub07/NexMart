import type { Request } from 'express';
import type { SellerLifecycleState } from '../models/Seller';
import { SellerAuditLog } from '../models/SellerAuditLog';

/** Server-owned lifecycle graph. A seller can never activate itself. */
export const SELLER_LIFECYCLE_TRANSITIONS: Record<SellerLifecycleState, SellerLifecycleState[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['active', 'suspended', 'blocked'],
  active: ['suspended', 'blocked', 'closed'],
  rejected: ['draft'],
  suspended: ['active', 'blocked'],
  blocked: ['active', 'closed'],
  closed: [],
};

export function isSellerTransitionAllowed(from: SellerLifecycleState, to: SellerLifecycleState): boolean {
  return (SELLER_LIFECYCLE_TRANSITIONS[from] || []).includes(to);
}

export async function recordSellerAudit(input: {
  seller: string;
  action: string;
  actorId: string;
  actorRole: 'admin' | 'seller' | 'system';
  fromState?: string;
  toState?: string;
  reason?: string;
  req?: Request;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await SellerAuditLog.create({
    seller: input.seller,
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    fromState: input.fromState,
    toState: input.toState,
    reason: input.reason,
    requestId: (input.req as (Request & { requestId?: string }) | undefined)?.requestId,
    metadata: input.metadata,
  });
}
