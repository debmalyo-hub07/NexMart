# P2 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the eleven P2 items from `D:\NexMart\CLAUDE.md` §8 (rows 19–29) — dead preview links, dead Share/wishlist buttons, admin order-select stuck state, the misleading admin-register link, the customers-suspend control, wishlist/phone API surfaces, form-library split, query-key drift, double-polling, category-manager invisibility, and discarded server messages.

**Architecture:** Point fixes in the Next.js frontend and Express backend. Row 19 is the largest: a middleware change letting admins GET-preview storefront routes plus an admin order-detail drawer. Rows 21–29 are surgical. The wishlist (rows 20/24) gets a real API against the existing `Wishlist` model.

**Tech Stack:** Next.js 15 / React 19 / TanStack Query / rhf+zod · Express / Mongoose · vitest (frontend)

**Spec:** `D:\NexMart\CLAUDE.md` v3.0 — §8 P2 rows 19–29, §3.2 toast rules, §5.2 query-key conventions, §5.4 form contract.

## Global Constraints (from CLAUDE.md v3.0)

- No new hex values; opacity only step-5 or bracket values; no `alert()`/`confirm()`.
- No mock data. Server messages pass through (`error.response?.data?.message` first).
- Every mutation: optimistic flip where cheap, rollback + toast on failure.
- Query keys: hierarchical tuples `['admin', …]`, `['delivery', …]`, `['store', …]`.
- TypeScript strict; no new `any` on API shapes.
- Verify: `cd frontend && npm test && npm run build`; `cd backend && npm run build`.
- Live smoke still blocked by the dead `UPSTASH_REDIS_REDI_URL` (environment issue, recorded in CLAUDE.md §8) — static verification only.
- Commit after each task on `main`.

---

### Task 1: Admin storefront preview + order-detail link (Row 19)

**Files:**
- Modify: `frontend/src/middleware.ts:91-96`
- Modify: `frontend/src/app/admin/orders/page.tsx:85` (Eye link)

**Interfaces:** none — middleware policy + link target change.

**Why:** The role-confinement block (lines 91–96) bounces an authed admin off ANY non-`/admin` path — so the admin products page's Eye link (`/products/${slug}`) and orders page's Eye link (`/orders/${id}`) silently teleport the admin back to `/admin`. CLAUDE.md's fix: let admins **GET-preview** storefront routes while still blocking writes (writes go through the API with admin auth anyway; page routes are all GET navigations).

- [ ] **Step 1: Middleware — allow admin read-access to storefront routes**

In `frontend/src/middleware.ts`, replace lines 91–96:

```ts
  // Admin and Agent should never see customer routes or root
  if (isAuthenticated && role === 'admin' && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (isAuthenticated && role === 'agent' && !pathname.startsWith('/delivery')) {
    return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
  }
```

with:

```ts
  // Role confinement. Admins keep READ access to storefront routes (product
  // preview from the admin panel, order-detail as the customer sees it) but
  // are bounced from customer-account surfaces. Agents stay fully confined.
  if (isAuthenticated && role === 'admin' && !pathname.startsWith('/admin')) {
    const adminPreviewable = ['/products', '/categories', '/search', '/about'];
    const customerSurfaces = ['/cart', '/checkout', '/orders', '/profile', '/customer'];
    if (customerSurfaces.some((p) => pathname.startsWith(p)) || !adminPreviewable.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }
  if (isAuthenticated && role === 'agent' && !pathname.startsWith('/delivery')) {
    return NextResponse.redirect(new URL('/delivery/dashboard', req.url));
  }
```

Wait — the orders Eye link goes to `/orders/${id}`, which IS a customer surface. The point of that link is order detail. Decision: the admin orders Eye link should NOT target the customer order page; it should open an admin-owned detail surface. Since building a full admin order-detail page is roadmap P2-19's second half, the pragmatic P2 scope: **point the Eye link at the existing admin order row-expand (already implemented via DataTable's expandable rows on the admin orders page — verify; if the DataTable supports an `expandable` prop, enable it with order details) OR remove the Eye link until the admin detail page exists.** Read the admin orders page + DataTable first: if DataTable already renders expandable rows (it does — the audit noted "expandable rows" exist), then the Eye `<Link>` is redundant-with-broken-behavior: **replace the Link with a button that toggles the row expansion** (same affordance, no navigation, no middleware involvement).

