# Marketplace experience rebuild — 20 September 2026

## Goal
Inspect the existing customer and seller journeys before editing, repair verified security and commerce defects, and replace the oversized dark editorial storefront with an approachable, photo-led marketplace. The user's new design direction supersedes the earlier dark/violet design requirements in CLAUDE.md.

## Work streams
1. Baseline: inspect public pages in a browser, map routes and current services, and start the existing isolated MongoDB/browser preview. Never use production orders for tests.
2. Security: trace authentication, session revocation, role boundaries, validation, uploads and rate limiting. Reproduce confirmed defects and add regression coverage.
3. Commerce: inspect price/stock authority, payment signatures, webhook replay handling, cancellations/refunds, seller permissions and fulfillment transitions. Fix verified defects with tests.
4. Research: compare documented Amazon India/Flipkart customer and seller capabilities and ecommerce usability guidance. Record sources, implemented features, missing services and operational dependencies; do not invent exclusivity.
5. Design: introduce coherent light storefront tokens, navy navigation, warm promotional imagery, compact photo categories and product grids. Improve customer account entry, catalog discovery and seller entry points. Keep honest sample labels and policy status.
6. Useful discovery features: implement a budget-first shopping aid and locally stored recently viewed products, with transparent behavior and working navigation.
7. Verify: frontend and backend unit/integration suites, builds, lint, isolated desktop/mobile browser journeys, keyboard interactions, reduced motion and screenshots. Record results and unresolved release requirements in the audit report and changelog.

## Files/interfaces
- Shared storefront styles, layout/navigation/footer/auth UI; home/catalog/category/product components.
- New presentation assets and discovery components with typed catalog inputs.
- Security and commerce fixes limited to findings proven during the audit.
- Research/audit reports, this plan, CLAUDE.md and CHANGELOG.md.

## Review boundary
Local implementation and isolated testing are authorized. Real inventory, legal/business details, payment merchant onboarding, logistics contracts and production deployment require actual operational configuration; software cannot fabricate them.
