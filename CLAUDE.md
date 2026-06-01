# 🔍 CLAUDE.md — NexMart Full-System Audit & Fix Directive

> **Purpose:** This is a deep, exhaustive audit and remediation prompt for the NexMart SaaS e-commerce platform. You must analyze the **entire codebase** — frontend, backend, database schemas, authentication flows, animation systems, panel rendering, and role-based access — identify every bug, latency issue, security gap, and logic flaw, and fix all of them in place. This is not a rewrite request; it is a surgical audit-and-patch with zero regressions.

---

## 📋 AUDIT SCOPE

Work through every section below **in order**. For each section:
1. **Analyze** the existing implementation thoroughly.
2. **Document** every bug, issue, or gap found (even minor ones).
3. **Fix** each issue with production-quality code.
4. **Verify** the fix does not break adjacent systems.

---

## ⚙️ ENVIRONMENT — Updated `.env` Source of Truth

The following `.env` is the **canonical, finalized configuration** for this audit. Replace any outdated values in code with these:

```env
# ── DATABASE (MongoDB Atlas) ────────────────────────────────
MONGODB_URI="your_mongodb_uri_here"

# ── REDIS (Upstash) ──────────────────────────────────────────
UPSTASH_REDIS_REST_URL="your_upstash_redis_rest_url_here"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_rest_token_here"
REDIS_URL="your_redis_url_here"

# ── CLOUDINARY ───────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name_here"
CLOUDINARY_API_KEY="your_cloudinary_api_key_here"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret_here"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name_here"

# ── RAZORPAY ─────────────────────────────────────────────────
RAZORPAY_KEY_ID="your_razorpay_key_id_here"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret_here"
NEXT_PUBLIC_RAZORPAY_KEY_ID="your_razorpay_key_id_here"

# ── AUTHENTICATION ────────────────────────────────────────────
AUTH_SECRET="your_auth_secret_here"
NEXTAUTH_SECRET="your_nextauth_secret_here"
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
JWT_SECRET="your_jwt_secret_here"
JWT_SECRET_ADMIN="your_jwt_secret_admin_here"
JWT_SECRET_CUSTOMER="your_jwt_secret_customer_here"
JWT_SECRET_AGENT="your_jwt_secret_agent_here"
JWT_EXPIRES_IN="7d"

# ── EMAIL / SMTP (Brevo) ─────────────────────────────────────
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your_smtp_user_here"
SMTP_PASSWORD="your_smtp_password_here"
SMTP_FROM="NexMart <your_sender_email_here>"

# ── APP ──────────────────────────────────────────────────────
NODE_ENV="development"
PORT="4000"
APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
API_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
CORS_ORIGIN="http://localhost:3000"
SESSION_MAXAGE="2592000"

# ── DELIVERY ─────────────────────────────────────────────────
DELIVERY_JWT_SECRET="your_delivery_jwt_secret_here"

# ── RATE LIMITING ────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS="60000"
RATE_LIMIT_MAX_REQUESTS="100"
PAYMENT_RATE_LIMIT_MAX="10"

# ── SOCKET.IO ────────────────────────────────────────────────
SOCKET_CORS_ORIGIN="http://localhost:3000"

# ── INVOICE STORAGE ──────────────────────────────────────────
INVOICE_STORAGE="cloudinary"
LOG_LEVEL="info"

# ── SEED / ADMIN BOOTSTRAP ───────────────────────────────────
ADMIN_SEED_EMAIL="your_admin_seed_email_here"
ADMIN_SEED_PASSWORD="your_admin_seed_password_here"
ADMIN_SEED_ENABLED="true"

# ── ADMIN 2FA SECRET KEY ─────────────────────────────────────
# Known ONLY to the master admin / owner. Never exposed to the client.
ADMIN_SECRET_KEY="your_admin_secret_key_here"
```

> **MongoDB Network Access:** Atlas is configured to allow `0.0.0.0/0` (all IPs). This is intentional for development. Do not alter connection logic based on IP restrictions.

---

## 🔐 SECTION 1 — AUTHENTICATION ARCHITECTURE AUDIT

### 1.1 — Segregated Auth Routes (CRITICAL)

The application must have **six completely separate auth entry points**, each with its own route, JWT signing secret, session namespace, cookie name, and redirect destination:

| Role | Login Route | Register Route | Post-Login Redirect | JWT Secret |
|---|---|---|---|---|
| Admin | `/admin/login` | `/admin/register` | `/admin` (dashboard) | `JWT_SECRET_ADMIN` |
| Customer | `/customer/login` | `/customer/register` | `/` (storefront) | `JWT_SECRET_CUSTOMER` |
| Delivery Agent | `/delivery/login` | `/delivery/register` | `/delivery/dashboard` | `JWT_SECRET_AGENT` |