- [ ] **Step 2: Admin orders Eye → expand toggle**

In `frontend/src/app/admin/orders/page.tsx`, read the DataTable usage. If DataTable exposes row expansion (an `expanded`/`onToggleExpand` mechanism or row render prop), replace:

```tsx
<Link href={`/orders/${row._id}`} className="p-1.5 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
  <Eye size={14} />
</Link>
```

with a button that toggles that row's expansion (state: `const [expandedId, setExpandedId] = useState<string | null>(null);` — mirror the pattern used in `frontend/src/app/orders/page.tsx`'s expandable rows). Remove the `Link` import if unused after this. If DataTable has NO expansion support, instead delete the Eye button entirely and note it in the commit (dead control removed; admin detail page is a future item).

- [ ] **Step 3: Middleware still protects products preview for admin** — covered by Step 1's allow-list (`/products` previewable; `/cart|/checkout|/orders|/profile|/customer` still bounce).

- [ ] **Step 4: Build + test + commit**

```bash
cd frontend && npm test && npm run build
git add frontend/src/middleware.ts frontend/src/app/admin/orders/page.tsx
git commit -m "fix(admin): storefront preview for admins; order Eye toggles row detail (was middleware bounce)

The role-confinement block teleported admins back to /admin from any
storefront path, killing both Eye preview links. Admins now keep read
access to /products, /categories, /search, /about (customer-account
surfaces still bounce). The orders Eye link toggles the row's detail
expansion instead of navigating to the customer order page.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Share button + wishlist API (Rows 20, 24)

**Files:**
- Create: `backend/src/controllers/wishlist.controller.ts`
- Modify: `backend/src/routes/customer.routes.ts` (append wishlist routes)
- Modify: `frontend/src/app/products/[slug]/page.tsx:25,163-167` (Share + wishlist)
- Modify: `frontend/src/components/product/ProductCard.tsx:19,128-137` (wishlist heart)

**Interfaces:**
- Produces: `GET /api/v1/customer/wishlist` → `{ data: { products: string[] } }`; `POST /api/v1/customer/wishlist/:productId` → adds, returns full product list (populated); `DELETE /api/v1/customer/wishlist/:productId` → removes, same.
- Produces (frontend): `useWishlist()` hook — `src/hooks/useWishlist.ts` exporting `{ wishlist: string[], toggleWishlist(productId: string): void, isWishlisted(productId: string): boolean, isLoading: boolean }`.

**Why:** Product-detail Share has no onClick; wishlist hearts are `useState`-only (no API, model exists with zero routes); row 24's wishlist model is unreachable.

- [ ] **Step 1: Backend wishlist controller**

Create `backend/src/controllers/wishlist.controller.ts`:

```ts
import { Request, Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { sendSuccess, sendBadRequest } from '../utils/response';
import { AuthenticatedRequest } from '../types';

async function getWishlistDoc(userId: string) {
  let doc = await Wishlist.findOne({ user: userId });
  if (!doc) doc = await Wishlist.create({ user: userId, products: [] });
  return doc;
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const doc = await getWishlistDoc(userId);
  const products = await Product.find({ _id: { $in: doc.products }, isPublished: true })
    .select('name slug images variants ratings');
  sendSuccess(res, { productIds: doc.products.map(String), products });
}

export async function addToWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const productId = req.params.productId;

  const exists = await Product.exists({ _id: productId, isPublished: true });
  if (!exists) { sendBadRequest(res, 'Product not found'); return; }

  const doc = await getWishlistDoc(userId);
  if (!doc.products.some((p) => p.toString() === productId)) {
    doc.products.push(productId as never);
    await doc.save();
  }
  sendSuccess(res, { productIds: doc.products.map(String) }, 'Added to wishlist');
}

export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  const { userId } = (req as AuthenticatedRequest).user!;
  const doc = await Wishlist.findOne({ user: userId });
  if (doc) {
    doc.products = doc.products.filter((p) => p.toString() !== req.params.productId);
    await doc.save();
  }
  sendSuccess(res, { productIds: doc ? doc.products.map(String) : [] }, 'Removed from wishlist');
}
```

- [ ] **Step 2: Routes**

In `backend/src/routes/customer.routes.ts`, add to imports: `import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller';` and append before `export default router` (inside the protected section — after the existing `router.use(protectCustomer, checkIP(Customer))` so auth applies):

