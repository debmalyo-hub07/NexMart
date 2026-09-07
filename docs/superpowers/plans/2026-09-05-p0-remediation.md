# P0 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the eight P0 items from `D:\NexMart\CLAUDE.md` §8 — the production-breaking payment verification, admin order-status 401, dead Tailwind classes, broken fonts, dead Socket.IO, dead reviews, unreachable Google OAuth, and mis-scoped smooth-scroll/cursor.

**Architecture:** Surgical fixes to the existing Next.js 15 App Router frontend (`frontend/src`) and Express backend (`backend/src`). No re-architecting: the hybrid NextAuth + backend-cookie auth stays as-is (CLAUDE.md §9.9). The socket auth token comes from the NextAuth session (`session.user.accessToken`, already returned by the credentials provider and embedded in the session JWT) instead of the never-persisted Zustand token.

**Tech Stack:** Next.js 15 / React 19 / Tailwind 3.4 / TanStack Query / socket.io-client 4 · Express / Mongoose / zod · vitest (new, frontend-only, for the two pure helpers this plan introduces)

**Spec:** `D:\NexMart\CLAUDE.md` v3.0 — §8 P0 rows, §2 design law, §5.1 socket contract.

## Global Constraints (from CLAUDE.md v3.0 — apply to every task)

- No new hex color values; no new violet scale steps; opacity modifiers only Tailwind step-5 (`/5 /10 …`) or bracket (`/[0.06]`) — never `/3 /4 /6 /7 /8`.
- No mock data. Every fix wires real behavior.
- Every async error path shows a user-visible message (toast/inline) — no `catch {}` swallowing, no `alert()`.
- Server error messages pass through: `error.response?.data?.message` first, generic fallback second.
- Every new/changed `useEffect` with listeners/sockets returns its cleanup.
- TypeScript strict: no new `any` on API shapes.
- Frontend verification: `cd frontend && npm run build` must pass. Backend verification: `cd backend && npm run build` (tsc) must pass.
- Test infra: the repo has **no test runner**. This plan adds vitest to the frontend only, covering the pure helpers it introduces (Tasks 2 and 5). Backend changes verify via `tsc` build + the curl smoke tests in Task 9. Standing up a full backend test suite is a separate workstream — do not start it here.
- Commit after each task, `main` branch (small fixes, user works directly on main).

---

### Task 1: Backend order-route middleware fix (P0-2)

**Files:**
- Modify: `backend/src/routes/order.routes.ts`
- Modify: `frontend/src/app/admin/orders/page.tsx:40` (failure path of the same control)

**Interfaces:**
- Consumes: existing `protectCustomer`, `protectAdmin` middleware (`backend/src/middleware/auth.ts`).
- Produces: `PATCH /api/v1/orders/:id/status` accepts an admin session cookie and returns 200; all other `/orders` routes unchanged (customer-only). Later tasks rely on this for delivery assignability of COD orders.

**Why:** `router.use(protectCustomer)` at `order.routes.ts:9` runs before the per-route `protectAdmin` on line 14, so an admin (who carries `nexmart_admin_session`, not `nexmart_customer_session`) always gets 401 "No token provided" when changing order status. This makes COD orders structurally undeliverable (created `placed`, only promotion tool is this endpoint).

- [ ] **Step 1: Rewrite the route guards**

Replace the entire body of `backend/src/routes/order.routes.ts` (after the imports, which stay identical) with:

```ts
const router = Router();

// Customer routes — each guarded individually (NOT router-wide: PATCH status is admin)
router.post('/', protectCustomer, createOrder);
router.get('/', protectCustomer, getMyOrders);
router.get('/:id', protectCustomer, getOrderById);
router.post('/:id/payment/verify', protectCustomer, paymentLimit, verifyPayment);
router.get('/:id/invoice', protectCustomer, getInvoice);

// Admin route — order status transitions
router.patch('/:id/status', protectAdmin, updateOrderStatus);

export default router;
```

(Remove the old `router.use(protectCustomer)` line and the duplicated `protectAdmin` on the PATCH line. `updateOrderStatus` reads `req.user.userId`, which `protectAdmin` sets — verified in `backend/src/middleware/auth.ts:47`.)

- [ ] **Step 2: Build the backend**

Run: `cd backend && npm run build`
Expected: tsc compiles with no errors.

- [ ] **Step 3: Fix the admin orders failure path (same control)**

In `frontend/src/app/admin/orders/page.tsx`, replace the mutation block (lines 32–41) with:

