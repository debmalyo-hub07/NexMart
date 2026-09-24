import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { emitOrderStatusUpdate } from '../config/socket';
import { FulfillmentGroup, FULFILLMENT_GROUP_STATUSES, type FulfillmentGroupStatus } from '../models/FulfillmentGroup';
import { Shipment, SHIPMENT_STATUSES, type ShipmentStatus } from '../models/Shipment';
import { Seller } from '../models/Seller';
import { Order } from '../models/Order';
import type { AuthenticatedRequest } from '../types';
import { parsePagination, generateShipmentId } from '../utils/helpers';
import { sendBadRequest, sendConflict, sendNotFound, sendPaginated, sendSuccess } from '../utils/response';
import {
  commitSellerInventoryForGroup,
  releaseSellerInventoryForGroup,
} from '../services/marketplaceInventory.service';

const sellerStatusTransitions: Record<FulfillmentGroupStatus, FulfillmentGroupStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: [],
  shipped: [],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
  returned: [],
};

const statusSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'ready_for_pickup', 'cancelled']),
  note: z.string().trim().max(1000).optional(),
});

function sellerId(req: Request): string {
  return String((req as AuthenticatedRequest).user?.userId || '');
}

function publicGroup(group: InstanceType<typeof FulfillmentGroup>): Record<string, unknown> {
  const value = group.toObject() as Record<string, any>;
  return {
    id: String(value._id),
    groupId: value.groupId,
    order: value.order ? String(value.order._id || value.order) : undefined,
    customer: value.customer ? String(value.customer._id || value.customer) : undefined,
    seller: value.seller ? String(value.seller._id || value.seller) : undefined,
    fulfillmentMode: value.fulfillmentMode,
    items: value.items,
    shippingAddress: value.shippingAddress,
    status: value.status,
    statusHistory: value.statusHistory,
    subtotalPaise: value.subtotalPaise,
    discountPaise: value.discountPaise,
    shippingPaise: value.shippingPaise,
    taxPaise: value.taxPaise,
    totalPaise: value.totalPaise,
    shipment: value.shipment?.shipmentId ? {
      _id: String(value.shipment._id), shipmentId: value.shipment.shipmentId,
      status: value.shipment.status, trackingId: value.shipment.trackingId,
    } : value.shipment ? String(value.shipment._id || value.shipment) : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    orderSummary: value.order && typeof value.order === 'object' ? {
      orderId: value.order.orderId,
      paymentStatus: value.order.paymentStatus,
      paymentMethod: value.order.paymentMethod,
      taxStatus: value.order.taxStatus,
      orderStatus: value.order.orderStatus,
      createdAt: value.order.createdAt,
    } : undefined,
  };
}

export async function getSellerFulfillmentGroups(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { seller: sellerId(req) };
  if (typeof req.query.status === 'string' && FULFILLMENT_GROUP_STATUSES.includes(req.query.status as FulfillmentGroupStatus)) {
    filter.status = req.query.status;
  }
  const [groups, total] = await Promise.all([
    FulfillmentGroup.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('order', 'orderId paymentStatus paymentMethod orderStatus taxStatus createdAt')
      .lean(),
    FulfillmentGroup.countDocuments(filter),
  ]);
  sendPaginated(res, groups.map((group) => publicGroup({ toObject: () => group } as any)), total, page, limit);
}

export async function getSellerFulfillmentGroup(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Fulfillment group not found'); return; }
  const group = await FulfillmentGroup.findOne({ _id: req.params.id, seller: sellerId(req) })
    .populate('order', 'orderId paymentStatus paymentMethod orderStatus taxStatus createdAt')
    .populate('shipment');
  if (!group) { sendNotFound(res, 'Fulfillment group not found'); return; }
  sendSuccess(res, publicGroup(group));
}