```ts
// --- Wishlist ---
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', addToWishlist);
router.delete('/wishlist/:productId', removeFromWishlist);
```

- [ ] **Step 3: Frontend hook**

Create `frontend/src/hooks/useWishlist.ts`:

```ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { getApiError } from '@/lib/api';

interface WishlistResponse {
  productIds: string[];
}

export function useWishlist() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { showToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'wishlist'],
    queryFn: () => api.get<WishlistResponse>('/customer/wishlist').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ productId, wishlisted }: { productId: string; wishlisted: boolean }) => {
      const url = `/customer/wishlist/${productId}`;
      return wishlisted
        ? api.delete(url).then((r) => r.data)
        : api.post(url, {}).then((r) => r.data);
    },
    onMutate: async ({ productId, wishlisted }) => {
      await queryClient.cancelQueries({ queryKey: ['customer', 'wishlist'] });
      const prev = queryClient.getQueryData<WishlistResponse>(['customer', 'wishlist']);
      queryClient.setQueryData<WishlistResponse>(['customer', 'wishlist'], {
        productIds: wishlisted
          ? (prev?.productIds || []).filter((id) => id !== productId)
          : [...(prev?.productIds || []), productId],
      });
      return { prev };
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['customer', 'wishlist'], ctx.prev);
      showToast(getApiError(err), 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', 'wishlist'] });
    },
  });

  const productIds = data?.productIds || [];

  return {
    productIds,
    isLoading,
    isWishlisted: (productId: string) => productIds.includes(productId),
    toggleWishlist: (productId: string) => {
      if (!isAuthenticated) {
        showToast('Sign in to save items to your wishlist', 'info');
        return;
      }
      toggle.mutate({ productId, wishlisted: productIds.includes(productId) });
    },
  };
}
```

- [ ] **Step 4: Product-detail page**

In `frontend/src/app/products/[slug]/page.tsx`:
- Import `useWishlist` and wire it: `const { isWishlisted, toggleWishlist } = useWishlist();` (remove the local `const [wishlist, setWishlist] = useState(false);` line).
- Heart button: `onClick={() => toggleWishlist(product._id)}`, active state `isWishlisted(product._id)`.
- Share button — give it a handler (add inside the component):

```tsx
const handleShare = async () => {
  const url = window.location.href;
  const shareData = { title: product.name, text: `Check out ${product.name} on NexMart`, url };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard', 'success');
    }
  } catch {
    // user dismissed the share sheet — not an error
  }
};
```

