# Changelog

All notable changes to NexMart are documented here, newest first.
Format follows [Keep a Changelog](https://keepachangelog.com/); work is grouped by remediation wave as defined in `CLAUDE.md` §8.

---

## 2026-09-11 — stabilization review of the responsive/motion/reliability wave

A quality review of the uncommitted responsive-motion-reliability working set (37 files + 8 new) found defects the wave's own verification gates missed; all fixed and live-verified. Plan: `docs/superpowers/plans/2026-09-10-responsive-motion-stabilization.md`.

**Security (verified live):**

- **Registration/OTP enumeration oracles closed.** The wave's 202-masking left live oracles: `verify-otp` returned 400 for a wrong code on an existing account but 202 for an unknown email (existence proof); `resend-otp` returned 200 "code sent" for existing unverified accounts but 202 otherwise (direct existence check + email-bomb trigger); `register` ran field validation *after* the existence checks (invalid phone + 400 ⇒ email free, 202 ⇒ exists) and paid bcrypt cost (~200 ms) only on the new-account path (timing side channel). Now: every branch of each handler answers identically (unified 400 for verify misses, opaque 202 everywhere else), validation runs before existence checks, the hash is unconditional for timing parity, and the resend rate limit is consumed before the lookup so even a 429 leaks nothing. A returning user with an expired code who re-registers now genuinely receives a new OTP (same opaque 202 response).
- **Plaintext OTP persistence fixed.** "Clear OTP" used `$set` with `undefined` values — a mongoose no-op, so the raw OTP and expiry stayed on the customer document for its lifetime, and `GET /admin/customers` (which only excluded `password`) returned every customer's OTP to the admin UI. Now `$unset`, and the admin listing excludes `otp`/`otpExpiry`.
- **Featured-products cache poisoning closed.** The shared `nexmart:products:featured` cache keyed on `featured=true&limit=8` regardless of other filters — any filtered request (`&category=x`, `&brand=y`) silently overwrote the homepage grid for the whole 5-min TTL. The key now applies only to the exact homepage query shape (no other filters, default page).
- **CSRF gate no longer unthrottled.** It ran before every rate limiter, so mismatched-origin POSTs got unlimited 403s plus a warn log each (log-flood / disk-exhaustion vector). `generalLimit` now mounts ahead of the CSRF gate (after the HMAC-authenticated webhook route), and blocked probes log at debug, not warn.

**Production-critical:**

- **Server-side auth fetches could 403 after deploy.** The wave's Origin header was derived from `NEXTAUTH_URL`/`APP_URL`/`NEXT_PUBLIC_APP_URL` — none of which the documented Cloudflare Pages env table sets — falling back to `http://localhost:3000` against `CORS_ORIGIN=https://nexmart.pages.dev`. Every credentials login and Google sign-in would have failed CSRF in production. New `lib/serverApi.ts` (`serverApiFetch`) derives the Origin from the live request host first (NextAuth's `authorize` now receives it), falls back to `headers()` then env; `docs/DEPLOYMENT.md` now lists `NEXTAUTH_URL`. Live-verified: NextAuth login reaches the backend (401 on bad credentials, not 403).
- **Aborted requests left no trace.** The new request-completion log subscribed only to `finish`, so mobile-network dropped connections (the exact failures the correlation log exists for) were never logged. Now `close` with an `aborted` flag. Dev logging also no longer drops the metadata object (winston's dev printf now appends it as JSON).

**Correctness & UX:**

- Delivery status-update errors now surface the server message (the shared transition guard's "cannot move from delivered → picked" explanation) instead of a hardcoded "Update failed"; admin orders uses `getApiError` for the same. `getApiError` itself now prefers the specific zod field message over the generic "Validation error" envelope message.
- The hero SearchBar's results dropdown was clipped by the hero section's `overflow-hidden` (input sits near the section's bottom edge) — section-level clip removed (main still clips horizontally).
- `--navbar-height` 64px mobile override vs the hardcoded 72px navbar clipped 8px of content under the bar on mobile — the navbar now consumes the variable.
- Wishlist hearts: saved state is again visible at a glance (hover-reveal applies only to the unsaved state); touch devices unaffected.
- WebGL hero low-power gate relaxed from ≤4 cores (excluded common quad-core laptops, beyond the documented mobile+reduced-motion policy) to ≤2 cores / ≤2 GB.
- Tab buttons got proper `role="tab"`/`role="tablist"` (aria-selected on a plain button is invalid ARIA).
- Suspend-customer ConfirmDialog gained modal semantics (Escape, scroll-lock, `role="dialog"`) and a viewport-safe width.
- `/?category=slug` and `/search?category=slug` resolve through one shared `resolveCategoryFilter` (were duplicated 12-line blocks that could diverge); verified live: slug and ObjectId return identical totals.
- Rate-limiter 429s now carry `code: 'RATE_LIMITED'` (was the default `INTERNAL_ERROR`).

**Shared components / dead code:**

- New `QueryError` component (the CLAUDE.md §5.2 error branch) replaces six hand-rolled per-page copies; `useDrawerBehavior` (scroll-lock + Escape) replaces three copy-pasted/duplicated drawer effects and now also covers the CartDrawer, which had neither. One error envelope: `sendError` gained an optional `errors` param and is now the single builder (errorHandler's private `sendFailure` and app.ts's hand-rolled CSRF body removed). `escapeRegExp` deduplicated out of the Cloudinary parser.
- Removed: dead `deliveryAgent` Order index (no query filters Order by that field — pure write overhead), unused `pulse-glow`/`float`/`shimmer`/`confetti`/`slide-*`/`spin-slow` animation config, orphaned `.card-glow-*` CSS, the `useScrollDirection` hook (last consumer was removed in this wave), and the `morgan`/`@types/morgan` dependencies.

**Verification:** backend `tsc` + 59 vitest tests + 0 lint errors; frontend production build + 5 vitest tests + 0 lint errors (one pre-existing hooks warning in admin/categories remains); live smoke: health/ready, CSRF reject with unified envelope, both enumeration probes identical, cache-poison probe leaves the homepage list intact, slug↔ObjectId parity, NextAuth server-side login round-trip.

---

## 2026-09-07 (evening) — second full-platform audit + 7 fixes (C1–C7)

A second live audit (102-check regression harness + socket/webhook/reaper/security probes) found 7 new issues; all fixed the same evening via TDD (56 backend tests, 6 new test files), live re-verified, test data deleted, DB restored to baseline. Full report: `docs/AUDIT-REPORT-2026-09-07-evening.md`. Reusable harnesses: `backend/audit-*.js`.

**Critical:**

- **C1 — Google OAuth account takeover.** `POST /auth/google/callback` trusted raw `{googleId, email, name, picture}` from the request body — a forged POST with any victim email returned a working customer token (bypassing email verification and issuing tokens for suspended accounts). The endpoint now accepts only a Google **ID token**, verified server-side against Google's tokeninfo endpoint (new `services/googleToken.service.ts`: audience must be our OAuth client, email must be verified at Google, fail-closed on any error); suspended accounts are refused; the frontend sends the token instead of raw identity. Live-verified: raw-identity probe → 400, forged token → 401.
- **C2 — the order reaper had never worked.** `fetchOrderPayments` cast Razorpay SDK 2.9.2's `{entity, count, items}` collection object to an array; the sweep's `payments.find()` threw on **every** sweep and the outer try/catch silently swallowed it — abandoned checkouts were never cancelled or restocked, paid-but-unconfirmed orders never reconciled. Fixed (returns `payments.items`), plus per-order error isolation in the sweep (one bad order no longer poisons the cycle). Live-verified: a backdated stale order was auto-cancelled with stock restocked by the sweep.

**High:**

- **C3 — admin/agent cancel & return never restocked** (only the reaper's dead path did). A shared `utils/orderRestock.ts` helper now runs on `cancelled` and `returned` in both the admin and delivery status paths.
- **C4 — failed online payments became zombies** (placed forever, stock leaked, reaper matched only `pending`). The reaper filter now sweeps `pending` AND `failed`; failed orders cancel + restock without a needless Razorpay call.

**Medium:**

- **C5 — delivered COD orders stayed `paymentStatus:'pending'` forever**, making revenue analytics (filter: `paid`) contradict the dashboard's total revenue. Both delivery paths mark COD `paid` on delivery.
- **C6 — refund emails said "Order Cancelled"** for non-cancelled (often delivered) orders. New `refunded` and `returned` email labels; the refund path now tells the truth.
- **C7 — webhook auto-disable root-caused** (the user observed test webhooks dying). Razorpay auto-disables webhooks after 24h of failed deliveries (non-2xx or >5s timeouts); localhost/dead-tunnel URLs guarantee failure. `docs/DEPLOYMENT.md` now documents the full policy and the local-dev strategy: don't create a dashboard webhook for local dev (the fixed reaper is the 15-min backstop; create the durable webhook only once the public Render URL exists).

**Also:** the morning audit's own cleanup had missed one test customer (its marker regex checked `nexmart-audit` with a hyphen while the actual emails use `nexmart.audit.`) — the new marker-driven `audit-cleanup.js` also removes Cloudinary invoice PDFs and Redis rate-limit keys, and caught the leftover. Backend `tsc`, all 56 vitest tests, the full audit harness (102 PASS), and the frontend production build all pass.

---

## 2026-09-07 — full-platform E2E audit + 12 fixes (B1–B12)

A live end-to-end test of every role flow (temp accounts for all three roles, real orders through COD + Razorpay test mode, sockets, webhooks, invoices, security probes), followed by fixes for everything it found. All test accounts and data were deleted afterwards; the DB was verified back to its pre-test baseline (1 pre-existing order, 1 customer, stock 18, 0 reviews).

**High severity (E2E-verified broken → fixed → E2E-verified fixed):**

- **B1 — Cart merge was broken end-to-end.** The frontend posts `{items: [...]}`; the backend schema expected a bare array — every login merge 400'd and the swallowed catch hid it. The schema now accepts exactly the frontend's shape (`utils/validation.ts`), so guest carts really do fold into account carts on login.
- **B2 — Delivery status path had no forward-only guard.** `delivered → picked` was accepted, regressing orders to `shipped` in front of the customer. The transition graph now lives in one shared module (`utils/orderTransitions.ts`) enforced by **both** the admin and delivery paths; same-status repeats (e.g. `picked` once assignment already set `shipped`) are idempotent no-ops that no longer duplicate statusHistory entries.
- **B3 — Customer suspension was cosmetic.** `isActive:false` was never checked — a suspended customer could log in and place orders. Now blocked at login *and* per-request in `protectCustomer` (existing 7-day tokens die immediately); suspended users fall back to guest in the cart's optional auth.
- **B4 — Cross-tenant `paymentStatus` poisoning.** The invalid-signature path in payment verify updated by `razorpayOrderId` alone, so any authenticated customer could mark another customer's paid order `failed`. Now scoped by `customer: userId`.
- **B5 — Password change needed no current password and had no strength policy** (a 1-char password was accepted live). Now requires the current password (bcrypt-verified, server message surfaces in the UI) and the same strength policy as the frontend modal; the PasswordModal gained the Current Password field and passes server errors through.

**Medium/minor:**

- **B6** — rejected agents saw "pending admin approval" (the `!isApproved` check shadowed the rejected branch); rejected is checked first now.
- **B7** — malformed JSON returned **500** with the parser's internal message; now 400 with a clean message.
- **B8** — the 404 handler echoed the route path (violates CLAUDE.md §5.3); now a generic "Resource not found" (the request line stays in morgan logs).
- **B9** — agent registration sat behind the 10/min `authLimit` instead of the 3/hour `registerLimit` the other roles use; aligned.
- **B10** — the empty-cart response advertised a phantom `subtotal: 0` (the Cart model has no subtotal field); removed.
- **B11** — `deleteProduct` orphaned its Cloudinary images forever; deletion now destroys them (strict URL→public_id parser — only our cloud + `nexmart/` tree — verified via the Admin API; delivery URLs may serve from CDN edge cache briefly after deletion).
- **B12** — agent-delivered COD orders never got an invoice (only the admin path and payment-verify queued them); the delivery path queues one on `delivered`.

**Infrastructure:** backend now has a test runner — vitest (`backend/ npm test`, 22 unit tests over the transition graph, merge/password schemas, and the Cloudinary URL parser). TDD'd: watched failing first, then green. Backend `tsc` build, frontend vitest suite, and frontend production build all pass.

**Data hygiene:** the leftover dummy agent `e2e-mtq73szc.agent@gmail.com` (from a previous test session) was removed along with its (zero) assignments.

**Known-open (documented, not fixed):** reviews store HTML unsanitized (inert — zero `dangerouslySetInnerHTML` in the frontend; sanitize server-side before any non-React consumer); `/products?category=<slug>` 400s (frontend sends ObjectIds — latent API wart); registration + OTP-verify responses allow email enumeration; product-form Zod messages still include raw defaults ("String must contain at least 10 character(s)"); `backend npm run lint` references eslint but eslint isn't installed.

**Razorpay config finding (dashboard, not code):** the webhook was created in the dashboard's **normal (live) mode** while the keys are test-mode — test payments will never fire it. The handler itself is production-grade (verified live with signed `payment.failed`/`payment.captured` events + idempotent replay); the order reaper covers the gap (reconciles pending online orders against Razorpay every 15 min). DEPLOYMENT.md now documents creating the webhook in the mode matching your keys.

## 2026-09-06 (later) — the Orbit-N logo mark

Replaced the generic gradient-tile-plus-"N" with an ownable monogram: two bold brand-gradient stems carry the letter **N**, the diagonal becomes a thin violet orbital arc, and an acid-green node travels on it — the homepage hero (wireframe sphere + orbiting rings) miniaturized into a mark. The node is the action color: the product in orbit. Implemented as a scalable SVG (`Logo` component, token colors only) across all seven call sites (navbar desktop + mobile drawer, footer, admin sidebar, delivery header, auth screens, loader) plus a dark-tile `icon.svg` favicon. En route: the last three `gradient-text` (violet→acid, the retired contradictory gradient) uses converted to the brand violet→fuchsia — the codebase now has exactly one gradient.

## 2026-09-06 — stability gap fixes (risk register rows 1–6)

- **Order status transition guard:** forward-only state graph enforced server-side (`placed→confirmed→…→delivered`, cancellation/return as the only exits); invalid moves get a 400 naming the allowed set; re-applying the current status is an idempotent no-op. Verified live.
- **Stale-order reaper + payment reconciliation:** every 15 min, online orders still `pending` 30+ min after creation are reconciled against Razorpay first (paid-but-unconfirmed → confirmed, invoice queued, customer notified) and only then cancelled with automatic restocking. COD orders are never auto-reaped. In-process, crash-safe, bounded to 50/cycle.
- **Admin refunds:** `POST /admin/orders/:id/refund` — full Razorpay refund with idempotency guards (online + paid + has payment ID), history entry, socket + email notification, SDK errors logged server-side only. "Refund payment" button (ConfirmDialog-gated) in the admin order-detail panel. Verified live (non-paid rejection).
- **Real-time role notifications:** admin gets a toast + instant refresh on `order:new` (was 60s-poll only); the delivery agent gets a toast + instant refresh on the new `delivery:assigned` event emitted to their room on assignment.
- **Non-blocking emails:** all three status-email call sites are fire-and-forget — SMTP latency no longer sits in any request path.
- **Webhook-secret boot check:** production boots abort loudly without `RAZORPAY_WEBHOOK_SECRET`; dev logs a warning.

## 2026-09-05 (security incident) — leaked MongoDB Atlas credential rotated

GitHub secret scanning flagged two `mongodb_atlas_db_uri_with_credentials` alerts: pre-squash-history commits (May 17) of `backend/db-cleanup.js` and `backend/migrate-users.js` contained the live Atlas connection string with embedded credentials — same user and cluster as the active `.env` credential, on a public repo with a fork and a 0.0.0.0/0 network rule. Current `main` was already clean (grep-verified; files read from `.env`). Remediated: **database password rotated** in Atlas (verified live — backend serves real data on the new credential), both alerts resolved as `revoked`, and **secret scanning + push protection enabled** on the repository so future pushes containing secrets are blocked at push time. Lesson recorded in CONTRIBUTING: `.env` only, always — the gitignore was correct; the leak predated it.

## 2026-09-05 (final) — Upstash restored + lifetime keep-alive

The deleted free-tier database was replaced with `dynamic-werewolf-100212.upstash.io` (Mumbai region). Verified live: rate limiting counts down per request (X-RateLimit-Remaining 99→98), admin login + protected routes pass the real blacklist check, circuit breaker closed automatically. Added `.github/workflows/redis-keepalive.yml` — a weekly one-command ping (manual dispatch supported) with the URL/token as encrypted repo secrets, so the free tier (500K commands/month) never goes idle and never gets auto-deleted again. Total ongoing cost: ₹0.

## 2026-09-05 (later still) — circuit breaker: dead Upstash costs ~0ms per request

Fail-open removed the 500s but every request still paid a failed Upstash round-trip (rate limiter on all routes, blacklist check on protected ones) — tens of ms with cached DNS failures, up to 2.5s when the DNS cache expired. The Redis client is now wrapped in a Proxy-based circuit breaker: after 3 consecutive failures all calls reject instantly for 30s, then a single half-open probe; success closes the circuit, so recovery is automatic the moment `.env` points at a live database. Measured: request 1 pays the trip, requests 4+ drop ~20ms in the DNS-cached state and are protected from the periodic 2.5s spikes.

## 2026-09-05 (later) — Redis resilience: dead Upstash no longer takes the API down

**Diagnosed:** every `/api/v1/*` request 500'd with `fetch failed` — `.env`'s `UPSTASH_REDIS_REST_URL` host no longer resolves in public DNS (deleted/renamed instance), and the global rate limiter's uncaught Upstash call failed every request (~4.4s DNS timeout, 5 retries with backoff).

**Fixed (fail-open degradation):** all five rate-limiter middlewares, `isTokenBlacklisted`, and the failed-login-attempt helpers now fail open with loud logging — matching the degradation pattern the product/category caches already used. Upstash client calls are bounded at 2.5s with retries disabled; the signal is passed as a **function** (a plain `AbortSignal` makes the client swallow the abort into a fake 200 `"Aborted"` result, which the blacklist check would read as a truthy hit — 401ing everything).

**Security note:** while Redis is unreachable, rate limiting / token revocation / login lockouts are bypassed (logged). Availability over protection for general traffic; update `.env` to a live Upstash database to restore full protection.

**Verified live against the still-dead host:** products, categories, admin login, admin stats, server-side sort, reviews GET, admin order-status PATCH — all 200 with real data.

## 2026-09-05 — P3+P4: dishonesty purge + polish

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
