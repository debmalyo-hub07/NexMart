# CLAUDE.md — NexMart UI/UX & Interaction Directive v3.0

> **Single source of truth for every AI agent working on NexMart.**
> This file documents the codebase **as it actually is**, then directs what it becomes.
> The old v2.0 spec described an aspirational system that diverged from reality — v2 is retired.
> Rule zero for every task: **read the real file before editing it. Never trust this doc over the code; if they disagree, the code wins and this doc gets updated.**

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 0. GROUND RULES (read before every task)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Reality-first.** The routes, collections, and flows in §1 are the real ones. `/admin/dashboard`, `admin_users`, `customer_users` from the old spec **do not exist**.
2. **No mock data, ever.** No hardcoded stats, testimonials, trend deltas, or activity logs. If real data isn't wired yet, show a loading/empty state — never fiction. (The v2-era code shipped `MOCK_ACTIVITY`, fake `change={12}` arrows, and hardcoded homepage stats; all are slated for removal in the roadmap.)
3. **Mobile-first, 375px baseline.** Every layout is designed and tested at 375px before desktop. Touch targets ≥ 44×44px (delivery panel ≥ 48px).
4. **Silent failure is the worst failure.** Every request path must have a visible loading, error, and empty state. An expired session must never render "No orders yet" or "₹0 revenue" as real data.
5. **One feedback idiom.** Toasts (built to §3 spec) for transient results, `ConfirmDialog` for confirmations, inline field errors for forms. `alert()` and `confirm()` are banned.
6. **Strict TypeScript.** No `any` on API shapes. New components use the tokens and primitives in §2 — never new hex values, never new violet steps.
7. **Every `useEffect` with listeners/intervals/sockets gets a cleanup return.** No exceptions.
8. **Verify after edit.** Run `npm run build` in `frontend/` before calling a frontend task done.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. REALITY SNAPSHOT (the actual system, verified 2026-09)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1.1 Stack
```
Frontend  : Next.js 15.3.2 App Router · React 19 · TypeScript · Tailwind 3.4
            TanStack Query 5.56 · Zustand 4.5 (auth/cart/ui) · NextAuth v5 beta
            framer-motion 11 · GSAP 3.12 + ScrollTrigger · Lenis 1.3
            three 0.184 + @react-three/fiber (homepage hero only) · recharts
Backend   : Express · Mongoose · Socket.IO · Upstash Redis · Razorpay test mode
DB        : MongoDB Atlas (collections use Mongoose-default plural names)
Media     : Cloudinary (res.cloudinary.com, dumb origin — no URL transforms yet)
```

### 1.2 Real routes (memorize these — they are NOT the old spec's)

| Role | Login | Register | Home | Panel pages |
|---|---|---|---|---|
| Customer | `/customer/login` | `/customer/register` → `/customer/verify-otp` | `/` (storefront) | `/orders`, `/orders/[id]`, `/profile`, `/cart`, `/checkout` |
| Admin | `/admin/login` | `/admin/register` (requires existing admin session) | `/admin` | `/admin/{products, categories, orders, users, delivery, analytics, profile}` |
| Delivery | `/delivery/login` | `/delivery/register` | `/delivery/dashboard` | `/delivery/profile` |

