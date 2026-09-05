# Changelog

All notable changes to NexMart are documented here, newest first.
Format follows [Keep a Changelog](https://keepachangelog.com/); work is grouped by remediation wave as defined in `CLAUDE.md` §8.

---

## 2026-09-05 — P3+P4: dishonesty purge + polish (in progress)

**Removed (no-fic rule, CLAUDE.md §0.2):** fabricated `MOCK_ACTIVITY` "Security & Activity Log", hardcoded dashboard trend deltas, fake "LIVE" sync badge (now honest "SYNC" with polling tooltip), unconditional "Verified by Admin" pill, per-page delivery stat counts.

**Fixed:** `getStatusColor` missing `approved/rejected/assigned/picked/attempted`; StatusBadge renders icon+text+color; analytics skeletons + chart empty states; admin delivery "Awaiting Approval" total stuck at 0 off-tab; `grid-cols-4` with 3 cards; mega-menu overflow at `lg`; admin nested-scroll iOS fight; `transition-all` purge; skeleton shimmer repaint.

**Added:** windowed pagination on `/products`, `/search`, `/categories/[slug]` (prev/next, pages 11+ reachable); mobile card view + debounced search in admin DataTable; toast queue rewrite (per-toast timers, max 3, pause-on-hover, aria-live); `not-found.tsx`; per-page admin `loading.tsx` skeletons; dead dependency purge.

**Docs:** README rewritten to match reality (BullMQ/Twilio/Syne claims removed); this changelog + `CONTRIBUTING.md` added.

## 2026-09-05 — P2: dead controls & patterns (rows 19–29)

- **Admin preview:** admins keep read access to storefront browse routes (middleware allow-list); orders Eye toggles a row-detail expansion via a new DataTable `ActionContext`.
- **Wishlist + Share:** real `GET/POST/DELETE /customer/wishlist` against the previously-unreachable Wishlist model, `useWishlist()` hook with optimistic toggles; `navigator.share` + clipboard fallback on the previously-dead Share button.
- **Suspend control:** `PATCH /admin/customers/:id/status` + toggle on the users table.
- **Register link:** renders only for signed-in admins (was a dead link logged-out).
- **Sync:** tuple query keys everywhere; double-polling (10s + 20s) collapsed to one 60s background-off backstop.
- **Categories:** admin sees inactive categories (cache-key split, public cache never poisoned); `displayOrder` + `comparePrice` inputs added; `confirm()` → `ConfirmDialog`.
- **Forms:** AuthForm (6 auth pages), admin categories, admin profile → react-hook-form + zod with inline adaptive errors.
- **Feedback idiom:** last `alert()`s (invoice download) replaced with toasts; detail-page handler no longer an unhandled rejection.

## 2026-09-05 — P1: silent failures & misinformation (rows 9–18)

- **Session:** NextAuth JWT aligned to backend cookie TTL (7d); axios 401 interceptor clears auth + redirects to role login (killed the day-7–30 dead zone where panels rendered empty states as data).
- **Cart:** `optionalCustomerAuth` binds carts to accounts; `POST /cart/merge` folds guest cart into account on login; null-safe remove; all cart mutations roll back with error toasts.
- **Registration:** collects phone/state/pincode with server validation (default address was schema-invalid).
- **Emails:** `sendOrderStatusEmail` wired at payment-confirmed, admin status change, agent status change.
- **Sort:** price sorting works on `/products` + `/search`.
- **Lockout:** pending/rejected agent logins no longer count as failed attempts.
- **Sockets:** dead pre-approval emits removed; assignment emits `shipped` to the customer; `picked` maps to `shipped` (was regressing orders to `processing`).
- **Delivery:** dashboard reads `shippingAddress.phone` with tap-to-call (was the always-empty `customer.phone`).
- **Homepage:** categories from the API (was hardcoded, slugs could 404); fabricated stats/testimonials deleted.

## 2026-09-05 — P0: production-breaking bugs (rows 1–8)

- **Payment:** verification now calls the real route (`POST /orders/:id/payment/verify` via `paymentVerifyPath()`) — was 404ing after the customer paid, never clearing the cart, double-order risk; modal lifecycle honest (button disabled through payment, ondismiss feedback).
- **Admin orders:** per-route auth replaces router-wide `protectCustomer` — status changes worked again; COD orders deliverable.
- **UI:** 19 dead Tailwind opacity classes (`/3 /4 /6 /7 /8`) → bracket values (nav pill, search focus, sidebar hovers were invisible).
- **Fonts:** all three families via `next/font`; render-blocking Google `@import` deleted; phantom `font-outfit`/`font-inter` classes defined.
- **Sockets:** canonical event names (`SOCKET_EVENTS`), authenticated handshake via NextAuth session token, singleton rebuild on auth change, listener cleanup fixed.
- **Reviews:** `GET/POST /products/:id/reviews` (was 404; one-per-customer, verified-purchase badge).
- **Google OAuth:** "Continue with Google" rendered on customer auth (was configured but unreachable).
- **Motion scope:** Lenis + custom cursor + navbar scoped to storefront; `prefers-reduced-motion` bail-out; conflicting CSS `scroll-behavior` removed.
- **Infra:** vitest added (first unit tests); `error.tsx` lint unblock (`<a>` → `<Link>`).

## 2026-09-05 — CLAUDE.md v3.0

Replaced the v2 aspirational spec (which diverged from the real codebase) with a reality-grounded directive: actual routes/collections/auth architecture, the Deep-Space Kinetic Editorial design law, role UX standards, the cross-role interaction contract, motion/performance budgets, WCAG 2.2 floor, and the P0–P4 remediation roadmap. Grounded in a four-agent full-code audit + Baymard/WCAG/web.dev research.

## 9b1e604 — Initial commit

Next.js 15 + Express + MongoDB e-commerce platform, three role portals, Deep-Space design system.
