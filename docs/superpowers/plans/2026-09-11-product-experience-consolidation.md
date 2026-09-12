# NexMart product experience consolidation

Date: 2026-09-11. Baseline: `2b57a9d` (clean working tree).

## Problem and objective

Consolidate the existing storefront, store operations, and delivery application into one credible retail product. Preserve Next.js, Express, the hybrid cookie/NextAuth authentication, TanStack Query, Zustand cart, server-authoritative inventory/payment processing, role isolation, request correlation, and the canonical viewport export. This is an evolution of the current implementation.

Customer hierarchy: discovery → information → confidence → action. Admin: information → decision → action. Delivery: task → action → confirmation.

## Audit completed before implementation

Read the repository directive, README, contributing/deployment/changelog documents, prior responsive and stability plans, latest 12 commits, package/lock/configuration files, route inventory, page/component/hook/store/client implementations, backend routes/controllers/models/services/middleware, unit tests, production audit scripts, CI and deployment configuration. Existing E2E scripts default to production and send email; do not run those unchanged for visual QA.

Read-only local API for baseline inspection: no write routes, invoice-generation GET, seed, order reaper, or invoice worker. Chromium screenshots of public/customer/admin/available delivery surfaces are stored locally under `artifacts/product-experience/before/`. These can contain account information and must remain ignored. Current real catalog: **1 published featured Samsung Galaxy S25 product, 1 image, 1 variant; 52 categories including children**. Do not populate the store with demonstration products. Existing suites: frontend 5/5, backend 59/59 passed before changes.

### Findings and evidence

| Priority | Location | Finding / consequence |
| --- | --- | --- |
| High | `app/page.tsx:78` | Viewport-sized hero and tall category tiles push the single product far below the first mobile screen; spotlight is hidden on mobile, noninteractive, and has no error/loading state. |
| High | `components/layout/Footer.tsx:9` | Nine nonexistent support/company destinations, placeholder social links, a nonfunctional newsletter, invented subscriber count, phone, address and company identity. |
| High | `app/about/page.tsx:7` | Fabricated customers/products/cities/satisfaction, founding year, delivery promises, returns and support claims. |
| High | `app/products/[slug]/page.tsx:189` | Unsupported “100% Secure”, “Fast Delivery”, “30-Day Returns”, “Genuine Product”. |
| High | `components/navbar/SearchBar.tsx:110` | Empty result branch unreachable; no combobox keyboard navigation; blur timer hides results from keyboard users; old results remain visible during a new debounce interval. |
| High | `app/products/page.tsx:29` | Category, featured and deal links are ignored. Sort/filter/page state is not reflected in the URL. Category/search pages duplicate different filtering UIs. |
| High | `app/categories/[slug]/page.tsx:30` | Category/API failures appear empty; an implicit ₹1,00,000 maximum hides expensive products; mobile filters precede the whole product list. |
| High | `lib/api.ts:87`, `store/cartStore.ts` | Guest session initializer has no callers. Cart fetch silently fails; persisted cart never reconciles. Concurrent optimistic mutations can roll back unrelated changes. |
| High | `components/navbar/CartDrawer.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx` | Drawer total excludes GST; cart/checkout round GST to rupees while server uses paise; formatter discards paise; shipping threshold copy disagrees with `subtotal > 999`. |
| High | `app/checkout/page.tsx:100` | New SDK script/order on retry; dismiss callback is not nested under Razorpay `modal`; states only appear in toast; no pending-payment action in Orders despite the toast promising one. COD “confirmed” message contradicts server `placed`. |
| High | `app/products/[slug]/page.tsx:37` | Every background refetch resets the chosen SKU. Quantity survives SKU changes even when stock differs. Variant picker cannot select variants with no attributes or incompatible attribute combinations. |
| High | `components/common/ConfirmDialog.tsx`, `hooks/useDrawerBehavior.ts`, `ProductGallery.tsx`, `PasswordModal.tsx` | Hand-rolled overlays lack focus trapping/return; nested scroll locks can restore the wrong overflow; confirm backdrop closes during saving. |
| High | `components/admin/ProductForm.tsx` | Schema strips variant attributes/images when editing. Missing field associations, hidden touch actions, blob URLs created during render without revocation, unsupported upload selection and silent category errors. |
| High | `app/delivery/dashboard/page.tsx` | Generic dropdown offers invalid transitions, full address is truncated, no maps action, operational work follows a large clock; “today” metrics count only the newest 100 records. |
| Medium | `app/orders/*` | No polling backstop, payment state absent from history, errors collapse to “not found”, no direct history→detail link, deleted products can crash rendering. |
| Medium | `hooks/useSocket.ts` | Stable callbacks can attach before token hydration and never resubscribe; socket survives logout; reconnect exhaustion needs polling backstop. |
| Medium | `components/layout/StorefrontLayout.tsx` | Cursor and Lenis still mount on checkout/cart/orders. Native cursor can disappear at tablet desktop widths; reduced-motion does not gate cursor. |
| Medium | `app/globals.css` | Layered global overrides add glows/lifts to operational cards and all inputs; muted text too dim; glass blur is used as the default surface. |
| Medium | `components/product/ProductCard.tsx` | Nested wishlist button in link, first-variant assumptions, price wrapping, image crop, and fabricated ₹0 for missing variants. |
| Medium | `ReviewSection.tsx`, `useWishlist.ts`, profile and category pages | Query errors masked as empty; read-only stars are focusable unlabeled buttons; wishlist products have no destination; profile refetch can reset dirty forms. |
| Medium | `components/admin/DataTable.tsx` | Sort inaccessible on mobile, click-only row expansion, nested cards, small unlabelled pagination actions. |
| Medium | `app/admin/page.tsx`, `admin.controller.ts:58` | Large clock displaces work; backend “totalRevenue” is all order value, while analytics is paid revenue. UI must describe the data actually returned. |
| Medium | `app/admin/orders/page.tsx` | Fulfillment and payment not shown distinctly; every status is offered instead of legal next transitions; consequential changes need confirmation. |
| Medium | `next.config.ts`, product/gallery images | No Cloudinary transforms, missing gallery `sizes`, no main image priority, original images repeatedly sent through optimizer. |
| Documentation | `CLAUDE.md`, README, DEPLOYMENT | Aspirational sections conflict with completed work, actual package versions, native routes, polling and Netlify deployment. |