```tsx
const updateStatus = useMutation({
  mutationFn: ({ id, status }: { id: string; status: string }) =>
    api.patch(`/orders/${id}/status`, { status }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    showToast('Order status updated');
    setUpdatingId(null);
  },
  onError: (err: unknown) => {
    setUpdatingId(null);
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed';
    showToast(msg, 'error');
  },
});
```

(Two fixes: `updatingId` resets on error so the select re-enables (roadmap P2-21); the server message passes through per the CLAUDE.md error contract.)

- [ ] **Step 4: Build the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/order.routes.ts frontend/src/app/admin/orders/page.tsx
git commit -m "fix(order): admin can change order status — per-route auth instead of router-wide protectCustomer

The router-wide protectCustomer rejected admin sessions (401) on
PATCH /orders/:id/status, making COD orders structurally undeliverable.
Also resets updatingId and surfaces the server message on failure.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Checkout payment verification (P0-1)

**Files:**
- Create: `frontend/src/lib/payment.ts`
- Create: `frontend/src/lib/payment.test.ts`
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json` (devDependency + test script)
- Modify: `frontend/src/app/checkout/page.tsx:68-127`

**Interfaces:**
- Consumes: order creation response `{ data: { orderId (Mongo _id), razorpayOrderId, keyId } }` from `POST /orders`; real backend route `POST /orders/:id/payment/verify` (body: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` — verified in `backend/src/controllers/order.controller.ts:162-168`).
- Produces: `paymentVerifyPath(orderId: string): string` — used by checkout; reusable when My Orders gets a pay-pending flow later.

**Why:** `checkout/page.tsx:107` posts `/orders/verify-payment`, which does not exist (real route is `POST /orders/:id/payment/verify` where `:id` is the Mongo order `_id` returned as `data.data.orderId`). A customer who just paid sees "Payment verification failed. Contact support." and their cart never clears. Additionally `setIsPlacing(false)` runs in `finally` *before* the Razorpay modal finishes (double-order risk), `script.onerror` is unhandled (blocked CDN = dead button), and modal dismissal gives no feedback.

- [ ] **Step 1: Install vitest (frontend has no test runner)**

Run: `cd frontend && npm install -D vitest`

Add to `frontend/package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/payment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { paymentVerifyPath } from './payment';

describe('paymentVerifyPath', () => {
  it('builds the real backend route with the Mongo order id', () => {
    expect(paymentVerifyPath('66f1a2b3c4d5e6f7a8b9c0d1')).toBe(
      '/orders/66f1a2b3c4d5e6f7a8b9c0d1/payment/verify'
    );
  });
});
```

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL — `Cannot find module './payment'`.

- [ ] **Step 4: Write the helper**

Create `frontend/src/lib/payment.ts`:

