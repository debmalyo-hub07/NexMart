import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';
import { SellerListing } from '../models/SellerListing';
import { SellerInventory } from '../models/SellerInventory';
import { Seller } from '../models/Seller';
import { FulfillmentGroup } from '../models/FulfillmentGroup';
import { InventoryMovement } from '../models/InventoryMovement';
import type { AuthenticatedRequest, IOrder } from '../types';
import { createRazorpayOrder, fetchOrderPayments, fetchPayment } from '../services/razorpay.service';
import { recordCapturedPayment } from '../services/orderPayment.service';
import { calculateMarketplaceFees, feeSnapshotFromCalculation, resolveMarketplaceFeeRule, type FeeRuleSnapshot } from '../services/marketplaceFee.service';
import { generateFulfillmentGroupId, generateOrderId, verifyRazorpaySignature } from '../utils/helpers';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response';
import { emitNewOrder } from '../config/socket';
import { env } from '../config/env';
import { includedProductTax } from '../utils/productTax';
import { sumOrderTotals } from '../services/pricing.service';
import { logger } from '../utils/logger';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const checkoutItemSchema = z.object({
  product: objectId.optional(),
  listing: objectId.optional(),
  variant: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(10),
  expectedPrice: z.number().finite().nonnegative().optional(),
}).superRefine((item, context) => {
  if (!item.product && !item.listing) context.addIssue({ code: z.ZodIssueCode.custom, path: ['product'], message: 'A product or seller listing is required' });
});
export const checkoutSchema = z.object({
  checkoutId: z.string().uuid().optional(),
  items: z.array(checkoutItemSchema).min(1, 'Your cart is empty').max(50)
    .refine(items => new Set(items.map(item => `${(item.listing || item.product || '').toLowerCase()}:${item.variant}`)).size === items.length, 'Combine duplicate product options in your cart'),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2, 'Enter the recipient’s full name').max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    addressLine1: z.string().trim().min(5, 'Enter a complete street address').max(250),
    addressLine2: z.string().trim().max(250).optional(),
    city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100),
    pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'), country: z.literal('India').default('India'),
  }),
  paymentMethod: z.enum(['online', 'cod']),
  expectedTotal: z.number().finite().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

class CheckoutError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) { super(message); }
}
const paise = (amount: number) => Math.round((amount + Number.EPSILON) * 100);

type ValidatedCheckoutItem = {
  product: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  listing?: mongoose.Types.ObjectId;
  seller?: mongoose.Types.ObjectId;
  sellerSku?: string;
  fulfillmentMode?: 'seller' | 'nexmart';
  inventory?: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  variant: string;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
  taxRateBps?: number;
  taxPaise: number;
  hsnCode?: string;
  discountPaise: number;
  inventoryState?: 'reserved' | 'committed' | 'released';
  purchaseTerms?: { sellerName?: string; returnWindowDays?: number; handlingTimeDays?: number; warrantyText?: string };
};

/** Allocate a minor-unit amount without losing a paise to rounding. */
function allocateMinorUnits(total: number, bases: number[]): number[] {
  if (bases.length === 0) return [];
  const baseTotal = bases.reduce((sum, value) => sum + value, 0);
  if (baseTotal <= 0 || total <= 0) return bases.map(() => 0);
  const allocations: number[] = [];
  let remaining = total;
  let remainingBase = baseTotal;
  for (let index = 0; index < bases.length; index += 1) {
    if (index === bases.length - 1) {
      allocations.push(remaining);
      break;
    }
    const allocation = Math.floor((remaining * bases[index]) / remainingBase);
    allocations.push(allocation);
    remaining -= allocation;
    remainingBase -= bases[index];
  }
  return allocations;
}