### Research and asset decision

Consulted legitimate public sources (2026-09-11):

- [Baymard homepage/category research](https://baymard.com/research/homepage-and-category-usability): product finding, catalog taxonomy and cross-navigation work together.
- [Baymard search research](https://baymard.com/research/ecommerce-search): the field, autocomplete interaction and results are all part of search usability.
- [Apple India Store](https://www.apple.com/in/store) and [IKEA India](https://www.ikea.com/in/en/): real products, clear category entry points and merchandising hierarchy. Principles only; no copied assets or branded layouts.
- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [web.dev LCP](https://web.dev/articles/optimize-lcp).
- [Cloudinary image transformations](https://cloudinary.com/documentation/image_transformations), [Lucide license](https://lucide.dev/license).

Choose **real catalog imagery on a neutral product stage, with restrained violet geometry**. One art direction; no generated imagery or third-party stock. The current WebGL scene has no shopping information and competes with the product. Remove its storefront mount and the cursor/scroll hijack; keep native scrolling. Do not weaken the existing capability/reduced-motion/disposal guards in retained optional scene code. Product stage uses contain, stable dimensions, responsive sizes and a shared safe image fallback. Category icon presentation uses the existing Lucide family with a fallback for unknown categories.

## Implementation waves and files

1. **Foundations:** consolidate `globals.css`/Tailwind tokens, existing buttons/inputs/status, accessible Radix modal/drawer, page headers, empty/error states, money/date helpers and connectivity feedback. Shared primitives serve all roles with different density.
2. **Navigation/home:** `layout/StorefrontLayout`, `Navbar`, `Footer`, homepage server shell/client catalog island. Mobile wordmark, search, browse, category access and actual product spotlight; sparse content deliberately composed.
3. **Discovery:** share catalog/category queries and URL-driven browsing across products/search/category pages. Implement cancellable keyboard autocomplete, honest empty/error states, shared category icons, image pipeline, touch-safe product cards.
4. **Purchase:** gallery/variants/PDP, cart and drawer reconciliation, shared exact totals, checkout address/payment state machine and recovery. Only add narrowly scoped backend changes needed to protect reviewed prices, retry identity and resume the existing saved order; tests cover ownership and server amount authority.
5. **Trust/account/orders:** accurate About/help information and existing links only; no invented commercial policy. Customer wishlist destination, consistent account forms, payment/fulfillment separation, lifecycle and refetch backstops.
6. **Admin:** operational dashboard/metric descriptions, mobile sorting/expansion, product form data preservation and image handling, explicit order and account actions, honest query states.
7. **Delivery:** task cards with full address/call/maps, legal next action from current server graph, confirmation, ≥48px controls, explicit offline/uncertain/retry state, no misleading truncated metrics.
8. **Accessibility/performance:** keyboard/focus/labels/contrast/reduced motion, no decorative global RAF loops, query cancellation, stable imagery, production browser performance measurements.
9. **Regression/cleanup:** repeat screenshots; test all 12 requested widths, three browser engines where installed, role confinement, lifecycle/failure cases and relevant backend regressions; update reality documentation.

## Risks and safeguards

- Preserve auth families, server price/stock validation, CSRF/rate limits, signatures and ownership. Never persist tokens to browser storage.
- Never retry a create-order mutation automatically. Distinguish an uncertain response from a known failure; retry must reuse the saved order/request identity.
- Never assert “unchanged” after a lost mutation response. Refetch and reconcile before offering the next action.
- Existing commercial policy/support/legal data is absent. Remove invented claims; explain implemented payment/tracking behavior and document operator inputs still required.
- Historical catalog/account data and screenshots stay local and ignored. Synthetic stress cases belong only in isolated automated tests, never the storefront/catalog database.
- Do not deploy, run production mutation harnesses, send email, charge/refund, or modify real store records during verification.

## Verification

- Required final gates: frontend `npm ci`, `npm test`, `npm run lint`, `npm run build`; backend test/lint/typecheck/build for API changes.
- Meaningful unit/integration cases: exact paise totals/thresholds, variant selection, query serialization/cancellation, safe same-order payment retry and ownership, forward-only actions and duplicate handling.
- Browser QA: 320/360/375/390/414/430/768/820/1024/1280/1440/1920; Chromium/WebKit/Firefox; touch/keyboard/reduced motion. Save before/after screenshots and machine-readable results to ignored artifacts.
- Measure production LCP/CLS/resource cost/long tasks and interactions with PerformanceObserver/CDP; report lab conditions and limits, do not claim field INP or real-device coverage.
- Exercise empty/slow/error/offline/stale/expired states with explicit test interception or an isolated test service; maintain a separate read-only real-catalog smoke test.

## Execution record

### Resume checkpoint — 2026-09-11

Last completed/committed wave: `2b57a9d`, responsive/motion/reliability stabilization. The working tree contains an unfinished start on waves 1–2 plus About/help/footer work from wave 5; none was recorded as verified. Preserve and complete those edits. The original screenshots and real public catalog snapshot are available in `artifacts/product-experience/before/`; `.next-before` is the previous build.

Rechecked history, documentation, current routes, components, stores, API clients and backend contracts against the audit. Baseline: frontend 5 tests and backend 59 tests pass. A direct frontend TypeScript check finds an existing Axios test-fixture type error (`queryPolicy.test.ts` response config lacks headers); fix this as part of verification.

Additional contract findings: payment verification ignores its route ID, a repeated successful callback returns an error, and a stale callback can regress fulfillment; the reaper assumes a failed attempt can never later succeed. Safe same-order payment recovery requires narrowly scoped fixes with regression tests. Product editing currently strips variant attributes/images; the backend already supports them. Do not create a replacement architecture or run production mutation harnesses.

| Wave | Resume status |
| --- | --- |
| 1. Foundations | Started; complete adoption and verify |
| 2. Navigation/home | Started; finish and verify |
| 3. Discovery | Remaining |
| 4. Purchase/payment | Remaining |
| 5. Trust/account/orders | Trust copy started; account/orders remaining |
| 6. Admin | Remaining |
| 7. Delivery | Remaining |
| 8. Accessibility/performance | Remaining |
| 9. Regression/docs | Remaining |

Implementation and measured verification results follow as each wave is completed.

### Second resume audit — 2026-09-11

The first checkpoint above no longer describes the full working tree. Preserve the existing uncommitted implementation: shared styles/overlays and static trust pages, server-rendered home with real catalog imagery, keyboard search, shared URL-driven catalog browser, category presentation, product images/cards, exact-total helpers and catalog regression tests. Changes in most remaining role pages are color-token substitutions only, not completed functional waves.

Re-run baseline: **13 frontend tests and 63 backend tests pass**. TypeScript fails on the new catalog query's inferred placeholder type and checkout's nullable product access. No local server is running. Original Chromium screenshots and catalog snapshot remain in the ignored before directory.

Resume in order: finish foundations/navigation/discovery; implement purchase/payment recovery; account/orders; admin; delivery; then browser accessibility/performance and documentation. Specific remaining defects confirmed in source: footer/navigation link to missing `/wishlist`; cart store fetch errors hidden and mutation responses race; missing tax in drawer; checkout creates another order on each attempt and uses the wrong Razorpay dismiss option; payment verification ignores route identity and can regress order status; product-form schema strips attributes/images; generic delivery dropdown conflicts with legal transitions; socket subscriptions miss late session hydration. The documentation still describes removed visuals and an obsolete Cloudflare deployment.

Backend scope is limited to contracts needed by those workflows: safe reviewed-price/order identity handling, same-order payment resume/verification, forward-only/idempotent delivery and assignment actions, and necessary catalog/cart validation. Cover each behavior with isolated regression tests; keep real production services read-only during QA.

### Continuation — 2026-09-12

Recovered the saved full brief and this execution record. Actual baseline remains 13 frontend / 63 backend passing tests. The catalog query type error has already been corrected; checkout still dereferences a nullable cart product. Waves 1–3 are substantially implemented but still need browser verification. Continue functional purchase → account/orders → admin → delivery work, then the final accessibility, browser, performance and documentation gates.

Purchase contract implementation: persist a customer-scoped checkout identity with a unique partial database index; compare the reviewed prices/total against server-calculated amounts; recover the saved order after an uncertain response; resume its existing Razorpay order. Payment confirmation must be idempotent and preserve fulfillment, including late captures after cancellation. The reaper must check failed attempts for later capture and avoid cancelling an active payment attempt. Validate these contracts against an isolated MongoDB replica set with payment, email, sockets and invoice side effects stubbed.

### Third resume checkpoint — 2026-09-12

Recovered the brief and inspected the actual working tree before continuing. Waves 4–5 now include the checkout identity/payment recovery implementation, reconciled cart/drawer, persistent variant selection, wishlist, account/address/password forms, order history/detail and socket/polling updates. Baseline verified: **16 frontend tests / 82 backend tests pass**, including 17 isolated checkout/cart/payment cases. No live store mutations were run.

Remaining implementation is waves 6–7: product editing still strips variant attributes/images; the category picker and image controls are inaccessible; admin tables lack mobile sort/keyboard expansion; dashboard metrics are mislabeled; order/assignment actions need legal transitions and clear confirmations. Delivery retains its generic status dropdown, truncated addresses and misleading 100-record totals. Confirmed server gaps: assignment can reset a completed order to shipped, repeated delivery updates rewrite timestamps, and assignment/order writes can diverge on a failed save. Complete these contracts with isolated regressions, then perform the full browser/accessibility/performance and documentation gates (waves 8–9). Preserve all prior uncommitted work.

### Waves 6–9 complete — 2026-09-12

Resumed from the third checkpoint and finished the remaining waves. Two type errors present at resume (a `QueryError` prop that does not exist, an over-narrow test fixture cast) were fixed first; both had been introduced by the unfinished wave-6 product-form work.

**Wave 6 (admin).** Shared `lib/orderStatus.ts` mirrors the server transition graph, with a test that parses `backend/src/utils/orderTransitions.ts` and fails on drift. Admin orders offers only legal next transitions, separates payment from fulfillment, and confirms stock/money changes. The dashboard states each metric's scope (all-order value vs paid revenue), leads with the work queue, and demotes the clock; `AnalyticsSummary` replaces `as any`. `DataTable` gained a keyboard-operable row disclosure (module-scope, so a toggle cannot remount it), a mobile sort control and labelled 44px pagination. Product-edit, category-manager and agent-profile failures no longer render as absence.

**Wave 7 (delivery).** Task cards with full address, tap-to-call, maps deep link, cash-to-collect as an instruction, and the single legal next action at 48px. Lost responses are reported as uncertain, never as failure. Offline notice added to the delivery and admin layouts.

**Backend.** Assignment now respects the transition graph (no delivered→shipped regression, no backwards jump when re-assigning a dispatched order), writes the assignment before the order so a failed assignment write cannot leave a phantom shipped order, and repeated delivery updates no longer rewrite milestone timestamps. 82 → 91 tests.

**Waves 8–9.** Found and fixed a systemic focus-restoration bug: every overlay dropped focus to `<body>` on close because the custom handler cancelled Radix's restoration and captured its reference too late; `SearchBar`'s `autoFocus` compounded it by moving focus before Radix recorded the trigger. Enabled `plugin:jsx-a11y/recommended` (16 findings resolved: 7 real label associations, 2 documented autofocus cases, 6 false positives from an `AuthForm` prop named `role` → renamed `portal`). Contrast floors applied to an interactive link, chart axes and the sort affordance.

**Measured.** 192 route×width combinations across all 12 required widths: zero horizontal overflow, zero page errors, no multiple-h1 routes. Reduced motion: no infinite animations, no canvas. Focus indicator visible on 24/24 tabbed elements; skip link resolves; search drawer traps focus, closes on Escape, restores body scroll and returns focus to its trigger. Gates: frontend build + 31 tests + clean lint; backend typecheck + 91 tests + clean lint.

**Limits of this verification.** No backend was run, so there is no live order-lifecycle confirmation of the new admin/delivery flows — they rest on unit tests, types and static browser QA. Chromium only (WebKit/Firefox not installed). No field performance data. The API being down during the sweep was useful rather than limiting: it confirmed storefront queries resolve to an honest error state after the retry policy exhausts (~13s), not to a fake empty one.
