# P1 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the ten P1 items from `D:\NexMart\CLAUDE.md` §8 (rows 9–18) — silent 401 failures, unbound carts, missing registration fields, unsent order emails, dead price sort, swallowed cart errors, false-attempt lockouts, dead agent emits, status regression, and hardcoded homepage data.

**Architecture:** Surgical fixes across the Next.js frontend (`frontend/src`) and Express backend (`backend/src`). The 401 contract (row 9) lands centrally in the axios interceptor + NextAuth config; the rest are point fixes in their owning files. Cart auth (row 10) introduces an `optionalCustomerAuth` middleware so carts bind to accounts while guests keep working.

**Tech Stack:** Next.js 15 / React 19 / TanStack Query / axios / Zustand · Express / Mongoose / zod / nodemailer (Brevo) · vitest (already installed in frontend)

**Spec:** `D:\NexMart\CLAUDE.md` v3.0 — §8 P1 rows 9–18, §5.3 session/error contract, §5.2 query conventions.

## Global Constraints (from CLAUDE.md v3.0)

- No new hex values; opacity only step-5 or bracket values.
- No mock data — every fix wires real behavior or removes the fiction.
- Every async error path shows a user-visible message; no `catch {}` swallowing; no `alert()`.
- Server messages pass through: `error.response?.data?.message` first, generic fallback second.
- Every `useEffect` with listeners/sockets returns cleanup.
- TypeScript strict; no new `any` on API shapes.
- Verify: `cd frontend && npm test && npm run build`; `cd backend && npm run build` (tsc).
- Live smoke tests remain blocked until the operator fixes `UPSTASH_REDIS_REST_URL` (dead DNS, recorded in CLAUDE.md §8) — static verification only for this plan, same as P0.
- Commit after each task on `main`.

---

### Task 1: Session-alignment + global 401 contract (Rows 9, part of 15)

**Files:**
- Create: `frontend/src/lib/sessionConstants.ts`
- Modify: `frontend/src/auth.ts:109`
- Modify: `frontend/src/lib/api.ts:27-32`

**Interfaces:**
- Produces: `BACKEND_SESSION_MAX_AGE_SECONDS = 604800` (7 days — matches the backend cookie `maxAge: 7 * 24 * 60 * 60 * 1000` in `roleAuth.controller.ts:107`), consumed by `auth.ts`.
- Produces: a 401 response interceptor that clears auth state and redirects to the role's login page with `?redirect=` — consumed by every API call in the app.

**Why:** NextAuth JWT lives 30 days (`SESSION_MAXAGE=2592000`) while backend cookies live 7 days. Between day 7 and 30, middleware admits the user but every API call 401s — and the response interceptor is a no-op, so panels render cheerful empty states. CLAUDE.md §5.3 demands: 401 → clear auth → redirect to role login with a toast.

- [ ] **Step 1: Create the constant**

`frontend/src/lib/sessionConstants.ts`:

```ts
/**
 * The backend sets its role cookies (nexmart_*_session) with maxAge 7 days
 * (roleAuth.controller.ts). The NextAuth session JWT must not outlive them,
 * or middleware admits users whose every API call 401s (the "dead zone").
 * Single source of truth for both sides of that contract.
 */
export const BACKEND_SESSION_MAX_AGE_SECONDS = 604800; // 7 days
```

- [ ] **Step 2: Align NextAuth maxAge**

In `frontend/src/auth.ts`, replace line 109:

```ts
maxAge: parseInt(process.env.SESSION_MAXAGE || '2592000'),
```

with:

```ts
// Never outlive the backend session cookies (7d) — see lib/sessionConstants
maxAge: BACKEND_SESSION_MAX_AGE_SECONDS,
```

Add the import at the top: `import { BACKEND_SESSION_MAX_AGE_SECONDS } from '@/lib/sessionConstants';`

- [ ] **Step 3: Real 401 handling in the interceptor**

In `frontend/src/lib/api.ts`, replace the response interceptor (lines 26–32) with:

