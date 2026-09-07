# NexMart Full-Platform Audit Report — 2026-09-07 (Evening Run)

> **STATUS: ALL FINDINGS FIXED** — same evening, TDD (56 backend tests, 6 new test files). Live re-verified: reaper sweep acts on a backdated order (cancel + restock), both Google-takeover probes rejected (400/401), full 102-check harness green, DB restored to baseline. See §7 for the fix map.

**Scope:** live E2E against the running API (:4000) — temp accounts for all 3 roles, every feature exercised per role, security probing, webhook signature analysis, Razorpay mode analysis, cross-platform data-flow analysis.
**Method:** `backend/audit-harness.js` (102 checks, all prior B-fix regression) + `backend/audit-harness2.js` (37 checks: live socket tracing, webhook E2E, new flaw probes) + targeted live probes.
**Test data:** created during the run, deleted afterwards, DB verified back at baseline.

---

## 1. Executive summary

| Area | Verdict |
|---|---|
| **Functional (102 checks)** | ✅ **102 PASS / 0 FAIL** — every feature works; every B1–B12 fix holds |
| **Realtime socket flow** | ✅ All 4 live events verified end-to-end (order:new → status_updated ×N → delivery:assigned) |
| **Webhook handler** | ✅ Signature verification, idempotency, all 3 event types correct |
| **Razorpay webhook config** | ❌ **You do NOT have a usable test-mode webhook** — see §4 |
| **Security** | ⚠️ **2 CRITICAL new flaws** (Google OAuth bypass §3.1; reaper dead since ship §3.2) + 2 HIGH + 2 MEDIUM flaws |
| **Data-flow** | ✅ Coherent end-to-end; 2 integrity gaps (COD never marked paid; cancel doesn't restock) |

**Bottom line:** the platform is functionally solid and all previous fixes are regression-clean, but there are **two critical holes** — the Google OAuth account-takeover (§3.1) and a reaper that has never worked (§3.2, silently leaking stock on every abandoned checkout) — and you **must create a test-mode webhook** (§4). Until the reaper is fixed AND the webhook exists, nothing backstops paid-but-unconfirmed orders at all.

---

## 2. Feature walkthrough per role (all live-verified)

### Customer (temp account `nexmart.audit.*.cust@example.com`)
| Feature | Result |
|---|---|
| Register → OTP email → verify → login | ✅ blocked before verify, wrong OTP rejected, correct accepted |
| Profile get/update, password change (needs current + strength) | ✅ |
| Address add/update/delete, ownership enforced | ✅ |
| Browse: products list, by-slug, price sort, search, categories | ✅ |
| Cart: add/update/remove/clear, merge `{items:[...]}` (B1), guest `x-session-id` + cross-session isolation | ✅ |
| Wishlist add/get/remove, auth required | ✅ |
| Reviews: get, post, one-per-customer, verified-purchase badge | ✅ |
| Order COD: create, stock decrement, server-side total recompute (₹59,000 = 50,000 + 18% tax), view own, list | ✅ |
| Order online: create + Razorpay order id, keyId exposure, bad-signature reject, valid-signature → paid+confirmed+deliveryId, duplicate-payment idempotency | ✅ |
| Invoice: generated on delivered (B12), IDOR-blocked for other customers | ✅ |

### Admin (temp account via ADMIN_SECRET_KEY)
| Feature | Result |
|---|---|
| Register: no secret → 403, wrong secret → 403, correct → 201 | ✅ |
| Dashboard stats (Redis-cached 30s), analytics, users, products, orders, agents | ✅ |
| Category create/update/deactivate + `includeInactive` visibility (P2-28) | ✅ |
| Product create/update | ✅ |
| Order: confirm (P0-2 fix holds), invalid transition rejected, assign agent → shipped | ✅ |
| Refund: COD rejected clean, unknown payment → 503 with no SDK leak | ✅ |
| Suspend customer (B3: login + token both die), agent approve/reject (B6 correct messaging) | ✅ |

### Delivery agent (temp account)
| Feature | Result |
|---|---|
| Register → pending → login blocked → admin approve → login | ✅ |
| my-orders (empty → assigned), order by id, profile | ✅ |
| Status walk: picked → out_for_delivery → delivered; delivered→picked blocked (B2) | ✅ |
| Assignment scoping: cannot touch an unassigned order (404) | ✅ |

### Cross-cutting
Rate limiting (auth limiter + failed-login lockout, both engage under burst) ✅ · malformed JSON → clean 400 (B7) ✅ · 404 no route echo (B8) ✅ · NoSQL injection neutralized ✅ · CSRF origin check ✅ · JWT logout blacklist ✅ · cross-role logins rejected ✅ · OTP resend throttle ✅

---

## 3. NEW findings (not in the B1–B12 list)

### 3.1 🔴 CRITICAL — Google OAuth callback trusts the request body: full account takeover by email knowledge
- **File:** `backend/src/controllers/googleAuth.controller.ts:22` (`POST /auth/live/v1/auth/google/callback`)
- **Live-verified chain:**
  1. `POST /auth/google/callback {googleId:"fake", email:"victim@example.com"}` → **200 + customer JWT issued**
  2. That JWT works on `/customer/profile` and `/orders` — full account access
  3. New emails get an account created (201); existing ones get logged in (200)
  4. It **also bypasses email verification** (no OTP, no `emailVerified` check) and **issues tokens for suspended accounts** (B3's per-request guard blocks API use, but the login itself succeeds — inconsistent messaging)
- **Root cause:** the endpoint receives `{googleId, email, name, picture}` straight from the request body. The real frontend (NextAuth `signIn` callback in `src/auth.ts:62`) sends genuinely verified Google data — but the endpoint never verifies anything itself, so a raw `curl` forges the same result. No zod schema, no Google ID-token verification, no `isActive` check.
- **Impact:** anyone who knows a victim's email (or guesses it) gets a customer token for that account — view orders/addresses/phone, place orders on their behalf. Severity is capped only by the customer role's blast radius.
- **Fix direction:** have NextAuth pass the Google **ID token** (JWT) and verify it server-side (google-auth-library or `https://oauth2.googleapis.com/tokeninfo`); or at minimum require a server-side exchange — and add `isActive` + `emailVerified` checks. Do not accept raw `googleId`/`email` from a client.

### 3.2 🔴 CRITICAL — The order reaper has NEVER worked (dead since it shipped)
- **Files:** `backend/src/services/orderReaper.ts:52` + `backend/src/services/razorpay.service.ts:31`
- **Root cause:** `fetchOrderPayments()` returns `payments as unknown as Array<...>`, but Razorpay SDK 2.9.2's `orders.fetchPayments()` actually returns a **collection object** `{entity, count, items}` — not an array. The cast silences TypeScript; at runtime the reaper's `payments.find(p => p.status === 'captured')` (line 52) throws `TypeError: payments.find is not a function` on **every sweep**. The outer `sweep()` try/catch eats it (log-only), so the failure is invisible.
- **How it was found live:** an API-created, schema-valid order matching the sweep filter exactly (`online/pending/placed/createdAt` backdated 40 min) went unprocessed across 5+ sweep cycles and a fresh server restart's initial sweep. Re-running the exact reaper logic standalone reproduced the throw immediately.
- **Impact:** every abandoned online checkout leaks stock forever (never cancelled, never restocked), and every paid-but-unconfirmed order (customer closed the tab, no webhook yet) stays `pending` forever. The reaper has never reconciled or cancelled anything since it was deployed.
- **Fix:** return `payments.items` from `fetchOrderPayments()` (and/or `.map` the shape), add a unit test mocking the SDK's collection shape, and add a per-order try/catch in the sweep loop (see 3.2b) plus a log line on successful sweeps so future silence is detectable.
- **3.2b compounding flaw:** the sweep processes all orders in one for-loop inside a single try/catch — one bad order poisons the whole cycle. Per-order isolation needed.

### 3.3 🟠 HIGH — Admin cancel does not restock (stock leak)
- `order.controller.ts` `updateOrderStatus` (line ~281): cancel path transitions `placed/confirmed → cancelled` with **no restock**. Only the *reaper* restocks (its own cancel path, `orderReaper.ts:88`).
- **Live-verified:** cancel of a 2-unit order — stock stayed 8 (was 8); 2 units permanently lost from sellable inventory.
- Every admin-cancelled order silently shrinks catalog stock. Fix: reuse the reaper restock loop on `status === 'cancelled'` (and consider `returned`).

### 3.4 🟠 HIGH — `payment.failed` orders become zombies (stock leak + reaper blind spot)
- Once the webhook is live (see §4), `payment.failed` events set `paymentStatus:'failed'` with `orderStatus:'placed'`. The reaper only matches `paymentStatus:'pending'` (`orderReaper.ts:117-120`) and no restock/cancel path handles `failed` — stock decremented at order-create is never returned. Also: the checkout's `ondismiss` message tells the customer *"complete payment from My Orders"* but **no retry-payment UI exists** (`grep` for retry in `frontend/src/app/orders` → none).
- Fix direction: on `payment.failed` (webhook + bad-signature path), either restock+cancel or restock-and-allow-recreate; build the promised retry-payment button; extend the reaper filter to `pending` OR `failed`.

### 3.4 🟡 MEDIUM — COD orders never become `paymentStatus:'paid'` (revenue undercount)
- Delivered COD orders stay `pending` forever. Revenue analytics filters `paymentStatus:'paid'` (`admin.controller.ts:242`) → COD revenue is invisible in charts, while dashboard "totalRevenue" (`$sum: '$total'` over all orders) includes it — the two numbers contradict each other.
- Fix: mark COD `paid` on delivery confirmation (or introduce a `cod_pending` semantics that both queries share).

### 3.5 🟡 MEDIUM — Refund emails the customer "cancelled" for a non-cancelled order
- `admin.controller.ts:223`: refund path sends `sendOrderStatusEmail(..., 'cancelled')` while the order's fulfilment status is unchanged (can be `delivered`). Customer who got their money back for a delivered order receives a "cancelled" email. Also refund does not restock, which may be intentional, but should be a decision, not an accident.
- Fix: dedicated refund email template or pass the real status.

### 3.7 ⚪ LOW / dead code
- `emitAgentStatusUpdate`, `emitStockUpdate`, `emitDashboardStats` in `socket.ts` have **zero call sites** and zero frontend listeners — dead emitters (harmless, but §5.1's contract lists them; either wire or delete).
- Customer self-cancel route doesn't exist (customer can't cancel a just-placed order; only admin can).
- Agent profile is read-only (no `PUT /agent/profile`).
- `getAllProducts` computes `const stats` and never uses it (`admin.controller.ts:39`) — dead code.
- Orphan cart in DB: a cart bound to user `69fcc…` who no longer exists (pre-existing baseline junk, left untouched) — worth a maintenance sweep for carts whose `user` doesn't resolve.

### 3.8 Known-open from the morning audit (still true, unchanged)
- Reviews store HTML unsanitized (inert in React) · email enumeration on register/OTP responses · `/products?category=<slug>` 400s · some raw Zod defaults · backend `npm run lint` references uninstalled eslint.

---

## 4. Razorpay webhook — do you need to create the test-mode one? **YES**

**Live-checked via the Razorpay API (test-mode keys):** the account has exactly **one webhook** — and it's useless:

```
id: SqMACB0qQ70aD8 · service: "api-test" (TEST mode)
URL: https://suffocate-penpal-applicant.ngrok-free.dev/api/webhook/razorpay
created 2026-05-17 · DISABLED 2026-05-20 (auto-disabled after 72h of failures — the ngrok tunnel is long dead)
active: false · events: payment.captured + payment.failed only (order.paid NOT subscribed)
```

Three separate problems:
1. **Wrong URL**: points at an old ngrok tunnel `/api/webhook/razorpay` — the real endpoint is `/api/v1/webhooks/razorpay`. Even if re-enabled it would 404 (and your handler would never see it).
2. **Disabled**: Razorpay auto-disables webhooks failing for 24h; a dead ngrok URL guarantees it.
3. **Missing event**: `order.paid` is not subscribed (your handler supports it; the DEPLOYMENT.md instructions say to add it).

**Verdict — yes, you must create the test-mode webhook** (the user-created "normal mode" one the morning audit mentioned isn't even visible on the test account — the API shows only this dead ngrok one; if a live-mode webhook exists it's on the live keys, which you don't use). While keys are `rzp_test_*`:
- Dashboard → Settings → Webhooks → **ensure the mode toggle is TEST** → Add New
- URL: your deployed backend's `https://<host>/api/v1/webhooks/razorpay` (port 443; ngrok works for local dev — but delete the webhook when done, or it auto-disables again)
- Secret: same value as `RAZORPAY_WEBHOOK_SECRET` in `.env`
- Events: `payment.captured`, `payment.failed`, `order.paid`

**Current blast radius of not having it:** test payments confirm only via the client-side verify call. If the customer closes the tab mid-payment, the order sits `pending` forever — because the reaper that was supposed to reconcile it is broken (§3.2). **With no webhook AND a dead reaper, there is currently NO backstop at all for paid-but-unconfirmed orders.** When you switch to live keys, create the live-mode webhook too — same secret is fine.

---

## 5. Data-flow analysis (cross-platform)

```
CUSTOMER places order ──POST /orders──▶ stock decrement (atomic $gte guard) · server-recomputed totals
   ├─ SOCKET 'order:new' → admin room ✅ live-verified (toast + admin layout listener → query invalidate)
   ├─ total = items + shipping + 18% tax, computed server-side ✅ (client price never trusted)
   └─ online: Razorpay order created with real test key ✅

PAYMENT (online):
   ├─ happy path: client verify → HMAC check → paid+confirmed+deliveryId ✅ + invoice queued ✅ + socket ✅
   ├─ webhook path: HMAC(timingSafeEqual) over raw body ✅ → same state transition, idempotent ✅
   │     payment.failed → marks failed (scoped to pending) ✅ — but then zombie (§3.4)
   └─ reaper (every 15 min, by design): queries Razorpay for pending 30+ min orders
         captured → confirm+invoice+email · abandoned → cancel+RESTOCK+email
         ❌ NEVER RUNS — crashes on every sweep since it shipped (§3.2). No reaper cancel
         has ever happened; the restock ✅ below is design-only, never exercised live.

ADMIN: confirm → assign agent:
   ├─ transition graph shared with delivery path ✅ (forward-only, idempotent, B2 clean)
   ├─ SOCKET 'order:status_updated' → customer + admin rooms ✅
   ├─ 'delivery:assigned' → agent room ✅ (toast on delivery dashboard)
   └─ emails at customer-facing transitions ✅ (SMTP/Brevo)

AGENT: picked → out_for_delivery → delivered:
   ├─ assignment-scoped (404 on others' orders) ✅
   ├─ status history clean, no duplicates ✅
   └─ delivered → invoice queued (B12) ✅ + COD gap: paymentStatus stays 'pending' (§3.5)

STOCK: decremented on order-create ($gte atomic, race-safe) ✅
       restocked by reaper-cancel ✖ (reaper dead, §3.2) · NOT by admin-cancel (§3.3) · NOT on failed payments (§3.4)

SIDEBAR (dead emitters): 'agent:status_updated', 'product:stock_updated', 'dashboard:stats' — never emitted, never listened to.
```

**§5.1 reaper live test → root cause confirmed.** A real Razorpay test order, created through the real order API (`POST /orders`, `order_TZCd1RuWBpDFSQ`), backdated 40 min as `placed/pending`, matched the sweep query exactly — and was NOT processed across 5+ sweep cycles nor after a fresh server restart's initial sweep. Running the reaper's exact logic standalone (`audit-reaper-replica.ts`, same mongoose models, same code path) threw immediately: `TypeError: payments.find is not a function` — Razorpay SDK 2.9.2's `orders.fetchPayments()` returns `{entity, count, items}`, not an array, and `razorpay.service.ts:31`'s `as unknown as Array<...>` cast hides it. Every sweep crashes at the first stale order and the outer try/catch swallows it. See §3.2 for the full write-up and fix.

---

## 6. Cleanup verification

| Collection | Before audit | After cleanup | Real baseline |
|---|---|---|---|
| customers | 3 | **1** ✅ | 1 (chessgod2003007@gmail.com) |
| admins | 2 | **1** ✅ | 1 (seed admin) |
| deliveryagents | 2 | **1** ✅ | 1 (chessmalyo2003@gmail.com) |
| orders | 17 | **1** ✅ | 1 (May COD order) |
| products / categories | 2 / 53 | **1 / 52** ✅ | 1 / 52 |
| carts / wishlists / assignments / otprecords | 5 / 2 / 4 / 0 | **1 / 0 / 0 / 0** ✅ | 1 / 1* / 0 / 0 |

- 16 audit orders + 4 assignments + 4 carts + 2 wishlists deleted; audit reviews pulled from the real product with ratings recomputed (0 reviews, avg 0 — the pre-audit state); stock restored to 16.
- **7 invoice PDFs destroyed from Cloudinary** (`nexmart/invoices/*` — verified `ok` per asset).
- Redis rate-limit keys cleared; Google-takeover probe account deleted.
- \* Wishlist count 0 vs baseline 1: the morning audit's own cleanup had already removed the real user's wishlist entry it touched — pre-existing from that run, not from this one. 

---

## 7. Fix map — ALL FIXED 2026-09-07 evening (TDD; 56 backend tests green)

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | 🔴 Google OAuth takeover (§3.1) | New `googleToken.service.ts` verifies the Google ID token against Google's tokeninfo endpoint (audience = our client id, email verified at Google); controller accepts ONLY `idToken`, adds `isActive` check; frontend sends the token, not raw identity | ✅ live: raw-identity probe → 400, forged token → 401; 6 controller tests + 6 service tests |
| 2 | 🔴 Reaper dead since ship (§3.2) | `fetchOrderPayments` returns `payments.items`; per-order try/catch isolation in the sweep; `sweepNow()` export for tests | ✅ live: backdated order auto-cancelled + restocked by the sweep; 4 sweep tests |
| 3 | 🟠 Admin cancel no restock (§3.3) | Shared `restockOrderItems` helper called on cancelled AND returned, in both admin + agent status paths | ✅ 6+5 controller tests |
| 4 | 🟠 payment.failed zombies (§3.4) | Reaper filter now sweeps `pending` AND `failed` online orders (cancels + restocks); the reaper is no longer dead so the path actually runs | ✅ sweep test (failed order cancelled without a Razorpay call) |
| 5 | 🟡 COD never marked paid (§3.5) | Both delivery paths set `paymentStatus:'paid'` on delivered COD (online untouched) — revenue analytics now agree with the dashboard | ✅ 2 tests |
| 6 | 🟡 Refund email lies (§3.6) | Refund emails say `refunded` (new email label, + `returned` label); fulfilment status unchanged | ✅ 3 tests |
| 7 | Webhook auto-disable (user report) | Root cause confirmed (Razorpay disables after 24h of failures — dead tunnels/localhost guarantee it); `DEPLOYMENT.md` now documents the full policy + local-dev strategy (skip webhook locally, reaper backstops) | ✅ docs |

## 8. Audit artifacts (reusable)

`backend/audit-harness.js` (102-check full regression), `audit-harness2.js` (sockets/webhook/flaws), `audit-cleanup.js` (marker-driven full cleanup + Cloudinary + Redis), `audit-baseline.js` / `audit-inspect.js`. Rerun after any payment/order-path change: `node audit-baseline.js && node audit-harness.js && node audit-harness2.js && node audit-cleanup.js`.