function checkoutData(order: IOrder) {
  return {
    orderId: String(order._id),
    humanOrderId: order.orderId,
    razorpayOrderId: order.razorpayOrderId,
    total: order.total,
    totalPaise: order.totalPaise,
    fulfillmentGroups: order.fulfillmentGroups?.map((id) => String(id)),
    currency: 'INR',
    keyId: order.paymentMethod === 'online' ? env.RAZORPAY_KEY_ID : undefined,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
  };
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const input = checkoutSchema.parse(req.body);
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, checkoutId: undefined })).digest('hex');
  const saved = () => Order.findOne({ customer: userId, checkoutId: input.checkoutId }).select('+checkoutFingerprint');
  const assertSame = (order: IOrder) => {
    if (order.checkoutFingerprint !== fingerprint) throw new CheckoutError('This checkout was already saved with different details. Open your orders to review it.', 'CHECKOUT_CONFLICT');
  };
  let session: mongoose.ClientSession | undefined;
  let created = false;
  let result: IOrder | undefined;
  try {
    if (input.checkoutId) {
      const existing = await saved();
      if (existing) { assertSame(existing); sendSuccess(res, checkoutData(existing), 'Existing order recovered'); return; }
    }
    session = await mongoose.startSession();
    let razorpayOrderId: string | undefined;
    const humanOrderId = generateOrderId();
    await session.withTransaction(async () => {
      if (input.checkoutId) {
        const existing = await saved().session(session!);
        if (existing) { assertSame(existing); result = existing; created = false; return; }
      }
      const validatedItems: ValidatedCheckoutItem[] = [];

      // Resolve every line against server state. A listing line uses the
      // seller's inventory and price; a legacy line keeps the original
      // canonical-product stock behavior until the catalog migration runs.
      for (const item of input.items) {
        if (item.listing) {
          const listing = await SellerListing.findOne({ _id: item.listing, status: 'published' }).session(session!);
          if (!listing) throw new CheckoutError('An item or offer is no longer available. Review your cart before ordering.', 'ITEM_UNAVAILABLE');

          const seller = await Seller.findOne({ _id: listing.seller, isActive: true, lifecycleStatus: 'active' }).select('_id storefrontName').session(session!);
          if (!seller) throw new CheckoutError('This seller is temporarily unavailable. Review your cart before ordering.', 'SELLER_UNAVAILABLE');

          if (item.product && String(item.product) !== String(listing.canonicalProduct)) {
            throw new CheckoutError('The selected offer does not belong to this product.', 'ITEM_UNAVAILABLE');
          }
          if (listing.canonicalVariantSku && listing.canonicalVariantSku !== item.variant) {
            throw new CheckoutError('The selected option is no longer available from this seller.', 'ITEM_UNAVAILABLE');
          }

          const product = await Product.findOne({ _id: listing.canonicalProduct, isPublished: true }).session(session!);
          if (product?.isDemo) throw new CheckoutError('Sample products cannot be purchased.', 'ITEM_UNAVAILABLE');
          const variant = product?.variants.find((option) => option.sku === item.variant);
          if (!product || !variant) throw new CheckoutError('An item or option is no longer available. Review your cart before ordering.', 'ITEM_UNAVAILABLE');

          const unitPricePaise = listing.pricePaise;
          if (item.expectedPrice !== undefined && paise(item.expectedPrice) !== unitPricePaise) {
            throw new CheckoutError('A product price changed. Review the updated cart before ordering.', 'PRICE_CHANGED');
          }
          const inventory = await SellerInventory.findOne({ listing: listing._id, seller: seller._id }).select('_id available').session(session!);
          if (!inventory || inventory.available < item.quantity) {
            throw new CheckoutError(`Stock changed for ${product.name}. Review your cart before ordering.`, 'STOCK_CHANGED');
          }

          const totalPricePaise = unitPricePaise * item.quantity;
          validatedItems.push({
            product: product._id,
            category: product.category,
            listing: listing._id,
            seller: seller._id,
            sellerSku: listing.sellerSku,
            fulfillmentMode: listing.fulfillmentMode,
            purchaseTerms: { sellerName: seller.storefrontName, returnWindowDays: listing.returnWindowDays, handlingTimeDays: listing.handlingTimeDays, warrantyText: listing.warrantyText },
            inventory: inventory._id,
            name: product.name,
            image: variant.images?.[0] || product.images?.[0],
            variant: item.variant,
            quantity: item.quantity,
            unitPricePaise,
            totalPricePaise,
            taxRateBps: product.taxRateBps,
            taxPaise: includedProductTax(totalPricePaise, product.taxRateBps),
            hsnCode: product.hsnCode,
            discountPaise: 0,
            inventoryState: 'reserved',
          });
          continue;
        }

        // Legacy/admin catalog line. `product` is guaranteed by the schema
        // refinement, but keep the guard explicit for type and safety.
        if (!item.product) throw new CheckoutError('A product or seller listing is required.', 'ITEM_UNAVAILABLE');
        const product = await Product.findOne({ _id: item.product, isPublished: true }).session(session!);
        if (product?.isDemo) throw new CheckoutError('Sample products cannot be purchased.', 'ITEM_UNAVAILABLE');
        const variant = product?.variants.find((option) => option.sku === item.variant);
        if (!product || !variant) throw new CheckoutError('An item or option is no longer available. Review your cart before ordering.', 'ITEM_UNAVAILABLE');
        if (variant.stock < item.quantity) throw new CheckoutError(`Stock changed for ${product.name}. Review your cart before ordering.`, 'STOCK_CHANGED');
        const unitPricePaise = paise(variant.price);
        if (item.expectedPrice !== undefined && paise(item.expectedPrice) !== unitPricePaise) {
          throw new CheckoutError('A product price changed. Review the updated cart before ordering.', 'PRICE_CHANGED');
        }
        const totalPricePaise = unitPricePaise * item.quantity;
        validatedItems.push({
          product: product._id,
          category: product.category,
          purchaseTerms: { sellerName: 'NexMart', returnWindowDays: product.returnWindowDays },
          name: product.name,
          image: variant.images?.[0] || product.images?.[0],
          variant: item.variant,
          quantity: item.quantity,
          unitPricePaise,
          totalPricePaise,
          taxRateBps: product.taxRateBps,
          taxPaise: includedProductTax(totalPricePaise, product.taxRateBps),
          hsnCode: product.hsnCode,
          discountPaise: 0,
        });
      }
      const { subtotalPaise, shippingPaise, taxPaise, taxStatus, totalPaise } = sumOrderTotals(validatedItems);
      if (input.expectedTotal !== undefined && paise(input.expectedTotal) !== totalPaise) throw new CheckoutError('The order total changed. Review your cart and confirm the updated amount.', 'PRICE_CHANGED');
      if (input.paymentMethod === 'online' && !razorpayOrderId) {
        try { razorpayOrderId = (await createRazorpayOrder(totalPaise, 'INR', humanOrderId)).id; }
        catch { throw new CheckoutError('Payment service is unavailable. Your order was not placed. Please try again later.', 'PAYMENT_UNAVAILABLE', 503); }
      }
      const [order] = await Order.create([{
        orderId: humanOrderId, checkoutId: input.checkoutId, checkoutFingerprint: fingerprint, customer: userId,
        items: validatedItems.map((item) => ({
          product: item.product,
          listing: item.listing,
          seller: item.seller,
          inventory: item.inventory,
          sellerSku: item.sellerSku,
          name: item.name,
          image: item.image,
          variant: item.variant,
          quantity: item.quantity,
          unitPrice: item.unitPricePaise / 100,
          totalPrice: item.totalPricePaise / 100,
          unitPricePaise: item.unitPricePaise,
          totalPricePaise: item.totalPricePaise,
          taxRateBps: item.taxRateBps, taxPaise: item.taxPaise, hsnCode: item.hsnCode,
          discountPaise: item.discountPaise,
          inventoryState: item.inventoryState || 'reserved',
          purchaseTerms: item.purchaseTerms,
        })), shippingAddress: input.shippingAddress, paymentMethod: input.paymentMethod,
        paymentStatus: 'pending', razorpayOrderId, orderStatus: 'placed',
        statusHistory: [{ status: 'placed', timestamp: new Date(), updatedBy: userId }],
        subtotal: subtotalPaise / 100, shippingFee: shippingPaise / 100, tax: taxPaise / 100, total: totalPaise / 100, discount: 0,
        subtotalPaise, shippingFeePaise: shippingPaise, taxPaise, taxStatus, discountPaise: 0, totalPaise, moneyVersion: 1,
        notes: input.notes,
      }], { session });

      // Reserve each seller's inventory with a conditional atomic update. The
      // order and movement are in the same transaction, so a failed line
      // rolls back every prior reservation.
      for (let index = 0; index < validatedItems.length; index += 1) {
        const item = validatedItems[index];
        if (item.listing && item.seller && item.inventory) {
          const inventory = await SellerInventory.findOneAndUpdate(
            { _id: item.inventory, listing: item.listing, seller: item.seller, available: { $gte: item.quantity } },
            {
              $inc: { available: -item.quantity, reserved: item.quantity },
              $set: { lastAdjustmentReason: 'order_reservation', lastAdjustmentNote: `Reserved for ${humanOrderId}`, lastAdjustedAt: new Date() },
            },
            { new: true, session: session! },
          );
          if (!inventory) throw new CheckoutError('Stock changed. Review your cart before ordering.', 'STOCK_CHANGED');
          await InventoryMovement.create([{
            movementId: `IM-${humanOrderId}-${index}`,
            idempotencyKey: `order-reservation:${humanOrderId}:${index}`,
            seller: item.seller,
            listing: item.listing,
            inventory: inventory._id,
            reason: 'order_reservation',
            availableDelta: -item.quantity,
            returnedDelta: 0,
            damagedDelta: 0,
            availableAfter: inventory.available,
            reservedAfter: inventory.reserved,
            committedAfter: inventory.committed,
            returnedAfter: inventory.returned,
            damagedAfter: inventory.damaged,
            actorId: item.seller,
            actorRole: 'system',
            note: `Checkout ${humanOrderId}`,
            requestId: (req as Request & { requestId?: string }).requestId,
          }], { session: session! });
        } else {
          const update = await Product.updateOne(
            { _id: item.product, variants: { $elemMatch: { sku: item.variant, stock: { $gte: item.quantity } } } },
            { $inc: { 'variants.$.stock': -item.quantity } }, { session: session! },
          );
          if (update.modifiedCount !== 1) throw new CheckoutError('Stock changed. Review your cart before ordering.', 'STOCK_CHANGED');
        }
      }

      // A single customer order can contain several seller groups. Shipping
      // and tax are allocated in minor units so group totals add up exactly.
      const shippingByItem = allocateMinorUnits(shippingPaise, validatedItems.map(item => item.totalPricePaise - item.discountPaise));
      const groupsBySeller = new Map<string, { seller: mongoose.Types.ObjectId; fulfillmentMode: 'seller' | 'nexmart'; items: Array<{ item: ValidatedCheckoutItem; orderItemId: mongoose.Types.ObjectId; shippingPaise: number }>; }>();
      validatedItems.forEach((item, index) => {
        if (!item.seller || !item.listing) return;
        const fulfillmentMode = item.fulfillmentMode || 'seller';
        const key = `${String(item.seller)}:${fulfillmentMode}`;
        const group = groupsBySeller.get(key) || { seller: item.seller, fulfillmentMode, items: [] };
        group.items.push({ item, orderItemId: order.items[index]._id!, shippingPaise: shippingByItem[index] });
        groupsBySeller.set(key, group);
      });
      const groups = Array.from(groupsBySeller.values());
      if (groups.length > 0) {
        const groupShipping = groups.map(group => group.items.reduce((sum, line) => sum + line.shippingPaise, 0));
        const groupTax = groups.map(group => group.items.reduce((sum, line) => sum + line.item.taxPaise, 0));
        const feeRuleCache = new Map<string, FeeRuleSnapshot>();
        const getFeeRule = async (item: ValidatedCheckoutItem, fulfillmentMode: 'seller' | 'nexmart'): Promise<FeeRuleSnapshot> => {
          const key = `${String(item.category || '')}:${fulfillmentMode}`;
          const cached = feeRuleCache.get(key);
          if (cached) return cached;
          const resolved = await resolveMarketplaceFeeRule({ category: item.category, fulfillmentMode, session: session! });
          feeRuleCache.set(key, resolved);
          return resolved;
        };
        const groupDocs = await Promise.all(groups.map(async (group, groupIndex) => {
          const subtotal = group.items.reduce((sum, line) => sum + line.item.totalPricePaise, 0);
          const discount = group.items.reduce((sum, line) => sum + line.item.discountPaise, 0);
          const shipping = groupShipping[groupIndex] || 0;
          const tax = groupTax[groupIndex] || 0;
          const itemShipping = group.items.map(line => line.shippingPaise);
          const itemTax = group.items.map(line => line.item.taxPaise);
          const items = await Promise.all(group.items.map(async (line, itemIndex) => {
            const rule = await getFeeRule(line.item, group.fulfillmentMode);
            const calculation = calculateMarketplaceFees({
              merchandisePaise: line.item.totalPricePaise,
              discountPaise: line.item.discountPaise,
              shippingPaise: itemShipping[itemIndex] || 0,
              taxPaise: itemTax[itemIndex] || 0,
              paymentMethod: input.paymentMethod,
              rule,
            });
            return {
              orderItemId: line.orderItemId,
              listing: line.item.listing,
              sellerSku: line.item.sellerSku,
              product: line.item.product,
              variant: line.item.variant,
              name: line.item.name,
              image: line.item.image,
              quantity: line.item.quantity,
              unitPricePaise: line.item.unitPricePaise,
              merchandisePaise: line.item.totalPricePaise,
              discountPaise: line.item.discountPaise,
              shippingPaise: itemShipping[itemIndex] || 0,
              taxPaise: itemTax[itemIndex] || 0,
              sellerPayableBasisPaise: calculation.adjustedMerchandisePaise,
              feeSnapshot: feeSnapshotFromCalculation(rule, calculation),
            };
          }));
          return {
            groupId: generateFulfillmentGroupId(),
            order: order._id,
            customer: userId,
            seller: group.seller,
            fulfillmentMode: group.fulfillmentMode,
            items,
            shippingAddress: input.shippingAddress,
            status: 'placed',
            statusHistory: [{ status: 'placed', timestamp: new Date(), updatedBy: userId }],
            subtotalPaise: subtotal,
            discountPaise: discount,
            shippingPaise: shipping,
            taxPaise: tax,
            totalPaise: subtotal - discount + shipping,
          };
        }));
        const createdGroups = await FulfillmentGroup.create(groupDocs, { session: session!, ordered: true });
        order.fulfillmentGroups = createdGroups.map((group) => group._id);
        await order.save({ session: session! });
      }
      await Cart.updateOne({ user: userId }, { $set: { items: [] } }, { session });
      result = order;
      created = true;
    });
    if (!result) throw new Error('Checkout transaction returned no order');
    if (created) emitNewOrder(result.orderId, { total: result.total, paymentMethod: result.paymentMethod });
    (created ? sendCreated : sendSuccess)(res, checkoutData(result), created ? 'Order placed' : 'Existing order recovered');
  } catch (error) {
    // A concurrent copy may have won either the checkout-key race or the
    // inventory reservation race. Recover only a matching customer-owned
    // checkout; a reused identity with different contents remains a conflict.
    if (input.checkoutId) {
      const existing = await saved();
      if (existing && existing.checkoutFingerprint === fingerprint) { sendSuccess(res, checkoutData(existing), 'Existing order recovered'); return; }
      if (existing) { sendError(res, 'This checkout was already saved with different details. Open your orders to review it.', 409, 'CHECKOUT_CONFLICT'); return; }
    }
    if (error instanceof CheckoutError) sendError(res, error.message, error.status, error.code);
    else { logger.error('Checkout failed', error); sendError(res, 'We could not confirm whether your order was saved. Check your orders or retry this same checkout.', 503, 'ORDER_UNCERTAIN'); }
  } finally { await session?.endSession(); }
}