export async function updateSellerFulfillmentStatus(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Fulfillment group not found'); return; }
  const input = statusSchema.parse(req.body);
  const session = await mongoose.startSession();
  try {
    let group: InstanceType<typeof FulfillmentGroup> | null = null;
    let notification: { customer: string; orderId: string; status: string } | undefined;
    await session.withTransaction(async () => {
      notification = undefined;
      group = await FulfillmentGroup.findOne({ _id: req.params.id, seller: sellerId(req) }).session(session);
      if (!group) return;
      if (group.status === input.status) return;
      if (!sellerStatusTransitions[group.status].includes(input.status)) {
        throw new Error(`Fulfillment group cannot move from "${group.status}" to "${input.status}".`);
      }
      const order = await Order.findById(group.order).session(session);
      if (!order) throw new Error('Parent order not found for this fulfillment group.');
      if (input.status !== 'cancelled' && (['cancelled', 'returned'].includes(order.orderStatus) || (order.paymentMethod === 'online' && order.paymentStatus !== 'paid'))) throw new AppError('This order is closed or its online payment is not captured.', 409, true, 'ORDER_NOT_READY');
      if (input.status === 'ready_for_pickup') {
        await commitSellerInventoryForGroup(order, group, session);
      }
      if (input.status === 'cancelled') {
        await releaseSellerInventoryForGroup(order, group, session);
      }
      group.status = input.status;
      group.statusHistory.push({ status: input.status, timestamp: new Date(), updatedBy: new mongoose.Types.ObjectId(sellerId(req)), note: input.note });
      await group.save({ session });
      const siblings = await FulfillmentGroup.find({ order: order._id }).session(session);
      if (order.items.every(item => item.listing) && siblings.length && siblings.every(item => item.status === 'cancelled') && order.orderStatus !== 'cancelled') {
        order.orderStatus = 'cancelled';
        order.statusHistory.push({ status: 'cancelled', timestamp: new Date(), updatedBy: new mongoose.Types.ObjectId(sellerId(req)), note: 'All seller packages were cancelled. Payment and any refund are tracked separately.' });
      }
      // Participate in the parent version check even for confirmation and
      // preparation. An unchanged save alone would not write or check __v.
      order.markModified('orderStatus');
      await order.save({ session });
      notification = { customer: String(order.customer), orderId: order.orderId, status: order.orderStatus };
    });
    if (!group) { sendNotFound(res, 'Fulfillment group not found'); return; }
    if (notification) {
      const event = notification as { customer: string; orderId: string; status: string };
      emitOrderStatusUpdate(event.customer, event.orderId, event.status);
    }
    sendSuccess(res, publicGroup(group), 'Fulfillment group updated');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Fulfillment group cannot move')) {
      sendBadRequest(res, error.message);
      return;
    }
    if (error instanceof Error && error.message.startsWith('Parent order not found')) {
      sendNotFound(res, error.message);
      return;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function createSellerShipment(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Fulfillment group not found'); return; }
  const session = await mongoose.startSession();
  try {
    let shipment: InstanceType<typeof Shipment> | null = null;
    let created = false;
    await session.withTransaction(async () => {
      created = false;
      const group = await FulfillmentGroup.findOne({ _id: req.params.id, seller: sellerId(req) }).session(session);
      if (!group) return;
      const order = await Order.findById(group.order).session(session);
      if (!order || ['cancelled', 'returned'].includes(order.orderStatus) || (order.paymentMethod === 'online' && order.paymentStatus !== 'paid')) throw new AppError('This order is closed or its online payment is not captured.', 409, true, 'ORDER_NOT_READY');
      if (group.shipment) {
        shipment = await Shipment.findOne({ _id: group.shipment, seller: sellerId(req) }).session(session);
        return;
      }
      if (group.status !== 'ready_for_pickup') {
        throw new Error('A shipment can be created only when the group is ready for pickup.');
      }
      const seller = await Seller.findOne({ _id: sellerId(req), isActive: true, lifecycleStatus: 'active' }).session(session);
      if (!seller) throw new Error('Seller account is not active.');
      const pickupSource = seller.pickupAddress || seller.businessAddress;
      if (!pickupSource) throw new Error('Add a pickup address before creating a shipment.');
      const createdShipments = await Shipment.create([{
        shipmentId: generateShipmentId(),
        order: group.order,
        fulfillmentGroup: group._id,
        seller: group.seller,
        customer: group.customer,
        items: group.items.map((item) => ({ orderItemId: item.orderItemId, listing: item.listing, quantity: item.quantity, name: item.name, variant: item.variant })),
        pickupSource,
        destination: group.shippingAddress,
        status: 'created',
        handoffEvents: [{ event: 'created', timestamp: new Date(), actorId: new mongoose.Types.ObjectId(sellerId(req)) }],
      }], { session, ordered: true });
      shipment = createdShipments[0];
      group.shipment = shipment._id;
      await group.save({ session });
      order.markModified('orderStatus');
      await order.save({ session });
      created = true;
    });
    if (!shipment) { sendNotFound(res, 'Fulfillment group not found'); return; }
    sendSuccess(res, shipment, created ? 'Shipment created' : 'Existing shipment recovered', created ? 201 : 200);
  } catch (error) {
    if (error instanceof Error && /shipment can be created|pickup address|Seller account/.test(error.message)) {
      sendBadRequest(res, error.message);
      return;
    }
    if ((error as any)?.code === 11000) {
      sendConflict(res, 'A shipment already exists for this fulfillment group.');
      return;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function getSellerShipments(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { seller: sellerId(req) };
  if (typeof req.query.status === 'string' && SHIPMENT_STATUSES.includes(req.query.status as ShipmentStatus)) {
    filter.status = req.query.status;
  }
  const [shipments, total] = await Promise.all([
    Shipment.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('order', 'orderId paymentStatus orderStatus createdAt')
      .populate('fulfillmentGroup', 'groupId status totalPaise')
      .lean(),
    Shipment.countDocuments(filter),
  ]);
  sendPaginated(res, shipments, total, page, limit);
}