```ts
/**
 * The backend payment-verify route is POST /orders/:id/payment/verify,
 * where :id is the Mongo order _id (returned as data.orderId by POST /orders).
 * Single source of truth — the old inline '/orders/verify-payment' string
 * 404'd after the customer had already paid.
 */
export function paymentVerifyPath(orderId: string): string {
  return `/orders/${orderId}/payment/verify`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Rewrite the submit handler in checkout**

In `frontend/src/app/checkout/page.tsx`:

6a. Add imports (top of file, with the other imports):

```tsx
import { paymentVerifyPath } from '@/lib/payment';
import { getApiError } from '@/lib/api';
```

6b. Replace the whole `onSubmit` function (lines 68–127) with:

```tsx
const onSubmit = async (addressData: AddressForm) => {
  if (items.length === 0) { showToast('Your cart is empty', 'error'); return; }
  setIsPlacing(true);

  try {
    const orderItems = items.map((item) => ({
      product: item.product._id,
      variant: item.variant,
      quantity: item.quantity,
    }));

    const { data } = await api.post('/orders', {
      items: orderItems,
      shippingAddress: { ...addressData, country: 'India' },
      paymentMethod,
    });

    if (paymentMethod === 'cod') {
      clearCart();
      setOrderSuccess(true);
      setIsPlacing(false);
      return;
    }

    // Online payment — keep the Pay button disabled until the modal resolves.
    // (The old `finally { setIsPlacing(false) }` re-enabled it mid-payment.)
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onerror = () => {
      setIsPlacing(false);
      showToast('Could not load the payment window. Check your connection and try again.', 'error');
    };
    document.body.appendChild(script);

    script.onload = () => {
      const rzp = new window.Razorpay({
        key: data.data.keyId,
        currency: 'INR',
        name: 'NexMart',
        description: 'Order Payment',
        order_id: data.data.razorpayOrderId, // amount comes from the server-created Razorpay order
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#7C3AED' },
        handler: async (response: Record<string, string>) => {
          try {
            await api.post(paymentVerifyPath(data.data.orderId), {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            clearCart();
            setOrderSuccess(true);
          } catch (err: unknown) {
            showToast(getApiError(err), 'error');
          } finally {
            setIsPlacing(false);
          }
        },
        ondismiss: () => {
          setIsPlacing(false);
          showToast('Payment window closed. Your order is saved as pending — complete payment from My Orders.', 'warning');
        },
      });
      rzp.open();
    };
  } catch (err: unknown) {
    showToast(getApiError(err), 'error');
    setIsPlacing(false);
  }
};
```

Notes: the removed `finally` block means the online path keeps the button disabled for the modal's whole lifetime. `amount: grandTotal * 100` is dropped — Razorpay derives the amount from `order_id`, which the backend created from the server-authoritative total.

6c. Fix the false email claim in the success screen (line 136):

Replace:
```tsx
<p className="text-white/60 mb-8">Your order has been confirmed. You'll receive a confirmation email shortly.</p>
```
with:
```tsx
<p className="text-white/60 mb-8">Your order has been confirmed. You can track it any time from My Orders.</p>
```

- [ ] **Step 7: Build + test**

Run: `cd frontend && npm test && npm run build`
Expected: test PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/payment.ts frontend/src/lib/payment.test.ts \
  frontend/vitest.config.ts frontend/package.json frontend/package-lock.json \
  frontend/src/app/checkout/page.tsx
git commit -m "fix(checkout): verify payment against the real route; honest modal lifecycle

The old /orders/verify-payment call 404'd after the customer had paid,
never cleared the cart, and re-enabled the Pay button mid-modal
(double-order risk). Now: real route via paymentVerifyPath(), button
stays disabled through the modal, script.onerror and ondismiss give
feedback, server messages pass through. Also drops the false
'confirmation email' claim (email wiring is roadmap P1-12).

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Kill the 19 dead Tailwind opacity classes (P0-3)

**Files (modify, exact lines from the audit, verified 2026-09-05):**
- `frontend/src/components/admin/AdminSidebar.tsx` (96, 109, 127)
- `frontend/src/components/admin/ProductForm.tsx` (160, 191)
- `frontend/src/components/admin/RevenueChart.tsx` (17)
- `frontend/src/components/product/ProductCard.tsx` (100)
- `frontend/src/components/common/ConfirmDialog.tsx` (39)
- `frontend/src/components/navbar/CartDrawer.tsx` (122)
- `frontend/src/components/layout/Navbar.tsx` (153, 161, 179, 269, 375)
- `frontend/src/components/navbar/MegaMenu.tsx` (79)
- `frontend/src/components/navbar/SearchBar.tsx` (130, 131, 173, 225)

**Interfaces:** none — pure class-string replacements.

**Why:** Tailwind 3.4's opacity scale steps by 5; `/3 /4 /6 /7 /8` compile to **nothing**. The active nav pill, focused search fill, search-result hover, admin sidebar hovers, and several borders currently have no visual state at all.

- [ ] **Step 1: Replace every occurrence**

Replacements (old → new), applied via find/replace per file:

```
bg-white/3   → bg-white/[0.03]
bg-white/4   → bg-white/[0.04]
bg-white/6   → bg-white/[0.06]
bg-white/7   → bg-white/[0.07]
bg-white/8   → bg-white/[0.08]
border-white/8 → border-white/[0.08]
```

- [ ] **Step 2: Verify zero remain**

Run: `cd frontend && grep -rEn "white/(3|4|6|7|8)\b" src/ || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components
git commit -m "fix(ui): replace 19 dead Tailwind opacity classes with bracket values

Tailwind 3.4 steps opacity by 5, so /3 /4 /6 /7 /8 compiled to nothing —
the active nav pill, focused search fill, result hover, admin sidebar
hovers, and several borders had no visual state. CLAUDE.md v3 §2.1 bans
these values going forward.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Fonts via next/font, kill the render-blocking @import (P0-4)

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/tailwind.config.ts:47-51`
- Modify: `frontend/src/app/globals.css:1` (delete)

**Interfaces:** produces CSS variables `--font-inter`, `--font-outfit`, `--font-mono` on `<body>`; Tailwind classes `font-syne` (legacy alias), `font-dm` (legacy alias), `font-outfit`, `font-inter`, `font-mono` all resolve to self-hosted fonts.

**Why:** Inter is loaded twice (render-blocking Google `@import` in globals.css + a `next/font` whose `--font-inter` variable nothing consumes); Outfit/JetBrains Mono load only through the blocking `@import`; the config keys lie (`syne` → Outfit, `dm` → Inter); and `font-outfit`/`font-inter` (17 uses) are defined nowhere, silently falling back to body font.

- [ ] **Step 1: Load all three families via next/font**

In `frontend/src/app/layout.tsx`, replace the font setup (lines 2, 6–9) and `<body>`:

```tsx
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
```

Body tag:

```tsx
<body className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-dm bg-space-900 text-white antialiased`} suppressHydrationWarning>
```

Also delete the two `fonts.googleapis.com` / `fonts.gstatic.com` `<link rel="preconnect">` lines from `<head>` (lines 36–37) — next/font self-hosts, so they now point at nothing.

- [ ] **Step 2: Point Tailwind at the variables (and make the phantom classes real)**

In `frontend/tailwind.config.ts`, replace the `fontFamily` block (lines 47–51) with:

```ts
fontFamily: {
  // Legacy aliases kept so existing markup keeps working — CLAUDE.md v3 §2.2 renames them over time.
  syne: ['var(--font-outfit)', 'sans-serif'],
  dm: ['var(--font-inter)', 'sans-serif'],
  outfit: ['var(--font-outfit)', 'sans-serif'],
  inter: ['var(--font-inter)', 'sans-serif'],
  mono: ['var(--font-mono)', 'monospace'],
},
```

- [ ] **Step 3: Delete the render-blocking @import**

Delete line 1 of `frontend/src/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:...&family=Inter:...&family=JetBrains+Mono:...&display=swap');
```

- [ ] **Step 4: Verify + build**

Run: `cd frontend && grep -rn "fonts.googleapis" src/ || echo CLEAN && npm run build`
Expected: `CLEAN` and the build succeeds. (The 17 `font-outfit`/`font-inter` uses across AuthForm, verify-otp, CustomCursor, ClockCalendar now compile for real.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/tailwind.config.ts frontend/src/app/globals.css
git commit -m "fix(fonts): next/font for all three families; kill render-blocking Google @import

Inter was double-loaded (blocking @import + unused next/font variable),
Outfit/JetBrains Mono loaded only via the blocking chain, and the
font-outfit/font-inter classes (17 uses) compiled to nothing. All
families now self-hosted with display:swap; phantom classes defined in
the Tailwind config.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Socket.IO — event name, authenticated handshake, rebuild, cleanup (P0-5)

**Files:**
- Create: `frontend/src/lib/socketEvents.ts`
- Create: `frontend/src/lib/socketEvents.test.ts`
- Modify: `frontend/src/hooks/useSocket.ts`
- Modify: `frontend/src/app/orders/page.tsx:33-38`
- Modify: `frontend/src/app/orders/[id]/page.tsx:29-35`

**Interfaces:**
- Consumes: NextAuth session (`useSession()` → `session.user.accessToken` — the backend JWT returned by the credentials provider, embedded in the session JWT by `src/auth.ts:48,87`); backend socket middleware (`backend/src/config/socket.ts:21-46`) which verifies `handshake.auth.token` and joins `user:{id}` + `role:{role}` rooms.
- Produces: `SOCKET_EVENTS` constants object; `useSocket()` whose `on()` returns an unsubscribe that callers **must** return from `useEffect`.

**Why:** Three compounding failures: the frontend listens to `order:status_update` but the backend emits `order:status_updated` (typo); the handshake token comes from a Zustand field that is never persisted, so after any reload the socket connects as a guest and joins no rooms; and `useSocket().on()` returns an unsubscribe that no caller returns, so `/orders/[id]` registers a fresh duplicate listener on every refetch (it lists `data` in its deps).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/socketEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SOCKET_EVENTS } from './socketEvents';

describe('SOCKET_EVENTS (contract with backend/src/config/socket.ts)', () => {
  it('order status event uses the backend spelling — order:status_updated', () => {
    expect(SOCKET_EVENTS.orderStatusUpdated).toBe('order:status_updated');
  });
});
```

Run: `cd frontend && npm test`
Expected: FAIL — cannot find `./socketEvents`.

- [ ] **Step 2: Create the constants module**

Create `frontend/src/lib/socketEvents.ts`:

```ts
/**
 * Canonical Socket.IO event names — must match the emitters in
 * backend/src/config/socket.ts exactly. The old inline string
 * 'order:status_update' (missing 'd') never fired.
 */
export const SOCKET_EVENTS = {
  orderStatusUpdated: 'order:status_updated',
  orderNew: 'order:new',
  stockUpdated: 'product:stock_updated',
  dashboardStats: 'dashboard:stats_updated',
  agentStatusUpdated: 'agent:status_updated',
} as const;
```

Run: `cd frontend && npm test` → PASS.

- [ ] **Step 3: Rewrite useSocket**

Replace the entire content of `frontend/src/hooks/useSocket.ts`:

```ts
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// Module-level singleton, but rebuilt whenever the auth token changes.
// (The old `if (!socket)` guard meant a guest socket created on first load
// lived forever — even after login.)
let socket: Socket | null = null;
let connectedToken: string | null = null;

export function useSocket() {
  const { data: session } = useSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken ?? null;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

    // Only connect with a real token: every event this app listens for is
    // user/role-scoped, and a guest socket joins no rooms so it can never
    // receive them. (Backend rejects presented-but-invalid tokens, and
    // allows guests only for public events, which we don't use.)
    if (!token) return;

    if (!socket || connectedToken !== token) {
      socket?.disconnect();
      socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });
      connectedToken = token;
    }

    socketRef.current = socket;
    return () => {
      // Keep the connection alive across mounts; per-listener cleanup is
      // the consumer's job (the `on()` unsubscribe).
      socketRef.current = null;
    };
  }, [token]);

  const on = useCallback(<T,>(event: string, callback: (data: T) => void) => {
    const target = socketRef.current ?? socket;
    target?.on(event, callback);
    return () => { target?.off(event, callback); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    (socketRef.current ?? socket)?.emit(event, data);
  }, []);

  return { on, emit, socket: socketRef.current };
}
```

- [ ] **Step 4: Fix both order pages (event name + cleanup + stale deps)**

In `frontend/src/app/orders/page.tsx`, replace lines 33–38:

```tsx
// Real-time order status updates (backend emits order:status_updated)
useEffect(() => {
  const unsubscribe = on<{ orderId: string; status: string }>(SOCKET_EVENTS.orderStatusUpdated, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  });
  return unsubscribe;
}, [on, queryClient]);
```

Add to the imports: `import { SOCKET_EVENTS } from '@/lib/socketEvents';`
Delete the now-false comment "socket.io listener cleanup is handled by the hook".

In `frontend/src/app/orders/[id]/page.tsx`, replace lines 29–35 (which put `data` in the deps — a fresh duplicate listener on every refetch):

```tsx
// Human order id (NXM-...) from the query cache, kept in a ref so the
// listener registration doesn't depend on the query data.
const orderIdRef = useRef<string | null>(null);
useEffect(() => {
  orderIdRef.current = data?.data?.orderId ?? null;
}, [data]);