export async function getCheckoutOrder(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const checkoutId = z.string().uuid().parse(req.params.checkoutId);
  const order = await Order.findOne({ customer: userId, checkoutId });
  if (!order) { sendNotFound(res, 'No saved order was found for this checkout'); return; }
  sendSuccess(res, checkoutData(order));
}

export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const input = z.object({ razorpayOrderId: z.string().min(1).max(100), razorpayPaymentId: z.string().min(1).max(100), razorpaySignature: z.string().min(1).max(256) }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Order not found'); return; }
  const order = await Order.findOne({ _id: req.params.id, customer: userId, razorpayOrderId: input.razorpayOrderId, paymentMethod: 'online' });
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (!verifyRazorpaySignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature, env.RAZORPAY_KEY_SECRET)) {
    sendError(res, 'We could not verify that payment. Refresh the order to check its current payment status.', 400, 'PAYMENT_VERIFICATION_FAILED'); return;
  }
  let providerPayment: Awaited<ReturnType<typeof fetchPayment>>;
  try {
    providerPayment = await fetchPayment(input.razorpayPaymentId);
  } catch {
    sendError(res, 'We could not confirm the payment with the payment provider. Please check the order again shortly.', 503, 'PAYMENT_UNCERTAIN'); return;
  }
  if (providerPayment.status !== 'captured') {
    sendError(res, 'The payment has not been captured yet. Refresh the order before trying again.', 400, 'PAYMENT_NOT_CAPTURED'); return;
  }
  if (providerPayment.order_id && providerPayment.order_id !== order.razorpayOrderId) {
    sendError(res, 'The payment does not belong to this order.', 400, 'PAYMENT_ORDER_MISMATCH'); return;
  }
  if (providerPayment.amount !== undefined && providerPayment.amount !== order.totalPaise) {
    sendError(res, 'The captured payment amount does not match this order.', 400, 'PAYMENT_AMOUNT_MISMATCH'); return;
  }
  if (providerPayment.currency !== undefined && providerPayment.currency !== 'INR') {
    sendError(res, 'The captured payment currency is not supported for this order.', 400, 'PAYMENT_CURRENCY_MISMATCH'); return;
  }
  const result = await recordCapturedPayment(String(order._id), input.razorpayOrderId, input.razorpayPaymentId);
  sendSuccess(res, result.order && checkoutData(result.order), 'Payment status verified');
}

