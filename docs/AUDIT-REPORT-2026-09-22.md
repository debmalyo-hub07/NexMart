# NexMart End-to-End Audit — 2026-09-22

Scope: backend security/auth/validation/payment/logic, frontend render/UX/design, and
Amazon.in/Flipkart competitive parity research. Verified against CLAUDE.md §8 so closed
bugs are not re-reported. Severity: **P0** = broken commerce/money, **P1** = exploitable or
trust-breaking, **P2** = real defect, **P3** = hardening.

---

## A. P0 — Broken commerce

### A1. Checkout silently drops seller-offer (`listing`) identity
`frontend/src/app/checkout/page.tsx:77` sends
`{ product, variant, quantity, expectedPrice }` — never `listing`, even when the cart
line was added through `SellerOffers` (which stores `item.listing` + offer price).
Consequences against `checkout.controller.ts`:
- **Normal case:** frontend `expectedPrice` = seller offer price ≠ canonical variant
  price → backend throws `PRICE_CHANGED` (409) → **a cart containing any seller offer
  can never be checked out.**
- **Coincidence case (offer price == canonical price):** the order is created through
  the *legacy* path: no `seller`, no `FulfillmentGroup`, no `SellerInventory`
  reservation; canonical variant stock is decremented instead of the seller's.
  Money, stock attribution, fulfilment and payouts are all wrong.

Fix: include `listing: item.listing` in the checkout payload (backend already handles
both shapes).

### A2. The entire storefront is "Sample · not for sale"
`backend/src/services/catalogSeed.service.ts:41` seeds every product with
`isDemo: true`. Combined with the UI labelling in `ProductCard`, `SearchBar`,
`HomeCatalog`, `CompareTray`, `QuickView`, `AddToCartButton` ("Sample · not for sale",
"Preview only", "Sample collection"), a first-time visitor sees a store where **nothing
can be bought**. This is the single largest trust/conversion killer observed (matches
the 17 live screenshots). Nothing is purchasable end-to-end today.

---

## B. P1 — Security & trust

### B1. No `trust proxy` → rate limiting is keyed on the proxy IP
`app.ts` never calls `app.set('trust proxy', …)`. Behind Render's load balancer
`req.ip` is the proxy address for **every** caller, so:
- `rateLimiter.ts getIdentifier()` buckets **all users into one limit** (100 req/min
  general, 10/min auth, 3/min OTP…) → one busy visitor or one attacker triggers
  **global 429s** (auth lockout for everyone), and
- the per-IP failed-login lockout (`redis.ts getFailedLoginAttempts`) is effectively
  one shared counter — also makes `x-forwarded-for` fallback dead code.
Fix: `app.set('trust proxy', 1)` (Render's `X-Forwarded-For` has one trusted hop).

### B2. Customer OTP flow is weaker than the seller flow it should match
`roleAuth.controller.ts`:
- `verifyOtp` / `registerCustomer` / `resendOtp` store the OTP **in plaintext**
  (`customer.otp !== otp`), while the seller flow stores SHA-256 hashes
  (`sellerAuth.controller.ts` codesMatch + timingSafeEqual).
- `verifyOtp` has **no per-account attempt cap** — only the IP-scoped `otpLimit`
  (3/min). Seller verification locks at 5 attempts (`verificationCodeAttempts`).
  A distributed guesser gets unbounded attempts at the 6-digit space.
Fix: hash customer OTPs (reuse `hashOtp`), add an attempts column + 5-attempt cap,
constant-time compare — mirror the seller implementation.

### B3. Registration has no server-side password policy (customer, agent, admin)
`registerCustomer` does `bcrypt.hash(password || '', 12)` — a missing password
creates an account whose password is the **empty string**; `registerAgent` and
`registerAdmin` have no validation at all (agent also stores `aadharNumber` raw with
no format check). Only `registerSeller` is zod-validated. Frontend-only validation is
not validation. Fix: shared zod schema (min 8, upper/lower/digit) on all three.

### B4. Authenticated password change does not kill existing sessions
`customer.routes.ts PUT /password` updates only `password`. `credentialsChangedAt` is
stamped by the reset flow and `sign-out-everywhere`, but **not** by the change-password
flow — an attacker holding a stolen session keeps it after the victim changes the
password. Fix: stamp `credentialsChangedAt` and re-issue the caller's cookie (so only
other devices are logged out).