**Audit checklist:**
- [ ] Verify each route exists as a distinct Next.js page (not a shared component with a role prop).
- [ ] Verify each route's form submits to the correct backend endpoint (`/api/v1/auth/admin/login`, `/api/v1/auth/customer/login`, `/api/v1/auth/delivery/login`).
- [ ] Verify each backend endpoint signs JWTs with the role-specific secret (`JWT_SECRET_ADMIN`, `JWT_SECRET_CUSTOMER`, `JWT_SECRET_AGENT`).
- [ ] Verify each endpoint stores the session cookie under a **role-namespaced cookie name**: `nexmart_admin_session`, `nexmart_customer_session`, `nexmart_delivery_session`.
- [ ] Verify middleware for `/admin/*` only accepts tokens signed with `JWT_SECRET_ADMIN`.
- [ ] Verify middleware for `/delivery/*` only accepts tokens signed with `JWT_SECRET_AGENT`.
- [ ] Verify that a valid `nexmart_customer_session` token is **rejected** by `/admin/*` middleware even if the JWT is structurally valid.

**Fix if broken:** Implement three separate `authMiddleware` factory functions, each hardcoded to its own secret and role assertion. Never use a single unified middleware that branches on role.

---

### 1.2 — Cross-Role Login Isolation (CRITICAL)

**Rule:** An admin or delivery agent must NEVER be able to authenticate through the customer-facing login/register routes using their original credentials.

**Audit — Customer Route Isolation:**
- [ ] On `POST /api/v1/auth/customer/login` with email+password: query **only** the `customers` collection (or `users` collection filtered by `role: "customer"`). If the email exists but belongs to an admin or delivery agent, return HTTP 403 with message: `"This account is not a customer account. Please use the correct login portal."` Do NOT return 401 (which leaks that the account exists).
- [ ] On `POST /api/v1/auth/customer/register` with email+password: if email already exists in admin or delivery collections, return HTTP 409: `"An account with this email already exists under a different role."` Never create a duplicate.

**Audit — Google OAuth via Customer Route:**
- [ ] When a user authenticates via Google OAuth through the **customer** interface and the returning Google email matches an existing admin or delivery agent account: **do NOT throw an error and do NOT block them**. Instead, silently create a **new, separate customer account** in the `customers` collection using the same email. This customer account is independent — it cannot access admin or delivery panels. The original admin/delivery account is completely unaffected.
- [ ] Verify this Google-OAuth isolation logic is implemented in the NextAuth callback specifically for the `/customer/login` entry point.
- [ ] Verify that the new customer account created this way has `authProviders: ["google"]`, `role: "customer"`, and a note field `createdViaCustomerGoogleOverlap: true` for audit purposes.

**Audit — Admin/Delivery Route Isolation:**
- [ ] On `POST /api/v1/auth/admin/login` or `POST /api/v1/auth/delivery/login`: if the requesting email matches a customer account only, return HTTP 403: `"Access denied. This portal is for authorized personnel only."` Never reveal role details.
- [ ] Verify that a customer JWT token cannot be used to access `/admin/*` or `/delivery/*` routes — middleware must reject it at the signature-secret level (wrong secret = invalid token, not just wrong role claim).

---

### 1.3 — Admin Registration with 2FA Secret Key

**Rule:** After the seeded master admin (`debmalyobarman2003@gmail.com`) logs in, they can register new admins. The registration form at `/admin/register` must require an **Admin Secret Key** as a mandatory field alongside email and password.

**Audit checklist:**
- [ ] The `/admin/register` page has a visible `Admin Secret Key` input field (type: password, never type: text).
- [ ] On form submit, the `adminSecretKey` field is included in the POST body to `/api/v1/auth/admin/register`.
- [ ] The backend endpoint validates: `adminSecretKey === process.env.ADMIN_SECRET_KEY`. If it does not match, return HTTP 403: `"Invalid admin secret key."` No further processing.
- [ ] The `ADMIN_SECRET_KEY` is read exclusively from `process.env` — never stored in the database, never logged, never returned in any API response.
- [ ] The `/admin/register` route is itself protected — only a currently authenticated admin session can access it. An unauthenticated visitor hitting `/admin/register` is redirected to `/admin/login`.
- [ ] The `ADMIN_SECRET_KEY` is never included in any client-side bundle. Verify with `grep -r "ADMIN_SECRET_KEY" frontend/` — result must be empty.

---

### 1.4 — Delivery Agent Registration & Admin Approval Flow

