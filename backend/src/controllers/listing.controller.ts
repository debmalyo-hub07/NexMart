import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Product } from '../models/Product';
import { Seller } from '../models/Seller';
import { SellerListing, LISTING_LIFECYCLE_STATES, type ListingLifecycleState } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { InventoryMovement } from '../models/InventoryMovement';
import { ListingAuditLog } from '../models/ListingAuditLog';
import type { AuthenticatedRequest } from '../types';
import { parsePagination } from '../utils/helpers';
import { sendBadRequest, sendConflict, sendForbidden, sendNotFound, sendPaginated, sendSuccess } from '../utils/response';
import { isListingTransitionAllowed, recordListingAudit } from '../utils/listingLifecycle';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid id');

const createListingFields = z.object({
  canonicalProduct: objectId,
  canonicalVariantSku: z.string().trim().min(1).max(120).optional(),
  sellerSku: z.string().trim().min(1).max(120),
  pricePaise: z.number().int().positive().max(100_000_000_00),
  compareAtPricePaise: z.number().int().positive().max(100_000_000_00).optional(),
  condition: z.enum(['new', 'used', 'refurbished']).default('new'),
  handlingTimeDays: z.number().int().min(0).max(30).default(2),
  fulfillmentMode: z.enum(['seller', 'nexmart']).default('seller'),
  returnWindowDays: z.number().int().min(0).max(90).default(7),
  warrantyText: z.string().trim().max(500).optional(),
  metadata: z.record(z.string().trim().max(200)).optional(),
  openingStock: z.number().int().min(0).max(1_000_000).default(0),
});

export const createListingSchema = createListingFields.refine((value) => value.compareAtPricePaise === undefined || value.compareAtPricePaise >= value.pricePaise, {
  path: ['compareAtPricePaise'],
  message: 'Compare-at price must be at least the selling price',
});

export const updateListingSchema = createListingFields.omit({ canonicalProduct: true, openingStock: true }).partial().strict().refine((value) => value.compareAtPricePaise === undefined || value.pricePaise === undefined || value.compareAtPricePaise >= value.pricePaise, {
  path: ['compareAtPricePaise'],
  message: 'Compare-at price must be at least the selling price',
});

const statusSchema = z.object({
  status: z.enum(LISTING_LIFECYCLE_STATES),
  reason: z.string().trim().max(1000).optional(),
});

const inventorySchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, 'Adjustment cannot be zero'),
  reason: z.enum(['opening_balance', 'restock', 'damage_reported', 'return_received']),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
}).superRefine((value, context) => {
  if ((value.reason === 'restock' || value.reason === 'return_received' || value.reason === 'opening_balance') && value.delta < 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: `${value.reason} must increase available stock` });
  }
  if (value.reason === 'damage_reported' && value.delta > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: 'Damage reporting must reduce available stock' });
  }
});

class InventoryAdjustmentError extends Error {}

function currentSellerId(req: Request): string {
  return String((req as AuthenticatedRequest).user?.userId || '');
}

async function assertActiveSeller(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const seller = await Seller.findOne({ _id: id, isActive: true, lifecycleStatus: 'active' }).select('_id').lean();
  return Boolean(seller);
}

