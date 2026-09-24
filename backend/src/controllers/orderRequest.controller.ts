import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { OrderRequest, REQUEST_KINDS, REQUEST_STATUSES } from '../models/OrderRequest';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { IOrder } from '../types';
import { sendSuccess, sendNotFound, sendError, sendPaginated } from '../utils/response';
import { parsePagination } from '../utils/helpers';
import { emitOrderStatusUpdate } from '../config/socket';

const inputSchema = z.object({
  requestKey: z.string().uuid(), kind: z.enum(REQUEST_KINDS),
  itemId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  reason: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(1000),
}).strict();
const identity = (req: Request): string => (req as Request & { user: { id: string } }).user.id;

async function ownedOrder(req: Request) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return Order.findOne({ _id: req.params.id, customer: identity(req) });
}

async function actionsFor(order: IOrder) {
  const groups = await FulfillmentGroup.find({ order: order._id }).lean();
  const beforeDispatch = ['placed', 'confirmed', 'processing'];
  const cancellation = beforeDispatch.includes(order.orderStatus) && groups.filter(group => group.status !== 'cancelled').every(group => [...beforeDispatch, 'ready_for_pickup'].includes(group.status));
  const returnItems = order.items.map(item => {
    const group = groups.find(group => group.items.some(line => String(line.orderItemId) === String(item._id)));
    const status = group?.status || order.orderStatus;
    const delivered = (group?.statusHistory || order.statusHistory).find(entry => entry.status === 'delivered')?.timestamp;
    const days = item.purchaseTerms?.returnWindowDays;
    let reason = '';
    if (status !== 'delivered') reason = 'Returns can be requested after this item is delivered.';
    else if (days === undefined || days === null || !delivered) reason = 'Return terms need review. Send an order help request.';
    else if (days === 0) reason = 'This offer has no standard return window. You can still ask for help with a problem.';
    else if (Date.now() > new Date(delivered).getTime() + days * 86_400_000) reason = 'The standard return window has ended. Contact us through order help.';
    return {
      itemId: String(item._id), name: item.name || 'Ordered item', eligible: !reason,
      reason, returnWindowDays: days,
      deadline: delivered && days ? new Date(new Date(delivered).getTime() + days * 86_400_000).toISOString() : undefined,
    };
  });
  return { cancellation, returnItems };
}

export async function getOrderRequests(req: Request, res: Response): Promise<void> {
  const order = await ownedOrder(req);
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  const [requests, actions] = await Promise.all([
    OrderRequest.find({ order: order._id, customer: identity(req) }).sort('-createdAt').lean(),
    actionsFor(order),
  ]);
  sendSuccess(res, { requests, actions });
}

export async function createOrderRequest(req: Request, res: Response): Promise<void> {
  const input = inputSchema.parse(req.body);
  const order = await ownedOrder(req);
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  const itemKey = input.kind === 'return' ? input.itemId : 'order';
  const existing = await OrderRequest.findOne({ customer: identity(req), requestKey: input.requestKey });
  if (existing) {
    if (String(existing.order) !== String(order._id) || existing.kind !== input.kind || existing.itemKey !== itemKey || existing.reason !== input.reason) {
      sendError(res, 'This request reference was already used for different details.', 409); return;
    }
    sendSuccess(res, existing, 'Request already received'); return;
  }
  const actions = await actionsFor(order);
  if (input.kind === 'cancellation' && !actions.cancellation) { sendError(res, 'This order can no longer be requested for cancellation. Use order help for an issue.', 409); return; }
  const returnItem = actions.returnItems.find(item => item.itemId === input.itemId);
  if (input.kind === 'return' && (!returnItem || !returnItem.eligible)) { sendError(res, returnItem?.reason || 'Select an eligible item from this order.', 409); return; }
  try {
    const request = await OrderRequest.create({
      order: order._id, customer: identity(req), requestKey: input.requestKey,
      kind: input.kind, itemKey, itemName: returnItem?.name, reason: input.reason,
      history: [{ status: 'submitted', timestamp: new Date(), note: 'Request received. Updates will appear here.' }],
    });
    sendSuccess(res, request, 'Request received. Your order and payment have not changed.', 201);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const current = await OrderRequest.findOne({ order: order._id, customer: identity(req), kind: input.kind, itemKey, isOpen: true });
    if (current?.requestKey === input.requestKey && current.reason === input.reason) { sendSuccess(res, current, 'Request already received'); return; }
    sendError(res, 'There is already an open request for this action. Follow its updates below.', 409);
  }
}

export async function getAdminOrderRequests(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {};
  if (req.query.status === 'open') filter.isOpen = true;
  else if (typeof req.query.status === 'string' && REQUEST_STATUSES.includes(req.query.status as typeof REQUEST_STATUSES[number])) filter.status = req.query.status;
  if (typeof req.query.kind === 'string' && REQUEST_KINDS.includes(req.query.kind as typeof REQUEST_KINDS[number])) filter.kind = req.query.kind;
  const [requests, total] = await Promise.all([
    OrderRequest.find(filter).sort('createdAt').skip(skip).limit(limit)
      .populate('order', 'orderId orderStatus paymentStatus refund total')
      .populate('customer', 'name email').lean(),
    OrderRequest.countDocuments(filter),
  ]);
  sendPaginated(res, requests, total, page, limit);
}

export async function updateOrderRequest(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Request not found'); return; }
  const input = z.object({ status: z.enum(REQUEST_STATUSES), note: z.string().trim().min(5).max(1000), version: z.number().int().nonnegative() }).strict().parse(req.body);
  const request = await OrderRequest.findById(req.params.id);
  if (!request) { sendNotFound(res, 'Request not found'); return; }
  const transitions: Record<string, string[]> = {
    submitted: ['under_review', 'rejected'], under_review: ['approved', 'rejected', ...(request.kind === 'help' ? ['resolved'] : [])],
    approved: ['resolved'], rejected: [], resolved: [],
  };
  if (!transitions[request.status]?.includes(input.status)) { sendError(res, 'This request cannot move to that state. Refresh its latest status.', 409); return; }
  const order = await Order.findById(request.order);
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (input.status === 'resolved' && request.kind !== 'help') {
    const complete = request.kind === 'return'
      ? order.items.some(item => String(item._id) === request.itemKey && item.inventoryState === 'returned')
      : order.orderStatus === 'cancelled';
    if (!complete) { sendError(res, `Complete the ${request.kind} in order operations before resolving this request.`, 409); return; }
  }
  const updated = await OrderRequest.findOneAndUpdate({ _id: request._id, __v: input.version, status: request.status }, {
    $set: { status: input.status, isOpen: !['resolved', 'rejected'].includes(input.status) },
    $push: { history: { status: input.status, note: input.note, timestamp: new Date(), updatedBy: identity(req) } }, $inc: { __v: 1 },
  }, { new: true, runValidators: true });
  if (!updated) { sendError(res, 'Another reviewer updated this request. Refresh before continuing.', 409); return; }
  emitOrderStatusUpdate(String(order.customer), order.orderId, order.orderStatus);
  sendSuccess(res, updated, 'Customer-visible update saved');
}