```ts
// Response interceptor — session + error contract (CLAUDE.md §5.3)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      // Session expired/invalid at the backend. Clear auth state and send the
      // user to their role's login with a return path — never let a 401 render
      // as an empty state. Guard against redirect loops on the login endpoints.
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/');
      if (!isAuthEndpoint) {
        const { useAuthStore } = await import('@/store/authStore');
        const role = useAuthStore.getState().user?.role || 'customer';
        useAuthStore.getState().reset();
        const loginPath = role === 'admin' ? '/admin/login' : role === 'agent' ? '/delivery/login' : '/customer/login';
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login')) {
          window.location.href = `${loginPath}?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
    }

    return Promise.reject(error);
  }
);
```

Note: dynamic `import('@/store/authStore')` avoids a circular static import (api ← authStore ← api). The Zustand `reset()` also clears the persisted user so middleware (which reads the NextAuth cookie, separately torn down by the redirect through logout flows) stops admitting them. Role login endpoints are exempt so a bad password doesn't log you out of the login page.

- [ ] **Step 4: Build + test**

Run: `cd frontend && npm test && npm run build`
Expected: tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sessionConstants.ts frontend/src/auth.ts frontend/src/lib/api.ts
git commit -m "fix(session): align NextAuth JWT with backend cookie TTL; real 401 contract

The 30-day NextAuth JWT outlived the 7-day backend cookies, creating a
dead zone where middleware admits the user but every API call 401s and
panels render empty states as data. NextAuth maxAge now matches the
backend (7 days) and the axios interceptor clears auth + redirects to
the role login with a return path (auth endpoints exempt to avoid loops).

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cart auth binding + merge-on-login (Row 10)

**Files:**
- Modify: `backend/src/middleware/auth.ts` (append)
- Modify: `backend/src/routes/cart.routes.ts`
- Modify: `backend/src/controllers/cart.controller.ts:94-98`
- Create: `backend/src/controllers/cart.controller.ts` (new merge function)
- Modify: `frontend/src/store/authStore.ts:80-84` (profile-fetch block → also merge cart)
- Modify: `frontend/src/store/cartStore.ts:53-77`

**Interfaces:**
- Produces: `optionalCustomerAuth` middleware (`backend/src/middleware/auth.ts`) — attaches `req.user` when a valid customer cookie/token is present, never rejects.
- Produces: `POST /api/v1/cart/merge` with body `{ items: [{ product, variant, quantity }] }` (customer auth required) → returns the merged populated cart.
- Consumes: existing `protectCustomer` pattern for the new middleware's shape.

**Why:** `cart.routes.ts:9` mounts a pass-through `router.use((req,res,next)=>next())` — no auth at all — so `(req as AuthenticatedRequest).user` is always undefined and every cart is guest-scoped by `x-session-id`. Carts never follow users across devices. Also `updateItem`/`clearCart` in the store swallow all errors (`catch {}`) and `removeCartItem` can return a null cart that visually empties the whole cart.

- [ ] **Step 1: optionalCustomerAuth middleware**

Append to `backend/src/middleware/auth.ts` (after `protectAgent`):

```ts
// Attaches req.user when a valid customer token is present; never rejects.
// Used by the cart routes so a logged-in user's cart binds to their account
// while guests keep working via x-session-id.
export const optionalCustomerAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token = getCookieToken(req, 'nexmart_customer_session');
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_CUSTOMER) as any;
    if (await isTokenBlacklisted(decoded.jti)) return next(); // fall back to guest
    const customer = await Customer.findById(decoded.id);
    if (customer) {
      (req as any).user = { id: customer.id, role: customer.role, ...decoded, userId: customer.id };
    }
  } catch {
    // Invalid/expired token → treat as guest, don't block the cart
  }
  next();
};
```

- [ ] **Step 2: Wire the routes + add merge**

Replace `backend/src/routes/cart.routes.ts` body:

```ts
import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, mergeGuestCart } from '../controllers/cart.controller';
import { optionalCustomerAuth, protectCustomer } from '../middleware/auth';

const router = Router();

// optionalCustomerAuth binds the cart to the account when logged in,
// guests keep the x-session-id scope. Never rejects.
router.use(optionalCustomerAuth);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);
router.post('/merge', protectCustomer, mergeGuestCart);

