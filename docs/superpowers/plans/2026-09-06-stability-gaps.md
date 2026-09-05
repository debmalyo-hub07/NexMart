# Risk-Register Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six remaining stability gaps from the 2026-09-05 risk register — transition guards, non-blocking emails, webhook-secret boot check, the stale-order reaper with payment reconciliation, admin refunds, and real-time role notifications.

**Architecture:** All backend work follows existing patterns: inline route handlers in `admin.routes.ts`, the in-process worker pattern from `invoiceQueue.ts` for the reaper, and socket emitters in `config/socket.ts`. Frontend work is two listeners and one refund action. No new dependencies.

**Tech Stack:** Express / Mongoose / Razorpay SDK / Socket.IO · Next.js 15 / TanStack Query.

**Spec:** `D:\NexMart\CLAUDE.md` v3.0 §5.1 (socket contract), §13 (no error leaks) + the risk register in the session analysis (2026-09-05).

## Global Constraints

- Server-authoritative everything; no internal leaks in responses (log detail server-side).
- Forward-only order transitions (an order never moves backwards).
- Idempotent money paths (reaper and refund both re-check state before acting).
- Emails never block a request (fire-and-forget with `.catch`).
- Verify: `cd backend && npm run build`; `cd frontend && npm test && npm run build`.
- Commit per task on `main`; push at the end.

---

### Task 1: Order status transition guard

**Files:** Modify `backend/src/controllers/order.controller.ts` (`updateOrderStatus`).

**Design:** Validate the requested transition against an allowed-state graph before writing. Same-status is an idempotent no-op success. Invalid → 400 with the allowed set named.

```ts
const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'returned'],
  out_for_delivery: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};
```

In `updateOrderStatus`, after zod-parse: fetch the order first (`findById`), validate `status === order.orderStatus` (no-op → still push history? No — return early with success), else check `ALLOWED_ORDER_TRANSITIONS[order.orderStatus]?.includes(status)` → 400 `` `Cannot change status from ${from} to ${to}. Allowed: ...` `` when invalid. Then apply the existing update (convert from `findByIdAndUpdate` to the fetched doc + save so the guard and write are on the same read).

### Task 2: Fire-and-forget emails

**Files:** Modify `backend/src/controllers/order.controller.ts` (2 sites), `backend/src/controllers/delivery.controller.ts` (1 site).

Change each `await sendOrderStatusEmail(...)` inside its try/catch to:

```ts
void sendOrderStatusEmail(customer.email, customer.name, order.orderId, status)
  .catch((err) => console.error('Order status email failed:', err));
```

(dropping the surrounding try/catch where it existed only for the email). Request latency no longer includes SMTP round-trips.

### Task 3: Webhook-secret boot check

**Files:** Modify `backend/src/server.ts` (boot sequence).

After `seedAdmin()` (or before listen), add:

```ts
// Fail loudly in production without webhook verification — the webhook is the
// source of truth for payments made by customers who close the tab.
if (env.NODE_ENV === 'production' && !env.RAZORPAY_WEBHOOK_SECRET) {
  logger.error('FATAL: RAZORPAY_WEBHOOK_SECRET is not set — payment webhooks cannot be verified. Aborting.');
  process.exit(1);
}
if (env.NODE_ENV !== 'production' && !env.RAZORPAY_WEBHOOK_SECRET) {
  logger.warn('⚠️  RAZORPAY_WEBHOOK_SECRET not set — webhook endpoint will 503 until configured.');
}
```

### Task 4: Stale-order reaper + payment reconciliation

**Files:** Create `backend/src/services/orderReaper.ts`; modify `backend/src/services/razorpay.service.ts` (add `fetchOrderPayments`); modify `backend/src/server.ts` (start it).