function publicListing(listing: Record<string, any>, inventory?: Record<string, any> | null): Record<string, unknown> {
  const seller = listing.seller && typeof listing.seller === 'object' ? listing.seller : undefined;
  const product = listing.canonicalProduct && typeof listing.canonicalProduct === 'object' ? listing.canonicalProduct : undefined;
  return {
    id: String(listing._id),
    canonicalProduct: product ? { id: String(product._id), name: product.name, slug: product.slug, brand: product.brand, images: product.images } : String(listing.canonicalProduct),
    canonicalVariantSku: listing.canonicalVariantSku,
    sellerSku: listing.sellerSku,
    pricePaise: listing.pricePaise,
    compareAtPricePaise: listing.compareAtPricePaise,
    condition: listing.condition,
    handlingTimeDays: listing.handlingTimeDays,
    fulfillmentMode: listing.fulfillmentMode,
    returnWindowDays: listing.returnWindowDays,
    warrantyText: listing.warrantyText,
    metadata: listing.metadata,
    status: listing.status,
    inventory: inventory ? {
      available: inventory.available,
      reserved: inventory.reserved,
      committed: inventory.committed,
      returned: inventory.returned,
      damaged: inventory.damaged,
    } : undefined,
    seller: seller ? {
      id: String(seller._id),
      storefrontName: seller.storefrontName,
      performance: seller.performance,
      // This is a state-derived signal, never a fabricated rating or claim.
      verification: seller.kycState === 'verified' && seller.complianceState === 'verified' ? 'verified' : 'standard',
    } : listing.seller ? String(listing.seller) : undefined,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

async function findOwnedListing(id: string, sellerId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return SellerListing.findOne({ _id: id, seller: sellerId });
}

export async function createSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  if (!(await assertActiveSeller(sellerId))) { sendForbidden(res, 'Seller approval is required before creating listings.'); return; }
  const input = createListingSchema.parse(req.body);
  const product = await Product.findById(input.canonicalProduct).select('_id variants isPublished').lean();
  if (!product) { sendNotFound(res, 'Canonical product not found'); return; }
  if (input.canonicalVariantSku && !product.variants.some((variant) => variant.sku === input.canonicalVariantSku)) {
    sendBadRequest(res, 'The selected canonical product option does not exist.');
    return;
  }

  let listing: InstanceType<typeof SellerListing> | undefined;
  let inventory: InstanceType<typeof SellerInventory> | undefined;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const createdListings = await SellerListing.create([{
        seller: sellerId,
        canonicalProduct: input.canonicalProduct,
        canonicalVariantSku: input.canonicalVariantSku,
        sellerSku: input.sellerSku,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise,
        condition: input.condition,
        handlingTimeDays: input.handlingTimeDays,
        fulfillmentMode: input.fulfillmentMode,
        returnWindowDays: input.returnWindowDays,
        warrantyText: input.warrantyText,
        metadata: input.metadata,
        status: 'draft',
      }], { session });
      listing = createdListings[0];
      const createdInventories = await SellerInventory.create([{
        listing: listing._id,
        seller: sellerId,
        available: input.openingStock,
        lastAdjustmentReason: input.openingStock ? 'opening_balance' : undefined,
        lastAdjustedAt: input.openingStock ? new Date() : undefined,
      }], { session });
      inventory = createdInventories[0];
      listing.inventory = inventory._id;
      await listing.save({ session });
      await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: 'listing_created', actorId: sellerId, actorRole: 'seller', toState: 'draft', req, session });
    });
  } catch (error: any) {
    if (error?.code === 11000) { sendConflict(res, 'You already use that seller SKU. Choose a different SKU.'); return; }
    throw error;
  } finally {
    await session.endSession();
  }
  if (!listing || !inventory) throw new Error('Listing could not be created');
  sendSuccess(res, publicListing(listing.toObject() as any, inventory.toObject() as any), 'Listing saved as draft', 201);
}

export async function getSellerListings(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { seller: sellerId };
  if (typeof req.query.status === 'string' && LISTING_LIFECYCLE_STATES.includes(req.query.status as ListingLifecycleState)) filter.status = req.query.status;
  const [listings, total] = await Promise.all([
    SellerListing.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('canonicalProduct', 'name slug brand images').lean(),
    SellerListing.countDocuments(filter),
  ]);
  const inventory = await SellerInventory.find({ listing: { $in: listings.map((item) => item._id) }, seller: sellerId }).lean();
  const inventoryByListing = new Map(inventory.map((item) => [String(item.listing), item]));
  sendPaginated(res, listings.map((item) => publicListing(item as any, inventoryByListing.get(String(item._id)))), total, page, limit);
}

export async function getSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  const inventory = await SellerInventory.findOne({ listing: listing._id, seller: sellerId }).lean();
  sendSuccess(res, publicListing(listing.toObject() as any, inventory));
}

export async function updateSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const input = updateListingSchema.parse(req.body);
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  if (['blocked', 'suspended'].includes(listing.status)) { sendForbidden(res, 'This listing cannot be changed in its current state.'); return; }

  if (input.canonicalVariantSku !== undefined) {
    const product = await Product.findById(listing.canonicalProduct).select('variants').lean();
    if (!product || !product.variants.some((variant) => variant.sku === input.canonicalVariantSku)) {
      sendBadRequest(res, 'The selected canonical product option does not exist.');
      return;
    }
  }

  const materialFields = ['pricePaise', 'compareAtPricePaise', 'condition', 'handlingTimeDays', 'fulfillmentMode', 'returnWindowDays', 'warrantyText', 'canonicalVariantSku', 'metadata'];
  const materialChanged = materialFields.some((field) => Object.prototype.hasOwnProperty.call(input, field) && (input as any)[field] !== (listing as any)[field]);
  Object.assign(listing, input);
  const previousState = listing.status;
  if (previousState === 'rejected') {
    // A rejected offer must re-enter the draft state before it can be
    // resubmitted. This keeps the lifecycle graph explicit and auditable.
    listing.status = 'draft';
    listing.moderationReason = undefined;
  } else if (materialChanged && ['published', 'approved'].includes(previousState)) {
    listing.status = 'submitted';
    listing.submittedAt = new Date();
    listing.approvedAt = undefined;
    listing.publishedAt = undefined;
    listing.moderationReason = undefined;
  }
  await listing.save();
  await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: materialChanged ? 'listing_changed_requires_moderation' : 'listing_updated', actorId: sellerId, actorRole: 'seller', fromState: previousState, toState: listing.status, req, metadata: { materialChanged } });
  const inventory = await SellerInventory.findOne({ listing: listing._id, seller: sellerId }).lean();
  sendSuccess(res, publicListing(listing.toObject() as any, inventory), 'Listing updated');
}