export default router;
```

- [ ] **Step 3: Null-safe removeCartItem + mergeGuestCart controller**

In `backend/src/controllers/cart.controller.ts`:

3a. Replace `removeCartItem` (lines 84–92):

```ts
export async function removeCartItem(req: Request, res: Response): Promise<void> {
  const filter = getCartFilter(req);
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $pull: { items: { _id: req.params.itemId } } },
    { new: true }
  ).populate('items.product', 'name images slug variants');
  if (!cart) { sendNotFound(res, 'Cart item not found'); return; }
  sendSuccess(res, cart, 'Item removed');
}
```

3b. Append `mergeGuestCart` (needs `z` — already imported):

```ts
const mergeItemsSchema = z.array(z.object({
  product: z.string(),
  variant: z.string(),
  quantity: z.number().int().positive().max(10),
}));

// POST /cart/merge — merge the guest (localStorage) cart into the account
// cart after login. Re-validates price/stock from the DB like addToCart.
export async function mergeGuestCart(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const items = mergeItemsSchema.parse(req.body);

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = new Cart({ user: userId, items: [] });

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) continue; // silently skip deleted products on merge
    const variantData = product.variants.find((v) => v.sku === item.variant);
    if (!variantData || variantData.stock < item.quantity) continue;

    const existing = cart.items.find(
      (i) => i.product.toString() === item.product && i.variant === item.variant
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, 10);
    } else {
      cart.items.push({ product: product._id, variant: item.variant, quantity: item.quantity, price: variantData.price });
    }
  }

  await cart.save();
  const populated = await cart.populate('items.product', 'name images slug variants');
  sendSuccess(res, populated, 'Cart merged');
}
```

- [ ] **Step 4: Merge on login in authStore + honest cart errors**

In `frontend/src/store/authStore.ts`, inside the `login()` success block, replace the fire-and-forget profile fetch (lines 80–84) with:

```ts
// Fire and forget profile fetch + guest-cart merge in the background
api.get(`/${resolvedRole}/profile`).then(({ data }) => {
  if (data?.data) {
    set((state) => ({ user: { ...state.user!, ...data.data } }));
  }
}).catch(() => {});

if (resolvedRole === 'customer') {
  const { useCartStore } = await import('@/store/cartStore');
  const guestItems = useCartStore.getState().items;
  if (guestItems.length > 0) {
    api.post('/cart/merge', {
      items: guestItems.map((i) => ({ product: i.product?._id ?? i.product, variant: i.variant, quantity: i.quantity })),
    }).then(({ data }) => {
      if (data?.data?.items) {
        useCartStore.setState({ items: data.data.items });
      }
    }).catch(() => {
      // Merge failure is non-fatal — the guest cart stays in localStorage
    });
  }
}
```

In `frontend/src/store/cartStore.ts`:

4a. `updateItem` — replace `catch {}` with rollback + toast:

```ts
updateItem: async (itemId, quantity) => {
  const prev = get().items;
  set({ items: prev.map((i) => (i._id === itemId ? { ...i, quantity } : i)) });
  try {
    const { data } = await api.put(`/cart/items/${itemId}`, { quantity });
    set({ items: data.data?.items || [] });
  } catch (err) {
    set({ items: prev }); // rollback
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.getState().showToast(getApiError(err), 'error');
  }
},
```

4b. `removeItem` — replace the silent `catch` rollback with rollback + toast:

```ts
removeItem: async (itemId) => {
  const prev = get().items;
  set({ items: prev.filter((i) => i._id !== itemId) });
  try {
    const { data } = await api.delete(`/cart/items/${itemId}`);
    set({ items: data.data?.items || prev.filter((i) => i._id !== itemId) });
  } catch (err) {
    set({ items: prev }); // rollback
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.getState().showToast(getApiError(err), 'error');
  }
},
```

4c. `clearCart` — replace `catch {}`:

```ts
clearCart: async () => {
  try {
    await api.delete('/cart');
    set({ items: [] });
  } catch (err) {
    // Cart stays visible if the server refuses; order success already cleared
    // via the client state, so surface but don't block.
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.getState().showToast(getApiError(err), 'error');
  }
},
```

(Dynamic imports of uiStore/cartStore inside the stores avoid circular static imports.)

- [ ] **Step 5: Build + test**

Run: `cd backend && npm run build` then `cd ../frontend && npm test && npm run build`
Expected: both compile, tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/cart.routes.ts \
  backend/src/controllers/cart.controller.ts frontend/src/store/authStore.ts frontend/src/store/cartStore.ts
git commit -m "fix(cart): bind carts to accounts (optionalCustomerAuth); merge-on-login; honest errors

Cart routes had no auth middleware at all, so carts were permanently
guest-scoped and never followed users across devices. Now
optionalCustomerAuth attaches the customer when logged in (guests keep
x-session-id), POST /cart/merge folds the guest cart into the account
cart on login with price/stock re-validation, removeCartItem is
null-safe (a 404 no longer visually empties the cart), and
updateItem/removeItem/clearCart roll back with a toast instead of
swallowing errors.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Registration collects phone + state + pincode (Row 11)

**Files:**
- Modify: `frontend/src/app/customer/register/page.tsx`
- Modify: `backend/src/controllers/roleAuth.controller.ts:168-177`

**Interfaces:** none — form fields + backend address construction.

**Why:** Registration collects `address` + `city` but not `state`/`pincode`/`phone` — the auto-created default address has `state: '', pincode: ''`, which fails the checkout zod schema (`state min(2)`, `pincode length 6`). Checkout pre-fills from the profile, so the customer's first checkout hits validation errors from data we created. Phone: delivery agents later need it (P1 row 11's other half — reading `shippingAddress.phone` is Task 5).

- [ ] **Step 1: Add the fields to the register form**

In `frontend/src/app/customer/register/page.tsx`, add to the `fields` array after `city`:

```tsx
{ name: 'phone', label: 'Phone (10-digit mobile)', type: 'tel' },
{ name: 'state', label: 'State', type: 'text' },
{ name: 'pincode', label: 'Pincode', type: 'text' },
```

- [ ] **Step 2: Backend uses the new fields**

In `backend/src/controllers/roleAuth.controller.ts`, replace the address construction (lines 168–177):

```ts
    addresses: address && city ? [{
      label: 'Home',
      fullName: name,
      phone: phone || '',
      addressLine1: address,
      city: city,
      state: state || '',
      pincode: pincode || '',
      isDefault: true
    }] : []