**Rule:** Delivery agents self-register at `/delivery/register` but their account starts as `status: "pending"`. They cannot log in until an admin approves their account.

**Audit checklist:**
- [ ] `POST /api/v1/auth/delivery/register` creates a delivery agent document with `status: "pending"`, `isApproved: false`. Returns HTTP 201 with message: `"Registration submitted. Please wait for admin approval before logging in."` No JWT is issued.
- [ ] `POST /api/v1/auth/delivery/login` checks `isApproved === true` before issuing a JWT. If `isApproved === false`, return HTTP 403: `"Your account is pending admin approval."`.
- [ ] The admin dashboard has a `Delivery Agents` sub-panel under `/admin/delivery` that lists pending agents with an **Approve** / **Reject** button.
- [ ] On approval: set `isApproved: true`, emit a Socket.io event to the agent's socket room if they are connected, and send an approval email via Brevo SMTP.
- [ ] On rejection: delete the agent document (or set `status: "rejected"`) and send a rejection email.
- [ ] No secret key is required for delivery agent registration — only email and password.

---

### 1.5 — Session Persistence & Post-Logout Behavior (CRITICAL)

**Rule:** Browser cache/localStorage may persist UI state, but the **server session must be fully invalidated on logout**. After logout, revisiting a protected route must show the login panel — never the dashboard.

**Audit checklist — Session Invalidation:**
- [ ] On logout (`POST /api/v1/auth/logout`): clear the role-namespaced HTTP-only cookie (`nexmart_admin_session`, `nexmart_customer_session`, or `nexmart_delivery_session`) by setting `maxAge: 0` and `expires: epoch`.
- [ ] Also call `NextAuth signOut()` on the frontend to clear the NextAuth session cookie simultaneously.
- [ ] Verify no `localStorage` or `sessionStorage` key holds the JWT token directly — tokens must only live in HTTP-only cookies, never in JS-accessible storage.
- [ ] After logout, the browser's React Query cache must be cleared (`queryClient.clear()`) so stale dashboard data does not re-render on the next visit.
- [ ] Verify that after logout, navigating to `/admin` redirects to `/admin/login`, not a cached dashboard shell.
- [ ] Verify that Zustand auth store is reset on logout: `useAuthStore.getState().reset()` must be called inside the logout handler.

**Rule — Cache Persistence for UX (Login Panel Memory):**
After logout, when the admin returns to `/admin/login`, the browser should remember the **last used email** (not password) so they don't have to retype it. Implement this as follows:
- [ ] On successful login, store only `nexmart_last_admin_email` in `localStorage` (not the password, not the token).
- [ ] On the `/admin/login` page load, pre-fill the email field from `localStorage.getItem("nexmart_last_admin_email")` if it exists.
- [ ] Same pattern for `nexmart_last_delivery_email` on `/delivery/login`.
- [ ] Customer login does NOT pre-fill (privacy-first for shared devices).

---

### 1.6 — Google OAuth Account Linking Audit

**Audit the following flows end-to-end:**

**Flow A — Email-first, then Google:**
1. User registers at `/customer/register` with `email + password` → `authProviders: ["email"]`.
2. Later signs in via Google OAuth at `/customer/login` with the same email.
3. Expected: accounts merge → `authProviders: ["email", "google"]`, `googleId` populated. Single document in DB.
4. **Audit:** Verify the NextAuth `signIn` callback checks for existing email before creating a new document. If it creates a duplicate instead of merging, fix the callback.

**Flow B — Google-first, then email+password:**
1. User registers at `/customer/register` via Google → `authProviders: ["google"]`, no `passwordHash`.
2. Later tries email+password login with same email.
3. Expected: HTTP 401 with message: `"This account was created with Google. Sign in with Google or set a password from your profile."` A deep-link to `/customer/profile?action=set-password` must be included in the response.
4. **Audit:** Verify the backend checks `authProviders` array before attempting `bcrypt.compare`. If `passwordHash` is null/undefined and request is email+password, return the correct error without proceeding.

**Flow C — Admin/Delivery Gmail used at Customer Google OAuth (Overlap Case):**
1. Admin (`debmalyobarman2003@gmail.com`) uses Google OAuth at `/customer/login`.
2. Expected: a **new, independent customer account** is created for that Gmail in the `customers` collection. Admin account in the `admins` collection is completely untouched.
3. **Audit:** Verify the customer Google OAuth callback does NOT look up the `admins` or `deliveryAgents` collections. It only interacts with the `customers` collection. Any email is valid for a new customer — role segregation is collection-level, not email-level.
4. **Audit:** Verify that this newly created customer account cannot be used to access `/admin` or `/delivery` routes.