`<button onClick={handleShare} ...>` on the Share2 icon. (`showToast` from useUIStore — check the page's existing imports.)

- [ ] **Step 5: ProductCard heart**

In `frontend/src/components/product/ProductCard.tsx`: remove `const [isWishlisted, setIsWishlisted] = useState(false);`, import + use `useWishlist()`, heart `onClick={(e) => { e.preventDefault(); toggleWishlist(product._id); }}`, active class from `isWishlisted(product._id)`.

- [ ] **Step 6: Build + test + commit**

```bash
cd backend && npm run build && cd ../frontend && npm test && npm run build
git add backend/src/controllers/wishlist.controller.ts backend/src/routes/customer.routes.ts \
  frontend/src/hooks/useWishlist.ts "frontend/src/app/products/[slug]/page.tsx" \
  frontend/src/components/product/ProductCard.tsx
git commit -m "feat(wishlist+share): real wishlist API + optimistic hearts; Share uses navigator.share

The Wishlist model existed with zero routes and hearts were local
useState fiction; now GET/POST/DELETE /customer/wishlist with optimistic
toggles, rollback, and a sign-in prompt for guests. Product-detail Share
(button had no onClick at all) uses navigator.share with clipboard
fallback.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Admin customers suspend control (Rows 22, 23-partial)

**Files:**
- Modify: `backend/src/routes/admin.routes.ts` (add PATCH route)
- Modify: `backend/src/controllers/admin.controller.ts` (append handler)
- Modify: `frontend/src/app/admin/users/page.tsx` (actions column)

**Interfaces:**
- Produces: `PATCH /api/v1/admin/customers/:id/status` with body `{ isActive: boolean }` → `{ data: updatedCustomer }`.

**Why:** The customers table renders an Active/Suspended badge with no control to change it — row 22. (Row 23's delivery-order-detail + dead fields are folded into this plan's scope decisions: suspend control is in; `GET /delivery/orders/:id` consumer and `comparePrice`/`specifications` inputs are deferred to P3 with a note, since they're feature-adds not dead-control fixes the audit ranked lower.)

- [ ] **Step 1: Backend route + handler**

In `backend/src/routes/admin.routes.ts`, after the `/customers` GET (line 41), add:

```ts
router.patch('/customers/:id/status', async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean', data: null });
  }
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select('-password -otp -otpExpiry');
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found', data: null });
  res.json({ success: true, message: `Customer ${isActive ? 'activated' : 'suspended'}`, data: customer });
});
```

(`Customer` is already imported in admin.routes.ts — verify; if not, import from `'../models/Customer'`. Follow the file's existing inline-handler style, as the approve/reject routes use.)

- [ ] **Step 2: Frontend actions column**

In `frontend/src/app/admin/users/page.tsx`, add a mutation and actions column:

```tsx
const toggleStatus = useMutation({
  mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
    api.patch(`/admin/customers/${id}/status`, { isActive }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    showToast('Customer status updated');
  },
  onError: (err: unknown) => showToast(getApiError(err), 'error'),
});
```

And in the columns array / DataTable actions slot (match the DataTable API as used in admin/orders), a toggle button mir the products-page action style:

```tsx
<button
  type="button"
  onClick={() => toggleStatus.mutate({ id: row._id as string, isActive: !row.isActive })}
  disabled={toggleStatus.isPending}
  className={row.isActive
    ? 'p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50'
    : 'p-1.5 rounded-lg text-white/40 hover:text-acid-400 hover:bg-acid-400/10 transition-colors disabled:opacity-50'}
  title={row.isActive ? 'Suspend customer' : 'Activate customer'}