export async function submitSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  if (listing.status !== 'draft') { sendBadRequest(res, `A ${listing.status} listing cannot be submitted.`); return; }
  const inventory = await SellerInventory.exists({ listing: listing._id, seller: sellerId });
  if (!inventory) { sendBadRequest(res, 'Add inventory before submitting this listing.'); return; }
  const previousState = listing.status;
  listing.status = 'submitted';
  listing.submittedAt = new Date();
  listing.moderationReason = undefined;
  await listing.save();
  await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: 'listing_submitted', actorId: sellerId, actorRole: 'seller', fromState: previousState, toState: 'submitted', req });
  sendSuccess(res, publicListing(listing.toObject() as any), 'Listing submitted for moderation');
}

export async function pauseSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  if (listing.status !== 'published') { sendBadRequest(res, 'Only a published listing can be paused.'); return; }
  const previousState = listing.status;
  listing.status = 'paused';
  listing.pausedAt = new Date();
  await listing.save();
  await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: 'listing_paused', actorId: sellerId, actorRole: 'seller', fromState: previousState, toState: 'paused', req });
  sendSuccess(res, publicListing(listing.toObject() as any), 'Listing paused');
}

export async function resumeSellerListing(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  if (listing.status !== 'paused') { sendBadRequest(res, 'Only a paused listing can be resumed.'); return; }
  if (!(await assertActiveSeller(sellerId))) { sendForbidden(res, 'Seller approval is required before resuming listings.'); return; }
  const previousState = listing.status;
  listing.status = 'published';
  listing.publishedAt = listing.publishedAt || new Date();
  await listing.save();
  await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: 'listing_resumed', actorId: sellerId, actorRole: 'seller', fromState: previousState, toState: 'published', req });
  sendSuccess(res, publicListing(listing.toObject() as any), 'Listing resumed');
}

export async function adjustSellerInventory(req: Request, res: Response): Promise<void> {
  const sellerId = currentSellerId(req);
  const headerKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');
  const input = inventorySchema.parse({ ...req.body, idempotencyKey: req.body?.idempotencyKey || headerKey });
  if (!input.idempotencyKey) { sendBadRequest(res, 'An Idempotency-Key is required for inventory changes.'); return; }
  const listing = await findOwnedListing(req.params.id, sellerId);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  if (['blocked', 'suspended'].includes(listing.status)) { sendForbidden(res, 'Inventory for this listing is locked.'); return; }
  let inventory: Record<string, any> | null = null;
  let replay = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const prior = await InventoryMovement.findOne({ seller: sellerId, listing: listing._id, idempotencyKey: input.idempotencyKey }).session(session).lean();
      if (prior) {
        inventory = await SellerInventory.findOne({ _id: prior.inventory, seller: sellerId }).session(session).lean() as Record<string, any> | null;
        replay = true;
        return;
      }

      const current = await SellerInventory.findOne({ listing: listing._id, seller: sellerId }).session(session);
      if (!current) throw new InventoryAdjustmentError('Inventory record not found');
      const available = current.available + input.delta;
      if (available < 0) throw new InventoryAdjustmentError('Inventory adjustment exceeds available stock.');
      const returnedDelta = input.reason === 'return_received' ? input.delta : 0;
      const damagedDelta = input.reason === 'damage_reported' ? Math.abs(input.delta) : 0;
      current.available = available;
      current.returned += returnedDelta;
      current.damaged += damagedDelta;
      current.lastAdjustmentReason = input.reason;
      current.lastAdjustmentNote = input.note;
      current.lastAdjustedAt = new Date();
      await current.save({ session });
      inventory = current.toObject() as Record<string, any>;
      await InventoryMovement.create([{
        movementId: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        seller: sellerId,
        listing: listing._id,
        inventory: current._id,
        reason: input.reason,
        availableDelta: input.delta,
        returnedDelta,
        damagedDelta,
        availableAfter: current.available,
        reservedAfter: current.reserved,
        committedAfter: current.committed,
        returnedAfter: current.returned,
        damagedAfter: current.damaged,
        actorId: sellerId,
        actorRole: 'seller',
        note: input.note,
        requestId: (req as Request & { requestId?: string }).requestId,
      }], { session });
      await recordListingAudit({ listing: String(listing._id), seller: sellerId, action: 'inventory_adjusted', actorId: sellerId, actorRole: 'seller', req, metadata: { delta: input.delta, reason: input.reason, note: input.note, idempotencyKey: input.idempotencyKey }, session });
    });
  } catch (error: any) {
    // A concurrent retry with the same key can lose the unique insert race;
    // resolve it to the already-committed movement instead of applying stock
    // a second time.
    if (error?.code === 11000) {
      const prior = await InventoryMovement.findOne({ seller: sellerId, listing: listing._id, idempotencyKey: input.idempotencyKey }).lean();
      if (prior) {
        inventory = await SellerInventory.findOne({ _id: prior.inventory, seller: sellerId }).lean() as Record<string, any> | null;
        replay = true;
      } else throw error;
    } else if (error instanceof InventoryAdjustmentError) {
      sendBadRequest(res, error.message);
      return;
    } else throw error;
  } finally {
    await session.endSession();
  }
  if (!inventory) { sendBadRequest(res, 'Inventory could not be updated.'); return; }
  sendSuccess(res, inventory, replay ? 'Inventory was already updated for this request' : 'Inventory updated');
}