---

## C. P2 — Validation, logic, correctness

### C1. Address routes accept unvalidated bodies (mass assignment)
`customer.routes.ts`: `addresses.push(req.body)` (POST) and
`Object.assign(addr, req.body)` (PUT) — no zod schema, arbitrary keys flow into the
subdocument. Compare with `profileUpdateSchema` which explicitly allow-lists fields.
Fix: `addressSchema` (mirrors `lib/address.ts`), allow-listed assign.

### C2. GST math displays a price the customer does not pay
Both `checkout.controller.ts:217` and `frontend/src/lib/commerce.ts:9` add a **flat
18% on top of the listed price**. Indian convention (Consumer Protection (E-Commerce)
Rules / MRP practice, and what Amazon.in/Flipkart display) is **MRP inclusive of tax**;
GST slabs are 0/5/12/18/28 by category, not a flat 18. Today the PDP shows ₹999 and
checkout charges ₹1,179 — disclosed only in the cart. Trust + compliance issue.
Decision required (see §E).

### C3. Sessions survive password change → covered by B4.

### C4. Admin search builds unescaped RegExp from user input
`admin.controller.ts:36,134,158` — `new RegExp(req.query.q, 'i')` with raw input:
ReDoS / regex-injection (admin-authenticated, so P2→P3). `escapeRegExp` already exists
in `helpers.ts`. Fix: wrap all three.

### C5. `POST /api/v1/orders` has no rate limiter
`order.routes.ts:10` — every create calls `razorpay.orders.create` (paid external API)
and writes inventory reservations. Payment routes are limited; order creation is not.
Fix: add `paymentLimit`.

### C6. Logout can 500 when Redis is down
`auth.routes.ts:68` `Promise.all(blacklistToken…)` — `blacklistToken` is **not**
fail-open (unlike every other Redis helper). Redis outage → logout returns 500
instead of degrading. Fix: try/catch per token.

### C7. `registerAdmin` compares `secretKey` non-constant-time and unvalidated
`roleAuth.controller.ts:46` — `secretKey !== env.ADMIN_SECRET_ADMIN` on raw strings;
also no body schema (password strength, email format). P3.

---

## D. Frontend render / UX / design findings

### D1. Generic-icon aesthetic (user's core complaint — confirmed)
- `CategoryIcon.tsx`: regex → Lucide glyph; rendered inside white/grey **circles**
  (`home-category-photo` fallback) on homepage, mobile nav, category directory.
- Homepage value props (`page.tsx:41`): three thin Lucide icons + text — no imagery,
  no motion, no proof.
- `HomeEditorial` falls back to a giant `Grid2X2` glyph when a category has no image.
- Spotlight/product stage art comes from `cdn.dummyjson.com` / `covers.openlibrary.org`
  (`next.config.ts`) — sample photography, not a coherent brand look.

### D2. Design direction conflict (resolved by plan)
`CLAUDE.md` specifies the dark-violet editorial language; `docs/superpowers/plans/
2026-09-20-marketplace-rebuild.md` supersedes it with a **photo-led light marketplace**.
The plan wins. This means a full restyle of the storefront shell (navbar, home, cards,
PDP, cart/checkout, policy pages), not patching.

### D3. Trust-signal gaps vs Amazon.in/Flipkart (feature-parity research)
Missing on PDP/cards/cart today:
1. **Pincode delivery-date estimate** ("Delivers to 110001 by Thu, 25 Sep") — the
   #1 pre-purchase trust cue on both giants.