useEffect(() => {
  const unsubscribe = on<{ orderId: string; status: string }>(SOCKET_EVENTS.orderStatusUpdated, (payload) => {
    if (orderIdRef.current && payload.orderId === orderIdRef.current) {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    }
  });
  return unsubscribe;
}, [on, id, queryClient]);
```

Add imports: `import { SOCKET_EVENTS } from '@/lib/socketEvents';` and add `useRef` to the existing `react` import.

- [ ] **Step 5: Test + build**

Run: `cd frontend && npm test && npm run build`
Expected: tests PASS (socketEvents + payment), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/socketEvents.ts frontend/src/lib/socketEvents.test.ts \
  frontend/src/hooks/useSocket.ts frontend/src/app/orders/page.tsx "frontend/src/app/orders/[id]/page.tsx"
git commit -m "fix(socket): authenticated handshake, canonical event names, real cleanup

Three compounding failures fixed: event-name typo (order:status_update
vs the backend's order:status_updated), guest-only handshake (token
came from a never-persisted Zustand field — now from the NextAuth
session, with the singleton rebuilt on token change), and listener
leaks (on() unsubscribes now returned from useEffect; the [id] page no
longer re-registers on every refetch).

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Reviews backend routes (P0-6)

**Files:**
- Modify: `backend/src/routes/product.routes.ts`
- Modify: `backend/src/controllers/product.controller.ts` (append two exports)

**Interfaces:**
- Consumes: existing embedded `reviews` array + `ratings` aggregate on the Product model (`backend/src/models/Product.ts:13-20,36-40`); `protectCustomer` middleware.
- Produces: `GET /api/v1/products/:id/reviews` → `{ data: Review[] }` (populated `user.name/profilePicture`, newest first); `POST /api/v1/products/:id/reviews` with body `{ rating: 1-5, title?, body? }` (customer auth) → 201 with the created review. The existing frontend `ReviewSection.tsx` already calls exactly these shapes — no frontend change needed beyond the error-message pass-through in Step 4.

**Why:** The UI calls these routes and they 404 — the reviews feature renders "No reviews yet" forever and every submission toasts "Failed to submit review". The model already embeds the ReviewSchema and the ratings aggregate, so this is purely controller + routes.

- [ ] **Step 1: Add the routes**

In `backend/src/routes/product.routes.ts`, add to the imports:

```ts
import { getProductReviews, addProductReview } from '../controllers/product.controller';
import { protectCustomer } from '../middleware/auth';
```

And add before the admin-only block (after `router.get('/:slug', getProductBySlug);`):

```ts
// Reviews (subdocument routes — no conflict with /:slug, different segment count)
router.get('/:id/reviews', getProductReviews);
router.post('/:id/reviews', protectCustomer, addProductReview);
```

- [ ] **Step 2: Add the controller functions**

Append to `backend/src/controllers/product.controller.ts` (add any missing imports at the top — `Order` from `../models/Order`, `mongoose` — `z`, `Request`/`Response`, `sendSuccess`/`sendCreated`/`sendNotFound`/`sendBadRequest`, and `AuthenticatedRequest` from types are either already imported or add them):

```ts
// ── Product Reviews ───────────────────────────────────────────
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().max(2000).optional(),
});

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const product = await Product.findById(req.params.id)
    .select('reviews')
    .populate('reviews.user', 'name profilePicture');

  if (!product) { sendNotFound(res, 'Product not found'); return; }

  // Newest first, plain array (frontend expects data.data to be a list)
  const reviews = [...product.reviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  sendSuccess(res, reviews);
}

