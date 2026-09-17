import mongoose, { ClientSession, Types } from 'mongoose';
import { InventoryMovement } from '../models/InventoryMovement';
import { SellerInventory } from '../models/SellerInventory';

type InventoryState = 'reserved' | 'committed' | 'released' | 'returned';

interface InventoryOrderItem {
  _id?: Types.ObjectId;
  product?: unknown;
  listing?: unknown;
  seller?: unknown;
  inventory?: unknown;
  variant?: string;
  quantity: number;
  inventoryState?: InventoryState;
}

interface InventoryOrder {
  _id?: unknown;
  orderId?: string;
  items?: InventoryOrderItem[];
  save?: (options?: { session?: ClientSession }) => Promise<unknown>;
}

export class MarketplaceInventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketplaceInventoryError';
  }
}

function asId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value !== null && '_id' in value) return asId((value as { _id?: unknown })._id);
  return String(value);
}

function orderKey(order: InventoryOrder): string {
  return asId(order._id) || order.orderId || 'unknown-order';
}

function movementKey(order: InventoryOrder, index: number, action: string, scope = 'order'): string {
  return `${scope}:${orderKey(order)}:${action}:${index}`;
}

async function findMovement(idempotencyKey: string, session?: ClientSession) {
  const query = InventoryMovement.findOne({ idempotencyKey });
  if (session) query.session(session);
  return query.lean();
}

async function appendMovement(
  movement: Record<string, unknown>,
  idempotencyKey: string,
  session?: ClientSession,
): Promise<void> {
  try {
    const options = session ? { session, ordered: true } : { ordered: true };
    await InventoryMovement.create([{ ...movement, idempotencyKey }], options);
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    // A retry after a committed write is successful and must not apply the
    // inventory delta a second time.
    if (!(await findMovement(idempotencyKey, session))) throw error;
  }
}

async function resolveInventory(item: InventoryOrderItem, session?: ClientSession) {
  const inventoryId = asId(item.inventory);
  const sellerId = asId(item.seller);
  const listingId = asId(item.listing);
  if (!sellerId || !listingId) return null;
  const filter: Record<string, unknown> = { seller: sellerId, listing: listingId };
  if (inventoryId) filter._id = inventoryId;
  const query = SellerInventory.findOne(filter);
  if (session) query.session(session);
  return query;
}

async function saveOrder(order: InventoryOrder, session?: ClientSession): Promise<void> {
  if (!order.save) return;
  if (session) await order.save({ session });
  else await order.save();
}

function actorIdFor(item: InventoryOrderItem): Types.ObjectId {
  const sellerId = asId(item.seller);
  if (sellerId && mongoose.isValidObjectId(sellerId)) return new Types.ObjectId(sellerId);
  // Legacy records should never enter this path, but keep the audit record
  // valid if a partially migrated document is encountered.
  return new Types.ObjectId();
}

function movementSnapshot(inventory: any, item: InventoryOrderItem, order: InventoryOrder, index: number, action: string, deltas: { available: number; reserved: number; committed: number; returned: number }, scope = 'order') {
  return {
    movementId: `IM-${scope}-${orderKey(order)}-${action}-${index}`.slice(0, 120),
    seller: actorIdFor(item),
    listing: new Types.ObjectId(asId(item.listing)),
    inventory: inventory._id,
    reason: action === 'commit' ? 'shipment_commit' : action === 'return' ? 'return_received' : 'reservation_release',
    availableDelta: deltas.available,
    reservedDelta: deltas.reserved,
    committedDelta: deltas.committed,
    returnedDelta: deltas.returned,
    damagedDelta: 0,
    availableAfter: inventory.available,
    reservedAfter: inventory.reserved,
    committedAfter: inventory.committed,
    returnedAfter: inventory.returned,
    damagedAfter: inventory.damaged,
    actorId: actorIdFor(item),
    actorRole: 'system',
    note: `Order ${orderKey(order)} inventory ${action}`,
  };
}

/** Move reserved seller stock into committed stock exactly once. */
export async function commitSellerInventory(order: InventoryOrder, session?: ClientSession, selectedOrderItemIds?: Set<string>, scope = 'order'): Promise<boolean> {
  let changed = false;
  for (let index = 0; index < (order.items || []).length; index += 1) {
    const item = order.items![index];
    if (!item.listing || !item.seller || !item.quantity) continue;
    if (selectedOrderItemIds && !selectedOrderItemIds.has(asId(item._id) || '')) continue;
    if (item.inventoryState === 'committed' || item.inventoryState === 'released' || item.inventoryState === 'returned') continue;
    const inventory = await resolveInventory(item, session);
    if (!inventory) throw new MarketplaceInventoryError(`Inventory record missing for marketplace order ${orderKey(order)}.`);
    const updated = await SellerInventory.findOneAndUpdate(
      { _id: inventory._id, seller: item.seller, reserved: { $gte: item.quantity } },
      {
        $inc: { reserved: -item.quantity, committed: item.quantity },
        $set: { lastAdjustmentReason: 'shipment_commit', lastAdjustmentNote: `Committed for ${orderKey(order)}`, lastAdjustedAt: new Date() },
      },
      { new: true, session },
    );
    const key = movementKey(order, index, 'commit', scope);
    if (!updated) {
      if (await findMovement(key, session)) {
        item.inventoryState = 'committed';
        changed = true;
        continue;
      }
      throw new MarketplaceInventoryError(`Reserved inventory changed for marketplace order ${orderKey(order)}.`);
    }
    await appendMovement(movementSnapshot(updated, item, order, index, 'commit', { available: 0, reserved: -item.quantity, committed: item.quantity, returned: 0 }, scope), key, session);
    item.inventoryState = 'committed';
    changed = true;
  }
  if (changed) await saveOrder(order, session);
  return changed;
}

