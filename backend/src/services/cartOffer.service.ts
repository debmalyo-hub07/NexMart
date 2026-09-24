import mongoose, { type ClientSession, type Types } from 'mongoose';
import type { ICartDoc } from '../models/Cart';
import type { ICartItem } from '../types';
import { SellerListing, type ISellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { Seller } from '../models/Seller';

function matches(listing: Pick<ISellerListing, 'canonicalProduct' | 'canonicalVariantSku' | 'status'>, productId: string, sku: string) {
  return listing.status === 'published' && String(listing.canonicalProduct) === productId && (!listing.canonicalVariantSku || listing.canonicalVariantSku === sku);
}

export async function resolveListingOffer(productId: string, sku: string, listingId: string, session?: ClientSession) {
  if (!mongoose.isValidObjectId(listingId)) return undefined;
  const listing = await SellerListing.findById(listingId).session(session ?? null).lean();
  if (!listing || !matches(listing, productId, sku)) return undefined;
  // Mongo transactions do not support parallel operations on the same session.
  const seller = await Seller.exists({ _id: listing.seller, isActive: true, lifecycleStatus: 'active' }).session(session ?? null);
  const inventory = await SellerInventory.findOne({ listing: listing._id, seller: listing.seller }).session(session ?? null).lean();
  if (!seller || !inventory) return undefined;
  return { price: listing.pricePaise / 100, stock: inventory.available, seller: listing.seller };
}

/** A current, read-only offer snapshot. Stored price remains the customer's prior price. */
export async function cartSnapshot(cart: ICartDoc | null) {
  if (!cart) return { items: [] };
  const lines = cart.items.filter(item => item.listing);
  const offers = new Map<string, { price: number; stock: number; available: boolean }>();
  if (lines.length) {
    const listingIds = lines.map(item => item.listing as Types.ObjectId);
    const listings = await SellerListing.find({ _id: { $in: listingIds } }).lean();
    const [sellers, inventories] = await Promise.all([
      Seller.find({ _id: { $in: listings.map(listing => listing.seller) }, isActive: true, lifecycleStatus: 'active' }).select('_id').lean(),
      SellerInventory.find({ listing: { $in: listingIds } }).select('listing seller available').lean(),
    ]);
    const sellerIds = new Set(sellers.map(seller => String(seller._id)));
    const byListing = new Map(listings.map(listing => [String(listing._id), listing]));
    const inventoryByListing = new Map(inventories.map(inventory => [String(inventory.listing), inventory]));
    for (const item of lines) {
      const listing = byListing.get(String(item.listing));
      const inventory = inventoryByListing.get(String(item.listing));
      const valid = listing && matches(listing, String(item.product), item.variant) && sellerIds.has(String(listing.seller)) && String(inventory?.seller) === String(listing.seller);
      const others = lines.filter(line => line !== item && String(line.listing) === String(item.listing)).reduce((sum, line) => sum + line.quantity, 0);
      const stock = valid ? Math.max(0, (inventory?.available ?? 0) - others) : 0;
      offers.set(String(item._id), { price: valid ? listing.pricePaise / 100 : item.price, stock, available: !!valid && stock > 0 });
    }
  }
  await cart.populate([
    { path: 'items.product', select: 'name images slug variants isPublished isDemo taxRateBps' },
    { path: 'items.seller', select: 'storefrontName' },
  ]);
  // toJSON, not toObject: populated product subdocuments keep their `attributes`
  // Map fields as Map instances under toObject, and JSON.stringify serialises a
  // Map to `{}` — cart lines would lose the chosen-option label ("512 GB"
  // became "Standard option"). toJSON converts Maps to plain objects.
  const plain = cart.toJSON<{ _id: Types.ObjectId; items: ICartItem[] }>();
  return { ...plain, items: plain.items.map(item => ({ ...item, ...(item.listing ? { offer: offers.get(String(item._id)) } : {}) })) };
}
