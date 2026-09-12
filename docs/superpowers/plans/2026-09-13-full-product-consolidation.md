# NexMart Full Product Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the existing P7/P8 product-experience wave, fix only confirmed gaps, and finish a trustworthy, responsive, accessible, production-grade NexMart experience across customer, admin, and delivery roles.

**Architecture:** Preserve the current Next.js App Router, React Query, Zustand, NextAuth hybrid authentication, Express/Mongoose backend, shared tokens, and existing primitives. Work in evidence-driven waves: establish a clean baseline, consolidate shared behavior, then improve each role without changing backend business behavior unless a failing acceptance test proves it is necessary.

**Tech Stack:** Next.js 15.3.2, React 19, TypeScript strict mode, Tailwind 3.4, TanStack Query 5, Zustand 4, Radix primitives where already adopted, Express, Mongoose, Vitest, ESLint, npm.

**Spec:** User-provided full production-grade product experience overhaul prompt and `CLAUDE.md`.

## Global Constraints

- Treat the current source code and current working tree as authoritative; do not discard or overwrite existing user changes.
- No mock data, fabricated metrics, unsupported testimonials, fake scarcity, or misleading status values.
- Mobile-first baseline is 375px; preserve usable layouts at 320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1440, and 1920px.
- Touch targets are at least 44px generally and 48px for delivery primary actions.
- Every server-driven surface distinguishes loading, error, empty, unauthorized, and success states where applicable.
- Use `getApiError` and `isUncertainError`; never discard server messages or call `alert()`/`confirm()`.
- Preserve role confinement, CSRF protection, ownership checks, payment verification, rate limits, and the NextAuth/backend hybrid.
- Use existing tokens and semantic colors; add no arbitrary hex values or violet ramp steps.
- Use `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR'})` for money and `Intl.DateTimeFormat` for dates.
- Every listener, interval, socket, observer, and animation effect has cleanup and honors reduced motion.
- Do not add decorative motion to checkout, auth, orders, admin, or delivery surfaces.
- Before declaring completion run frontend tests, lint, build, backend tests, and backend lint; report blocked runtime/browser checks honestly.

---

## Wave 0: Baseline Verification and Gap Classification

### Task 1: Record the repository baseline