2. **Return/replacement window badge** (7–10 day easy returns + free pickup).
3. **GST-inclusive price display** and **GST invoice available** callout (B2B).
4. **COD availability + secure-payment strip** (UPI/cards icons, "100% secure").
5. **Quality/assurance badge** (Amazon's Choice / Flipkart Assured equivalent).
6. **MRP / strike-through compare price** with "% off" — exists only when
   `comparePrice` set; needs the MRP field surfaced for Indian compliance.
7. **Ratings on cards** — ProductCard shows options/stock but not `ratings`.
8. **Buy-again / recently viewed / save-for-later** (plan already includes recently
   viewed).
9. **Delivery timeline in order tracking** (per-stage ETA, not just status).
10. **Deals/coupon surface** — no coupon engine exists at all.

### D4. What is already good (do not "fix")
- No dead `href="#"` links found; in-page anchors on PDP are genuine.
- Wishlist is server-backed (`wishlist.controller` + `useWishlist`), compare tray is
  legitimately session-local.
- Middleware route guards (`frontend/src/middleware.ts`) are thorough: role
  confinement for admin/agent/seller, redirect handling for /login, protected paths.
- Guest cart session IDs are `guest_<uuid>` — unguessable.
- 401 interceptor, error envelope, skeletons, skip-links, reduced-motion handling in
  spotlight, focus management: solid accessibility baseline.
- Payment core is genuinely strong: HMAC webhook + timingSafeEqual, browser-verify
  signature + provider fetch + amount/currency/order match, atomic idempotent
  `recordCapturedPayment` with ledger in the same transaction, order reaper.

---

## E. Competitive research summary (Amazon.in / Flipkart / Meesho, 2026)

**Parity table (customer):** delivery-date-by-pincode · easy-return window badges ·
GST invoice (B2B, "GST Invoice Available" callout + filter) · No-cost EMI / Pay Later ·
coupons + bank offers + sale events · ratings & reviews incl. photos · assured/quality
badge · order timeline with stage ETRs · buy-again · save-for-later · voice/vernacular
search · WhatsApp/SMS updates.

**Parity (seller):** account-health metrics · promoted listings/ads · returns &
replacement management workflow · buyer messaging · bulk price/stock edit ·
settlement report with TCS/TDS (partially present via ledger/finances) ·
payout schedule clarity (Flipkart 7-day, Amazon rolling 7-day).

**Unique angles the giants do NOT have (research-backed):**
1. **Bargaining / "Name your price"** — Gajab.com proved buyers submit an offer,
   sellers pre-set a floor, an engine counters automatically (<30 s). Amazon/Flipkart
   have no buyer-initiated price negotiation. NexMart's per-seller `SellerListing`
   model is a natural fit: **offer per seller listing**, auto-accept/counter/reject by
   seller-defined floor + expiry. Strong Tier-2/3 resonance (60%+ of transactions).
2. **Budget-first shopping aid** (already in the rebuild plan): "I have ₹2,000 — show
   me what I can actually buy, in stock, delivered" — Meesho/Shopsy prove value-led
   discovery converts; nobody owns the explicit budget-input UX.
3. **Recently viewed + compare-across-sellers on one page** (plan) — Amazon hides
   alternate sellers behind the buy box; NexMart can show all offers side by side.
4. **Radical price transparency**: show GST-inclusive prices everywhere with an
   itemised "what you pay is what's shown" breakdown — directly exploits C2 as a
   differentiator instead of a defect.
5. **Proximity fulfillment** (Eythal's hybrid shipping idea, lightweight version):
   show "Ships from <city>" and faster local ETA on seller offers.

---

## F. Fix order (proposed)

1. **P0 commerce:** A1 checkout `listing` payload; A2 sample-catalog policy (needs a
   decision — see below).
2. **P1 security:** B1 trust proxy; B2 customer OTP hardening; B3 registration
   password policy; B4 session invalidation on password change.
3. **P2:** C1 address schema; C2 GST display decision; C4 regex escaping; C5 order
   rate limit; C6 logout fail-open; C7 admin register schema.
4. **Rebuild:** storefront restyle per plan (photo-led light), CategoryIcon →
   imagery, homepage trust strip, PDP trust badges (pincode ETA, returns, GST,
   COD/secure-pay), ratings on cards, recently viewed, budget-first tool.
5. **Differentiators:** make-an-offer engine, all-offers comparison, price
   transparency layer.

---

## G. Verification record (2026-09-23, plan stream 7)

**Commits:** `8088da4` (P0–P2 audit fixes) · `61e4e6c` (light storefront
restyle) · `7290dd5` (budget tool + recently viewed) · `3b98f6a` (preview
password-hash fix) · `0c779c5` (this record).

**Addendum (2026-09-23, pre-push re-verification):** after the local-dev
incident was resolved (duplicate dev-server instances wedged Turbopack so
page compiles never finished; a backend instance running with a
session-level `MONGODB_URI` override serving an empty catalog), the full
gate suite was re-run clean: backend lint + typecheck + build +
**191/191 tests (29 suites, single run)**; frontend lint + **49/49 tests
(11 suites)** + isolated production build (60 routes). The P0-A2 activation
was then applied to the live Atlas database
(`seed:catalog --apply --database=nexmart`: 60 activated, 0 added, 0
`isDemo` remaining) so the real storefront serves sellable stock. CI
history on `main` is all green; Render/Redis keep-alive secrets present.

**Automated gates — all green:**
- Frontend: 49/49 tests (11 suites), `next lint` clean, `tsc --noEmit` clean,
  production build OK (run with `NEXT_DIST_DIR=.next-verify` so the QA dev
  server's cache was never clobbered).
- Backend: typecheck clean; 191/191 tests. Two replica-set suites
  (`checkout.test`, `cartOffers.integration.test`) hit `Hook timed out in
  10000ms` on one full run while the QA servers were also spawning
  mongodb-memory-server instances — re-ran green in isolation (35/35).
  Contention, not code.

**Isolated QA stack:** `previewStorefront.ts --isolated` (API :4100, disposable
memory replica set,60 seeded products, CORS pinned to :3100) + Next dev on
:3100 with process-level `NEXT_PUBLIC_API_URL`/`NEXTAUTH_URL` overrides — no
`.env` / `.env.local` values were changed.

**HTTP-level journey results** (desktop browser tool was disconnected from the
session, so these are curl/SSR checks rather than pixel/interaction checks):
- `/` 200: `.storefront-shell` light tokens, trust strip, budget chips,
  `/budget` entry point, fixed `?sort=price` link (old dead `price-asc`
  confirmed gone).
- `/budget?maxPrice=1999` 200: six bands, GST/shipping note, SEO metadata.
- `/products`, `/products/preview-galaxy-s25` 200: PDP trust strip
  (pincode/returns/GST/payments) present in SSR HTML.
- `/cart`, `/help`, `/terms`, `/sellers/*` 200; unknown route →404 with the
  restyled light "Lost in space" page.
- Auth guards: `/orders` `/profile` `/wishlist` `/checkout` →307 to
  `/customer/login?redirect=<path>` **on the request origin**, and the login
  page renders200.
- CORS: API accepts `Origin: http://localhost:3100`.
- **Live end-to-end:** customer login → `POST /cart/items` (2× PREVIEW-256) →
  server totals matched the inclusive-GST contract (subtotal ₹1,00,000 + free
  shipping → `totalPaise`10,000,000) → price-parity guard accepted
  `expectedTotal` → COD order **ORD-MUD1RQGK-87GJ** placed → visible in
  `GET /orders`.

**Defects found and fixed during verification:**
- `previewStorefront.ts` seeded the QA customer's password in plaintext (the
  Customer model has no pre-save hash hook — controllers hash explicitly), so
  `bcrypt.compare` rejected it on every QA login. Fixed in `3b98f6a`.
- Homepage "Lowest price first" linked to `?sort=price-asc`, which
  `catalogParams` silently drops (not a valid sort value) — navigation was a
  no-op. Fixed in `7290dd5`.

**Environment findings (documented, not code defects):**
- Auth middleware redirects to the **canonical `NEXTAUTH_URL` origin**, not the
  incoming Host header — that is the host-header-safe behavior, but it means
  `NEXTAUTH_URL` must match the real deployment host. Locally it is pinned to
  `http://localhost:3000`, so any dev/preview run on another port must
  override `NEXTAUTH_URL` at process level (verified working: redirects then
  resolve to `localhost:3100` with correct `?redirect=` return paths).
- A preview/dev run shares the `.next` Turbopack cache unless
  `NEXT_DIST_DIR` is set (rule from2026-09-19 changelog). The QA run on :3100
  baked `NEXT_PUBLIC_API_URL=:4100` into client chunks — `.next` was cleaned
  after the session.

**Unresolved release requirements:**
1. **Interactive browser pass still pending** — desktop browser was not
   connected to this session. Needed: desktop + mobile journeys, keyboard
   navigation, reduced-motion behavior, screenshots. Static a11y checks are in
   place (skip link, `aria-label`/`aria-expanded` on nav controls,
   `prefers-reduced-motion` CSS block, focus-visible outlines).
2. **Differentiators (F5):** make-an-offer engine needs backend work
   (offer/counter/floor model on `SellerListing`); price-transparency layer is
   partially shipped (inclusive GST everywhere) but lacks the itemised
   "what you pay is what's shown" invoice-style breakdown on the PDP/checkout.
3. Auth pages remain on the dark theme (deliberate follow-up, see plan).
