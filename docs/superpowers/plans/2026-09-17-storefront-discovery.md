# Storefront discovery and catalog rebuild

## Objective

Implement the requested richer storefront, product merchandising, reliable search/filtering, category-wise starter products, and discoverable shopping/legal information. Preserve existing products, accounts, orders, and category IDs.

## Evidence before implementation

- `/products` uses substring search; `/search` uses Mongo full-text OR semantics. Suggestions therefore disagree with browsing and miss partial model names.
- Price filtering/sorting uses `variants.0.price`, while stock filtering can match another variant. Cards and detail pages also choose different variants.
- Parent-category filtering does not traverse descendants. Category pages wait for a category-detail request before starting the products request.
- Product list responses include embedded reviews and long descriptions. Search fetches results and counts sequentially. Featured/category cache writes delay responses.
- Homepage awaits both API requests before rendering its shell, with a five-second timeout. Its random request-id header also fragments Next fetch cache keys.
- `seedCategories.ts` deletes all categories, breaking referenced IDs.
- Public product-by-ID requests expose unpublished products.
- Screenshots show a single product, almost no merchandising, long native category dropdowns, and no terms/privacy/shipping/returns/contact destinations.

## Work sequence and interfaces

1. Add integration regressions against isolated MongoDB for search, descendant categories, same-variant price/stock, sort order, public visibility, and compact response shapes. Run red before changes.
2. Introduce one catalog-query service behind both product and search routes. Validate and normalize inputs, return honest facets and a selected-variant summary, and use one aggregate for results/counts. Keep legacy sort URLs compatible. Add bounded partial/typo search with clear correction metadata.
3. Replace destructive seeding with additive upserts. Add an explicitly labelled demo collection, with INR sample prices, meaningful specifications/variants, and photo provenance. Protect sample items from real checkout.
4. Build shared public data loading and streaming boundaries. Preserve cached results during navigation; remove request waterfalls and unnecessary cache round trips.
5. Rebuild storefront navigation, homepage collections, visual category directory, URL-backed facet filters, richer product cards/quick view, product comparison, and product details. Retain dark NexMart tokens, mobile density, keyboard support, and reduced motion.
6. Add terms, privacy, shipping, returns/cancellation, and contact pages. Use a single business-details configuration; mark missing business facts and operational policies as drafts, with no invented guarantees. Improve About/Help and link policies from purchase/auth surfaces.
7. Verify frontend/backend tests, lint, builds, responsive Chromium browsing (375px and desktop), search/filter/history, dialog keyboard use, image loading, and seeded category coverage. Record source research, measured findings, changes, and remaining launch requirements.

## Authorization and data integrity

The user's request for starter category-wise merchandise authorizes demo catalog data for this task, an explicit exception to the repository's general ban on mock content. Demo products remain clearly labelled and cannot be purchased as real inventory. Seeding is idempotent and never deletes or overwrites unowned products/categories. Existing real catalog data remains usable.

The user has been asked asynchronously for legal identity/contact and shipping/return terms. Independent implementation continues with explicitly draft policies until those facts are supplied. No deployment or live checkout is implied by this work.

## Verification and handoff

Completed 19 September 2026:

- Frontend: 49 Vitest tests passed, lint clean, production build generated 59 routes.
- Backend: 189 Vitest tests passed across 29 suites, lint 0 errors (72 legacy `any` warnings), production build and test typecheck passed.
- Database: guarded additive seed applied to `nexmart`; 60 labelled zero-stock samples inserted, immediate rerun idempotent, original product/category/account/order/cart records preserved by the seed contract and post-seed inspection.
- Static gates: `git diff --check`, opacity, native-dialog, and query-key gates clean.
- Browser QA: Playwright configuration and 14 desktop/mobile scenarios are prepared, but execution is blocked because the environment rejected starting the isolated Next preview server. This is an explicit verification gap, not a passing result.

Research, source links, data-flow notes, seed provenance, and launch blockers are recorded in `docs/STOREFRONT-AUDIT-2026-09-19.md`. No commit, push, or deployment was performed.