export async function addProductReview(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const { rating, title, body } = reviewSchema.parse(req.body);

  const product = await Product.findById(req.params.id);
  if (!product) { sendNotFound(res, 'Product not found'); return; }

  const alreadyReviewed = product.reviews.some((r) => r.user.toString() === userId);
  if (alreadyReviewed) { sendBadRequest(res, 'You have already reviewed this product'); return; }

  // Verified-purchase badge: this customer has a delivered order containing this product
  const isVerifiedPurchase = !!(await Order.exists({
    customer: userId,
    'items.product': product._id,
    orderStatus: 'delivered',
  }));

  product.reviews.push({
    user: new mongoose.Types.ObjectId(userId),
    rating,
    title,
    body,
    isVerifiedPurchase,
  } as never);
  product.ratings.count = product.reviews.length;
  product.ratings.average =
    product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.ratings.count;

  await product.save();

  const created = product.reviews[product.reviews.length - 1];
  sendCreated(res, created, 'Review submitted');
}
```

- [ ] **Step 3: Build the backend**

Run: `cd backend && npm run build`
Expected: tsc compiles clean. If `express-async-errors` is not imported in the app entry, verify zod parse errors still reach the error handler — the existing controllers rely on the same pattern (`order.controller.ts` parses zod inline with no try/catch), so the app already handles thrown errors globally.

- [ ] **Step 4: Pass server messages through in the frontend review form**

In `frontend/src/components/product/ReviewSection.tsx`, replace the mutation's `onError` (line 71):

```tsx
onError: (err: unknown) => {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit review';
  showToast(msg, 'error');
},
```

- [ ] **Step 5: Build the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/product.routes.ts backend/src/controllers/product.controller.ts \
  frontend/src/components/product/ReviewSection.tsx
git commit -m "feat(reviews): backend routes for product reviews — the UI was calling a 404

GET/POST /products/:id/reviews against the model's embedded ReviewSchema.
One review per customer, verified-purchase badge from delivered orders,
ratings aggregate recomputed on write. Frontend now surfaces the server
message on failure.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Render the Google OAuth button (P0-7)

**Files:**
- Modify: `frontend/src/components/auth/AuthForm.tsx`
- Modify: `frontend/src/app/customer/login/page.tsx`
- Modify: `frontend/src/app/customer/register/page.tsx`

**Interfaces:**
- Consumes: the fully-configured Google provider (`src/auth.ts:8-11` — clientId/secret, `signIn` callback syncing with the backend); `signIn` from `next-auth/react`.
- Produces: optional `showGoogle?: boolean` prop on `AuthForm`.

**Why:** Google OAuth is configured end-to-end (provider, backend `/auth/google/callback` sync, session callbacks) but zero `signIn('google')` calls exist in the UI — an unreachable feature.

- [ ] **Step 1: Add the prop and the button**

In `frontend/src/components/auth/AuthForm.tsx`:

1a. Extend the props interface (line 19–29) with `showGoogle?: boolean;` and add it to the destructured props on line 31.

1b. Add the import: `import { signIn } from 'next-auth/react';`

1c. Render the button below the submit `</form>` (before the `{note && ...}` block, around line 190):

```tsx
{showGoogle && (
  <>
    <div className="flex items-center gap-3 mt-5">
      <div className="flex-1 h-px bg-white/[0.08]" />
      <span className="text-xs text-white/40 font-inter">or</span>
      <div className="flex-1 h-px bg-white/[0.08]" />
    </div>
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: redirectUrl })}
      className="w-full mt-4 flex items-center justify-center gap-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl py-3.5 text-sm font-medium text-white transition-colors font-inter"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.6-1.2 2.9-2.5 3.8v3.1h4c2.4-2.2 3.5-5.4 3.5-9.1z"/>
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-4-3.1c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.3v3.2C3.3 21.3 7.3 24 12 24z"/>
        <path fill="#FBBC05" d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.5H1.3C.5 8.1 0 10 0 12s.5 3.9 1.3 5.5l4.1-3.2z"/>
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.5l4.1 3.2c.9-2.8 3.5-4.9 6.6-4.9z"/>
      </svg>
      Continue with Google
    </button>
  </>
)}
```

- [ ] **Step 2: Enable it on the customer auth pages (only — admin/agent portals have no Google flow)**

In `frontend/src/app/customer/login/page.tsx` and `frontend/src/app/customer/register/page.tsx`, add `showGoogle` to the `<AuthForm>` config:

```tsx
<AuthForm
  ...
  showGoogle
  ...