**Files:**
- Read: `CLAUDE.md`, `README.md`, `docs/CHANGELOG.md`, `docs/CONTRIBUTING.md`, `docs/DEPLOYMENT.md`
- Read: `docs/superpowers/plans/2026-09-10-responsive-motion-stabilization.md`
- Read: `docs/superpowers/plans/2026-09-11-product-experience-consolidation.md`
- Read: `docs/superpowers/plans/2026-09-12-product-experience-brief.md`
- Read: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/src/app/layout.tsx`
- Read: `backend/package.json`, CI workflow files, deployment files

**Interfaces:**
- Produces: a checked baseline of commands, routes, existing primitives, known-open items, and uncommitted files for all later tasks.

- [ ] Step 1: Capture `git status --short`, `git diff --stat`, and the latest five commits without modifying files.
- [ ] Step 2: Read the required documentation and package scripts completely enough to identify the actual test/lint/build commands.
- [ ] Step 3: Map customer, admin, and delivery routes and identify their shared layout/providers.
- [ ] Step 4: Write a dated audit note in `docs/superpowers/plans/2026-09-13-full-product-consolidation.md` under this task listing observed baseline facts and any contradictions with `CLAUDE.md`.

### Task 2: Run the complete automated baseline

**Files:**
- Test only: `frontend/`, `backend/`

- [ ] Step 1: Run `npm test` in `frontend/` and record failures.
- [ ] Step 2: Run `npm run lint` in `frontend/` and record failures.
- [ ] Step 3: Run `npm run build` in `frontend/` and record failures.
- [ ] Step 4: Run the backend test command from `backend/package.json` and record failures.
- [ ] Step 5: Run the backend lint command from `backend/package.json` and record failures.
- [ ] Step 6: Classify each failure as existing-wave regression, pre-existing issue, environment/service limitation, or confirmed product gap; do not fix speculative findings.

### Task 3: Create a verified-gap ledger

**Files:**
- Modify: `docs/superpowers/plans/2026-09-13-full-product-consolidation.md`
- Inspect: all files named by automated failures and source audits

- [ ] Step 1: Search application code for `alert(`, `confirm(`, mock constants, unsupported claims, dead route links, duplicate viewport metadata, invalid opacity classes, `transition-all`, and uncleaned effects.
- [ ] Step 2: Exclude intentional test/security-harness payloads from application findings.
- [ ] Step 3: For every retained finding record file, line, reproduction/input, expected behavior, and the smallest affected wave.
- [ ] Step 4: Remove any finding that cannot be reproduced or supported by source evidence.

---

## Wave 1: Shared Foundations and Navigation

### Task 4: Consolidate only confirmed shared primitive defects

**Files:**
- Modify only confirmed files among `frontend/src/components/common/`, `frontend/src/components/layout/`, `frontend/src/components/navbar/`, `frontend/src/app/globals.css`
- Test: adjacent existing frontend unit tests or new focused tests under `frontend/src/**/*.test.ts(x)`

- [ ] Step 1: Add a failing test for each confirmed defect, such as incorrect toast queue behavior, missing error state, broken focus restoration, or incorrect status mapping.
- [ ] Step 2: Run the focused test and verify it fails for the observed reason.
- [ ] Step 3: Implement the smallest token-compliant fix using existing primitives; do not introduce a parallel component system.
- [ ] Step 4: Verify keyboard focus, Escape handling, aria state, reduced motion, and mobile target size for the changed primitive.
- [ ] Step 5: Run focused tests, then frontend lint and typecheck/build if the shared code compiles.

### Task 5: Verify storefront navigation and footer integrity

**Files:**
- Inspect/modify only confirmed files among `frontend/src/components/layout/StorefrontLayout.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/layout/Footer.tsx`, `frontend/src/components/navbar/MegaMenu.tsx`, `frontend/src/components/navbar/SearchBar.tsx`, `frontend/src/app/help/page.tsx`, `frontend/src/app/about/page.tsx`
- Test: focused navigation/link tests if existing test setup supports them

- [ ] Step 1: Enumerate every navigation/footer link and resolve it against the actual route table.
- [ ] Step 2: Add a focused test or static assertion for each confirmed dead or role-inappropriate link.
- [ ] Step 3: Fix confirmed links, labels, focus behavior, safe-area padding, or drawer scroll behavior without adding presentation-only animation.
- [ ] Step 4: Verify mobile navigation at 320px and 375px and keyboard navigation at desktop width.

---

## Wave 2: Customer Discovery and Homepage

### Task 6: Verify the homepage against real catalog behavior

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/page.tsx`, `frontend/src/components/home/`, `frontend/src/components/product/`, `frontend/src/lib/catalog.ts`, `frontend/src/lib/catalogFilters.ts`
- Test: `frontend/src/lib/commerce.test.ts`, catalog tests, and new focused tests only for confirmed gaps

- [ ] Step 1: Trace homepage data from request to rendered category/product sections, including loading, error, empty, and unauthorized behavior.
- [ ] Step 2: Add a failing test for every confirmed issue, such as fabricated content, incorrect route construction, missing empty state, or stale result rendering.
- [ ] Step 3: Implement the smallest fix that keeps real products/categories as the content source.
- [ ] Step 4: Ensure the hero hierarchy exposes brand/value proposition, search, browse action, and real products without requiring animation.
- [ ] Step 5: Keep WebGL optional and gated; verify static poster/reduced-motion/mobile fallback paths remain intact.
- [ ] Step 6: Run focused tests and inspect rendered source for unsupported claims or hidden primary actions.

### Task 7: Verify search, categories, filters, and product cards

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/search/page.tsx`, `frontend/src/app/products/page.tsx`, `frontend/src/app/categories/page.tsx`, `frontend/src/app/categories/[slug]/page.tsx`, `frontend/src/components/navbar/SearchBar.tsx`, `frontend/src/components/product/CatalogBrowser.tsx`, `frontend/src/components/product/ProductCard.tsx`
- Test: `frontend/src/lib/catalogFilters.test.ts`, catalog/commerce tests, focused tests for confirmed behavior

- [ ] Step 1: Verify debounce, cancellation/stale-response handling, keyboard suggestions, clear behavior, and tri-state query rendering.
- [ ] Step 2: Verify category slug and ID handling against backend route contracts.
- [ ] Step 3: Verify filter pills, sorting, pagination, out-of-stock state, wishlist/add-to-cart actions, and event propagation.
- [ ] Step 4: Add failing tests only for confirmed defects, then implement and run them.
- [ ] Step 5: Check card content at narrow widths with long titles, missing images, discounts, and unavailable products.

---

## Wave 3: Product Detail, Cart, Checkout, and Orders

### Task 8: Verify product detail information architecture and imagery

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/products/[slug]/page.tsx`, `frontend/src/components/product/ProductGallery.tsx`, `ProductImage.tsx`, `VariantSelector.tsx`, `ReviewSection.tsx`
- Test: focused product-detail tests where needed

- [ ] Step 1: Trace real product, variant, stock, review, delivery, and image data.
- [ ] Step 2: Add tests for confirmed missing/error/empty/unsafe rendering behavior.
- [ ] Step 3: Fix only verified issues with price hierarchy, image sizes/aspect ratios, selected-image accessibility, variant availability, or safe review rendering.
- [ ] Step 4: Verify primary image priority/LQIP behavior and that every fill image has an appropriate `sizes` value.

### Task 9: Verify cart and checkout state honesty

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/cart/page.tsx`, `frontend/src/components/cart/`, `frontend/src/store/cartStore.ts`, `frontend/src/app/checkout/page.tsx`, `frontend/src/components/orders/PaymentPanel.tsx`, `frontend/src/lib/payment.ts`, `frontend/src/lib/razorpay.ts`
- Test: cart store tests, payment tests, commerce tests, new focused tests for confirmed gaps

- [ ] Step 1: Test stock/price changes, item removal failure, empty cart, guest/auth merge, payment pending/failure/cancel/uncertain states, and refresh persistence.
- [ ] Step 2: Add failing tests for each confirmed defect.
- [ ] Step 3: Implement minimal fixes using rollback, `getApiError`, `isUncertainError`, and existing query invalidation patterns.
- [ ] Step 4: Ensure final total, payment method, shipping/tax values, and post-payment outcome are visible and never fabricated.
- [ ] Step 5: Verify no duplicate payment submission is possible during the Razorpay lifecycle.

### Task 10: Verify orders, tracking, invoices, and reviews

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/orders/`, `frontend/src/components/orders/`, `frontend/src/hooks/useOrderUpdates.ts`, `frontend/src/hooks/useSocket.ts`, `frontend/src/components/product/ReviewSection.tsx`
- Test: socket/order-status/payment/review tests as applicable

- [ ] Step 1: Verify order list/detail tri-state behavior and 401/session-expiry handling.
- [ ] Step 2: Verify socket event names, unsubscribe cleanup, polling backstop, and disconnect/reconnect messaging.
- [ ] Step 3: Verify status timeline, payment status, invoice availability, cancellation/return/refund distinctions, and review eligibility.
- [ ] Step 4: Add and pass focused tests for confirmed failures only.

---

## Wave 4: Admin Operations

### Task 11: Verify dashboard metrics and synchronization truthfulness

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/admin/page.tsx`, `frontend/src/components/admin/StatsCard.tsx`, `RevenueChart.tsx`, `frontend/src/lib/syncConfig.ts`
- Test: focused query/state tests and existing frontend tests

- [ ] Step 1: Trace every dashboard metric to its backend response and scope label.
- [ ] Step 2: Verify loading, error, empty, retry, socket/live, and polling states.
- [ ] Step 3: Add tests for confirmed fake-zero, fake-delta, stale-sync, or chart-state defects.
- [ ] Step 4: Implement the smallest fix and verify charts remain accessible and data-backed.

### Task 12: Verify admin tables and forms

**Files:**
- Inspect/modify only confirmed files among `frontend/src/components/admin/DataTable.tsx`, `ProductForm.tsx`, `frontend/src/app/admin/products/`, `categories/`, `orders/`, `users/`, `delivery/`, `profile/`
- Test: focused form/table tests and existing tests

- [ ] Step 1: Verify server-side sorting/pagination, mobile card presentation, row expansion, action labels, status transitions, and rollback behavior.
- [ ] Step 2: Verify product form grouping, field labels, adaptive validation, server field errors, image handling, and save states.
- [ ] Step 3: Verify destructive actions use `ConfirmDialog` and never silently mutate.
- [ ] Step 4: Add focused failing tests for confirmed defects and implement minimal fixes.
- [ ] Step 5: Verify admin role confinement and preview/detail routes remain correct.

---

## Wave 5: Delivery Operations

### Task 13: Verify delivery task flow and mobile action safety

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/delivery/`, `frontend/src/components/delivery/`, `frontend/src/hooks/useOrderUpdates.ts`, `frontend/src/lib/orderStatus.ts`
- Test: order transition tests, delivery-focused frontend tests, backend transition tests when behavior is involved

- [ ] Step 1: Verify assignment loading/empty/error states, notification behavior, customer phone source, map URL encoding, and invoice access.
- [ ] Step 2: Verify the UI exposes only legal next actions from the mirrored transition graph.
- [ ] Step 3: Verify duplicate taps, per-row pending state, lost responses, offline queue behavior, reconnect reconciliation, and honest confirmation copy.
- [ ] Step 4: Add failing tests for confirmed defects, then implement the smallest frontend fix; change backend only if a failing contract test proves the backend is wrong.
- [ ] Step 5: Verify primary actions are at least 48px and reachable at 375px without horizontal overflow.

### Task 14: Verify delivery profile and approval states

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/delivery/profile/page.tsx`, `frontend/src/app/delivery/register/page.tsx`, `frontend/src/components/auth/AuthForm.tsx`
- Test: focused auth/profile tests

- [ ] Step 1: Verify pending, approved, and rejected states are distinct and honest.
- [ ] Step 2: Verify registration field validation, server errors, OTP flow, and no enumeration regressions.
- [ ] Step 3: Fix only confirmed issues and rerun focused tests.

---

## Wave 6: Accessibility, Responsive, Performance, and Content QA

### Task 15: Run static accessibility and responsive audits

**Files:**
- Modify only confirmed files among `frontend/src/app/`, `frontend/src/components/`, `frontend/src/app/globals.css`
- Configuration: `frontend/.eslintrc.json` only if the audit proves configuration drift

- [ ] Step 1: Run frontend lint and inspect all jsx-a11y findings.
- [ ] Step 2: Search for unlabeled inputs, missing focus rings, invalid aria states, unsafe autofocus in overlays, missing image `alt`, and below-floor targets.
- [ ] Step 3: Search for horizontal overflow, fixed-width controls, unsafe viewport units, and duplicated viewport metadata.
- [ ] Step 4: Add focused tests or source assertions for confirmed regressions.
- [ ] Step 5: Fix confirmed issues using existing primitives and responsive tokens; do not make arbitrary global style changes.

### Task 16: Audit assets, fonts, motion, and performance paths

**Files:**
- Inspect/modify only confirmed files among `frontend/src/app/layout.tsx`, `frontend/src/app/globals.css`, `frontend/next.config.ts`, `frontend/src/components/common/HeroBackground.tsx`, image consumers
- Test: frontend build and targeted source checks

- [ ] Step 1: Verify next/font-only loading, configured font variables, Cloudinary loader behavior, image `sizes`, priority, and stable aspect ratios.
- [ ] Step 2: Verify WebGL gating, disposal, visibility pause, reduced-motion fallback, and no mobile canvas below the intended breakpoint.
- [ ] Step 3: Verify no forbidden layout-property animation or decorative motion leaks into admin, delivery, checkout, auth, cart, or orders.
- [ ] Step 4: Fix only confirmed issues and rerun build.

### Task 17: Audit factual content and trust copy

**Files:**
- Inspect/modify only confirmed content files among `frontend/src/app/about/page.tsx`, `frontend/src/app/help/page.tsx`, `frontend/src/components/layout/Footer.tsx`, customer trust/order/payment surfaces

- [ ] Step 1: Search all user-facing copy for unsupported metrics, guarantees, delivery claims, testimonials, review counts, and fake contact details.
- [ ] Step 2: Verify each claim against a real endpoint/configuration or remove/rephrase it as non-factual product guidance.
- [ ] Step 3: Verify payment, returns, delivery, invoice, and support copy describes actual behavior.

---

## Wave 7: Full Verification and Handoff

### Task 18: Run the final automated verification matrix

**Files:**
- Test only: `frontend/`, `backend/`

- [ ] Step 1: Run frontend `npm test`.
- [ ] Step 2: Run frontend `npm run lint`.
- [ ] Step 3: Run frontend `npm run build`.
- [ ] Step 4: Run backend tests.
- [ ] Step 5: Run backend lint.
- [ ] Step 6: Re-run source audits for mocks, forbidden APIs, dead links, unsupported claims, invalid classes, and effect cleanup.
- [ ] Step 7: Record exact output and any environment-blocked checks; do not claim green status without command evidence.

### Task 19: Perform targeted runtime/browser QA

**Files:**
- No code changes unless a reproduced defect is found; fix through the applicable earlier task.

- [ ] Step 1: Start the application using the project run instructions.
- [ ] Step 2: Exercise customer browse/search/PDP/cart/checkout/order flows with real or explicitly documented test data.
- [ ] Step 3: Exercise admin dashboard/order/product/user flows.
- [ ] Step 4: Exercise delivery assignment/status/contact flows.
- [ ] Step 5: Test keyboard, touch-sized controls, reduced motion, slow/offline responses, socket disconnect, refresh, and back navigation where practical.
- [ ] Step 6: Test Chromium and any available WebKit/Firefox environments; record unavailable browsers.

### Task 20: Update documentation and handoff

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `CLAUDE.md` only for verified source/documentation drift
- Modify: this plan with completion evidence

- [ ] Step 1: Document only completed, verified changes and explicitly list accepted limitations.
- [ ] Step 2: Update known-open items if their status changed.
- [ ] Step 3: Record test commands and results, including blocked live E2E or browser checks.
- [ ] Step 4: Preserve the user's existing uncommitted changes and do not commit unless separately authorized.

## Wave 0 Audit Evidence (2026-09-13)

- Working tree: already contained the broad P7/P8 product-experience wave plus backend checkout/assignment/reaper changes; no existing changes were discarded.
- Frontend baseline: `npm test` passed (8 files, 31 tests); `npm run lint` passed with no warnings/errors; `npm run build` passed and generated 37 routes.
- Backend baseline: `npm test` passed (15 files, 91 tests); `npm run lint` completed with 0 errors and 35 existing `no-explicit-any` warnings.
- Environment note: Bash path syntax was incompatible with this Windows checkout; verification was rerun successfully with PowerShell.
- Initial source scan found no application `alert()`/`confirm()` calls, no `MOCK_` application constants, and no duplicate viewport configuration. The XSS strings found in `backend/audit-harness.js` are intentional security-test inputs.
- Confirmed residual polish issues fixed in this pass: `frontend/src/app/global-error.tsx` now uses the approved `space-950` background, `100svh`, safe horizontal padding, readable muted text, and a 44px button; `frontend/src/app/error.tsx` now uses a specific transition property, stronger border/focus treatment, and a 44px target.
- Post-fix frontend verification: tests passed (8 files, 31 tests), lint passed, and production build passed (37 routes). Backend tests passed (15 files, 91 tests). Backend lint remains 0 errors/35 existing warnings.

## Completion Criteria

- Every retained defect in the verified-gap ledger is fixed or explicitly accepted with evidence.
- Frontend tests, lint, and build pass; backend tests and lint pass, or failures are documented with exact output and root cause.
- No unsupported product claims, mock data, dead links, forbidden feedback APIs, or role-boundary regressions remain in application code.
- Customer, admin, and delivery flows retain distinct information density and motion budgets.
- Responsive and accessibility checks pass for the required baseline widths and interaction modes that are available in the environment.
- Documentation reflects actual code behavior rather than aspirational behavior.
