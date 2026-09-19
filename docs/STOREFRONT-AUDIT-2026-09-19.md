# Storefront Audit & Handoff — 19 September 2026

## Result

The storefront discovery, catalog, seller-offer, cart, and policy work requested for this pass is implemented. The public catalog now has one query path for products and search, URL-backed facets, descendant-category visibility, same-variant price/stock matching, compact list payloads, typo-tolerant search metadata, and deterministic pagination/sorting. The customer experience includes a richer home merchandising layout, visual category directory, product cards, quick view, comparison, option continuity, seller offers, and policy/help destinations.

## Data flow

```text
Category/Product collections
        |
        v
catalog.service -> normalized filters -> one aggregate -> results/count/facets
        |                                      |
        v                                      v
  /products, /search                    CatalogBrowser / SSR snapshot
                                                |
                                                v
                              ProductCard -> PDP -> SellerOffers -> Cart offer snapshot
```

Catalog visibility is shared by browse, search, public product detail, seller storefronts, and seller offers. Inactive ancestors, orphaned/cyclic categories, unpublished products, hidden subcategories, demo samples, missing canonical options, inactive sellers, and mismatched inventory are filtered consistently. Cart and checkout revalidate the seller/listing/variant relationship and stock instead of trusting a client price.

## Research applied

- [Baymard: multiple filter values](https://baymard.com/research-articles/allow-applying-of-multiple-filter-values) and [applied filters](https://baymard.com/blog/how-to-design-applied-filters): OR within a facet, AND across facets, visible removable chips, and mobile apply behavior.
- [Baymard: product listing information](https://baymard.com/blog/product-listing-information): useful specifications, option-aware pricing, stock clarity, and scan-friendly cards.
- [Baymard: ecommerce search query types](https://baymard.com/research/ecommerce-search-query-types), [autocomplete design](https://baymard.com/blog/autocomplete-design), and [copying suggestions to the search field](https://baymard.com/research-articles/copy-search-suggestion-to-search-field): model/attribute matching, keyboard suggestions, and explicit approximate-result messaging.
- [Baymard product page research](https://baymard.com/research/product-page): option continuity, delivery/return context, reviews, and related products.
- [Consumer Protection (E-Commerce) Rules, 2020](https://consumeraffairs.nic.in/theconsumerprotection/consumer-protection-e-commerce-rules-2020) and [National Consumer Helpline FAQ](https://consumerhelpline.gov.in/faq-details.php?fid=E-Commerce): operator identity, grievance contacts, and the distinction between complaint handling and refund timing.
- [Razorpay refund guidance](https://razorpay.com/docs/payments/customers/customer-refunds): payment/refund status is separate from order status.
- [DummyJSON product data](https://dummyjson.com/docs/products), [DummyJSON licence](https://github.com/Ovi/DummyJSON/blob/master/LICENSE), and [Open Library covers](https://openlibrary.org/dev/docs/api/covers): provenance for the explicitly labelled, zero-stock sample catalog. Commercial image rights still require operator review.

## Starter catalog

The guarded command `npm run seed:catalog -- --apply --database=nexmart` inserted 60 products across 9 departments on the configured `nexmart` database. It added two missing child categories (`kitchen-appliances`, `fresh-produce`) and preserved existing category IDs, editorial fields, the original published Samsung product, inventory, orders, carts, and users. Every sample is named `Demo · …`, marked `isDemo`, carries a `nexmart-demo-2026-09` source marker, has zero stock, no reviews, and is blocked from cart, checkout, seller offers, and public seller catalogs. An immediate rerun returned `added: 0, preserved: 60`.

## Verification

- Frontend: 49 Vitest tests passed; lint reported no warnings/errors; production build generated 59 routes.
- Backend: 189 Vitest tests passed across 29 suites; build and test typecheck passed; lint reported 0 errors and 72 pre-existing/legacy `any` warnings.
- `git diff --check`: clean.
- Browser QA executed 2026-09-19 against the isolated preview (`previewStorefront.ts` on :4100 + Next dev on :3100, desktop 1440px and mobile 375px): **14/14 Playwright scenarios passed**. Four real defects were found and fixed during this pass (see CHANGELOG): a UTF-8 BOM that broke Turbopack dev rendering, cart lines losing variant-option labels (mongoose `Map` + `toObject` on populated docs), variant radios whose labels intercepted pointer events, and the cart drawer not opening when a concurrent owner transition invalidated the add's epoch. Playwright screenshots (home, categories, product, filters, comparison, cart, contact, login) are in `frontend/test-results/` and should be re-captured as `playwright-artifacts` per run, not committed.
- Added regression coverage for seller route boundaries, public seller data exposure, canonical publication/category visibility, seller inventory ownership, option continuity, selected-option availability, price-range labelling, and Quick View focus restoration.
- Playwright suite at `frontend/playwright.storefront.config.ts` with desktop and 375px projects was executed in a later pass on 2026-09-19; all 14 scenarios passed (see Verification above). The earlier environment limitation that had blocked the isolated preview server did not recur.

## Launch blockers

These require real operator decisions or production verification and were intentionally not fabricated:

1. Legal operator name, registered address, support channel, and grievance officer/contact.
2. Approved shipping coverage, delivery estimates, cancellation/return windows, category exclusions, warranty ownership, and refund timelines.
3. Privacy retention/deletion operations, deployed provider list, transfer/access controls, and consent choices.
4. Tax configuration: the existing flat 18% GST behavior remains unvalidated and must be reviewed before launch.
5. Commercial rights for third-party/sample imagery and final production image sources.
6. Browser QA at desktop/mobile, field LCP/INP/CLS measurements, and live payment/email/Redis verification.

The policy pages therefore remain visibly marked `Draft · pending business approval` and use `noindex` metadata until those facts are supplied.
