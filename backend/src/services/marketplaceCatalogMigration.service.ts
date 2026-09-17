import crypto from 'crypto';
import { Product } from '../models/Product';
import { Seller } from '../models/Seller';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';

export const FIRST_PARTY_SELLER_EMAIL = 'retail@nexmart.local';
export const LEGACY_CATALOG_MIGRATION_SOURCE = 'legacy_admin_catalog_v1';

export interface CatalogMigrationResult {
  dryRun: boolean;
  sellerCreated: boolean;
  productsScanned: number;
  listingsCreated: number;
  inventoriesCreated: number;
  variantsSkipped: number;
}

function migrationSku(productId: string, variantSku: string): string {
  const digest = crypto.createHash('sha256').update(`${productId}:${variantSku}`).digest('hex').slice(0, 12).toUpperCase();
  return `NXM-${productId}-${digest}`.slice(0, 120);
}

/**
 * Lands legacy admin-owned variants in the marketplace model. Existing
 * listings and inventory are intentionally left untouched, so an interrupted
 * run can be resumed safely and seller edits survive a rerun.
 */
export async function migrateLegacyCatalog(options: { dryRun?: boolean } = {}): Promise<CatalogMigrationResult> {
  const dryRun = options.dryRun === true;
  const result: CatalogMigrationResult = { dryRun, sellerCreated: false, productsScanned: 0, listingsCreated: 0, inventoriesCreated: 0, variantsSkipped: 0 };
  let seller = await Seller.findOne({ email: FIRST_PARTY_SELLER_EMAIL });

  if (!seller && !dryRun) {
    seller = await Seller.create({
      name: 'NexMart Retail',
      email: FIRST_PARTY_SELLER_EMAIL,
      phone: '9000000000',
      role: 'seller',
      sellerKind: 'first_party',
      systemKey: 'nexmart-retail',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      lifecycleStatus: 'active',
      legalBusinessName: 'NexMart Retail',
      storefrontName: 'NexMart Retail',
      businessType: 'private_limited',
      // The internal account is operationally active, but these fields remain
      // unverified until the platform has evidence to support a claim.
      kycState: 'unverified',
      complianceState: 'unverified',
      policyAcceptedAt: new Date(),
      prohibitedProductsAcknowledgedAt: new Date(),
    });
    result.sellerCreated = true;
  }

  const products = await Product.find().select('_id slug isPublished variants').lean();
  result.productsScanned = products.length;
  if (!seller && dryRun) {
    result.listingsCreated = products.reduce((count, product) => count + (product.variants || []).filter((variant) => Boolean(variant?.sku && Number.isFinite(variant.price))).length, 0);
    result.variantsSkipped = products.reduce((count, product) => count + (product.variants || []).filter((variant) => !variant?.sku || !Number.isFinite(variant.price)).length, 0);
    return result;
  }
  if (!seller) throw new Error('First-party seller could not be created');

  const existing = await SellerListing.find({ seller: seller._id }).select('canonicalProduct canonicalVariantSku inventory').lean();
  const existingKeys = new Set(existing.map((item) => `${String(item.canonicalProduct)}:${item.canonicalVariantSku || ''}`));
  if (dryRun) {
    for (const product of products) {
      for (const variant of product.variants || []) {
        if (!variant?.sku || !Number.isFinite(variant.price)) { result.variantsSkipped += 1; continue; }
        if (!existingKeys.has(`${String(product._id)}:${variant.sku}`)) result.listingsCreated += 1;
      }
    }
    return result;
  }

  for (const product of products) {
    const seenSkus = new Set<string>();
    for (const variant of product.variants || []) {
      if (!variant?.sku || !Number.isFinite(variant.price) || seenSkus.has(variant.sku)) { result.variantsSkipped += 1; continue; }
      seenSkus.add(variant.sku);
      const key = `${String(product._id)}:${variant.sku}`;
      const wasPresent = existingKeys.has(key);
      const listing = await SellerListing.findOneAndUpdate(
        { seller: seller._id, canonicalProduct: product._id, canonicalVariantSku: variant.sku },
        {
          $setOnInsert: {
            seller: seller._id,
            canonicalProduct: product._id,
            canonicalVariantSku: variant.sku,
            sellerSku: migrationSku(String(product._id), variant.sku),
            pricePaise: Math.round((variant.price + Number.EPSILON) * 100),
            compareAtPricePaise: variant.comparePrice === undefined ? undefined : Math.round((variant.comparePrice + Number.EPSILON) * 100),
            condition: 'new',
            handlingTimeDays: 2,
            fulfillmentMode: 'nexmart',
            returnWindowDays: 7,
            status: product.isPublished ? 'published' : 'draft',
            publishedAt: product.isPublished ? new Date() : undefined,
            metadata: { migrationSource: LEGACY_CATALOG_MIGRATION_SOURCE },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (!wasPresent) { result.listingsCreated += 1; existingKeys.add(key); }

      const existingInventory = await SellerInventory.exists({ listing: listing._id, seller: seller._id });
      const inventory = await SellerInventory.findOneAndUpdate(
        { listing: listing._id, seller: seller._id },
        {
          $setOnInsert: {
            listing: listing._id,
            seller: seller._id,
            available: variant.stock,
            reserved: 0,
            committed: 0,
            returned: 0,
            damaged: 0,
            lastAdjustmentReason: 'opening_balance',
            lastAdjustmentNote: 'Migrated from the legacy admin catalog',
            lastAdjustedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (!existingInventory) result.inventoriesCreated += 1;
      if (!listing.inventory || String(listing.inventory) !== String(inventory._id)) {
        await SellerListing.updateOne({ _id: listing._id }, { $set: { inventory: inventory._id } });
      }
    }
  }
  return result;
}

export async function rollbackLegacyCatalogMigration(options: { dryRun?: boolean } = {}): Promise<{ dryRun: boolean; listings: number; inventories: number; sellerDeleted: boolean }> {
  const dryRun = options.dryRun === true;
  const seller = await Seller.findOne({ systemKey: 'nexmart-retail' }).select('_id').lean();
  if (!seller) return { dryRun, listings: 0, inventories: 0, sellerDeleted: false };
  const listings = await SellerListing.find({ seller: seller._id, 'metadata.migrationSource': LEGACY_CATALOG_MIGRATION_SOURCE }).select('_id').lean();
  const listingIds = listings.map((item) => item._id);
  if (dryRun) return { dryRun, listings: listingIds.length, inventories: await SellerInventory.countDocuments({ listing: { $in: listingIds }, seller: seller._id }), sellerDeleted: false };
  const inventoryResult = await SellerInventory.deleteMany({ listing: { $in: listingIds }, seller: seller._id });
  const listingResult = await SellerListing.deleteMany({ _id: { $in: listingIds }, seller: seller._id, 'metadata.migrationSource': LEGACY_CATALOG_MIGRATION_SOURCE });
  const remaining = await SellerListing.exists({ seller: seller._id });
  let sellerDeleted = false;
  if (!remaining) {
    const deleted = await Seller.deleteOne({ _id: seller._id, systemKey: 'nexmart-retail' });
    sellerDeleted = deleted.deletedCount === 1;
  }
  return { dryRun, listings: listingResult.deletedCount, inventories: inventoryResult.deletedCount, sellerDeleted };
}