/** Release reserved/committed seller stock back to available stock exactly once. */
export async function releaseSellerInventory(order: InventoryOrder, session?: ClientSession, selectedOrderItemIds?: Set<string>, scope = 'order'): Promise<boolean> {
  let changed = false;
  for (let index = 0; index < (order.items || []).length; index += 1) {
    const item = order.items![index];
    if (!item.listing || !item.seller || !item.quantity) continue;
    if (selectedOrderItemIds && !selectedOrderItemIds.has(asId(item._id) || '')) continue;
    if (item.inventoryState === 'released' || item.inventoryState === 'returned') continue;
    const inventory = await resolveInventory(item, session);
    if (!inventory) throw new MarketplaceInventoryError(`Inventory record missing for marketplace order ${orderKey(order)}.`);
    const state = item.inventoryState || 'reserved';
    const filter: Record<string, unknown> = { _id: inventory._id, seller: item.seller };
    const update = state === 'committed'
      ? { $inc: { available: item.quantity, committed: -item.quantity }, $set: { lastAdjustmentReason: 'reservation_release', lastAdjustmentNote: `Released for ${orderKey(order)}`, lastAdjustedAt: new Date() } }
      : { $inc: { available: item.quantity, reserved: -item.quantity }, $set: { lastAdjustmentReason: 'reservation_release', lastAdjustmentNote: `Released for ${orderKey(order)}`, lastAdjustedAt: new Date() } };
    filter[state === 'committed' ? 'committed' : 'reserved'] = { $gte: item.quantity };
    const updated = await SellerInventory.findOneAndUpdate(filter, update, { new: true, session });
    const key = movementKey(order, index, 'release', scope);
    if (!updated) {
      if (await findMovement(key, session)) {
        item.inventoryState = 'released';
        changed = true;
        continue;
      }
      throw new MarketplaceInventoryError(`Inventory state changed for marketplace order ${orderKey(order)}.`);
    }
    await appendMovement(movementSnapshot(updated, item, order, index, 'release', {
      available: item.quantity,
      reserved: state === 'committed' ? 0 : -item.quantity,
      committed: state === 'committed' ? -item.quantity : 0,
      returned: 0,
    }, scope), key, session);
    item.inventoryState = 'released';
    changed = true;
  }
  if (changed) await saveOrder(order, session);
  return changed;
}

/** Move delivered-return stock into the returned bucket pending inspection. */
export async function receiveReturnedSellerInventory(order: InventoryOrder, session?: ClientSession, selectedOrderItemIds?: Set<string>, scope = 'order'): Promise<boolean> {
  let changed = false;
  for (let index = 0; index < (order.items || []).length; index += 1) {
    const item = order.items![index];
    if (!item.listing || !item.seller || !item.quantity || item.inventoryState !== 'committed') continue;
    if (selectedOrderItemIds && !selectedOrderItemIds.has(asId(item._id) || '')) continue;
    const inventory = await resolveInventory(item, session);
    if (!inventory) throw new MarketplaceInventoryError(`Inventory record missing for marketplace order ${orderKey(order)}.`);
    const updated = await SellerInventory.findOneAndUpdate(
      { _id: inventory._id, seller: item.seller, committed: { $gte: item.quantity } },
      { $inc: { committed: -item.quantity, returned: item.quantity }, $set: { lastAdjustmentReason: 'return_received', lastAdjustmentNote: `Return received for ${orderKey(order)}`, lastAdjustedAt: new Date() } },
      { new: true, session },
    );
    const key = movementKey(order, index, 'return', scope);
    if (!updated) {
      if (await findMovement(key, session)) {
        item.inventoryState = 'returned';
        changed = true;
        continue;
      }
      throw new MarketplaceInventoryError(`Committed inventory changed for marketplace order ${orderKey(order)}.`);
    }
    await appendMovement(movementSnapshot(updated, item, order, index, 'return', { available: 0, reserved: 0, committed: -item.quantity, returned: item.quantity }, scope), key, session);
    item.inventoryState = 'returned';
    changed = true;
  }
  if (changed) await saveOrder(order, session);
  return changed;
}

function groupItemIds(group: { items: Array<{ orderItemId: unknown }> }): Set<string> {
  return new Set(group.items.map((item) => asId(item.orderItemId)).filter((id): id is string => Boolean(id)));
}

export function commitSellerInventoryForGroup(order: InventoryOrder, group: { groupId: string; items: Array<{ orderItemId: unknown }> }, session?: ClientSession): Promise<boolean> {
  return commitSellerInventory(order, session, groupItemIds(group), `group:${group.groupId}`);
}

export function releaseSellerInventoryForGroup(order: InventoryOrder, group: { groupId: string; items: Array<{ orderItemId: unknown }> }, session?: ClientSession): Promise<boolean> {
  return releaseSellerInventory(order, session, groupItemIds(group), `group:${group.groupId}`);
}

export function receiveReturnedSellerInventoryForGroup(order: InventoryOrder, group: { groupId: string; items: Array<{ orderItemId: unknown }> }, session?: ClientSession): Promise<boolean> {
  return receiveReturnedSellerInventory(order, session, groupItemIds(group), `group:${group.groupId}`);
}