export async function getProductOffers(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendSuccess(res, [], 'No offers found'); return; }
  const product = await Product.findOne({ _id: req.params.id, isPublished: true }).select('_id').lean();
  if (!product) { sendNotFound(res, 'Product not found'); return; }
  const listings = await SellerListing.find({ canonicalProduct: req.params.id, status: 'published' })
    .populate({ path: 'seller', match: { isActive: true, lifecycleStatus: 'active' }, select: 'storefrontName performance kycState complianceState lifecycleStatus' })
    .lean();
  const visible = listings.filter((listing) => listing.seller);
  const inventory = await SellerInventory.find({ listing: { $in: visible.map((item) => item._id) } }).lean();
  const inventoryByListing = new Map(inventory.map((item) => [String(item.listing), item]));
  sendSuccess(res, visible.map((item) => publicListing(item as any, inventoryByListing.get(String(item._id)) || null)), 'Offers loaded');
}

export async function getAllListings(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && LISTING_LIFECYCLE_STATES.includes(req.query.status as ListingLifecycleState)) filter.status = req.query.status;
  if (typeof req.query.seller === 'string' && mongoose.isValidObjectId(req.query.seller)) filter.seller = req.query.seller;
  const [listings, total] = await Promise.all([
    SellerListing.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('seller', 'storefrontName email lifecycleStatus').populate('canonicalProduct', 'name slug brand images').lean(),
    SellerListing.countDocuments(filter),
  ]);
  sendPaginated(res, listings.map((item) => publicListing(item as any)), total, page, limit);
}

export async function updateListingStatus(req: Request, res: Response): Promise<void> {
  const input = statusSchema.parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Listing not found'); return; }
  const listing = await SellerListing.findById(req.params.id);
  if (!listing) { sendNotFound(res, 'Listing not found'); return; }
  const next = input.status as ListingLifecycleState;
  if (listing.status === next) { sendSuccess(res, publicListing(listing.toObject() as any), 'Listing status unchanged'); return; }
  if (!isListingTransitionAllowed(listing.status, next)) { sendBadRequest(res, `Listing cannot move from "${listing.status}" to "${next}".`); return; }
  if (['rejected', 'suspended', 'blocked'].includes(next) && !input.reason) { sendBadRequest(res, 'A reason is required for this status change.'); return; }
  if (next === 'published' && !(await assertActiveSeller(String(listing.seller)))) { sendBadRequest(res, 'The seller must be active before a listing can be published.'); return; }
  const previousState = listing.status;
  listing.status = next;
  listing.moderationReason = input.reason;
  if (next === 'approved') listing.approvedAt = new Date();
  if (next === 'published') listing.publishedAt = new Date();
  if (next === 'paused') listing.pausedAt = new Date();
  await listing.save();
  const actorId = String((req as AuthenticatedRequest).user?.userId || '');
  await recordListingAudit({ listing: String(listing._id), seller: String(listing.seller), action: 'listing_status_changed', actorId, actorRole: 'admin', fromState: previousState, toState: next, reason: input.reason, req });
  sendSuccess(res, publicListing(listing.toObject() as any), 'Listing status updated');
}

export async function getListingAudit(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Listing not found'); return; }
  const { page, limit, skip } = parsePagination(req.query);
  const [entries, total] = await Promise.all([
    ListingAuditLog.find({ listing: req.params.id }).sort('-createdAt').skip(skip).limit(limit).select('-metadata').lean(),
    ListingAuditLog.countDocuments({ listing: req.params.id }),
  ]);
  sendPaginated(res, entries, total, page, limit);
}