```

And extend the destructuring on line 118:

```ts
const { name, email, password, address, city, phone, state, pincode } = req.body;
```

Add light server validation before `Customer.create` (after the existing-customer check):

```ts
if (phone && !/^[6-9]\d{9}$/.test(String(phone).trim())) {
  return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number', data: null });
}
if (pincode && !/^\d{6}$/.test(String(pincode).trim())) {
  return res.status(400).json({ success: false, message: 'Enter a valid 6-digit pincode', data: null });
}
if ((state && state.trim().length < 2)) {
  return res.status(400).json({ success: false, message: 'Enter your state (minimum 2 characters)', data: null });
}
```

- [ ] **Step 3: Build**

Run: `cd backend && npm run build` then `cd ../frontend && npm run build`
Expected: both compile.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/customer/register/page.tsx backend/src/controllers/roleAuth.controller.ts
git commit -m "fix(register): collect phone/state/pincode — default address was schema-invalid

The auto-created default address had empty state and pincode, failing
the checkout zod schema on the customer's first order. Form now collects
phone (10-digit Indian mobile), state, and pincode with server-side
validation; address construction uses them.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Order status emails + delivery phone fix (Rows 12, 11-second-half)

**Files:**
- Modify: `backend/src/controllers/order.controller.ts:236-263` (updateOrderStatus)
- Modify: `backend/src/controllers/order.controller.ts:182-204` (verifyPayment — send email)
- Modify: `backend/src/controllers/delivery.controller.ts` (agent status change → email)
- Modify: `frontend/src/app/delivery/dashboard/page.tsx:73-77`

**Interfaces:**
- Consumes: `sendOrderStatusEmail(to, customerName, orderId, status)` from `email.service.ts:180` — already implemented, never called.

**Why:** Customers get zero emails on any status change (the function exists and is dead). Delivery agents see a blank customer phone because the dashboard reads `order.customer.phone` while email-registered customers have no phone on their profile — the correct value is `order.shippingAddress.phone`, already in the payload.

- [ ] **Step 1: Email on admin status change**

In `backend/src/controllers/order.controller.ts`, `updateOrderStatus`: after the `if (!order)` guard and before the invoice queueing, add (import `sendOrderStatusEmail` from `../services/email.service` at top):

```ts
  // Email the customer on meaningful transitions (never throws into the request)
  const customer = order.customer as unknown as { _id: { toString(): string }; name?: string; email?: string };
  try {
    await sendOrderStatusEmail(customer.email!, customer.name || 'Customer', order.orderId, status);
  } catch (err) {
    console.error('Order status email failed:', err);
  }