There is **no** `/admin/dashboard`, no `/customer/dashboard`, no `/products/[id]` (it's `/products/[slug]`).

### 1.3 Auth architecture (hybrid — do not "simplify" without a plan)
- `middleware.ts` wraps NextAuth `auth()` (not jose). Role values: `'admin'`, `'agent'`, `'customer'`.
- Two backend route families both exist and both are used: `POST /auth/{role}/login` (called by `authStore.login` via axios, sets the backend httpOnly `nexmart_*_session` cookie) **and** `POST /{role}/auth/login` (called by NextAuth's credentials `authorize` in `src/auth.ts`). One UI login therefore authenticates twice — a known defect (roadmap P1-15; the double-login half of the lockout issue), not an architecture to replicate.
- `authStore` (Zustand, persisted key `nexmart-auth`) persists **only** `{user, isAuthenticated}` — the backend token is never persisted, which is why the socket handshake is always guest (roadmap P0-5).
- NextAuth session JWT outlives backend cookies (30d vs 7d) → dead-zone between day 7 and 30 where middleware admits you but every API call 401s (roadmap P1-9).
- Role confinement: middleware bounces an authed admin off **any** non-`/admin` path and agent off any non-`/delivery` path. Storefront preview from admin panels requires changing this (roadmap P2-19).

### 1.4 Data layer as built
- React Query is the fetching layer (30+ call sites). Admin + delivery pages spread `liveQueryOptions` from `src/lib/syncConfig.ts` (10s `refetchInterval`, in-background). Checkout, OTP, admin profile, and all auth forms still use raw `api` + `useState`.
- Query defaults (`providers.tsx`): `retry: 0`, no refetch on focus/reconnect — this is why errors render as empty states (roadmap P1-9).
- Cart is Zustand-only; `cartStore.fetchCart()` is never called; backend `/cart/*` has **no auth middleware** so carts are guest-scoped forever (roadmap P1-10).
- Backend collections: `admins`, `customers`, `deliveryagents`, `products`, `categories`, `orders`, `deliveryassignments` (Mongoose plural defaults — not the old spec's `*_users` names).
- Response envelope: `{success, message, data}` + `meta:{page,limit,total,totalPages}`. Zod field errors return under `errors` — **no frontend code reads `errors` today**; new code must (§5.4).

### 1.5 Known-broken inventory
The full ranked list with `file:line` evidence is §8. **P0 rows 1–8 were fixed 2026-09-05** (see §8 for the one remaining environment caveat: the Upstash Redis URL in `.env` no longer resolves, 500-ing every API request locally until updated). Still open today: the invoice `alert()`s on `/orders` (P4), plus the P1–P4 rows.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. DESIGN LANGUAGE — "Deep-Space Kinetic Editorial"
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Award-caliber dark identity, evolved from the existing palette with **one** set of rules. The aesthetic direction: Vercel/Linear/Awwwards lineage — cinematic scroll storytelling, oversized display type, magnetic micro-interactions — with commerce conversion guardrails baked in.

### 2.1 Color — the law

**Surfaces (elevation = lightness, never drop shadows):**
```
space-950  #050508   page background
space-900  #0A0A0F   section background
space-800  #0F0F1A   card surface
space-700  #141425   raised / hover surface
glass               overlays (rgba white < 0.06 + backdrop-blur)
```
Never pure black. Never `#050505`/`#111116`/`#1A1A24`/`#0A0A0A` or any off-ramp near-black — they exist in auth/mega-menu today and are being purged. Depth on dark comes from stepping **up** the ramp, not from `box-shadow` (glow shadows below are the only exception).

**One violet ramp (interactive identity):**
```
violet-600 #7C3AED   borders, glows, focus rings
violet-500 #8B5CF6   primary interactive (links, active states, icons)
violet-400 #A855F7   hover / light accents
```
`#A78BFA`, `#D946EF`-as-violet, and every other violet variant are **deleted**. If a design needs a fifth violet, the design is wrong.

**One brand gradient:** `from-violet-500 to-fuchsia-500` (450ms hue drift on hover is allowed). Used for: hero/CTA fills, headline gradient text, the logo mark. The old violet→acid `.gradient-text` is retired — acid is never a gradient partner.

**Acid green (`acid-400 #22D58D`) = action + success only.** Primary CTA, add-to-cart, in-stock, delivered, synced/online states. Never decorative, never body text. Accent budget: acid + violet together touch ≤ ~10% of any screen (the Razer rule).

**Semantic colors, registered in `tailwind.config.ts`** (today they're unregistered stock classes — fix as part of P2):
```
success/delivered/in-stock  → acid-400
warning/pending/processing  → amber-400 #F59E0B
danger/error/cancelled      → red-400  #EF4444
```
Fix `getStatusColor` (`src/lib/utils.ts`) to cover `approved, rejected, assigned, picked, attempted` — today all fall to amber, making approved and rejected agents look identical.

**Status is always icon + text + color** (WCAG 1.4.1). Every `StatusBadge` gets a lucide icon. Color never carries meaning alone.

**Opacity law:** only Tailwind step-5 values (`/5 /10 /15 …`) or bracket syntax (`bg-white/[0.08]`). `/3 /4 /6 /7 /8` silently compile to **nothing** in Tailwind 3.4 — 19 such classes exist today, which is why the active nav pill, focused search fill, and admin sidebar hovers are invisible. Banned going forward; hunted to extinction in P0.

**Contrast floors (WCAG 2.2 AA):**
- Body text: ≥ `text-white/70` on space-900 (≥4.5:1). `text-white/40` (today ×134) is banned for text.
- Muted/secondary: ≥ `text-white/60` (large text only, ≥18px).
- UI borders, icons, focus indicators: ≥ 3:1 (`border-white/15`+).
- `text-white/30` and below: decorative only (background watermark text), never information.

### 2.2 Typography

```
Display   Outfit        600/700, tracking -0.02em   — headings, hero, stat numbers
Body      Inter         400/500, 1.6 line-height     — everything readable
Mono      JetBrains Mono 400/500                     — prices, SKUs, order IDs, timestamps
```

- **All fonts via `next/font/google` only.** Delete the render-blocking `@import` in `globals.css:1` (it double-loads Inter and blocks first paint). Wire `--font-outfit` / `--font-inter` / `--font-mono` CSS variables into `tailwind.config.ts` `fontFamily`; rename the lying `syne`/`dm` keys to real names; define or remove the phantom `font-outfit`/`font-inter` classes (17 uses today compile to nothing).
- **Body default is `text-base`** (16px). `text-sm` (14px) is the floor for dense admin tables; `text-xs` (12px) is metadata-only. `text-[10px]` is promoted to a named token (`text-meta`) or removed — no unnamed steps.
- **Fluid display type for hero moments:** `text-[clamp(3rem,8vw,7rem)]`, never fixed `text-7xl`/`text-8xl`.
- **Prices/IDs always mono** — the e-com detail that reads as premium: `₹ 1,23,456` in JetBrains Mono with tabular figures.
- Type scale: `meta(12) · sm(14) · base(16) · lg(18) · xl(20) · 2xl(24) · 3xl(30) · 4xl(36) · display(clamp)`.

### 2.3 Spacing & layout
- 4/8px grid. Page gutters via `.page-container` (existing, 37 uses — keep it).
- `--navbar-height` and `--sidebar-width` CSS vars become the single source (`pt-[var(--navbar-height)]`, `w-[var(--sidebar-width)]`) — today 72px/260px are hardcoded in 12 places.
- Product grids: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (2-up on mobile, not 1-up — commerce scan density).
- Modals/drawers: `max-w-md` centered or right-docked; full-bleed on mobile with `overscroll-behavior: contain`.

### 2.4 Signature motion vocabulary (the "award" layer)

All of these are **storefront-only** (§2.5). Exact specs so agents don't improvise:

| Interaction | Spec |
|---|---|
| **Headline char reveal** | Split text into per-char spans; `y: 100%→0` + clip-path mask, 30ms stagger, 600ms `cubic-bezier(0.22,1,0.36,1)`, once per section entry via IntersectionObserver. (The dead `.char` GSAP code in `page.tsx` gets actually implemented.) |
| **Magnetic button** | On pointermove within 80px radius, `translate` ≤ 6px toward cursor (lerp 0.2); spring-return on leave (stiffness 300, damping 20). Desktop + fine-pointer only. |
| **Cursor-reactive hero** | Existing WebGL scene (wireframe sphere, tori, 500 particles) — kept and tightened per §6.3. |
| **Scroll progress** | 2px acid gradient bar, fixed top, `scaleX` driven by scroll (passive listener + rAF). |
| **Section parallax** | `data-parallax` elements move at 0.8× scroll via GSAP ScrollTrigger. Max ±80px. Never on interactive content. |
| **Page transitions** | CSS `page-in` 180ms `opacity 0→1 + translateY(8px→0)` on `<main>`. Reduced-motion: instant. (View Transitions API where supported, same timing.) |
| **Hover lift** | Cards: `translateY(-2px)` + border `violet-600/40`, 200ms. Buttons: `translateY(-1px)` + glow shadow, 150ms. |
| **Micro-feedback** | Add-to-cart: button morphs to spinner → checkmark (400ms) + cart badge `scale 1→1.2→1`. Status flips: crossfade 150ms. |

**Forbiddens:** layout-property animations (`width`/`height`/`top` — the 9 framer-motion `height:'auto'` sites get rebuilt as grid-template-rows `0fr→1fr`), `transition-all` (42 uses today → replaced with specific properties), `animate-pulse-glow` pairs on 600px blurred elements, infinite animations except spinners/pulse, entrance animations that delay first content paint beyond 200ms.

### 2.5 Motion jurisdiction (where the wow is allowed)

| Surface | Motion budget |
|---|---|
| Storefront public (`/`, `/products`, `/categories`, `/search`, product detail) | Full vocabulary — char reveals, parallax, magnetic, hero canvas |
| Checkout, auth, `/cart`, `/orders` | Functional only: spinner→check, 150ms state crossfades, toast slide. Zero decorative motion. |
| Admin panel | Skeletons + row-expand (grid-rows trick) + optimistic crossfades. No parallax, no reveals, no cursor games. |
| Delivery panel | Absolute minimum: status change confirmation. Field conditions, one-handed use, possibly direct sunlight. |

**`prefers-reduced-motion: reduce` is a hard gate, not a nicety.** One global handler: all GSAP timelines/ScrollTriggers/Lenis disabled, char-reveals render complete, hero canvas replaced by static gradient poster, framer transitions → 0ms. Implement with a single `useReducedMotion` check + a CSS media query that sets `animation-duration: 0.01ms !important` — both, from day one of any motion work.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. COMPONENT STANDARDS
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3.1 Foundations (build these once, in `src/components/ui/`)
The 13 installed-but-unused `@radix-ui/*` packages become the base layer for anything overlay/menu-related — they solve focus trap, Escape, aria, and keyboard nav that zero hand-rolled components have today:

| Primitive | Base | Rules |
|---|---|---|
| `Dialog` | Radix Dialog | Replaces hand-rolled `ConfirmDialog`, `PasswordModal`, gallery lightbox. Focus trap + Escape + `aria-modal` + return focus are non-negotiable. |
| `Drawer` | Radix Dialog (side variant) | CartDrawer, mobile nav, admin mobile sidebar. Escape closes; body scroll locked; `overscroll-behavior: contain`. |
| `DropdownMenu` | Radix DropdownMenu | Navbar user menu, table row actions. Full keyboard nav, `aria-expanded`. |
| `Toast` | Radix Toast | See 3.2. |
| `Select` | Radix Select | Status dropdowns (admin orders, delivery). The native `<select>` styled dark is the stopgap. |
| `Tabs` | Radix Tabs | Admin delivery tabs, profile tabs. |
| `Button`, `Input`, `Badge`, `Skeleton`, `EmptyState` | hand-rolled | Token-only styling; sizes `sm/md/lg`; Button ≥44px tall on mobile. |

### 3.2 Toast system (rebuild — current one has a timer bug and one slot)
- **Queue, not slot:** each toast has an id; new toasts stack (max 3, oldest evicted). Timer bug (bare `setTimeout` killing the wrong toast) dies with the rewrite.
- Variants: `success` (acid icon+bar) · `error` (red) · `info` (violet) · `warning` (amber). Icon + text, auto-dismiss 4s (errors 6s), pause on hover, swipe/click dismiss.
- `aria-live="polite"`, `role="status"`. It's the app's only status channel — it must be announced.
- **Server messages pass through.** `error.response?.data?.message` first, fallback generic. Zod field errors map to inline field messages (§5.4). The pattern `catch { showToast('Update failed') }` that discards server detail is banned.

### 3.3 Data display
- `DataTable`: server-side sort + pagination only (today's client-side sort over one page while paginating server-side is a lie — P4). Debounced search (300ms). On `<lg`: rows collapse to cards (not horizontal scroll — the current `overflow-x-auto` table is unusable on mobile). Sortable headers are `<button>` with `aria-sort`.
- `StatusBadge`: icon + label + semantic color, full status coverage (§2.1).
- `StatsCard`: value in mono/tabular figures, delta with real data only, sparkline optional. Loading = skeleton; error = "—" with retry, **never 0**.
- `Skeleton`: shimmer via `background-position` is replaced with opacity pulse (GPU-friendly) or kept but capped — 36 concurrent shimmer elements repaint the screen every frame.
- `EmptyState`: illustration/icon + what's missing + why + one CTA. Empty ≠ error ≠ loading — all three states exist for every query.
- Pagination: numbered window + prev/next, never a 10-button cap with pages 11+ unreachable (current bug, P4).

### 3.4 Imagery
- **Cloudinary loader in `next.config.ts`** with `f_auto,q_auto,w_{width},c_limit` — images transform at the CDN edge instead of round-tripping every image through the Node optimizer (today's setup bills the server for what Cloudinary does free).
- Every `fill` image gets `sizes` (5 today don't — the 64px gallery thumbnails currently request 3840px sources).
- Product-detail main image: `priority` + `placeholder="blur"` via a low-quality Cloudinary derivative (`q_10,e_blur:200` LQIP).
- `alt` text describes the product on commerce surfaces (`alt=""` only for decorative chrome).
- Product images: square `c_pad` in cards (grid stability, CLS 0), `g_auto` crop in detail gallery.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. ROLE EXPERIENCE STANDARDS
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 4.0 Cross-role order lifecycle (the interaction backbone)

```
CUSTOMER places order (POST /orders → 'placed')
   → SOCKET 'order:new' → admin room          [today: no listener — POLL 10s]
ADMIN confirms ('placed' → 'confirmed')        [today: 401 — broken route guard]
   → assigns agent (POST /admin/orders/:id/assign/:agentId → 'shipped')
   → SOCKET 'delivery:assigned' → agent room  [today: email only]
AGENT: assigned → picked → in_transit → delivered
   → SOCKET 'order:status_updated' → customer + admin rooms
   → email via queue at each customer-facing transition
```

Every arrow that says "today: broken" is roadmap P0/P1. **The UI contract for every role is built against this diagram** — each portal is a view of the same order document, and the socket event names in §5.1 are the shared vocabulary.

### 4.1 Customer storefront — conversion-first

**Checkout (Baymard-grounded):**
- ≤ 14 form elements total. Address, payment, review — one screen on desktop, 3 steps on mobile.
- Full order cost (items + shipping + tax) visible **before** the payment step; COD fee if any, shown at address entry.
- Pincode field validates server-side and returns serviceability + ETA + COD availability ("Deliver to 700001 — by Tue 12 Oct · COD Available"). Invalid pincode blocks progression with an adaptive message.
- Adaptive per-field errors: "Enter a valid 10-digit mobile number" — never "Invalid input". Validate on blur, never on keystroke, never prematurely.
- Input persistence: field values survive validation errors and payment failure. Nothing worse than re-typing an address after a declined card.
- Payment: UPI listed first (Indian default), Razorpay branding + lock icon + "Secure payments" at the payment step, guest-visible total. **The verify endpoint and the success path must actually work** (P0-1) — a customer who pays and then sees "verification failed" is the single most damaging bug in the product.
- Post-purchase: success state with order id (mono), timeline, and a real confirmation email (P1-12).

**Indian-market grounding (hard rules):**
- All currency via `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR'})` — ₹1,23,456 lakh grouping. Never Western 3-3 grouping, never string-concatenated ₹.
- Phone: 10-digit Indian mobile validation (E.164 `+91` internally).
- Registration collects phone + full address (state, pincode) — today it creates addresses that fail the checkout schema (P1-11).
- Dates: `Intl.DateTimeFormat` with day-month-year, e.g. "12 Oct 2026".

**Browse & PDP:**
- Applied-filter pills above the grid, removable (66% of top sites miss this).
- "No results" pages suggest categories/queries, never dead-end.
- Gallery: all thumbnails visible or partial-cutoff pattern (never hidden truncation); lightbox is keyboard-navigable.
- PDP shows stock state ("Only 3 left" in amber), delivery ETA by pincode, reviews, related products. Wishlist button either works (API built, P2-20) or is removed — a heart that does nothing is a trust leak.
- Search: typo-tolerant suggestions, debounced, keyboard navigable (the current SearchBar is the best-built flow — it's the template).

**Session honesty:** a 401 from the API layer triggers re-auth flow (§5.3), never an empty state.

### 4.2 Admin panel — scanability-first

- Dashboard answers "is anything on fire?" in 5 seconds: 4 stat cards top-left (orders today, revenue, pending deliveries, low stock), each with **real** deltas, chart below, activity feed after.
- Auto-sync: socket push for new events + 60s polling backstop (replacing today's 10s + 20s double-poll). Sync indicator shows truth: "Live" (socket connected) vs "Syncing…" (polling) vs "Reconnecting" — never a fake LIVE.
- New-order arrival: toast + sidebar badge count + subtle audio cue (respects mute). Today an order arrives silently within 10s of polling — the admin might as well refresh manually.
- Tables per §3.3. Status changes: optimistic flip + rollback toast on failure (and the select re-enables — today's permanently-disabled select after error is P2-21).
- Destructive actions (delete product, revoke agent): ConfirmDialog with red action, never pre-focused.
- Order detail (route to build, P2-19): full items, customer, payment, assignment, timeline, internal notes.
- **Never render unverified data as truth:** the `MOCK_ACTIVITY` security log, hardcoded trend deltas, and `?? 0` fallbacks are all P0/P2 removals.

### 4.3 Delivery panel — field-use-first

- **48px minimum touch targets.** Primary actions (Picked Up, Delivered, Failed) bottom-anchored, full-width, thumb-reach. One primary action per screen.
- Customer phone: tap-to-call `tel:` link reading `shippingAddress.phone` (today it reads the always-empty `customer.phone` — P1-11). Address: "Open in Maps" via `https://www.google.com/maps/dir/?api=1&destination={encoded}`.
- Assignment arrival: notification badge + toast + sound the moment an order is assigned (socket, P0-5). Until then: visible "checking for new assignments" state.
- Status updates: optimistic with per-row spinner, offline-tolerant (queue locally, sync on reconnect, "Saved offline — will sync" state).
- Stats are honest: "Delivered Today" counts today's deliveries (today it counts the current page — P3).
- Agent profile: approval status honest (today's unconditional "Verified by Admin" pill is P3).
- Status model: `assigned → picked → in_transit → delivered` — "picked" must never regress an order from `shipped` (P1-17).

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. INTERACTION & FEEDBACK ARCHITECTURE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 5.1 Realtime contract (Socket.IO)
Server event names (backend `src/config/socket.ts` is the emitter; these are the **canonical** names — the frontend's current `'order:status_update'` (missing d) is a typo to fix):

```
'order:new'             → admin room          (new order placed)
'order:status_updated'  → customer + admin    (any status transition)
'delivery:assigned'     → agent room          (order assigned to them)
'agent:status_updated'  → agent room          (approval/rejection)
'product:stock_updated' → admin room          (low stock)
'dashboard:stats'       → admin room          (aggregates refresh hint)
```

Socket handshake carries the role's JWT (requires persisting/deriving it — the auth fix in P0-5). The client singleton **rebuilds when auth state changes** (module-level `if (!socket)` prevents this today). Every `useSocket().on()` registration returns its unsubscribe and callers return it from `useEffect` — the current leaks in `/orders` pages register a fresh listener per refetch.

Polling remains the backstop (visibility-based: active tab 60s, hidden tab off) — not the primary channel, and **never double-polling** (kill the 20s layout invalidation that stacks on the 10s refetchInterval).

### 5.2 React Query conventions
- Query keys: hierarchical tuples `['admin', 'orders', filters]`, `['delivery', 'assignments']`, `['store', 'products', …]`. The stray `['admin-products']` / `['admin-categories']` keys (which the layout's `['admin']` invalidation can never match) are renamed.
- Mutations invalidate by tuple prefix; optimistic updates with rollback for status/cart/availability changes.
- Defaults become: `retry: 1` (network-only), `refetchOnWindowFocus: true`. `staleTime` role-based: storefront 60s, admin/delivery 10s.
- Every `useQuery` consumer renders **tri-state** (loading/error/empty) — enforced via an `<QueryState>` wrapper component so it's structural, not per-page discipline.

### 5.3 Session & error contract
- `api.ts` response interceptor becomes real: on **401** → clear auth state → redirect to the role's login with `?redirect=` and a "Session expired, please sign in again" toast. On **403** → "You don't have access to this" inline. On **429** → backoff + "Too many requests, wait a moment" toast. On network error → offline banner.
- Session fix (P1-9): align NextAuth JWT maxAge with backend cookie TTL (7d) so the dead zone can't exist; `AuthSync` additionally reacts to the first backend 401, not just NextAuth status.
- Backend error responses sanitize: no Razorpay SDK text, no ObjectIds, no route-path echo to end users (P1 group). Client always surfaces `error.response.data.message` when user-appropriate, else a mapped generic.

### 5.4 Form contract
All forms — all roles — use react-hook-form + zod (the checkout/profile forms are the existing in-repo template; the hand-rolled AuthForm and admin forms convert as P2-25):
- Inline per-field errors below inputs, `aria-describedby` wired, focus-first-error on submit.
- Validation on blur; never premature; adaptive messages ("Enter a valid 10-digit mobile number").
- Zod schemas set every custom message — no raw "String must contain at least 2 character(s)".
- Server field errors (the backend `errors` key) map onto form fields.
- Submit button disabled while pending, spinner, success toast with the server's message.

### 5.5 OTP flow (the existing one is the gold standard — keep it)
6-box auto-advance, backspace-back, full paste, 60s resend countdown, per-state spinners, masked email ("sent to d***r@gmail.com"), auto-submit on 6th digit. It's the best flow in the codebase; new patterns copy it.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. MOTION, MEDIA & PERFORMANCE BUDGETS
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6.1 Core Web Vitals targets (75th percentile, mobile)
```
LCP ≤ 2.5s   (storefront hero text/SSR element — NEVER the WebGL canvas)
INP ≤ 200ms  (cart, filters, search must yield to render first)
CLS ≤ 0.1    (aspect-ratio reserved everywhere; no layout-property animation)
```

### 6.2 Animation rules
- **Animate only compositor properties:** `transform`, `opacity`, `filter`. The existing `height:'auto'` framer-motion sites (9) rebuild as `grid-template-rows: 0fr→1fr` transitions.
- No per-frame object allocation in rAF loops (reuse vectors — the hero scene already does this correctly).
- Routed-scope motion only: Lenis, CustomCursor, ScrollTrigger are **storefront-scoped**, never admin/delivery/checkout (today they wrap the whole app — P0/P2 scope fix). Lenis gets a `prefers-reduced-motion` bail-out and `syncTouch: false`-equivalent (native mobile momentum).
- ProductCard's per-card springs survive, but the `mousemove` `setState` glow coords move to direct DOM style writes (no re-render per pointer frame — today's card re-renders on every mousemove, ×24 cards).
- `will-change` only on elements animating for > 200ms continuously, removed after.

### 6.3 Three.js hero (contained, and it stays contained)
The scene is well-engineered (dpr cap, antialias off, visibility pause, full disposal, dynamic import) — keep it, with these additions:
- **WebGL failure fallback:** wrap context creation; on failure render the static gradient poster (currently an R3F throw nukes the whole homepage via root error boundary).
- **`prefers-reduced-motion`:** static poster.
- **Mobile:** skip the canvas below `sm` (a 500-particle additive-blend field behind text nobody reads on a 375px screen is pure GPU waste). Static gradient poster instead.
- **LCP discipline:** the hero headline (SSR'd text with font preload) is the LCP element. The canvas fades in *behind* it, non-blocking. It never carries content.
- Kill the useless `<ambientLight>` (all materials are unlit Basic/Points) and `<Preload all />`.

### 6.4 Image pipeline
Per §3.4: Cloudinary `f_auto,q_auto` loader, `sizes` on every `fill` image, `priority` + blur LQIP on PDP main image, square-padded card images. Stable, canonical transform URLs (Cloudinary counts any URL change as a new transform).

### 6.5 Fonts
`next/font` only, self-hosted, `display: swap`, preloaded. The Google `@import` in globals.css is deleted (it's a render-blocking chain that double-loads Inter). `<link rel="preconnect">` to fonts.gstatic.com stays.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. ACCESSIBILITY FLOOR (WCAG 2.2 AA — hard requirements)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every interactive element, every overlay, every form, in all three portals:

```
□ Keyboard: every action reachable and operable by keyboard alone; visible
  focus ring (≥3:1, 2px) on everything — never bare outline-none
□ Focus management: modals/drawers trap focus, close on Escape, return
  focus to the trigger (Radix gives this free — use it)
□ Labels: every input has a visible <label htmlFor> or aria-label. Today
  the auth forms have zero.
□ ARIA state: aria-expanded on all disclosures (mega-menu, dropdowns,
  mobile nav, filter accordions), aria-current on nav, aria-sort on
  sortable headers, aria-live on the toast region
□ Targets ≥ 24×24 AA floor; ≥44px on mobile; ≥48px delivery panel
□ Contrast per §2.1 floors; icon+text+color for every status
□ prefers-reduced-motion honored globally (§2.5)
□ Decorative images/art alt=""; informative alt describes content
□ Skip-to-content link; landmark structure (header/nav/main/footer)
□ Tables: real <th> scope, caption where non-obvious
```

Add `plugin:jsx-a11y/recommended` to `.eslintrc.json` so CI enforces this instead of nothing.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 8. REMEDIATION ROADMAP (audited 2026-09, ranked)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each item: the gap, the evidence, the acceptance criterion. Execute in order; P0 blocks everything.

### P0 — broken in production (fix before any UI polish) — ✅ ALL DONE 2026-09-05
| # | Gap | Fix / acceptance |
|---|---|---|
| 1 ✅ | **Payment verify 404s after customer pays.** `checkout/page.tsx:107` posts `/orders/verify-payment`; real route is `POST /orders/:id/payment/verify`. Customer sees "verification failed", cart never clears, double-order risk (button re-enables mid-Razorpay). | FIXED: `paymentVerifyPath()` helper, real route, button disabled through modal, ondismiss feedback, cart clears on success. |
| 2 ✅ | **Admin order-status change always 401.** `order.routes.ts:9` applies `protectCustomer` router-wide before per-route `protectAdmin`. COD orders can never reach `confirmed`, hence never assignable — structurally undeliverable. | FIXED: per-route guards; `updateOrderStatus` under `protectAdmin` only. Live smoke pending (Upstash outage, see below). |
| 3 ✅ | **19 dead Tailwind opacity classes** (`/3 /4 /6 /7 /8`) — active nav pill, search focus fill, admin sidebar hovers render nothing. | FIXED: all bracket values; grep gate clean. |
| 4 ✅ | **Phantom font classes** (`font-outfit`, `font-inter` — 17 uses compile to nothing) + double font loading + lying config keys. | FIXED: next/font ×3 families, @import deleted, config wired to variables, body/heading rules use vars. |
| 5 ✅ | **Socket.IO dead end-to-end:** event-name typo (`order:status_update` vs `order:status_updated`), guest handshake (token never persisted), listener leaks (fresh listener per refetch on `/orders/[id]`). | FIXED: `SOCKET_EVENTS` constants, NextAuth-session token, singleton rebuild, real unsubscribes. Live smoke pending (Upstash outage, see below). |
| 6 ✅ | **Reviews fully dead** — UI calls routes that 404. | FIXED: `GET/POST /products/:id/reviews` (zod, one-per-customer, verified-purchase via delivered orders). Live smoke pending (Upstash outage, see below). |
| 7 ✅ | **Google OAuth configured, zero buttons.** | FIXED: "Continue with Google" on customer login/register. |
| 8 ✅ | **Lenis + CustomCursor scoped wrong** — smooth-scroll hijack + cursor over admin tables and checkout. | FIXED: storefront-only mount (StorefrontLayout), providers.tsx double-mount removed, reduced-motion early-return, CSS scroll-behavior conflict removed. |

> ⚠️ **Upstash status (2026-09-05):** the `UPSTASH_REDIS_REST_URL` in `.env` (`lucky-gobbler-82201.upstash.io`) no longer resolves in public DNS — the instance appears deleted/renamed. Since the resilience fix (2026-09-05, later that day) the API **degrades gracefully** with Redis down: rate limiting, JWT blacklisting, failed-login lockouts, and caches fail open with loud logging (2.5s bounded calls, no retries), and all endpoints serve real MongoDB data. Update the URL to a live Upstash database to restore full protection. Verified live in this state: products/categories/stats/orders-sort/reviews/patch-status/admin-login all 200.

### P1 — silent failures & misinformation — ✅ ALL DONE 2026-09-05
| # | Gap | Fix / acceptance |
|---|---|---|
| 9 ✅ | 401 renders as empty state in all three roles; 7d-cookie vs 30d-session dead zone. | FIXED: NextAuth maxAge = 7d (matches backend cookies); axios interceptor on 401 clears auth + redirects to role login with `?redirect=`; auth endpoints exempt (loop guard). |
| 10 ✅ | Cart has no auth middleware → never bound to an account; `removeItem` failure wipes the visible cart. | FIXED: `optionalCustomerAuth` on cart routes; `POST /cart/merge` folds guest cart into account on login (price/stock re-validated); `removeCartItem` null-safe. |
| 11 ✅ | Delivery agent sees blank customer phone (reads `customer.phone`, registration never collects it). | FIXED: dashboard reads `shippingAddress.phone` (tap-to-call); registration collects phone + state + pincode with server validation. |
| 12 ✅ | "You'll receive a confirmation email" — `sendOrderStatusEmail` never called. | FIXED: wired at payment-confirmed, admin status change, and agent status change (try/caught, never blocks the request). |
| 13 ✅ | Price sort silently dead on `/products` + `/search` (`ALLOWED_SORT` lacks `variants.0.price`). | FIXED: `/products` sends `variants.0.price`; search allow-list extended. |
| 14 ✅ | Cart `updateItem`/`clearCart` swallow all errors (`catch {}`). | FIXED: rollback + `getApiError` toast on all three cart mutations. |
| 15 ✅ | Pending agent's legitimate login counts as a failed attempt, ×2 via the double-login bug → 15-min lockout after 3 tries. | FIXED: pending/rejected status blocks no longer increment the counter. (Analysis: the double-trip only occurs on *successful* logins, which clear the counter — wrong passwords throw before the second trip. Auth families deliberately NOT unified: the browser POST is what sets the cookie; NextAuth's server-side fetch cannot.) |
| 16 ✅ | `agent:status_updated` emits to a room the pending agent (not logged in) can never join. | FIXED: dead pre-approval emits removed; email is the pre-approval channel. Admin assignment now emits `order:status_updated` 'shipped' to the customer. |
| 17 ✅ | "picked" regresses order `shipped → processing`, visible to the customer. | FIXED: `picked` maps to `'shipped'`; forward-only transitions. |
| 18 ✅ | Hardcoded homepage categories/stats/testimonials; `page.tsx` categories can 404 against real DB. | FIXED: categories from `GET /categories` with skeleton loading; fabricated stats row + testimonials deleted. |

### P2 — dead controls & patterns — ✅ DONE 2026-09-05 (2 deferrals noted)
| # | Gap | Fix / acceptance |
|---|---|---|
| 19 ✅ | Admin product/order "Eye" preview links bounce to `/admin` (middleware role confinement). No admin order-detail view exists. | FIXED: admins keep read access to `/products` `/categories` `/search` `/about`; customer-account surfaces still bounce. Orders Eye toggles a row-detail expansion (customer, items, address, total) via a DataTable `ActionContext`. (Full order-detail page deferred to feature work.) |
| 20 ✅ | Product Share button has no onClick; wishlist hearts are local-only (no API). | FIXED: `navigator.share` + clipboard fallback; `GET/POST/DELETE /customer/wishlist` + `useWishlist()` hook with optimistic toggles and guest sign-in prompt. |
| 21 ✅ | Admin orders select permanently disabled after failed update (`updatingId` never reset in `onError`). | FIXED (landed with P0 Task 1): `onError` resets `updatingId` + passes the server message. |
| 22 ✅ | "Register Admin Account" link unreachable for non-admins; first admin only via seed. | FIXED: link renders only for signed-in admins (server-side `auth()` check). Seed bootstrap documented. |
| 23 ✅ | Customers page shows Active/Suspended with no control. | FIXED: `PATCH /admin/customers/:id/status` + suspend/activate toggle with real query-key invalidation. |
| 24 ✅ | `GET /delivery/orders/:id` and Wishlist model unreachable; `comparePrice`/`specifications`/`displayOrder` have no inputs. | PARTIAL by design: wishlist API built (above); `displayOrder` + `comparePrice` inputs added. **Deferred:** delivery-order-detail consumer and `specifications` editor → feature work. |
| 25 ✅ | Form library split: all auth forms + 2 admin forms hand-rolled. | FIXED: AuthForm (all 6 auth pages), admin categories, admin profile → rhf+zod with inline adaptive errors. |
| 26 ✅ | Query-key drift (`['admin-products']` vs `['admin','products']`). | FIXED: all flat keys converted to tuples; invalidation cascades. |
| 27 ✅ | Double-polling (10s refetch + 20s layout invalidation) with `refetchIntervalInBackground`. | FIXED: single 60s backstop, background polling off, layout intervals deleted. |
| 28 ✅ | Category manager fetches `isActive:true` only — deactivated categories unmanageable. | FIXED: `includeInactive=true` for admin with cache-key split (public cache never poisoned). |
| 29 ✅ | Server messages discarded in most catches; Zod `errors` key unread. | FIXED across the surfaces touched (cart, wishlist, suspend, invoice, forms): `getApiError` pass-through everywhere; adaptive field errors via rhf+zod. |

### P3 — dishonest data (delete or wire) — ✅ DONE 2026-09-05
~~`MOCK_ACTIVITY` "Security & Activity Log"~~ deleted · ~~hardcoded `change={12/8/5}` deltas~~ deleted (no real period data exists — chips removed, not faked; StatsCard is now tri-state with retry) · ~~fake LIVE badge~~ now honest "SYNC" + 60s tooltip · ~~delivery "Verified by Admin" unconditional~~ status-conditional (approved/pending/rejected, icon+text) · ~~"Delivered Today" counting current page~~ dedicated stats fetch, today-scoped for real · ~~"Awaiting Approval" showing 0 off-tab~~ reads the pending query unconditionally · `getStatusColor` ~~missing 5 statuses~~ all mapped (approved/rejected/assigned/picked/attempted) + StatusBadge icons · ~~false Sentry comment~~ corrected · ~~`grid-cols-4` with 3 cards~~ grid-cols-3. **Also fixed en route:** `DeliveryAssignment` enum lacked `out_for_delivery` (mongoose rejected the save → that status option 500'd); dashboard status list gains display-only `assigned` (new assignments no longer render as "picked").

### P4 — polish & consistency — ✅ DONE 2026-09-05 (1 moot, 2 noted)
Analytics skeleton wired (isLoading was destructured-unused) · RevenueChart + bar chart empty/error states · ~~invoice `alert()`s~~ toasts (the last in the app) · ~~`confirm()` category delete~~ ConfirmDialog · DataTable: 300ms debounced search + below-lg mobile card view + **real server-side sort** (allow-listed sort params added to the three admin endpoints; client-side one-page sort deleted; headers are buttons with `aria-sort`) · toast queue rewrite (per-toast timers, max 3, aria-live) · `/products` `/search` `/categories/[slug]` windowed pagination with prev/next (pages 11+ reachable) · ~~hero stat row wraps at 360px~~ MOOT — the fabricated stats row was deleted in P1 · `transition-all` purged (39 sites → specific properties) · skeleton shimmer → opacity pulse · admin single-scroll restructure (was nested overflow fighting iOS) · mega-menu viewport clamp · dead deps purged (react-dropzone, react-image-crop, date-fns, cva, @sentry/nextjs — 186 packages) · ~~non-functional Playwright workflow~~ deleted · `error.tsx` ~~`btn-glow`~~ → `btn-primary` · about-page dead link → `/customer/register` · unused imports swept · per-page admin `loading.tsx` ×6 · `not-found.tsx` with browse/home CTAs. **Noted, not blocking:** admin layout restructure is the one structural layout change — verify on a real iOS device; backend has no test runner yet (unit tests are frontend-only).

> **All 43 rows closed.** Standing environment caveat: `UPSTASH_REDIS_REST_URL` in `.env` must be updated to a live database before any live smoke test — every API request 500s until then (global rate limiter).

### Done-definitions (apply per item)
- Build passes (`npm run build` in `frontend/`).
- The acceptance criterion in the row is demonstrably true in the running app.
- No new hex values, no new violet steps, no layout-property animations (§2).
- The tri-state (loading/error/empty) exists for any new query.
- Mobile 375px verified for any layout change.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 9. AGENT OPERATING RULES
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Read the file before editing it.** This doc's citations age; the code is ground truth. If code contradicts this doc, fix the doc alongside the code.
2. **`.env` values are final.** Never regenerate secrets. Never expose server-side env to the client bundle.
3. **Three JWT secrets, three cookies** — `JWT_SECRET_ADMIN` / `JWT_SECRET_CUSTOMER` / `JWT_SECRET_AGENT`, cookies `nexmart_{admin|customer|delivery}_session`. Role value in payloads is `'agent'` for delivery (not `'delivery'`).
4. **No mock data.** Ever. For any demo, wire the real endpoint.
5. **Mobile-first 375px; a11y floor §7 is not optional; reduced-motion is a hard gate.**
6. **Money is `Intl.NumberFormat('en-IN')`. Phone is 10-digit Indian mobile.**
7. **Scope discipline:** storefront motion vocabulary never leaks into admin/delivery/checkout; admin table density never leaks into the storefront.
8. **When finishing P0-P4 items, update the roadmap table** — strike the row and note the date. The roadmap is the doc's living tail.
9. **Never "unify" the two auth route families or remove NextAuth without a migration plan** — the hybrid is load-bearing for both cookie sets.
10. **Error responses never leak internals** (stacks, ObjectIds, route paths, SDK text); client never discards the server's user-appropriate message.

---

*NexMart CLAUDE.md v3.0 — "Deep-Space Kinetic Editorial"*
*Grounded in a full-code audit (frontend 89 components, backend 4.6k LOC) and Baymard / WCAG 2.2 / web.dev research, 2026-09.*
*Seed admin: debmalyobarman2003@gmail.com · Admin secret: ADMIN_SECRET_KEY in .env*