/>
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/AuthForm.tsx \
  frontend/src/app/customer/login/page.tsx frontend/src/app/customer/register/page.tsx
git commit -m "feat(auth): render the Continue with Google button on customer auth

The Google provider, backend sync callback, and session wiring were all
configured — but no signIn('google') call existed anywhere in the UI.
Shown only on customer login/register per the portal matrix.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Scope Lenis + CustomCursor to the storefront (P0-8)

**Files:**
- Modify: `frontend/src/components/layout/StorefrontLayout.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/components/common/SmoothScrollProvider.tsx`
- Modify: `frontend/src/app/globals.css:33-34`

**Interfaces:** none — mount-location changes.

**Why:** Both mount in the root layout, so scroll-hijacking (Lenis runs a permanent rAF loop for the whole session, `lagSmoothing(0)` globally) and the custom cursor run over admin data tables, checkout forms, and auth pages. Lenis also has no `prefers-reduced-motion` bail-out (a WCAG 2.3.3 vestibular concern) and fights `html { scroll-behavior: smooth }` on anchor links. CustomCursor already gates itself to fine pointers, but it also shouldn't exist on admin/delivery at all.

- [ ] **Step 1: Move both components into StorefrontLayout**

Replace `frontend/src/components/layout/StorefrontLayout.tsx` entirely:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SmoothScrollProvider } from '@/components/common/SmoothScrollProvider';
import { CustomCursor } from '@/components/common/CustomCursor';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define paths where Navbar/Footer/cursor/smooth-scroll should NOT appear
  const isAuth = pathname?.includes('/login') || pathname?.includes('/register') || pathname?.includes('/verify-otp');
  const isAdmin = pathname?.startsWith('/admin');
  const isDelivery = pathname?.startsWith('/delivery');

  const showNavAndFooter = !isAuth && !isAdmin && !isDelivery;

  return (
    <>
      {showNavAndFooter && <Navbar />}
      {showNavAndFooter && <CustomCursor />}
      {showNavAndFooter
        ? <SmoothScrollProvider>{children}</SmoothScrollProvider>
        : children}
      {showNavAndFooter && <Footer />}
    </>
  );
}
```

- [ ] **Step 2: Remove CustomCursor from the root layout**

In `frontend/src/app/layout.tsx`: delete the `CustomCursor` import (line 29) and its usage (line 41). The body renders `<Providers><StorefrontLayout>{children}</StorefrontLayout></Providers>`.

- [ ] **Step 3: Reduced-motion bail-out in Lenis**

In `frontend/src/components/common/SmoothScrollProvider.tsx`, insert the guard as the first lines of the `useEffect` (after `gsap.registerPlugin(ScrollTrigger);`):

```ts
// Vestibular safety (WCAG 2.3.3): no scroll hijacking for users who
// prefer reduced motion — native scroll, no Lenis instance at all.
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