---

## 🎨 SECTION 2 — FRONTEND PERFORMANCE & ANIMATION AUDIT

### 2.1 — Application Speed (CRITICAL — "Too Slow" Report)

The application is reported as feeling excessively slow. Conduct a full performance audit:

**Identify and fix all of the following common causes:**

**Bundle Size:**
- [ ] Run `next build --analyze` (install `@next/bundle-analyzer`). Document the total JS bundle size.
- [ ] Identify any component importing a full library when only one function is needed (e.g., `import _ from 'lodash'` instead of `import debounce from 'lodash/debounce'`).
- [ ] Verify all heavy libraries (Three.js, GSAP, Framer Motion) are dynamically imported with `next/dynamic` and `{ ssr: false }` where they are not needed server-side.
- [ ] Verify `framer-motion` is not imported at the root layout level — only in the components that use it.

**React Rendering:**
- [ ] Audit every page-level component for unnecessary re-renders. Use `React.memo`, `useMemo`, and `useCallback` where state changes in a parent should not repaint stable children.
- [ ] Verify the Zustand store is sliced correctly — components should subscribe only to the slices they need, not the entire store object.
- [ ] Verify React Query is not set to `refetchOnWindowFocus: true` globally — this causes visible refetch flashes on every tab switch. Set it to `false` globally and enable selectively only where fresh data is critical.

**Panel & Page Transition Latency:**
- [ ] Audit every panel switch (e.g., admin sidebar navigation, profile tab switching, product category switching). Each transition must complete in under 150ms perceived time.
- [ ] If panels are rendered with `display: none` toggling, replace with CSS `opacity: 0 / pointer-events: none` + Framer Motion `AnimatePresence` so the DOM node stays mounted and does not re-run its data-fetching on every show/hide.
- [ ] For admin dashboard sub-panels (`/admin/products`, `/admin/orders`, etc.): prefetch data using React Query's `queryClient.prefetchQuery` when the admin hovers over the sidebar link, so data is ready before the click completes.
- [ ] Verify the admin layout shell (sidebar, topbar) is rendered as a persistent `layout.tsx` wrapper and **not** remounted on sub-route navigation.

**API Response Times:**
- [ ] Audit all MongoDB queries in the backend for missing indexes. Ensure compound indexes exist for: `{ role: 1, email: 1 }`, `{ role: 1, isApproved: 1 }`, `{ customer: 1, createdAt: -1 }` on the orders collection.
- [ ] Verify all list endpoints (`GET /products`, `GET /orders`) use pagination and never return unbounded results.
- [ ] Verify Upstash Redis is used as a cache layer for frequently read, rarely changed data: category list, featured products, dashboard aggregate stats. Cache TTL: 30 seconds for stats, 5 minutes for categories/products.

**Image Loading:**
- [ ] Verify all `<Image>` components have explicit `width` and `height` or `fill` with a sized parent — missing dimensions cause layout shift and lazy-load delays.
- [ ] Verify Cloudinary `f_auto,q_auto` transformation parameters are appended to all image URLs for automatic format (WebP/AVIF) and quality optimization.
- [ ] Hero section background images/videos must use `priority` prop and `loading="eager"` — they are above the fold and must not lazy-load.

---

### 2.2 — Homepage Animation Bugs & Latency

**Known reported issues:** Homepage animation has bugs and latency. Audit the following:

**GSAP ScrollTrigger:**
- [ ] Verify `ScrollTrigger.refresh()` is called after all fonts and images have loaded (`window.addEventListener("load", ...)`) — if called before layout is complete, pin positions are miscalculated causing jitter.
- [ ] Verify all GSAP animations are wrapped in a `useGSAP()` hook (from `@gsap/react`) or a `useEffect` with a proper cleanup that calls `ctx.revert()`. Missing cleanup causes duplicate animation instances on hot-reload and route re-entry.
- [ ] Verify GSAP `ScrollTrigger` instances are killed on component unmount: `return () => { trigger.kill(); }`.
- [ ] If the hero section uses a pinned scroll sequence: verify the pinned element's height is set explicitly in JS (`gsap.set(hero, { height: window.innerHeight })`) not in CSS percentage — percentage heights cause ScrollTrigger miscalculations on mobile.