export async function resumePayment(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { expectedTotal } = z.object({ expectedTotal: z.number().finite().nonnegative() }).parse(req.body);
  if (!mongoose.isValidObjectId(req.params.id)) { sendNotFound(res, 'Order not found'); return; }
  const order = await Order.findOne({ _id: req.params.id, customer: userId });
  if (!order) { sendNotFound(res, 'Order not found'); return; }
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') { sendSuccess(res, checkoutData(order)); return; }
  if (order.paymentMethod !== 'online' || !order.razorpayOrderId || order.orderStatus !== 'placed') { sendError(res, 'This order is not awaiting an online payment. Refresh its details.', 409, 'PAYMENT_NOT_AVAILABLE'); return; }
  if (paise(expectedTotal) !== paise(order.total)) { sendError(res, 'The order total changed. Refresh and review it before paying.', 409, 'PRICE_CHANGED'); return; }
  // A short payment lease also lets the reaper distinguish active attempts.
  const current = await Order.findOneAndUpdate({ _id: order._id, orderStatus: 'placed', paymentStatus: { $in: ['pending', 'failed'] } }, { $set: { paymentAttemptedAt: new Date() }, $inc: { __v: 1 } }, { new: true });
  if (!current) { sendError(res, 'The order changed. Refresh its details before paying.', 409, 'ORDER_CHANGED'); return; }
  try {
    const payments = await fetchOrderPayments(order.razorpayOrderId);
    const captured = payments.find(payment => payment.status === 'captured');
    if (captured) {
      const result = await recordCapturedPayment(String(order._id), order.razorpayOrderId, captured.id);
      sendSuccess(res, result.order && checkoutData(result.order)); return;
    }
    if (payments.some(payment => payment.status === 'authorized')) { sendSuccess(res, { ...checkoutData(current), processing: true }, 'Your payment is still processing'); return; }
    sendSuccess(res, checkoutData(current), 'Continue payment on this saved order');
  } catch { sendError(res, 'We could not check your payment. Please wait, then check this order again.', 503, 'PAYMENT_UNCERTAIN'); }
}