(Lenis's default `syncTouch: false` means native touch momentum is untouched on mobile — the `touchMultiplier: 2` value only affects wheel; leave it.)

- [ ] **Step 4: Remove the conflicting CSS smooth-scroll**

In `frontend/src/app/globals.css`, delete `scroll-behavior: smooth;` from the `html` rule (line 34) — Lenis manages scrolling on the storefront, and the two fight on anchor navigation.

- [ ] **Step 5: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/StorefrontLayout.tsx frontend/src/app/layout.tsx \
  frontend/src/components/common/SmoothScrollProvider.tsx frontend/src/app/globals.css
git commit -m "fix(perf): scope Lenis + custom cursor to the storefront; reduced-motion bail-out

Both mounted in the root layout, so scroll-hijacking and the cursor ran
over admin tables, checkout, and auth. Lenis now storefront-only with a
prefers-reduced-motion guard, and the conflicting CSS scroll-behavior is
gone. CLAUDE.md v3 §2.5 motion jurisdiction.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Final verification, smoke tests, CLAUDE.md roadmap update

**Files:**
- Modify: `D:\NexMart\CLAUDE.md` §8 (strike the P0 rows)
- No code changes

- [ ] **Step 1: Full builds**

Run: `cd frontend && npm test && npm run build` then `cd ../backend && npm run build`
Expected: all pass.

- [ ] **Step 2: Grep gates (the CLAUDE.md bans, now enforced post-hoc)**

Run from `frontend/`:

```bash
grep -rEn "white/(3|4|6|7|8)\b" src/ || echo CLEAN-opacity
grep -rn "fonts.googleapis" src/ || echo CLEAN-fonts
grep -rn "alert(" src/app src/components || echo CLEAN-alerts
```

Expected: all three print CLEAN. (The `alert(` gate catches the remaining invoice `alert()`s — roadmap P4; if it hits, that's expected to remain for a later task, not a failure of this plan. Record what's left.)

- [ ] **Step 3: Backend smoke test (requires running MongoDB + Redis + the seeded admin)**

Start the backend (`cd backend && npm run dev`) and run these from a second terminal, substituting a real customer login email/password:

```bash
# 1. Admin can now change order status (was always 401):
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/admin/login \
  -H 'Content-Type: application/json' -c cookies.txt \
  -d '{"email":"<ADMIN_SEED_EMAIL>","password":"<ADMIN_SEED_PASSWORD>"}' | head -c 200)
curl -s -X PATCH http://localhost:4000/api/v1/orders/<ORDER_ID>/status \
  -H 'Content-Type: application/json' -b cookies.txt -d '{"status":"confirmed"}'
# Expected: 200 {"success":true,...,"message":"Order status updated"}

# 2. Reviews routes exist (was 404):
curl -s http://localhost:4000/api/v1/products/<PRODUCT_ID>/reviews
# Expected: 200 {"success":true,"data":[...]} (empty array on a fresh product)
```

- [ ] **Step 4: Manual browser checks (dev servers running)**

- `/checkout` with online payment + Razorpay test card: success screen shows, cart clears. Close the modal mid-payment: warning toast, order stays pending.
- Admin → Orders: change a status; it updates (no 401); after forcing an error the select re-enables.
- `/orders` (customer): with another session changing the order status, the list updates without refresh (socket).
- Auth pages: headings render in Outfit (display font), "Continue with Google" visible on customer pages only.
- Admin pages: no custom cursor, native scroll; navbar on storefront: active pill and search focus visibly styled.

- [ ] **Step 5: Update the CLAUDE.md roadmap (agent rule §9.8)**

In `D:\NexMart\CLAUDE.md` §8, mark each P0 row as done, e.g. change the row's first cell `| 1 |` to `| 1 ✅ 2026-09-05 |` for all eight rows, and update §1.5's known-broken summary to reflect what's fixed.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: strike P0 roadmap rows — payment verify, admin 401, dead classes, fonts, sockets, reviews, Google button, motion scoping

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review (performed 2026-09-05)

**Spec coverage:** CLAUDE.md §8 P0 rows 1–8 → Tasks 2, 1, 3, 4, 5, 6, 7, 8 respectively. Task 1 additionally fixes P2-21 (the stuck select) because it is the failure path of the same control; Task 2 removes the false email claim (half of P1-12's symptom). All other P1/P2/P3/P4 rows are deliberately out of scope.

**Placeholder scan:** no TBDs; every code step shows the code. Backend smoke tests use `<ORDER_ID>`/`<PRODUCT_ID>` placeholders — these are runtime values from the operator's DB, not unspecified plan content.

**Type consistency:** `paymentVerifyPath(orderId: string): string` (Task 2) matches its test and call site. `SOCKET_EVENTS.orderStatusUpdated` (Task 5) matches both order pages. `showGoogle?: boolean` (Task 7) matches both customer page configs. `getProductReviews`/`addProductReview` (Task 6) match the route file imports.

**Known limitation recorded honestly:** backend changes verify via `tsc` + curl smoke tests only (no backend test runner exists; adding one is out of scope). The deviator is stated in Global Constraints, not hidden.