**Framer Motion:**
- [ ] Verify `AnimatePresence` is not wrapping static elements that never mount/unmount — unnecessary `AnimatePresence` adds a layout effect on every render.
- [ ] Audit all `motion.div` components for missing `key` props inside lists — missing keys cause Framer Motion to reuse DOM nodes for different items, producing glitchy cross-fade animations.
- [ ] Verify all `initial`, `animate`, and `exit` variants are defined as **static objects** outside the component body (not inline objects) — inline objects are recreated on every render and trigger needless animation restarts.
- [ ] Replace all `transition={{ duration: 0.8 }}` on scroll-reveal animations with `transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}` — 0.8s is perceptibly sluggish for UI transitions. Max 400ms for panel transitions, max 600ms for hero entry animations.

**Navbar Scroll Animation Bugs:**
- [ ] Audit the navbar scroll listener. If it is implemented with a raw `window.addEventListener("scroll", handler)` without `{ passive: true }`, remove it and add `passive: true` — non-passive scroll listeners block the browser's scroll thread.
- [ ] Verify the navbar scroll handler is debounced or uses `requestAnimationFrame` — firing state updates on every scroll pixel causes 60+ re-renders per second.
- [ ] Correct implementation:
  ```ts
  useEffect(() => {
    let ticking = false;
    const handler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  ```
- [ ] Verify the navbar hide/show on scroll direction uses a `useRef` for the last scroll Y position, not `useState` — using state for scroll position triggers React re-renders on every scroll event.

---

### 2.3 — Three.js UI Animation Review

**Audit whether the current Three.js implementation is appropriate for a professional e-commerce platform.**

Conduct the following analysis:

**Performance Assessment:**
- [ ] Measure the GPU/CPU cost of the Three.js scene on a mid-range mobile device (simulate with Chrome DevTools > Performance tab, CPU throttling 4x).
- [ ] If the Three.js scene causes frame drops below 30fps on throttled CPU, it **must be replaced or made optional**. A laggy 3D background is worse than no 3D background for conversion rates.
- [ ] Verify the Three.js canvas has a `willReadFrequently: false` context attribute and uses `antialias: false` on mobile (detect via `window.devicePixelRatio > 1.5` heuristic).

**Appropriateness for E-Commerce:**
Evaluate the current Three.js usage against these criteria and document your findings:

| Criterion | Acceptable Use | Unacceptable Use |
|---|---|---|
| Location | Hero section only, above the fold, as a brand statement | Full-page background on product catalog or checkout |
| Performance | Renders at 60fps on desktop, degrades gracefully on mobile | Drops below 30fps on mid-range devices |
| Content relevance | Abstract brand geometry, product showcase in 3D, interactive particle brand logo | Generic space/star-field unrelated to the brand |
| Fallback | Static image fallback when WebGL is unavailable | Blank screen or error when WebGL unavailable |
| Load impact | Scene assets under 500KB, lazy-loaded after LCP | Blocks LCP, adds >1MB to initial load |

**Decision rule:** If the Three.js implementation fails two or more of the above criteria, replace it with a GSAP + CSS-based hero animation that achieves equivalent visual impact at a fraction of the GPU cost. Document your decision.

