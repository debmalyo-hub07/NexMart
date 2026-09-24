import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { MarketplaceLedgerEntry } from '../models/MarketplaceLedgerEntry';
import { sendSuccess } from '../utils/response';

export async function getSellerDashboard(req: Request, res: Response): Promise<void> {
  const seller = new mongoose.Types.ObjectId((req as Request & { user: { id: string } }).user.id);
  const [listings, inventory, fulfillment, balances] = await Promise.all([
    SellerListing.aggregate([{ $match: { seller } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    SellerInventory.aggregate([
      { $match: { seller, available: { $lte: 5 } } },
      { $lookup: { from: 'sellerlistings', localField: 'listing', foreignField: '_id', as: 'offer' } },
      { $unwind: '$offer' }, { $match: { 'offer.status': 'published', 'offer.seller': seller } },
      { $lookup: { from: 'products', localField: 'offer.canonicalProduct', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $facet: {
        count: [{ $count: 'total' }],
        items: [{ $sort: { available: 1, updatedAt: 1 } }, { $limit: 8 }, { $project: { _id: 0, listingId: '$listing', name: '$product.name', image: { $arrayElemAt: ['$product.images', 0] }, sku: '$offer.sellerSku', available: 1, reserved: 1 } }],
      } },
    ]),
    FulfillmentGroup.aggregate([
      { $match: { seller } },
      { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'parent' } },
      { $unwind: '$parent' },
      { $match: { 'parent.orderStatus': { $nin: ['cancelled', 'returned'] }, $or: [{ 'parent.paymentMethod': 'cod' }, { 'parent.paymentStatus': 'paid' }] } },
      { $facet: {
        counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        queue: [{ $match: { status: { $in: ['placed', 'confirmed', 'processing', 'ready_for_pickup'] } } }, { $sort: { createdAt: 1 } }, { $limit: 8 }, { $project: { _id: 1, groupId: 1, status: 1, createdAt: 1, totalPaise: 1, orderId: '$parent.orderId', itemCount: { $sum: '$items.quantity' }, productName: { $arrayElemAt: ['$items.name', 0] }, image: { $arrayElemAt: ['$items.image', 0] }, shipment: 1 } }],
      } },
    ]),
    MarketplaceLedgerEntry.aggregate([{ $match: { seller, account: { $in: ['seller_payable', 'seller_reserve', 'seller_receivable'] } } }, { $group: { _id: '$account', amountPaise: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amountPaise', { $multiply: ['$amountPaise', -1] }] } } } }]),
  ]);
  sendSuccess(res, {
    asOf: new Date().toISOString(),
    listings: Object.fromEntries(listings.map(row => [row._id, row.count])),
    fulfillment: Object.fromEntries((fulfillment[0]?.counts || []).map((row: { _id: string; count: number }) => [row._id, row.count])),
    actionQueue: fulfillment[0]?.queue || [],
    lowStockCount: inventory[0]?.count?.[0]?.total || 0, lowStock: inventory[0]?.items || [],
    balances: Object.fromEntries(balances.map(row => [row._id, row.amountPaise])),
  });
}