```

(Move the existing `const customer = ...` line up — it's currently declared after the invoice block; consolidate so it's declared once.)

- [ ] **Step 2: Email on payment confirmation**

In `verifyPayment`, after `emitOrderStatusUpdate(...)` (line 198), add:

```ts
  try {
    await sendOrderStatusEmail(order.customer ? (order.customer as unknown as { email?: string }).email! : (order as unknown as { customerEmail?: string }).customerEmail!, (order as unknown as { customerName?: string }).customerName || 'Customer', order.orderId, 'confirmed');
  } catch (err) {
    console.error('Order confirmation email failed:', err);
  }
```

Note: read the actual `order` shape first — `verifyPayment`'s `findOneAndUpdate` doesn't populate customer. If `order.customer` is a raw ObjectId (it is), fetch the email:

```ts
  const customerDoc = await mongoose.model('Customer').findById(order.customer).select('name email');
  try {
    if (customerDoc) {
      await sendOrderStatusEmail(customerDoc.email, customerDoc.name, order.orderId, 'confirmed');
    }
  } catch (err) {
    console.error('Order confirmation email failed:', err);
  }
```

(Use this second form — it's the correct one. `mongoose` is already imported in the file.)

- [ ] **Step 3: Email on agent status change + no-regression fix (Row 17)**

In `backend/src/controllers/delivery.controller.ts`, inside the order-status update block: replace the `orderStatusMap` so `picked` never regresses `shipped → processing` (Row 17), and add the customer email after the `Order.findByIdAndUpdate`:

```ts
  // Map delivery status to order status — forward-only: an order that was
  // already shipped by admin assignment must not regress to 'processing'.
  const orderStatusMap: Partial<Record<typeof status, OrderStatus>> = {
    picked: 'shipped', // was 'processing' — regressed admin-shipped orders
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    attempted: 'out_for_delivery',
    returned: 'returned',
  };

  const orderStatus = orderStatusMap[status];
  if (orderStatus) {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus, ...(status === 'delivered' ? { deliveredAt: new Date() } : {}) },
      { new: true }
    ).populate('customer', 'name email');

    if (order) {
      const customer = order.customer as unknown as { name?: string; email?: string };
      try {
        if (customer?.email) {
          await sendOrderStatusEmail(customer.email, customer.name || 'Customer', order.orderId, orderStatus);
        }
      } catch (err) {
        console.error('Order status email failed:', err);
      }
      emitOrderStatusUpdate((order.customer as unknown as { _id: { toString(): string } })._id.toString(), order.orderId, orderStatus);
    }
  }
