# Changelog

All notable changes to NexMart are documented here, newest first.
Format follows [Keep a Changelog](https://keepachangelog.com/); work is grouped by remediation wave as defined in `CLAUDE.md` §8.

---

## Unreleased — Information-page premium rebuild + storefront trust pass

- **Typography fixed:** `frontend/src/app/layout.tsx` loaded Manrope/DM_Sans under the
  `--font-inter`/`--font-outfit` variable names; now loads true Outfit (display) +
  Inter (body) with JetBrains Mono for prices/IDs. Same variable contract, so portal
  markup is unaffected.
- **Policy system rebuilt** (`PolicyLayout` + `PolicyProgress`/`PolicyTOC`/
  `CopySectionLink`/`PolicyPrintButton`): editorial hero with read-time meta, reading
  progress bar, scrollspy table of contents, per-section copy-link, print/save-PDF
  stylesheet. Content unchanged — drafts stay honest, `policiesApproved:false` keeps
  indexing off until operator facts are supplied.
- **About** (`/about`): photo hero, live catalog stats via `publicCatalog`
  (department/in-stock counts, never invented), photographic journey cards replacing
  Lucide-icon tiles.
- **Contact** (`/contact`): published/awaiting-operator status chips per field plus a
  live published-count. No legal identity invented — all six fields remain null-bound.
- **Help** (`/help`): same search/topic/FAQ logic under a photo hero card.
- **Motion:** new `Reveal` scroll-reveal (IntersectionObserver, once, compositor-only,
  reduced-motion instant) applied to homepage planner banner, editorial cards
  (90ms stagger), and seller invitation; never on above-fold content.
- **Trust copy:** PDP delivery/returns links no longer claim a universal "7-day
  window" — copy now states the seller-stated window. Audit of all remaining
  guarantee language confirms honest disclaimers only.
- **Token unification:** last orange-600/500 literals in storefront surfaces
  (PDP brand link, sample CTA, checkout payment radio, budget-tool hover, search
  suggestion icon) moved to `--accent-violet` brand tokens.
- **Deploy docs synced to `render.yaml`:** blueprint build `npm ci --include=dev`,
  healthcheck `/health/ready`, `NODE_VERSION 24.19.0`; keep-alive secret and
  workflow now target `/health/ready`; boot-log line mentions the refund reconciler.
- **Verification:** frontend lint + typecheck clean, 56/56 Vitest tests pass
  (13 suites), production build green (62/62 routes). Backend: 34 suites, 223/223
  tests pass (incl. new `pricing.service` contract tests); lint + typecheck + build
  clean. Replica-set suites flake on mongod startup contention under parallel load —
  green solo and in isolation. Two lint errors in prior-wave files fixed
  (`admin.controller` unused import, `refund.service` prefer-const).

---

## 2026-09-23 (3) — Render deploy fix: prod build no longer compiles test/QA sources

- **Render build failure fixed** (deploy of `252bf14` failed with 5 ×
  `TS2307 Cannot find module 'mongodb-memory-server' / 'supertest'`).
  Two layered causes:
  1. **Code:** the production `tsc` compiled test/QA-only sources —
     `src/test/helpers.ts` (integration harness) and
     `src/scripts/previewStorefront.ts` — which import devDependencies.
     `tsconfig.json` now also excludes `src/test/**` and
     `src/scripts/previewStorefront.ts`. Tests/QA keep full coverage via
     `tsconfig.test.json` (`npm run typecheck`); nothing in runtime code
     imports the excluded files.
  2. **Service config drift:** Render ran `npm install && npm run build`
     (log), not `render.yaml`'s `npm install --include=dev && npm run build`,
     so devDeps were absent (`audited 278 packages`). The live service is not
     following the blueprint — align the dashboard build command (see
     `docs/DEPLOYMENT.md`).
- **Verified by reproducing Render locally:** temp dir + `npm install
  --omit=dev` (no mongodb-memory-server/supertest, typescript present as a
  regular dep) → `tsc` exit 0, `dist/server.js` emitted, no test artifacts.
  Local gates green: typecheck, build, lint (pre-existing warnings only),
  full test suite (the 2 suites that failed in the first run were mongod
  resource-contention flakes; both pass on re-run — 191/191 accounted).

---


- **Local frontend hang diagnosed and fixed:** the dev server had been started
  twice (two `npm run dev` wrappers sharing one `.next`); page compilations
  never completed (`/` and `/products` hung >2 min with zero bytes while
  `/favicon.ico` answered in 0.2s). All stale processes killed, `.next`
  wiped, one clean instance started → Ready in 4.5s, subsequent pages 1.8–3.4s.
  Rule reaffirmed: **never two dev servers on one `.next`** (same class of
  incident as the 2026-09-19 `NEXT_DIST_DIR` finding).
- **Backend serving an empty catalog diagnosed:** the running instance
  returned `0 categories / 0 products` instantly while Atlas `nexmart` holds
  54 categories / 61 products — a session-level `MONGODB_URI` override in that
  shell (dotenv never overrides pre-set process env; no User/Machine-scope
  vars exist). The instance also died mid-session. Restarted from a clean
  shell → data served correctly.
- **Atlas sample catalog activated (P0-A2 rolled out to the live DB):**
  `npm run seed:catalog -- --apply --database=nexmart` → `added 0,
  preserved 60, activated 60` — `Demo · ` prefixes stripped, stock 12,
  compare prices set, 0 `isDemo` left. Storefront now shows real sellable
  stock (61 published products, page cap 48).
- **Repo hygiene:** removed the stale `.kilo/worktrees/olivine-tumbleweed`
  Kilo Code agent worktree (detached at `b793599`, an ancestor of `main`,
  clean — unregistered with `git worktree remove` first, then deleted) and a
  temporary diagnostic script.
- **Docs synced:** README (dual-theme design section, budget/recently-viewed/
  trust-strip/GST features, 191-test counts, audit-report link, Netlify
  deployment), CLAUDE.md v3.3 (§2 dual-theme scope note, §8 P11 entry),
  DEPLOYMENT.md (frontend host corrected: Cloudflare Pages → **Netlify**,
  verified live at `https://nexmart-in.netlify.app` → 200 / Netlify Edge;
  `nexmart.pages.dev` → 404).
- **Verification before push:** backend lint + typecheck + build + **191/191
  tests (29 suites, one clean run)**; frontend lint + **49/49 tests (11
  suites)** + isolated production build (60 routes, `NEXT_DIST_DIR=.next-verify`,
  cleaned afterwards). CI (`ci.yml`) history all green; keep-alive secrets
  present.

## 2026-09-23 — Rebuild wave: audit P0–P2 fixes, light storefront, discovery tools

- **Audit (P0–P2):** fixed checkout `listing` identity (P0-A1), un-demo'd the
  seed catalog into real sellable stock (P0-A2), `trust proxy` (B1), hashed OTPs
  with5-attempt burn (B2), server-side password policy on all registrations
  (B3), session invalidation + cookie reissue on password change (B4),
  zod-validated address routes (C1), tax-inclusive GST as the differentiator
  (C2 — listed price IS the final price; `taxPaise` is the contained18/118
  slice), escaped admin search regex (C4), order-endpoint rate limit (C5),
  logout fail-open confirmed (C6), constant-time admin secret compare (C7).
  Full detail: `docs/AUDIT-REPORT-2026-09-22.md` §A–C.
- **Storefront restyle (plan stream5):** photo-led **light** theme scoped to
  `.storefront-shell` (warm paper base, navy actions, marigold promos, emerald
  savings) — admin/seller/delivery portals and auth keep their dark density.
  Navy utility strip over white main nav; every storefront page/component
  migrated off dark literals; shared components (ConfirmDialog, QueryError,
  ConnectivityNotice, Overlay, EmptyState, Pagination) now use dual-theme
  tokens so they read correctly in both themes. New PDP trust strip:
  pincode delivery estimate, returns, GST-inclusive note, payment trust.
- **Discovery tools (plan stream6):** `/budget` budget-first shopping aid —
  six price ceilings, live in-stock results cheapest-first, every band a plain
  link to the catalog for no-JS navigation; locally stored **recently viewed**
  (localStorage only, max8, explicit clear control + on-device privacy note)
  rendered as a homepage rail. Fixed the dead homepage `?sort=price-asc` link.
- **Verification:** frontend49/49 tests + lint + typecheck + isolated
  production build; backend191/191 tests + typecheck (two replica-set suites
  re-ran green in isolation after in-memory-Mongo startup contention under QA
  load). Isolated QA stack (disposable preview API :4100 + dev :3100):
  SSR checks across home/budget/catalog/PDP/cart/policies/404, auth-guard
  redirects on the correct origin with `?redirect=` return paths, CORS, and a
  **live end-to-end** login → cart → inclusive-GST total parity → COD order
  `ORD-MUD1RQGK-87GJ` placed and listed. Two defects found and fixed during
  verification: preview QA customer password seeded in plaintext (`3b98f6a`),
  dead homepage sort link (`7290dd5`). Full record incl. pending interactive
  browser pass: `docs/AUDIT-REPORT-2026-09-22.md` §G.

## 2026-09-19 — Storefront discovery, catalog reliability & policy foundation

- Rebuilt public catalog/search around one aggregate-backed service with normalized Unicode/unit matching, bounded typo fallback, descendant-category filters, disjunctive facets, same-option price/stock matching, stable sorting, compact list payloads, and explicit approximate-result metadata.
- Added additive, idempotent starter catalog seeding: 60 labelled, zero-stock samples across 9 departments, with provenance and cart/checkout/offer guards. Existing catalog, category IDs, inventory, accounts, orders, and carts were preserved.
- Added visual department directory, richer homepage merchandising, URL-backed multi-select filters, removable chips, quick view, comparison, seller offers, option-preserving links, and policy/help/contact destinations.
- Hardened cart offer identity and seller inventory checks, public product visibility, public seller storefront visibility, and seller-profile routing. Public seller responses no longer expose contacts, moderation metadata, seller SKUs, or fabricated return/verification claims.
- Added draft Terms, Privacy, Shipping, Returns, and Contact pages backed by a single business-details configuration. Missing legal/operator facts remain explicit launch blockers.
- Homepage "curated edit" spotlight now autoplays (5s interval) with a synced progress bar on the active dot. It pauses on hover and keyboard focus, in hidden tabs, and entirely for `prefers-reduced-motion` users (whose reduced-motion CSS also neutralises the progress animation); a manual pick restarts the full countdown. The stage image gets a subtle hover zoom, gated to fine pointers like the other hover reveals.
- Verification: 49 frontend tests (11 suites), 190 backend tests (29 suites), frontend lint/build clean, backend build/typecheck clean. Isolated browser QA (Playwright, desktop 1440px + mobile 375px): 14/14 scenarios passed.
- Late QA fixes surfaced by the browser pass that static gates missed:
  - `globals.css` and 12 other files carried a UTF-8 BOM; Turbopack's dev CSS parser rejects it, so every dev-mode page 500'd until the BOM was stripped (production webpack builds tolerated it, which is why `next build` passed).
  - Cart API lines lost the chosen-option label: mongoose `toObject()` on a populated product leaves `Map` fields as Map instances, which serialize to `{}` — cart lines showed "Standard option" instead of "512 GB". `cartSnapshot` now serialises with `toJSON()`.
  - Variant selector radios were `sr-only`, so the styled label intercepted pointer events; the transparent input now covers the whole option chip.
  - Cart drawer now opens optimistically on add-to-cart: previously the open was gated on the store's generation guard, so a concurrent owner transition (initial `unknown → guest` sync) silently swallowed it and the drawer never appeared despite a successful add.
  - A preview dev-server run without `NEXT_DIST_DIR` shared the `.next` Turbopack cache with the developer's own dev server and baked the preview's `NEXT_PUBLIC_API_URL` (port 4100) into client chunks — the storefront then fetched a dead port and showed query error states once the preview stopped. Rule: every isolated preview/dev run must set `NEXT_DIST_DIR=.next-preview` (the override already exists in `next.config.ts`). The poisoned cache was cleared and the dev server restarted cleanly.

Research and launch notes: `docs/STOREFRONT-AUDIT-2026-09-19.md`.

## 2026-09-17 — Multi-Vendor Marketplace Transformation (Full Stack)

Transformed NexMart from an admin-controlled catalog into a production-grade multi-vendor marketplace with 4 distinct role portals (Customer, Seller, Admin, Delivery).
Baseline: 119 backend / 31 frontend tests → **142 backend tests (25 suites, 100% pass), 54 Next.js routes generated (100% pass), 0 TypeScript/lint errors**.

### 1. Seller Domain & Operational Hub (`/seller/*`)
- **Seller Identity & Isolation**: Dedicated `Seller` model (`sellerKind: 'first_party' | 'third_party'`) with lifecycle states (`draft`, `submitted`, `under_review`, `approved`, `active`, `rejected`, `suspended`, `blocked`). Isolated auth cookie (`nexmart_seller_session`), `JWT_SECRET_SELLER`, and cross-role boundary enforcement.
- **Onboarding & Verification**: Multi-step business profile onboarding with GSTIN, PAN, business/pickup/return addresses, and audit logging (`SellerAuditLog`).
- **Listings & Inventory**: Decoupled canonical `Product` identity from commercial `SellerListing` offers. Lifecycle states (`draft → submitted → moderation → approved → published`). Idempotent stock adjustments with UUID `Idempotency-Key` tracking and immutable `InventoryMovement` audits.
- **Fulfillment & Shipments**: Orders split into per-seller `FulfillmentGroup`s. Forward-only progression (`placed → confirmed → processing → ready_for_pickup`). Carrier dispatch generation (`Shipment`) with tracking IDs and handoff event histories.
- **Finances & Settlements**: Real-time financial dashboard (`/seller/finances`) aggregating net payable balance, escrow reserve withholdings (held during return window), gross sales, and transaction ledger journal.

### 2. Admin Marketplace Governance & Financial Control (`/admin/*`)
- **Seller Application Reviews**: Admin governance for seller approvals, rejection, suspensions, and unblocking with mandatory audit reason logging.
- **Listing Moderation**: Admin moderation queue (`/admin/listings`) controlling `moderation → approved → published` transitions with rejection overlays.
- **Fee Rules Engine**: Configurable, time-bounded, category-specific fee rules (`MarketplaceFeeRule`) governing commission BPS, fixed fees, and reserve withholdings. Admin management UI at `/admin/fee-rules`.
- **Double-Entry Ledger Explorer**: Complete accounting transparency UI at `/admin/ledger` with account balance cards (`platform_revenue`, `seller_payable`, `seller_reserve`, `payment_cost`, `shipping_cost`, `payment_clearing`) and detailed debit/credit journal audit logs.
- **Platform Analytics**: Net platform fee revenue separated from Gross Merchandise Value (GMV).

### 3. Customer Marketplace Experience
- **Multi-Seller Offers**: Component `SellerOffers` on Product Detail Pages (`/products/[slug]`) fetching active vendor listings, highlighting lowest prices, ratings, verified seller badges, and dispatch speeds.
- **Cart Grouping**: `CartContents` automatically partitions cart items into distinct vendor packages with seller storefront branding.
- **Attributed Checkout**: Line-item vendor attribution and transparent multi-seller order summary.
- **Packages & Dispatch Tracking**: Customer Order Detail page (`/orders/[id]`) visualizes individual seller fulfillment groups, item allotments, and live shipment tracking statuses.
- **Public Seller Storefront**: Customer-facing `/sellers/[id]` showcases merchant performance, return policies, and active catalog.

### 4. Verification & Hardening
- 25/25 backend test suites passing (142/142 tests) including race-condition reservation tests, double-entry balance verification, and seller isolation checks.
- 54/54 frontend routes statically compiled and validated with zero type errors.

### 5. Credential & Security Incident Remediation
- **Environment Template Sanitization**: Replaced placeholder password in `.env.example` (`ADMIN_SEED_PASSWORD=change_this_admin_seed_password`) to prevent scanner false positives and credential confusion.
- **Obsolete Script Purge**: Removed orphaned test script `backend/test-profile.js` containing hardcoded email.
- **Identity & PII Sanitization**: Replaced developer name and email references across `backend/reset-admin.js`, `backend/src/seed/adminSeed.ts`, `backend/src/utils/helpers.ts`, and `CLAUDE.md` with standard administrative constants.
- **Branch Normalization**: Consolidated all marketplace features and fixes onto `main`, removing temporary feature branches.

---

## 2026-09-13 — Piece 0: customer auth repair + account extension

First piece of the multi-vendor marketplace transformation (map: `docs/superpowers/plans/2026-09-13-marketplace-program-map.md`; design: `docs/superpowers/specs/2026-09-13-piece-0-auth-account-design.md`). Baseline 91 backend / 31 frontend tests → **119 backend / 31 frontend, 0 lint errors, clean typecheck and build**.

### Password reset (did not exist)
- `POST /customer/auth/forgot-password` → always 202, whatever the truth is. Rate limit consumed before the lookup, so even a 429 cannot prove an address exists. Unknown address, cross-role address and Google-only account are indistinguishable.
- `POST /customer/auth/reset-password` → one uniform 400 for unknown address, wrong code, expired code and burnt code alike.
- Codes are SHA-256 hashed at rest (`utils/resetCode.ts`), expire in 15 minutes, and die after 5 attempts. A reset code is more sensitive than a verification code — plaintext persistence was the P7 defect this avoids repeating.
- A Google-only account receives a "sign in with Google" email rather than a code. The owner gets an actionable message; the HTTP response is unchanged.
- **A successful reset invalidates every session that predates it** via the new `credentialsChangedAt` stamp on `Customer`, checked in `protectCustomer`. Without this, an attacker holding a live session would keep it through the victim's reset.

### Session invalidation primitive
- Tokens now carry a millisecond `iatMs` claim. The standard `iat` is whole seconds, which cannot be ordered against a sub-second event: a reset and the login that follows it land in the same second, so a second-resolution comparison either keeps the session it was meant to kill or kills the one it just issued. Tokens predating the claim fall back to `iat`, which is correct for them.
- `POST /customer/sign-out-everywhere` uses the same primitive.

### Registration
- Nine fields → four (name, email, password, confirm). Checkout already collects the delivery address with validation and a saved-address selector; signup was duplicating it.
- Password strength now matches the backend policy — but on **register only**. Applying it to login would have locked out any account whose password predates the policy.

### Defects fixed
- **Registration routing**: `AuthForm` inferred OTP state from `requiresOtp`, which the deliberately-opaque 202 can never honestly carry. A customer re-registering an unverified email got a success toast and a bounce to login while their freshly-sent code sat unread. Registration now always routes to the code screen, whose copy is true on every branch.
- **`authProviders` never recorded Google linking** — the array the account security screen renders from said "email" only for every linked account, so the screen told those customers they had no Google sign-in. Recorded on link and on set-password; `src/scripts/backfillAuthProviders.ts` repairs existing accounts (idempotent).
- **Google-only customers dead-ended**: the security tab said "manage security through your linked provider" and offered no way to. They can now add a password via an emailed code, reusing the reset machinery rather than a second code path.
- **`refreshUser` logged users out on any failure** — a timeout or 5xx cleared the session. Now only 401/403 does.
- **Unverified login fed the IP lockout counter**: a legitimate customer's correct password counted toward a 5-strike lockout because they had not clicked the OTP yet. Same class as P1-15 for pending agents.
- **`PUT /customer/profile` had no validation** — `req.body` spread straight into `$set`. Mongoose happened to make that safe; the zod schema now states the contract rather than relying on the accident.
- **One `showPassword` state** revealed password and confirm-password together. Now per-field.
- **"Welcome back to your workspace"** on customer sign-in → "Sign in to your NexMart account".

### Integration test harness (reused by Pieces 1–13)
- `supertest` added; `backend/src/test/helpers.ts` mounts the real `createApp()` against `mongodb-memory-server` with Redis and SMTP mocked at the module boundary.
- Covers the full lifecycle (register → verify → login → protected route → reset → old session dies, new login works), anti-enumeration byte-equality, reset attempt-capping and reuse, lockout-counter behaviour, Google-only handling, and CSRF Origin rejection.
- 28 new tests across four files. This is the harness Piece 9's seller-isolation and IDOR tests build on.

### Frontend
- New `/customer/forgot-password` and `/customer/reset-password` routes; middleware keeps both reachable when signed out.
- `components/auth/OtpInput.tsx` extracted from the verify-otp page so verification and reset share one six-box implementation (§5.5) instead of duplicating it.

**Not yet done:** live smoke against a real inbox, and the `authProviders` backfill against Atlas. Both send real effects and are queued for the user.

---

## 2026-09-13 — product experience polish (audit-driven consolidation)

Full-platform audit covering documentation, frontend architecture (50+ components, 25+ routes), backend architecture (11 route modules, 91 tests), design tokens, accessibility, trust integrity, and responsive behavior. Baseline: 31 frontend tests passing, 91 backend tests passing, 0 lint errors, zero fabricated data.

### WCAG border contrast
- Upgraded `border-white/10` → `border-white/15` across Overlay, About, Help, Delivery Dashboard, and AssignmentCard for WCAG 2.2 AA 3:1 non-text contrast compliance.
- Upgraded `border-white/5` → `border-white/10` on admin top products panel.

### Error page quality
- `error.tsx`: heading `<h2>` → `<h1>`, added `role="alert"`, improved copy from vague "Something went wrong" to specific "This page could not be loaded", replaced hand-rolled button with `.btn-secondary`, added `flex-wrap`.
- `global-error.tsx`: heading `<h2>` → `<h1>`, added `role="alert"`.
- `not-found.tsx`: added `aria-hidden` to decorative icons, added `flex-wrap`.

### Page layout standardization
- About and Help pages: replaced custom `pt-[calc(var(--navbar-height)+Xrem)]` with standard `.store-page` class.

### UX copy accuracy
- Admin dashboard: corrected "refreshed about once a minute" to "refreshed automatically while this tab is open" (actual polling is 10–15s).

### Commerce UX polish
- PDP: quantity stepper hidden when selected variant has zero stock (Add to Cart remains visible but disabled).
- Product gallery: added touch swipe and keyboard ArrowLeft/ArrowRight navigation to the enlarged lightbox modal.

### Accessibility improvements
- Delivery AssignmentCard: added order-specific `aria-label` to Call/Directions links, added `(opens in Maps)` screen-reader indicator.
- Admin dashboard: added `aria-label="Rank N"` to top product rank badges.

**Verification:** 31 frontend tests passed, 0 lint errors, production build clean. 12 files modified, 0 backend changes.

---

## 2026-09-12 — product experience consolidation, waves 6–9 (operations & field)

Completes the consolidation plan (`docs/superpowers/plans/2026-09-11-product-experience-consolidation.md`). Waves 1–5 (foundations, navigation/home, discovery, purchase/payment recovery, trust/account/orders) were already implemented in the working tree; this entry covers the store-operations and delivery waves, then the accessibility, browser and documentation gates for the whole effort.

**One state machine, mirrored rather than re-guessed:**

- New `frontend/src/lib/orderStatus.ts` mirrors the backend's `ALLOWED_ORDER_TRANSITIONS` and derives what each role may actually do next. A unit test parses the backend source and asserts the two graphs are identical, so a change to the server machine fails the frontend suite instead of reaching an operator as a dropdown of 400s.
- **Admin orders** previously offered all eight statuses on every row — most of them illegal for that row and rejected by the server. The control now offers only the legal next transitions, labelled as actions ("Confirm order", "Mark out for delivery"). Cancel and return, which move stock and money, require a confirmation naming the consequence.
- **Delivery** replaces the generic status dropdown (which listed `assigned`, a display-only value the API rejects, and allowed skipping stages) with the one legal next action as a 48px button, plus confirmation on the two actions that settle payment or stock.

**Honest operator data:**

- The dashboard's revenue tile summed *every* order — paid, unpaid and cancelled — while the chart beside it counted only received payments, so the two disagreed with no explanation. The tile is now "Order value, all orders" with its scope stated and a link to paid revenue in Analytics; every tile states what it counts, and the queue that needs work leads the grid. The reference clock moved below the operational content.
- `AnalyticsSummary` replaces `as any` on the analytics payload (admin dashboard and analytics page).
- A failed product fetch rendered "Product not found" — an invitation to recreate a product that already exists. Failure and absence are now distinct states. Same fix for the category manager and the agent profile, where a failed load silently fell back to session data (including approval status).

**Field readiness (delivery):**

- Assignments render as task cards: full address (never clamped), tap-to-call, "Directions" via a maps deep link, and the amount to collect stated as an instruction for cash orders rather than a payment status. Finished deliveries collapse below the active ones.
- A lost response is no longer reported as a failure: `isUncertainError` distinguishes "no answer" from "rejected", and the agent is told the update may have gone through, with the list refreshed, instead of being invited to repeat an action that may already have applied.
- The offline notice now mounts in the delivery and admin layouts, not only the storefront.

**Backend contracts (isolated regression tests, 82 → 91):**

- `assignDeliveryAgent` could drag a delivered or cancelled order back to `shipped`, and re-assigning an order already out for delivery showed the customer a backwards jump. It now respects the shared transition graph, keeps a dispatched order's status while still recording the new assignment, and emits a status update only when the status genuinely changed.
- The same handler wrote the order first and the assignment second, so a failed assignment write left an order marked shipped that no agent had been given. The assignment is now written first.
- Repeating a delivery status (double tap, or a retry after a lost response) rewrote `pickedAt`/`deliveredAt`. Milestones are now recorded once; `attemptedAt` still tracks the latest attempt, because each attempt is a real new event.

**Accessibility:**

- **Focus never returned to the trigger after closing an overlay** — it dropped to `<body>`, on every dialog and drawer in the app. `Overlay`'s hand-rolled handler cancelled Radix's own restoration and then focused a reference captured after focus had already moved inside. The trigger is now tracked while the surface is closed, and the search field is focused through an `initialFocus` prop rather than a native `autoFocus` that pre-empted the bookkeeping. Verified: focus returns to the trigger on both the pointer and keyboard paths.
- Table rows were expanded by clicking a `<tr>` — unreachable by keyboard or screen reader. `DataTable` now owns one labelled disclosure button per row ("Show order details for NEX-1042"), declared at module scope so toggling cannot remount it and steal focus. Sortable columns exist only in the desktop table, so narrow screens gained a sort control; pagination buttons gained labels and 44px targets.
- `plugin:jsx-a11y/recommended` is now in the lint config, so CI enforces this. It surfaced 16 issues: seven unassociated form labels (fixed), two `autoFocus` uses inside deliberately-opened overlays (one removed, one documented), and six false positives from an `AuthForm` prop named `role`, which collided with the ARIA attribute — renamed to `portal`.
- Contrast: an interactive link at `text-white/25`, chart axis labels at `white/40`, and the sort affordance raised to meet the §2.1 floors.

**Verification.** Frontend: production build, 31 vitest tests (19 → 31), 0 lint errors/warnings with jsx-a11y enabled. Backend: `tsc`, 91 vitest tests (82 → 91), 0 lint errors. Browser (Chromium, built app): **192 route×width combinations across all 12 required widths — zero horizontal overflow, zero page errors**; reduced-motion renders no infinite animations and no WebGL canvas; 24/24 tabbed elements show a visible focus indicator; skip link reaches `#main-content`. The API was deliberately unreachable during the sweep, which confirmed the retry policy resolves to an honest error state (~13s) on the storefront rather than a fake empty one. Harnesses: `frontend/scripts/responsive-audit.cjs`, `frontend/scripts/a11y-audit.cjs`.

**Not done / carried forward.** No live end-to-end run against a running backend (no local API or test database was started, per the plan's read-only constraint), so the new admin/delivery flows are verified by unit tests, types and static browser QA rather than a real order lifecycle. WebKit and Firefox engines are not installed locally; only Chromium was exercised. No field performance data — LCP/INP numbers would need a real deployment.

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
