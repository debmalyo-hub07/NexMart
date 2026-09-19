import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Seller, SELLER_LIFECYCLE_STATES, type SellerLifecycleState } from '../models/Seller';
import { SellerAuditLog } from '../models/SellerAuditLog';
import { MarketplaceLedgerEntry } from '../models/MarketplaceLedgerEntry';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { AuthenticatedRequest } from '../types';
import { sendBadRequest, sendForbidden, sendNotFound, sendPaginated, sendSuccess } from '../utils/response';
import { parsePagination } from '../utils/helpers';
import { isSellerTransitionAllowed, recordSellerAudit } from '../utils/sellerLifecycle';
import { publicProductVisibility, visibleCategories } from '../utils/categoryVisibility';

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  addressLine1: z.string().trim().min(5).max(250),
  addressLine2: z.string().trim().max(250).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  country: z.literal('India').default('India'),
});

export const sellerProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  legalBusinessName: z.string().trim().min(2).max(160).optional(),
  storefrontName: z.string().trim().min(2).max(120).optional(),
  businessType: z.enum(['individual', 'proprietorship', 'partnership', 'llp', 'private_limited', 'other']).optional(),
  businessAddress: addressSchema.optional(),
  pickupAddress: addressSchema.optional(),
  returnAddress: addressSchema.optional(),
  tax: z.object({
    pan: z.string().trim().regex(/^[A-Z]{5}\d{4}[A-Z]$/).optional(),
    gstin: z.string().trim().regex(/^\d{2}[A-Z0-9]{13}$/).optional(),
    countryOfOrigin: z.string().trim().max(100).optional(),
  }).optional(),
  policyAccepted: z.literal(true).optional(),
  prohibitedProductsAcknowledged: z.literal(true).optional(),
}).strict();

function sellerId(req: Request): string {
  return String((req as AuthenticatedRequest).user?.userId || '');
}

function publicSeller(seller: InstanceType<typeof Seller>): Record<string, unknown> {
  const value = seller.toObject() as unknown as Record<string, unknown> & {
    tax?: { pan?: string; gstin?: string; countryOfOrigin?: string };
    payout?: { bankAccountLast4?: string; ifscLast4?: string; verificationState?: string };
  };
  delete value.password;
  delete value.verificationCodeHash;
  delete value.verificationCodeExpiry;
  delete value.verificationCodeAttempts;
  if (value.tax) {
    value.tax = {
      countryOfOrigin: value.tax.countryOfOrigin,
      pan: value.tax.pan ? `********${String(value.tax.pan).slice(-4)}` : undefined,
      gstin: value.tax.gstin ? `${String(value.tax.gstin).slice(0, 2)}***********${String(value.tax.gstin).slice(-2)}` : undefined,
    };
  }
  if (value.payout) {
    value.payout = {
      bankAccountLast4: value.payout.bankAccountLast4,
      ifscLast4: value.payout.ifscLast4,
      verificationState: value.payout.verificationState,
    };
  }
  return value;
}

export async function getSellerProfile(req: Request, res: Response): Promise<void> {
  const seller = await Seller.findById(sellerId(req));
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  sendSuccess(res, publicSeller(seller));
}

export async function updateSellerProfile(req: Request, res: Response): Promise<void> {
  const input = sellerProfileSchema.parse(req.body);
  const seller = await Seller.findById(sellerId(req));
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  if (['blocked', 'closed'].includes(seller.lifecycleStatus)) {
    sendForbidden(res, 'This seller account cannot be changed. Contact NexMart support.');
    return;
  }

  const sensitiveChanged = Boolean(input.legalBusinessName || input.businessType || input.tax || input.pickupAddress || input.returnAddress);
  const wasApproved = ['approved', 'active'].includes(seller.lifecycleStatus);
  const previousState = seller.lifecycleStatus;

  const update: Record<string, unknown> = { ...input };
  delete update.policyAccepted;
  delete update.prohibitedProductsAcknowledged;
  if (input.policyAccepted) update.policyAcceptedAt = new Date();
  if (input.prohibitedProductsAcknowledged) update.prohibitedProductsAcknowledgedAt = new Date();
  if (sensitiveChanged && wasApproved) {
    // Sensitive business changes require a fresh review. Existing published
    // listings are not implicitly activated by this write.
    update.lifecycleStatus = 'under_review';
    update.kycState = 'pending';
    update.complianceState = 'pending';
  }

  Object.assign(seller, update);
  await seller.save();
  if (update.lifecycleStatus && update.lifecycleStatus !== previousState) {
    await recordSellerAudit({
      seller: seller.id,
      action: 'seller_profile_change_reverification',
      actorId: seller.id,
      actorRole: 'seller',
      fromState: previousState,
      toState: String(update.lifecycleStatus),
      req,
      metadata: { sensitiveChanged: true },
    });
  } else {
    await recordSellerAudit({ seller: seller.id, action: 'seller_profile_updated', actorId: seller.id, actorRole: 'seller', req });
  }
  sendSuccess(res, publicSeller(seller), 'Seller profile updated');
}