**Design:** Every 15 minutes (in-process, `setInterval` + initial 60s delay, matching the invoice-worker pattern):
1. Find orders: `paymentMethod: 'online'`, `paymentStatus: 'pending'`, `orderStatus: 'placed'`, `razorpayOrderId` exists, `createdAt < now - 30min`.
2. For each — **reconcile first**: `razorpay.orders.fetchPayments(rzpOrderId)`; if any payment is `captured`, confirm the order (paid + confirmed + history + emit + invoice queue) — same shape as the webhook's confirm branch.
3. Else cancel: `orderStatus: 'cancelled'`, history entry `Auto-cancelled: payment not completed within 30 minutes`, restock each item (`Product.updateOne({ _id, 'variants.sku': variant }, { $inc: { 'variants.$.stock': quantity } })` — per-item try/catch so a deleted product doesn't abort the sweep), emit `order:status_updated` cancelled, fire-and-forget cancel email.
4. Log a one-line summary per run (checked N, confirmed X, cancelled Y).

`razorpay.service.ts` addition:

```ts
export async function fetchOrderPayments(
  razorpayOrderId: string
): Promise<Array<{ id: string; status: string; order_id: string }>> {
  const payments = await razorpay.orders.fetchPayments(razorpayOrderId);
  return payments as unknown as Array<{ id: string; status: string; order_id: string }>;
}
```

Reaper skeleton (full logic in implementation): `export function startOrderReaper(): void` with `INTERVAL_MS = 15 * 60 * 1000`, `STALE_AFTER_MS = 30 * 60 * 1000`, guard `isRunning` flag (skip if previous run still going), everything in try/catch — the reaper must never crash the process.

### Task 5: Admin refunds

**Files:** Modify `backend/src/services/razorpay.service.ts` (add `refundPayment`), `backend/src/controllers/admin.controller.ts` (add `refundOrder`), `backend/src/routes/admin.routes.ts` (route), `frontend/src/app/admin/orders/page.tsx` (refund button in the row-detail panel).

Backend:
```ts
export async function refundPayment(paymentId: string): Promise<{ id: string; status: string }> {
  const refund = await razorpay.payments.refund(paymentId);
  return { id: refund.id as string, status: refund.status as string };
}
```

`refundOrder` handler: find order (404 if missing) → require `paymentMethod === 'online'` && `paymentStatus === 'paid'` && `razorpayPaymentId` (400 with clear reasons otherwise) → idempotency: already `refunded` → 400 "Already refunded" → call `refundPayment` → on success: `paymentStatus: 'refunded'`, history entry `Payment refunded (refund ${id})` by admin id, save, emit status update, fire-and-forget email, return the order. Razorpay errors: log detail, 503 "Refund service unavailable" (no SDK leaks).

Route (admin.routes.ts, inside the protectAdmin block): `router.post('/orders/:id/refund', refundOrder);`

Frontend (`admin/orders/page.tsx`): in the `expandableRender` detail panel, when `row.paymentMethod === 'online' && row.paymentStatus === 'paid'`, render a "Refund payment" button (red-tinted, `RotateCcw` icon) → `ConfirmDialog` ("Refund the full amount for this order? This cannot be undone.") → `POST /admin/orders/:id/refund` mutation → invalidate `['admin','orders']` + toast with the server message. Read the page first and place it in the existing detail-panel markup.

### Task 6: Real-time role notifications

**Files:** Modify `backend/src/config/socket.ts` (add `emitDeliveryAssigned`), `backend/src/controllers/admin.controller.ts` (call it in `assignDeliveryAgent`), `frontend/src/lib/socketEvents.ts` (add `deliveryAssigned`), `frontend/src/app/admin/layout.tsx` (order:new listener), `frontend/src/app/delivery/dashboard/page.tsx` (delivery:assigned listener).

Backend emitter:

```ts
export function emitDeliveryAssigned(agentId: string, orderId: string, data: object = {}): void {
  try {
    getIO().to(`user:${agentId}`).emit('delivery:assigned', { orderId, ...data });
  } catch (err) {
    logger.error('Socket emitDeliveryAssigned failed:', err);
  }
}
```

Call after the assignment email in `assignDeliveryAgent`: `emitDeliveryAssigned(agent._id.toString(), order.orderId, { customerName: order.shippingAddress?.fullName });`

Frontend:
- `SOCKET_EVENTS` gains `deliveryAssigned: 'delivery:assigned'`.
- Admin layout (client component): `const { on } = useSocket();` + effect → `on(SOCKET_EVENTS.orderNew, () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); showToast('New order received', 'success'); })` returning the unsubscribe. (Needs useQueryClient + useUIStore — re-add imports removed in the P2 polling cleanup.)
- Delivery dashboard: `on(SOCKET_EVENTS.deliveryAssigned, () => { queryClient.invalidateQueries({ queryKey: ['delivery', 'my-deliveries'] }); showToast('New order assigned to you', 'success'); })` — returning the unsubscribe, deps `[on, queryClient]`.

---

## Self-Review

**Coverage:** all six register rows (P1 reaper, P1 refunds, P2 admin notify, P2 transition guard, P2 blocking emails, P3 webhook boot check). The P3 "reconciliation sweep" row is folded into Task 4 (reaper reconciles before cancelling) — noted.
**Placeholders:** Task 4's reaper marks its skeleton as "full logic in implementation" — the design above specifies every branch; acceptable since the executor is the plan author executing inline.
**Type consistency:** `fetchOrderPayments`/`refundPayment` signatures match Task 4/5 usage; `emitDeliveryAssigned(agentId, orderId, data)` matches the call site; `SOCKET_EVENTS.deliveryAssigned` matches both the emitter string and the dashboard listener.