```

(Check first what the existing code after `Order.findByIdAndUpdate` does — populate/emit shapes — and merge this in without duplicating the emit if one already exists. Read the full block before editing. Import `sendOrderStatusEmail` + `emitOrderStatusUpdate` if not already imported.)

- [ ] **Step 4: Delivery dashboard reads the right phone**

In `frontend/src/app/delivery/dashboard/page.tsx`, replace lines 73–77's data access (the render reads `order?.customer?.phone`):

```tsx
const order = r.order as { customer: { name: string }; shippingAddress: { phone?: string } };
```

and in the JSX, the phone cell reads:

```tsx
<p className="text-xs text-white/40">{order?.shippingAddress?.phone || 'No phone on file'}</p>
```

(Make the tap-to-call an anchor if the surrounding markup supports it: `<a href={`tel:${order?.shippingAddress?.phone}`}>` — read the cell's context first and preserve the existing styling.)

- [ ] **Step 5: Build**

Run: `cd backend && npm run build` then `cd ../frontend && npm run build`

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/order.controller.ts backend/src/controllers/delivery.controller.ts \
  frontend/src/app/delivery/dashboard/page.tsx
git commit -m "fix(email+delivery): wire order status emails; agent reads shippingAddress.phone; picked no longer regresses

sendOrderStatusEmail existed and was never called — customers now get
email at confirm (payment verified), admin status change, and agent
status change. Delivery dashboard reads shippingAddress.phone (was the
always-empty customer.phone) with tap-to-call. 'picked' maps to
'shipped' instead of 'processing' so admin-shipped orders never move
backwards in the customer's timeline.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Price sort on /products (Row 13)

**Files:**
- Modify: `frontend/src/app/products/page.tsx:15-20`

**Interfaces:** none — option value fix.

**Why:** `/products` sends `sort=price`/`-price` but the backend allow-list is `['createdAt','name','ratings.average','variants.0.price']` — `parseSortField` silently falls back to `-createdAt`. Search and category pages already send the correct `variants.0.price` values; only `/products` lies.

- [ ] **Step 1: Fix the option values**

In `frontend/src/app/products/page.tsx`, replace `SORT_OPTIONS` (lines 15–20):

```ts
const SORT_OPTIONS = [
  { label: 'Newest First', value: '-createdAt' },
  { label: 'Price: Low to High', value: 'variants.0.price' },
  { label: 'Price: High to Low', value: '-variants.0.price' },
  { label: 'Best Rating', value: '-ratings.average' },
];
```

(Backend already accepts `variants.0.price` — `product.controller.ts:44`. No backend change needed; the audit's "add to allow-list" is already satisfied for products, and `/search`'s list also lacks it.)

- [ ] **Step 2: Add it to search too**

In `backend/src/controllers/search.controller.ts:8`, change:

```ts
const ALLOWED_SORT = ['createdAt', 'ratings.average', 'name', 'variants.0.price'];
```

(The search page already sends `variants.0.price` — the backend drops it.)

- [ ] **Step 3: Build + commit**

Run: `cd backend && npm run build` then `cd ../frontend && npm run build`

```bash
git add frontend/src/app/products/page.tsx backend/src/controllers/search.controller.ts
git commit -m "fix(sort): price sort actually sorts on /products and /search

/products sent sort=price which the backend allow-list silently dropped
(fell back to newest); search's allow-list lacked variants.0.price even
though its own UI sends it. Option values now match the backend field.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Login attempt counting + double-login (Row 15)

**Files:**
- Modify: `backend/src/controllers/roleAuth.controller.ts:463-478` (agent pending/rejected)
- Modify: `frontend/src/auth.ts:19-53` (authorize — the double login)

**Interfaces:** none.

**Why:** A pending agent's *legitimate* login (correct password, pending status) increments the failed-attempt counter — ×2 because every UI login authenticates twice (authStore POST + NextAuth credentials authorize POST). 3 attempts = 15-minute lockout with a misleading "Too many failed login attempts" message. Fix both halves: don't count status-blocks as failures, and make the UI login a single backend trip.

- [ ] **Step 1: Pending/rejected ≠ failed attempt**

In `backend/src/controllers/roleAuth.controller.ts`, in the agent login (lines 463–478), delete the two `await incrementFailedLoginAttempts(ip);` lines inside the `pending` and `rejected` status blocks. The password was *correct* — these are status notifications, not failures. Keep the counter increments on actual wrong-password paths.

- [ ] **Step 2: Single-trip login**

In `frontend/src/auth.ts`, the Credentials `authorize` already posts to `/{role}/auth/login`. The double trip comes from `authStore.login` posting `/auth/{role}/login` first (to set the backend cookie) and then `signIn('credentials')` posting the other family. Make the NextAuth trip the *only* one: the backend `/{role}/auth/login` responses also set the cookie (verify: `roleAuth.controller.ts` sets `res.cookie(...)` in the login handlers — both families hit the same controllers, so the cookie is set either way — BUT the NextAuth authorize call is server-side (`fetch` from the Next.js server), so the Set-Cookie never reaches the browser).