>
  {row.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
</button>
```

Imports: `UserX, UserCheck` from lucide-react, `useMutation`, `useQueryClient`, `getApiError` from `@/lib/api` (check existing imports and extend). Check what query key the page currently uses for its customers query — if it's `['admin', 'users', …]` (read the file), use THAT key in the invalidation, not 'customers'.

- [ ] **Step 3: Build + commit**

```bash
cd backend && npm run build && cd ../frontend && npm run build
git add backend/src/routes/admin.routes.ts frontend/src/app/admin/users/page.tsx
git commit -m "feat(admin): suspend/activate customer control (badge was read-only)

PATCH /admin/customers/:id/status + toggle action on the users table
with optimistic-feel invalidation and server-error toasts.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Hide the dead admin-register link (Row 22-second-half)

**Files:**
- Modify: `frontend/src/app/admin/login/page.tsx`

**Why:** The login page shows "Register Admin Account" linking to `/admin/register`, which middleware requires an existing admin session for — a dead link for every logged-out visitor. CLAUDE.md's verdict: intentional gating; hide the link for logged-out users (the first admin comes from the seed script).

- [ ] **Step 1:** Since `/admin/login` is a server component wrapping AuthForm, and hiding requires knowing auth state (available via `auth()` server-side), convert the link to conditional. In `frontend/src/app/admin/login/page.tsx`:

```tsx
import { AuthForm } from '@/components/auth/AuthForm';
import { auth } from '@/auth';

export const metadata = { title: 'Admin Login | NexMart' };

export default async function AdminLogin() {
  // The register page requires an existing admin session (middleware) —
  // only show the link to admins. First admin comes from the seed script.
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  return (
    <AuthForm
      type="login"
      role="admin"
      title="Admin Portal"
      submitText="Admin Login"
      linkText={isAdmin ? 'Register New Admin' : ''}
      linkHref="/admin/register"
      redirectUrl="/admin"
      fields={[
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
      ]}
    />
  );
}
```

In `frontend/src/components/auth/AuthForm.tsx`, guard the link render: wrap the existing bottom Link block in `{linkText && (...)}` so an empty string renders nothing.

- [ ] **Step 2: Build + commit**

```bash
cd frontend && npm run build
git add frontend/src/app/admin/login/page.tsx frontend/src/components/auth/AuthForm.tsx
git commit -m "fix(admin): register link only for signed-in admins (was dead for logged-out users)

/admin/register requires an existing admin session by middleware, so the
login-page link was a dead end for every logged-out visitor. It now
renders only for authenticated admins; first admin bootstrap stays the
seed script.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Query-key drift + double-polling (Rows 26, 27)

**Files:**
- Modify: `frontend/src/components/admin/ProductForm.tsx:237,311`
- Modify: `frontend/src/lib/syncConfig.ts` (polling cadence)
- Modify: `frontend/src/app/admin/layout.tsx:31-37` (kill 20s invalidation)
- Modify: `frontend/src/app/delivery/layout.tsx` (same)

**Why:** ProductForm uses `['admin-categories']` / invalidates `['admin-products']` while every other admin query uses tuple keys — the layout's `invalidateQueries({queryKey:['admin']})` never matches them, and product-created invalidation never refreshes the real list. Admin/delivery also double-poll: 10s refetchInterval + 20s layout invalidation.

- [ ] **Step 1: Fix ProductForm keys**

In `frontend/src/components/admin/ProductForm.tsx`: change `queryKey: ['admin-categories'],` (line 237) to `queryKey: ['admin', 'categories'],` and `queryClient.invalidateQueries({ queryKey: ['admin-products'] });` (line 311) to:

```ts
queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
```

Also grep the file for any other flat admin keys (`['admin-products']`, `['admin-categories']`) and convert.

- [ ] **Step 2: Single polling channel**

In `frontend/src/lib/syncConfig.ts`: read it, then change `liveQueryOptions` to 60s `refetchInterval` with `refetchIntervalInBackground: false` (socket push is now real post-P0-5; polling is the backstop per CLAUDE.md §5.1) and `analyticsQueryOptions` stays 60s:

```ts
export const liveQueryOptions = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
} as const;
```

(Preserve any other properties the file exports — read first, modify only the intervals. If the file's existing exports have different names/shape, adapt to reality.)

- [ ] **Step 3: Remove the 20s layout invalidations**

In `frontend/src/app/admin/layout.tsx` (lines 31-37) and `frontend/src/app/delivery/layout.tsx`: delete the `setInterval(() => queryClient.invalidateQueries(...), 20_000)` block and its cleanup (the whole effect if the interval is its only content). The 60s query-level polling is the sole backstop now.

- [ ] **Step 4: Build + commit**

```bash
cd frontend && npm run build
git add frontend/src/components/admin/ProductForm.tsx frontend/src/lib/syncConfig.ts \
  frontend/src/app/admin/layout.tsx frontend/src/app/delivery/layout.tsx
git commit -m "fix(sync): tuple query keys; single 60s polling backstop (was 10s+20s double-poll)

ProductForm's flat keys (['admin-products']) never matched the layout's
['admin'] invalidation or the list's tuple key — product-created
refresh relied on the poll. All keys now tuples. Polling collapsed to
one 60s backstop (socket push is primary post-P0-5); the 20s layout
invalidations are gone, and hidden tabs stop polling.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Category manager sees inactive + ProductForm dead fields (Rows 27-partial, 24-partial)

**Files:**
- Modify: `backend/src/controllers/category.controller.ts:46` (admin fetch includes inactive)
- Modify: `frontend/src/app/admin/categories/page.tsx` (displayOrder input; confirm-delete)
- Modify: `frontend/src/components/admin/ProductForm.tsx` (comparePrice input)

**Why:** The category manager fetches `GET /categories` which hard-filters `isActive: true` — a deactivated category becomes invisible and unmanageable forever. `displayOrder` is in the form state but has no input; `comparePrice` is in the zod schema with no input.

- [ ] **Step 1: Backend — admin category fetch includes inactive**

In `backend/src/controllers/category.controller.ts`, `getCategories` builds `{ ...filter, isActive: true }`. Change the query to respect an explicit include flag:

```ts
  const includeInactive = req.query.includeInactive === 'true';
  const categories = await Category.find(includeInactive ? filter : { ...filter, isActive: true })
    .populate('parent', 'name slug _id')
    .sort({ displayOrder: 1, name: 1 });
```