export async function submitSellerOnboarding(req: Request, res: Response): Promise<void> {
  const seller = await Seller.findById(sellerId(req));
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  if (!seller.emailVerified) { sendBadRequest(res, 'Verify your seller email before submitting onboarding.'); return; }
  if (!['draft', 'rejected'].includes(seller.lifecycleStatus)) {
    sendBadRequest(res, `Onboarding cannot be submitted while the account is ${seller.lifecycleStatus}.`);
    return;
  }
  const required = [seller.name, seller.phone, seller.legalBusinessName, seller.storefrontName, seller.businessType, seller.pickupAddress, seller.returnAddress, seller.policyAcceptedAt, seller.prohibitedProductsAcknowledgedAt];
  if (required.some((value) => !value)) {
    sendBadRequest(res, 'Complete the required business, address, and policy fields before submitting.');
    return;
  }
  const previousState = seller.lifecycleStatus;
  seller.lifecycleStatus = 'submitted';
  seller.rejectionReason = undefined;
  await seller.save();
  await recordSellerAudit({ seller: seller.id, action: 'seller_onboarding_submitted', actorId: seller.id, actorRole: 'seller', fromState: previousState, toState: 'submitted', req });
  sendSuccess(res, publicSeller(seller), 'Seller application submitted for review');
}

const statusSchema = z.object({
  status: z.enum(SELLER_LIFECYCLE_STATES),
  reason: z.string().trim().max(1000).optional(),
});

export async function getSellers(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && SELLER_LIFECYCLE_STATES.includes(req.query.status as SellerLifecycleState)) filter.lifecycleStatus = req.query.status;
  if (req.query.search) {
    const search = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: search }, { email: search }, { legalBusinessName: search }, { storefrontName: search }];
  }
  const [sellers, total] = await Promise.all([
    Seller.find(filter).select('-password -verificationCodeHash -verificationCodeExpiry -verificationCodeAttempts -tax.pan -tax.gstin -payout.providerAccountId').sort('-createdAt').skip(skip).limit(limit),
    Seller.countDocuments(filter),
  ]);
  sendPaginated(res, sellers.map(publicSeller), total, page, limit);
}

export async function getSellerById(req: Request, res: Response): Promise<void> {
  const seller = await Seller.findById(req.params.id).select('-password -verificationCodeHash -verificationCodeExpiry -verificationCodeAttempts -tax.pan -tax.gstin -payout.providerAccountId');
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  sendSuccess(res, publicSeller(seller));
}

export async function updateSellerStatus(req: Request, res: Response): Promise<void> {
  const input = statusSchema.parse(req.body);
  const seller = await Seller.findById(req.params.id);
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  const next = input.status as SellerLifecycleState;
  if (seller.lifecycleStatus === next) {
    sendSuccess(res, publicSeller(seller), 'Seller status unchanged');
    return;
  }
  if (!isSellerTransitionAllowed(seller.lifecycleStatus, next)) {
    sendBadRequest(res, `Seller cannot move from "${seller.lifecycleStatus}" to "${next}".`);
    return;
  }
  if (['rejected', 'suspended', 'blocked'].includes(next) && !input.reason) {
    sendBadRequest(res, 'A reason is required for this status change.');
    return;
  }
  const previousState = seller.lifecycleStatus;
  seller.lifecycleStatus = next;
  seller.isActive = !['suspended', 'blocked', 'closed'].includes(next);
  if (next === 'rejected') seller.rejectionReason = input.reason;
  if (next === 'active' || next === 'approved') seller.rejectionReason = undefined;
  await seller.save();
  const actorId = String((req as AuthenticatedRequest).user?.userId || '');
  await recordSellerAudit({ seller: seller.id, action: 'seller_status_changed', actorId, actorRole: 'admin', fromState: previousState, toState: next, reason: input.reason, req });
  sendSuccess(res, publicSeller(seller), 'Seller status updated');
}

export async function getSellerAudit(req: Request, res: Response): Promise<void> {
  const seller = await Seller.exists({ _id: req.params.id });
  if (!seller) { sendNotFound(res, 'Seller account not found'); return; }
  const { page, limit, skip } = parsePagination(req.query);
  const [entries, total] = await Promise.all([
    SellerAuditLog.find({ seller: req.params.id }).sort('-createdAt').skip(skip).limit(limit).select('-metadata'),
    SellerAuditLog.countDocuments({ seller: req.params.id }),
  ]);
  sendPaginated(res, entries, total, page, limit);
}