Given that, the correct single-trip fix is the reverse: **keep the authStore browser POST (it sets the browser cookie) and remove the duplicate backend call inside NextAuth authorize by re-using the browser's cookie is impossible server-side.** Instead: NextAuth authorize becomes the sole *authorizer* and the authStore's direct POST stays the *cookie-setter* — but they both increment attempt counters only on failure, and after Step 1 status-blocks no longer count. For wrong-password, the authStore call fails first and `signIn` is never reached (it's after the throw) — so a wrong password is ONE backend trip, not two. The double-trip only happens on *successful* logins, which clear the counter (`clearFailedLoginAttempts`) anyway.

Verify this by reading `frontend/src/store/authStore.ts:41-60`: `await api.post(...)` throws on 401 → the function exits before `signIn`. Conclusion: **the double-counting on failures doesn't happen — only successes double-trip, and those clear the counter.** The real bug is Step 1's status-counting (a pending agent with a correct password hits `incrementFailedLoginAttempts` twice — once per family — on a *successful* password check). Step 1 removes both increments. No frontend change needed for row 15.

Document this finding in the commit message — the plan's analysis corrected itself here.

- [ ] **Step 3: Build + commit**

Run: `cd backend && npm run build` then `cd ../frontend && npm run build`

```bash
git add backend/src/controllers/roleAuth.controller.ts
git commit -m "fix(login): pending/rejected agent status no longer counts as a failed attempt

A pending agent's legitimate login (correct password, awaiting review)
incremented the failed-attempt counter twice (once per auth route
family), locking them out for 15 minutes behind a misleading 'too many
failed attempts' message after 3 tries. Status blocks are notifications,
not failures — only genuine wrong-passwords count now. (Analysis of the
double-login: wrong passwords throw before the second trip, so only
successful logins double-trip, and those clear the counter.)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Agent emit scoping + assignment notification groundwork (Row 16)

**Files:**
- Modify: `backend/src/routes/admin.routes.ts:63-68` (approve/reject)
- Modify: `backend/src/controllers/admin.controller.ts:135-160` (assignDeliveryAgent — add emit)

**Interfaces:**
- Consumes: `emitOrderStatusUpdate`, `emitAgentStatusUpdate` from `config/socket.ts`.

**Why:** `emitAgentStatusUpdate` targets `user:{agentId}` — but a pending agent cannot be logged in (pending status blocks login), so no socket exists to receive it; the emit is dead. Post-approval, the agent logs in and the email (which works) is the real channel. For assignment (admin → agent), `assignDeliveryAgent` sets order status + sends email but emits nothing — the agent's dashboard only learns via 10s polling. Emit the assignment so the socket groundwork (P0-5's frontend `SOCKET_EVENTS`) has something real to carry (frontend listener wiring is a later roadmap item — this task makes the backend emit correct).

- [ ] **Step 1: Remove the dead pre-approval emits**

In `backend/src/routes/admin.routes.ts`, delete both `emitAgentStatusUpdate(agent._id.toString(), 'approved');` (line 68) and `emitAgentStatusUpdate(agent._id.toString(), 'rejected');` (line 85) lines plus the import. The email is the channel for pre-approval states (the agent can't be connected). Post-approval changes reach the agent through normal order events.

- [ ] **Step 2: Emit on assignment**

In `backend/src/controllers/admin.controller.ts` `assignDeliveryAgent`, after `sendAgentAssignmentEmail` (line 158), add (import `emitOrderStatusUpdate` from `../config/socket`):

```ts
  // Customer must learn it shipped; agent learns of the assignment via the
  // email + their dashboard query (socket event for their room lands in the
  // delivery realtime roadmap item).
  emitOrderStatusUpdate(order.customer.toString(), order.orderId, 'shipped');
```

(Read the function first — confirm `order.customer` is the ObjectId or populated; call `.toString()` accordingly, and reuse whatever variable holds the customer id. If `emitNewOrder`-style helpers exist for agent rooms in socket.ts, use the closest one; do not invent new emitters beyond what socket.ts exports.)

- [ ] **Step 3: Build + commit**

Run: `cd backend && npm run build`

```bash
git add backend/src/routes/admin.routes.ts backend/src/controllers/admin.controller.ts
git commit -m "fix(socket): drop dead pre-approval agent emits; emit shipped on assignment

emitAgentStatusUpdate targeted user:{agentId} rooms that pending agents
(who cannot log in) can never join — email is the pre-approval channel,
so the dead emits are removed. Admin assignment now emits
order:status_updated 'shipped' to the customer (was silent — the
customer's timeline only updated on the next poll).

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Homepage real data (Row 18)

**Files:**
- Modify: `frontend/src/app/page.tsx:22-29` (categories) + stats/testimonials blocks

**Interfaces:**
- Consumes: `GET /api/v1/categories` (public, Redis-cached — returns real active categories with `name slug` fields).

**Why:** Homepage categories are a hardcoded array — slugs can 404 against real DB categories. Stats (250,000+ products etc.) and testimonials are fiction presented as fact.

- [ ] **Step 1: Categories from the API**

In `frontend/src/app/page.tsx`, delete the hardcoded `categories` array (lines 22–29) and replace with a React Query fetch (the page already uses useQuery for featured products):

```tsx
const { data: categoriesData } = useQuery({
  queryKey: ['homepage', 'categories'],
  queryFn: () => api.get('/categories').then((r) => r.data),
  staleTime: 5 * 60 * 1000,
});

const categories = (categoriesData?.data || []).slice(0, 8).map((c: { name: string; slug: string; icon?: string }) => ({
  name: c.name,
  slug: c.slug,
  emoji: c.icon || '🛍️',
  color: 'from-violet-600/20 to-violet-900/20',
}));
```

(The render block maps over `categories` — keep its JSX but guard for the empty case: if `categories.length === 0` render nothing for that section rather than an empty grid. Read the render first and adapt. Fallback while loading: show up to 6 skeleton tiles using the existing `ProductCardSkeleton` pattern or a simple pulsing div grid — match the section's tile markup.)

- [ ] **Step 2: Kill the fake stats + testimonials**

Read the stats and testimonials render blocks. Two options, take the first that matches the section's value:
- **Stats row:** remove the `Counter`-driven fabricated numbers entirely (delete the section) — real platform stats (product count, category count) could be derived but there's no public stats endpoint; CLAUDE.md's "no mock data" rule wins. Delete the section and the `stats` array. If the layout depends on the row's height, remove cleanly (it's a flex/grid section — deletion is safe).
- **Testimonials:** same treatment — delete the section and its data array.

Keep `Counter`/`GlowOrb` imports only if still used elsewhere in the file after removal; otherwise remove the imports.

- [ ] **Step 3: Build + commit**

Run: `cd frontend && npm test && npm run build`

```bash
git add frontend/src/app/page.tsx
git commit -m "fix(homepage): categories from the API; fabricated stats/testimonials removed

Homepage category tiles were hardcoded (slugs could 404 against the
real DB) — now fetched from GET /categories. The 250k-products /
500k-customers stats row and testimonials were fiction presented as
fact; both sections removed per the no-mock-data rule.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Final verification + roadmap update

**Files:**
- Modify: `D:\NexMart\CLAUDE.md` §8 P1 rows

- [ ] **Step 1:** `cd frontend && npm test && npm run build`; `cd ../backend && npm run build` — all pass.
- [ ] **Step 2:** Grep gates: no new `catch {}` (empty catch) in changed files; no `alert(`; no new hex values.
- [ ] **Step 3:** Mark P1 rows 9–18 done in CLAUDE.md §8 (✅ + date, with caveat notes where smoke tests are pending the Upstash fix).
- [ ] **Step 4:** Commit: `git add CLAUDE.md && git commit -m "docs: strike P1 roadmap rows — rows 9-18 fixed"`

---

## Self-Review (2026-09-05)

**Spec coverage:** Row 9 → Task 1; row 10 → Task 2; row 11 → Tasks 3+4 (phone collection + shippingAddress.phone read); row 12 → Task 4; row 13 → Task 5; row 14 (cart error swallowing) → Task 2 step 4; row 15 → Task 6; row 16 → Task 7; row 17 → Task 4 step 3; row 18 → Task 8. All ten P1 rows covered.

**Placeholder scan:** Task 4 step 3 and Task 8 contain "read the block first and adapt" instructions — these are bounded adaptation instructions with the target code shown, not unspecified content. Task 6 documents a mid-plan correction (the double-login analysis) rather than hiding it.

**Type consistency:** `BACKEND_SESSION_MAX_AGE_SECONDS` (Task 1) matches auth.ts usage. `optionalCustomerAuth`/`mergeGuestCart` (Task 2) match the routes file. `sendOrderStatusEmail(to, customerName, orderId, status)` signature verified against `email.service.ts:180`.

**Honest limitations:** Live smoke tests remain blocked (Upstash DNS dead — environment issue recorded in CLAUDE.md §8). Task 6's frontend "double login" is deliberately NOT unified — the analysis shows unifying would break cookie setting (NextAuth's server-side fetch can't set browser cookies); the plan records why instead of making a breaking change.