(Also ensure the cache key distinguishes variants: `const cacheKey = \`nexmart:categories:${includeInactive ? 'admin' : req.query.parent !== undefined ? String(req.query.parent) : 'all'}\`;` — read the existing cache logic and adapt so admin fetches don't poison the public cache.)

- [ ] **Step 2: Frontend category manager**

In `frontend/src/app/admin/categories/page.tsx`:
- The page's fetch: append `?includeInactive=true` to its `GET /categories`.
- Add the missing `displayOrder` input next to the name/icon fields (a number input bound to `form.displayOrder`, matching the existing input styling).
- Replace the two `confirm()` calls (~lines 242, 270) with the styled `ConfirmDialog` component (already used on the products page — read its props from `frontend/src/components/common/ConfirmDialog.tsx` and mirror the products-page usage pattern: state for `pendingDeleteId`, dialog open when set, confirm → mutation).

- [ ] **Step 3: comparePrice input in ProductForm**

In `frontend/src/components/admin/ProductForm.tsx`: the variants field array renders inputs for sku/price/stock/attributes (read the render block ~lines 160-200). Add a `comparePrice` number input in each variant row, registered via the field array's `register` (`{...register(\`variants.${index}.comparePrice\` as const, { valueAsNumber: true })}`) with the same styling and an optional label 'MRP (compare price)'.

- [ ] **Step 4: Build + commit**

```bash
cd backend && npm run build && cd ../frontend && npm run build
git add backend/src/controllers/category.controller.ts frontend/src/app/admin/categories/page.tsx \
  frontend/src/components/admin/ProductForm.tsx
git commit -m "fix(admin): category manager sees inactive categories; displayOrder + comparePrice inputs; styled confirm

The category manager fetched isActive:true only — a deactivated
category became permanently invisible and unmanageable. Admin fetch now
requests includeInactive=true (cache-key split so the public cache
isn't poisoned). displayOrder and comparePrice get their missing
inputs, and category delete uses ConfirmDialog instead of native
confirm().

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Form conversions (Row 25) — auth forms + admin forms to rhf+zod

**Files:**
- Modify: `frontend/src/components/auth/AuthForm.tsx`
- Modify: `frontend/src/app/admin/profile/page.tsx`
- Modify: `frontend/src/app/admin/categories/page.tsx` (already touched in Task 6 — fold its manual form into rhf+zod here)

**Interfaces:** none — internal refactors.

**Why:** All auth forms + 2 admin forms are hand-rolled useState with no per-field validation (CLAUDE.md §5.4 mandates rhf+zod everywhere).

- [ ] **Step 1: AuthForm**

Rewrite `AuthForm.tsx` with react-hook-form + zod: build the schema dynamically from the `fields` prop (each field `z.string().min(1, '...')`, password fields `min(8, 'Password must be at least 8 characters')`, email fields `.email('Enter a valid email')`, tel → 10-digit Indian mobile regex when name === 'phone', pincode → 6-digit when name === 'pincode'), `zodResolver`, per-field inline errors below inputs, `register(field.name)` replacing the `formData` state, keep: password-visibility toggle (via watch), submit flow unchanged (login → authStore.login; register → POST + OTP redirect), the P0-7 Google button, `showWelcomeBack` email pre-fill via `defaultValues`, error banner for server errors, `aria-describedby` on inputs with errors. Preserve ALL existing behavior — this is a validation-layer swap, not a redesign. Keep every current className.

- [ ] **Step 2: Admin profile form**

Read `frontend/src/app/admin/profile/page.tsx` (159 lines, manual useState + HTML required). Convert to rhf+zod: name (min 2), phone (optional 10-digit), email read-only (keep as-is if it is), submit unchanged (PUT + refreshUser), keep the MOCK_ACTIVITY removal if it landed in P3 or keep untouched here (P3 owns it — leave the activity section alone).

- [ ] **Step 3: Admin categories form**

Fold into the Task 6 edit if executing together, else standalone: convert the create/edit form state to rhf+zod (name required min 2, icon optional, description optional max 500, parent optional, displayOrder number optional).

- [ ] **Step 4: Build + test + commit**

```bash
cd frontend && npm test && npm run build
git add frontend/src/components/auth/AuthForm.tsx frontend/src/app/admin/profile/page.tsx \
  frontend/src/app/admin/categories/page.tsx
git commit -m "refactor(forms): auth + admin forms to react-hook-form + zod (CLAUDE.md §5.4)

All six auth pages and the admin profile/categories forms were
hand-rolled useState with zero per-field validation. Now rhf+zod with
inline adaptive errors (10-digit phone, 6-digit pincode, email format),
blur-safe validation, and preserved submit flows/styling.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Invoice alert()s + server-message pass-through sweep (Row 29, P4-adjacent)

**Files:**
- Modify: `frontend/src/app/orders/page.tsx:40-51`
- Modify: `frontend/src/app/orders/[id]/page.tsx:39-44`

**Why:** The last `alert()`s in the app (invoice download) — the feedback-idiom violation the grep gate keeps flagging; also row 29's discarded server messages.

- [ ] **Step 1: Replace alerts with toasts**

In `frontend/src/app/orders/page.tsx`, replace `handleDownloadInvoice`:

```tsx
const handleDownloadInvoice = async (orderId: string) => {
  try {
    const { data } = await api.get(`/orders/${orderId}/invoice`);
    if (data.data?.invoiceUrl) {
      window.open(data.data.invoiceUrl, '_blank');
    } else {
      showToast(data.message || 'Invoice is being generated. Please try again in a moment.', 'info');
    }
  } catch (err: unknown) {
    showToast(getApiError(err), 'error');
  }
};
```

Add `getApiError` to the api import; `showToast` — check whether the page already pulls it from useUIStore (add if not).

In `frontend/src/app/orders/[id]/page.tsx`, replace `handleDownloadInvoice` (which has NO try/catch — an unhandled rejection):

```tsx
const handleDownloadInvoice = async () => {
  if (!order) return;
  try {
    const { data: inv } = await api.get(`/orders/${id}/invoice`);
    if (inv.data?.invoiceUrl) window.open(inv.data.invoiceUrl, '_blank');
    else showToast(inv.message || 'Invoice is being generated, please try again shortly.', 'info');
  } catch (err: unknown) {
    showToast(getApiError(err), 'error');
  }
};
```

- [ ] **Step 2: Build + commit**

```bash
cd frontend && npm run build
git add frontend/src/app/orders/page.tsx "frontend/src/app/orders/[id]/page.tsx"
git commit -m "fix(orders): invoice downloads use toasts (last alert()s); no unhandled rejection

The invoice handlers used native alert() — the only remaining ones in
the app — and the detail page's had no error handling at all (404/401
became an unhandled promise rejection). Both now toast with the
server's message.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Final verification + roadmap update

- [ ] **Step 1:** `cd frontend && npm test && npm run build`; `cd ../backend && npm run build`.
- [ ] **Step 2:** Grep gates — zero `alert(`/`confirm(` in src; zero flat admin query keys; zero empty catches in changed stores.
- [ ] **Step 3:** Strike P2 rows 19–29 in CLAUDE.md §8 (✅ + date; note deferrals: `GET /delivery/orders/:id` consumer and `specifications` editor deliberately deferred to P3/feature work; `24` note).
- [ ] **Step 4:** Commit: `git add CLAUDE.md && git commit -m "docs: strike P2 roadmap rows — 19-29 fixed (delivery-order-detail + specifications editor deferred)"`.

---

## Self-Review (2026-09-05)

**Spec coverage:** Row 19 → Task 1; rows 20+24(wishlist) → Task 2; row 21 → landed in P0 Task 1 (already struck — verify at Task 9 and note); rows 22-both-halves → Tasks 3+4; row 23 → Task 3 (suspend); row 25 → Task 7; row 26 → Task 5; row 27 → Tasks 5+6; row 29 → Task 8 (+ Task 6's ConfirmDialog). Row 24's `GET /delivery/orders/:id` consumer and `specifications` editor: **deliberately deferred** (feature-adds; noted in the roadmap strike, not silently dropped).

**Placeholder scan:** Task 1 Step 2 and Task 6 Step 2 contain "read the X first and mirror the pattern" — bounded adaptation instructions with target code shown. Task 7 Step 1 describes a schema-building approach precisely rather than dumping 200 lines of rewritten form — acceptable since the field list is enumerated and behavior is fully specified.

**Type consistency:** `useWishlist()` (Task 2) used by both product pages. `PATCH /admin/customers/:id/status` (Task 3) matches the frontend mutation. Tuple key convention consistent across Tasks 5–6.

**Honest limitations:** smoke tests still blocked (Upstash). Task 7 is the riskiest (large form rewrite) — it's last among the form tasks and isolated to its files.