**If keeping Three.js:**
- [ ] Wrap the Three.js canvas in `next/dynamic` with `{ ssr: false }`.
- [ ] Add a `<Suspense>` boundary with a static image fallback.
- [ ] Implement `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — never render at 3x on high-DPI displays.
- [ ] Implement `renderer.dispose()` and scene cleanup in the component's cleanup function.

---

### 2.4 — Interactive Glow Effects & Cursor Interactions

Implement the following across the entire application:

**Custom Cursor:**
- [ ] Replace the default OS cursor with a custom cursor on desktop (skip on mobile — `@media (pointer: coarse)`).
- [ ] Default state: small filled circle (12px), brand primary color, slight lag behind mouse using GSAP `lerp`.
- [ ] Hover state on interactive elements (buttons, links, product cards, navbar items): cursor expands to 40px, changes to a ring/outline style, background element subtly scales up (1.02).
- [ ] Hover state on product images: cursor shows a "View" label inside the ring.
- [ ] Drag state on carousels: cursor changes to a ↔ drag icon.
- [ ] Implementation: use a single global `<CustomCursor />` component in `layout.tsx`, driven by a `mousemove` listener with `requestAnimationFrame` and GSAP `quickSetter` for zero-lag DOM updates.

**Glowing Effects:**
- [ ] **Button glow**: all primary CTA buttons (Add to Cart, Buy Now, Login, etc.) have a `box-shadow` glow animation on hover using the brand's primary color at 40% opacity. Use CSS `transition: box-shadow 200ms ease`.
- [ ] **Card glow**: product cards have a subtle radial gradient that follows the cursor position within the card (CSS `background: radial-gradient(circle at var(--x) var(--y), rgba(accent, 0.15), transparent 60%)`). Update `--x` and `--y` CSS variables on `mousemove` within each card.
- [ ] **Input glow**: form inputs on login/register pages glow with the brand primary color on focus (`box-shadow: 0 0 0 3px rgba(primary, 0.3)`).
- [ ] **Navbar link glow**: active and hovered navbar links have a bottom-border glow using `filter: drop-shadow(0 2px 4px rgba(primary, 0.6))`.
- [ ] **Admin sidebar**: active menu items have a left-border glow strip + a subtle background gradient.

---

## 🛠 SECTION 3 — BACKEND AUDIT

### 3.1 — API Error Surface Audit

Audit every backend route handler for the following classes of bugs:

**Unhandled Promise Rejections:**
- [ ] Verify `express-async-errors` is installed and required at the top of the entry file (`require("express-async-errors")`). Without this, async errors in route handlers crash the process silently.
- [ ] Verify the global error handler is the **last** middleware registered: `app.use(globalErrorHandler)`.
- [ ] The global error handler must never send stack traces to the client in production (`NODE_ENV === "production"`).

**Input Validation Gaps:**
- [ ] Every route that accepts a request body must validate with Zod before touching the database.
- [ ] Every route that accepts URL params (`:id`, `:slug`) must validate that `:id` is a valid MongoDB ObjectId before querying (`mongoose.isValidObjectId(id)`). Without this, passing `"undefined"` or `"null"` as an ID causes a Mongoose CastError that may leak stack traces.
- [ ] Audit all query parameters for type coercion — `page` and `limit` must be parsed as integers with `parseInt` and clamped (`limit = Math.min(parseInt(limit) || 20, 100)`).

**Race Conditions:**
- [ ] Order creation: verify a MongoDB session/transaction wraps the sequence of (1) stock decrement, (2) order document creation, (3) Razorpay order creation. If step 3 fails, steps 1 and 2 must be rolled back atomically.
- [ ] Profile email change: verify the uniqueness check and the update happen inside a transaction so two concurrent requests cannot both claim the same email.

**Data Leakage:**
- [ ] Verify no API endpoint returns `passwordHash`, `JWT_SECRET`, `ADMIN_SECRET_KEY`, or any internal system field to the client. Apply a Mongoose transform or a Zod response schema to strip sensitive fields before serialization.
- [ ] Verify the user list endpoint (`GET /admin/users`) does not return `passwordHash` fields even for admin consumers.

---

### 3.2 — Database Schema Audit

**Check every Mongoose schema for:**

- [ ] **Missing indexes**: add if not present:
  - `User`: `{ email: 1 }` unique, `{ role: 1 }`, `{ role: 1, isApproved: 1 }` (for delivery agents)
  - `Order`: `{ customer: 1, createdAt: -1 }`, `{ razorpayOrderId: 1 }` unique sparse, `{ orderStatus: 1 }`
  - `Product`: `{ slug: 1 }` unique, `{ category: 1, isPublished: 1 }`, text index on `{ name: "text", tags: "text" }`
  - `OtpRecord`: TTL index on `expiresAt` field (`expireAfterSeconds: 0`) so expired OTPs are auto-deleted by MongoDB
- [ ] **Schema validation**: verify `required: true` is set on all non-optional fields. Missing required validators allow partial documents to be saved silently.
- [ ] **Virtuals & toJSON**: verify all schemas have `{ toJSON: { virtuals: true, transform: (doc, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } } }` to auto-strip sensitive fields on serialization.

---

### 3.3 — Auto-Sync (Admin & Delivery Panels Only)

**Rule:** Admin and delivery dashboards must auto-refresh every **20 seconds**. Customer-facing pages must NOT auto-refresh (reduces unnecessary API load).

**Audit checklist:**
- [ ] In the admin layout (`frontend/app/admin/layout.tsx`), a global polling interval is set up:
  ```ts
  // In admin layout — runs for all admin sub-pages
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    }, 20_000);
    return () => clearInterval(interval);
  }, []);
  ```
- [ ] Verify the `queryKey` hierarchy uses `["admin", ...]` as a prefix for all admin queries so a single `invalidateQueries({ queryKey: ["admin"] })` call refreshes all admin data at once.
- [ ] Same pattern for the delivery layout with `["delivery", ...]` prefix.
- [ ] Verify no polling interval is set in any customer-facing page or layout.
- [ ] Socket.io real-time events (order updates, new orders) still function independently of the 20-second poll — the poll is a fallback, not the primary sync mechanism.

---

### 3.4 — Admin & Delivery Feature Implementation Audit

**Check that the following features are fully implemented, not stubbed or partially built:**

**Admin Dashboard (`/admin`):**
- [ ] Revenue chart: total revenue (last 7 days, 30 days, 90 days) with period toggle. Data from `/api/v1/admin/analytics/revenue`.
- [ ] KPI cards: Total Orders, Pending Orders, Delivered Orders, Total Customers, Total Products, Low Stock Alerts (< 10 units).
- [ ] Real-time order notification: when a new order is placed, a toast notification appears on the admin dashboard without a page refresh.
- [ ] Recent orders table: last 10 orders with Order ID, Customer Name, Total, Status, and a "View" quick-action.

**Admin Orders (`/admin/orders`):**
- [ ] Full paginated order list with filters: status, date range, payment method.
- [ ] Bulk status update: checkbox multi-select + dropdown to update status for all selected orders.
- [ ] Per-order status dropdown: changing status emits `order:status_updated` Socket.io event immediately.
- [ ] Status change is reflected on the customer's order detail page in real-time (Socket.io listener).

**Admin Products (`/admin/products`):**
- [ ] Product list with inline stock count display and a red badge when stock < 10.
- [ ] Create product: dynamic form that changes field set based on selected category (category spec templates from DB).
- [ ] Edit product: all fields editable, image reorder, variant management.
- [ ] Delete product: soft-delete (set `isPublished: false`) with a confirmation modal.
- [ ] Bulk publish/unpublish.

**Admin Delivery Management (`/admin/delivery`):**
- [ ] Pending agent approvals list with Approve/Reject actions.
- [ ] Active agent list with current assignment count.
- [ ] Order assignment: drag-and-drop or dropdown to assign an order to an agent.
- [ ] Auto-email notification to agent on assignment (Brevo SMTP).

**Delivery Agent Dashboard (`/delivery/dashboard`):**
- [ ] List of assigned orders, sorted by delivery date, filterable by status.
- [ ] Status update per order: `Picked Up` → `Out for Delivery` → `Delivered` / `Attempted Delivery`.
- [ ] Each status update POSTs to `/api/v1/delivery/orders/:id/status` and emits a Socket.io event.
- [ ] Customer receives real-time status update on their order detail page.
- [ ] Agent cannot see or access orders not assigned to them (server-side query filtered by `deliveryAgent: agentId`).

---

## 🔒 SECTION 4 — SESSION SECURITY DEEP AUDIT

### 4.1 — Cookie Security Flags
- [ ] All session cookies must be set with: `httpOnly: true`, `secure: true` (in production), `sameSite: "lax"`, `path: "/"`.
- [ ] In development (`NODE_ENV === "development"`), `secure: false` is acceptable but `httpOnly: true` must always be on.
- [ ] Verify no session token appears in `localStorage`, `sessionStorage`, or as a URL query parameter anywhere in the codebase.

### 4.2 — CSRF Protection
- [ ] Verify `sameSite: "lax"` on cookies provides baseline CSRF protection.
- [ ] For state-mutating endpoints (POST, PATCH, DELETE), verify the backend checks the `Origin` or `Referer` header against `process.env.CORS_ORIGIN`.

### 4.3 — Rate Limiting on Auth Endpoints
- [ ] `/api/v1/auth/*/login`: max 5 failed attempts per IP per 15 minutes. On 5th failure, return HTTP 429 and lock the IP for 15 minutes (store in Upstash Redis).
- [ ] `/api/v1/auth/*/register`: max 3 registrations per IP per hour.
- [ ] OTP send endpoints: max 3 OTP requests per email per 10 minutes.

### 4.4 — JWT Expiry & Refresh
- [ ] All JWTs expire in `7d` (from `JWT_EXPIRES_IN`).
- [ ] Verify there is a `/api/v1/auth/refresh` endpoint that issues a new JWT if the existing one is valid and not expired. This prevents users from being kicked out mid-session.
- [ ] Verify the refresh endpoint also uses the role-specific secret for verification.

---

## 🎯 SECTION 5 — ROLE INTERFACE VERIFICATION

Verify that each role sees **only** its intended interface and cannot navigate to another role's interface by any means (direct URL, back button, browser history):

### Admin Interface
- [ ] After login, admin lands on `/admin` (dashboard).
- [ ] Typing `/customer/login` or `/delivery/login` in the address bar while logged in as admin redirects to `/admin` with a toast: `"You are logged in as admin."`.
- [ ] Admin cannot access `/cart`, `/checkout`, or any customer storefront route (these require `nexmart_customer_session`).
- [ ] The admin profile panel shows: Admin Dashboard quick-link, Role badge (`Admin`), Activity log. Does NOT show: saved addresses, order history, wishlist.

### Customer Interface
- [ ] After login, customer lands on `/` (storefront).
- [ ] Typing `/admin` or `/admin/login` redirects to `/customer/login` with message: `"Access denied."`.
- [ ] The customer profile panel shows: saved addresses, order history, wishlist. Does NOT show: admin dashboard link, delivery assignments.
- [ ] Guest (unauthenticated) can browse the storefront, product catalog, and product detail pages. Cannot access `/cart`, `/checkout`, `/orders`, or `/profile` — redirect to `/customer/login`.

### Delivery Agent Interface
- [ ] After login and approval, agent lands on `/delivery/dashboard`.
- [ ] Agent cannot access `/admin/*` or any storefront routes requiring customer session.
- [ ] Pending (unapproved) agent attempting login sees: `"Your account is pending admin approval."` and is not redirected to any dashboard.

---

## 🧪 SECTION 6 — FULL DYNAMIC FUNCTIONALITY VERIFICATION

Verify the following features are **fully dynamic** (no hardcoded data, no placeholder content, no "coming soon" stubs):

- [ ] Product catalog loads from MongoDB via API, not from a static array.
- [ ] Category mega-menu items load from the categories API, not from a hardcoded list.
- [ ] Homepage "Featured Products" and "Trending" sections are driven by `isFeatured: true` and `ratings.average` fields in MongoDB.
- [ ] Cart state persists across page refreshes for authenticated users (stored in DB) and as a cookie/localStorage for guests (merged on login).
- [ ] Checkout flow calculates totals server-side (subtotal + shipping + tax - discount) — never trust the client's submitted total.
- [ ] Order status tracker on the customer order detail page updates in real-time via Socket.io without a page refresh.
- [ ] Admin product creation form dynamically loads the spec template for the selected category from `/api/v1/categories/:id/spec-template`.
- [ ] Invoice PDF is generated asynchronously (BullMQ job) and the download button polls for completion before enabling.
- [ ] All pagination controls are functional — page 2, 3... return different results, not the same first page.
- [ ] Search filters (price range, category, rating) all correctly narrow results and stack with each other.

---

## 📝 SECTION 7 — AUDIT REPORT FORMAT

After completing all audits and fixes, produce a structured report in this exact format:

```
## NexMart Audit Report

### Bugs Fixed
| # | Location | Bug Description | Fix Applied | Severity |
|---|---|---|---|---|
| 1 | frontend/components/Navbar.tsx | Non-passive scroll listener causing jank | Added { passive: true } flag | High |
| 2 | ... | ... | ... | ... |

### Performance Improvements
| # | Area | Issue | Fix | Impact |
|---|---|---|---|---|
| 1 | Bundle | lodash fully imported | Switched to lodash/debounce | -80KB bundle |
| 2 | ... | ... | ... | ... |

### Security Fixes
| # | Endpoint / File | Vulnerability | Fix | Risk Level |
|---|---|---|---|---|
| 1 | /api/v1/auth/customer/login | Admin credentials accepted at customer endpoint | Added collection-scoped role check | Critical |
| 2 | ... | ... | ... | ... |

### Features Completed / Stubbed Items Fixed
| # | Feature | Was | Now |
|---|---|---|---|
| 1 | Delivery agent approval | UI present, API missing | Full CRUD API + email notification |
| 2 | ... | ... | ... |

### Three.js Decision
Decision: [Keep / Replace]
Reason: [...]
If replaced: [Describe the GSAP/CSS alternative implemented]

### Remaining Known Issues (Not Fixed — Requires External Action)
| # | Issue | Reason Not Fixed |
|---|---|---|
| 1 | ... | ... |
```

---

## ⚠️ ABSOLUTE CONSTRAINTS

These rules must never be violated during any fix:

1. **Never expose `ADMIN_SECRET_KEY` to any client-side code or API response.**
2. **Never store JWT tokens in `localStorage` or `sessionStorage` — HTTP-only cookies only.**
3. **Never use a single shared auth middleware for all roles — each role has its own middleware with its own secret.**
4. **Never allow an unapproved delivery agent to receive a JWT or access the delivery dashboard.**
5. **Never remount the admin or delivery layout shell on sub-route navigation — it must be a persistent `layout.tsx`.**
6. **Never return `passwordHash` or any secret env variable in an API response.**
7. **Never make unbounded MongoDB queries — all list queries must have `limit` applied.**
8. **Never use `setInterval` for polling in customer-facing pages — only in admin and delivery layouts.**
9. **All animation cleanup functions (GSAP `ctx.revert()`, `trigger.kill()`, Framer Motion) must run on component unmount.**
10. **The custom cursor must be disabled on touch/mobile devices (`@media (pointer: coarse)`).**