export async function getSellerFinances(req: Request, res: Response): Promise<void> {
  const sellerOid = new mongoose.Types.ObjectId(sellerId(req));
  const [summary, recentEntries] = await Promise.all([
    MarketplaceLedgerEntry.aggregate([
      { $match: { seller: sellerOid } },
      {
        $group: {
          _id: '$account',
          totalCreditPaise: {
            $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', 0] },
          },
          totalDebitPaise: {
            $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amountPaise', 0] },
          },
        },
      },
    ]),
    MarketplaceLedgerEntry.find({ seller: sellerOid })
      .sort('-effectiveAt -createdAt')
      .limit(15)
      .populate('order', 'orderId total')
      .lean(),
  ]);

  let payableBalancePaise = 0;
  let reserveBalancePaise = 0;
  let totalEarnedPaise = 0;

  for (const row of summary) {
    const net = row.totalCreditPaise - row.totalDebitPaise;
    if (row._id === 'seller_payable') {
      payableBalancePaise = net;
      totalEarnedPaise = row.totalCreditPaise;
    } else if (row._id === 'seller_reserve') {
      reserveBalancePaise = net;
    }
  }

  sendSuccess(res, {
    payableBalancePaise,
    payableBalanceRupees: payableBalancePaise / 100,
    reserveBalancePaise,
    reserveBalanceRupees: reserveBalancePaise / 100,
    totalEarnedPaise,
    totalEarnedRupees: totalEarnedPaise / 100,
    recentEntries,
  });
}

export async function getPublicSellerStorefront(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Seller not found'); return; }
  const { page, limit, skip } = parsePagination(req.query);
  const [seller, categories] = await Promise.all([
    Seller.findOne({ _id: req.params.id, isActive: true, lifecycleStatus: 'active' })
      .select('storefrontName legalBusinessName businessType performance.ratingAverage performance.ratingCount kycState complianceState createdAt businessAddress.city businessAddress.state')
      .lean(),
    Category.find({ isActive: true }).select('_id parent').lean(),
  ]);
  if (!seller) { sendNotFound(res, 'Seller store not found or is currently inactive'); return; }

  // Apply canonical publication and option checks before pagination/counting.
  // Never serialize seller-only fields (moderation, metadata, reserved stock).
  const [result] = await SellerListing.aggregate<{ listings: Record<string, unknown>[]; totals: { count: number }[] }>([
    { $match: { seller: seller._id, status: 'published' } },
    { $lookup: {
      from: Product.collection.name,
      localField: 'canonicalProduct', foreignField: '_id', as: 'canonicalProduct',
      pipeline: [
        { $match: { ...publicProductVisibility(visibleCategories(categories)), isDemo: { $ne: true } } },
        { $project: { name: 1, slug: 1, images: 1, 'variants.sku': 1 } },
      ],
    } },
    { $unwind: '$canonicalProduct' },
    { $match: { $expr: { $and: [
      { $gt: [{ $size: '$canonicalProduct.variants' }, 0] },
      { $or: [
        { $eq: [{ $ifNull: ['$canonicalVariantSku', ''] }, ''] },
        { $in: ['$canonicalVariantSku', '$canonicalProduct.variants.sku'] },
      ] },
    ] } } },
    { $sort: { pricePaise: 1, _id: 1 } },
    { $facet: {
      totals: [{ $count: 'count' }],
      listings: [
        { $skip: skip }, { $limit: limit },
        { $lookup: {
          from: SellerInventory.collection.name,
          let: { listingId: '$_id', sellerId: '$seller' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$listing', '$$listingId'] }, { $eq: ['$seller', '$$sellerId'] }] } } },
            { $project: { _id: 0, available: 1 } },
          ],
          as: 'publicInventory',
        } },
        { $project: {
          _id: 1, canonicalVariantSku: 1, pricePaise: 1, compareAtPricePaise: 1,
          condition: 1, handlingTimeDays: 1, fulfillmentMode: 1, returnWindowDays: 1, warrantyText: 1,
          'canonicalProduct._id': 1, 'canonicalProduct.name': 1, 'canonicalProduct.slug': 1, 'canonicalProduct.images': 1,
          inventory: { $ifNull: [{ $first: '$publicInventory' }, { available: 0 }] },
        } },
      ],
    } },
  ]);
  const { kycState, complianceState, ...details } = seller;
  const total = result?.totals[0]?.count ?? 0;
  sendSuccess(res, {
    seller: { ...details, verification: kycState === 'verified' && complianceState === 'verified' ? 'verified' : 'standard' },
    listings: result?.listings ?? [],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

