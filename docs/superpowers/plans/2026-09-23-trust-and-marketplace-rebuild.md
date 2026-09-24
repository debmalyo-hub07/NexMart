# NexMart trust and marketplace rebuild

The requested outcome is a credible, useful marketplace with a coherent shopping and seller experience, verified authentication/payment boundaries, and a reproducible Render deployment. Existing implementation and isolated browser evidence take precedence over older audit claims.

## Inspect before changing

- Read the current frontend, role authentication, cart, checkout, payment reconciliation, seller inventory, fulfillment, and deployment configuration.
- Run the existing tests against disposable databases. Baseline: backend 29 suites / 191 tests; frontend 11 suites / 49 tests passed.
- Capture desktop and 375px browser evidence under `artifacts/rebuild/before/`. No live database writes or real payment requests.
- Review official Amazon India, Flipkart, commerce usability, payment, and hosting references. Keep citations and access limitations in `docs/research/marketplace-2026-09-23.md`.

## Confirmed implementation issues to address

1. CORS omits `Idempotency-Key`, blocking seller inventory writes across origins.
2. Optional cart authentication misses credential-change revocation. Socket authentication verifies only the signature; it misses account status, revocation, and seller role support.
3. Frontend password login authenticates twice and creates different backend tokens. NextAuth accepts a client-supplied role during session update and Google backend refusal can still return a successful frontend sign-in.
4. Logout decodes unsigned claims and overlooks bearer-only sessions. Redis outages remove brute-force controls.
5. Pincode UI invents delivery dates and universal returns without coverage or customer return endpoints. Product prices include tax but shipping still affects the final total.
6. Customer cancellation/return requests and an admin handling queue are missing. The existing payment/refund/fulfillment boundaries must be preserved.
7. Deployment URLs inconsistently include `/api/v1`; frontend auth and rewrites append it again. Cross-site browser cookies and short cold-start timeouts impair the Netlify/Render experience. Render blueprint readiness and Node/install configuration need verification.
8. Navigation, category art, product cards, authentication, and seller dashboards do not form a consistent commercial design. Seller overview reports account checks but no operational workload.

## Implementation sequence

1. Add regressions for confirmed security and transport bugs, then repair session verification, login/logout, CORS, and bounded fallback protection. Audit installed dependencies and update verified vulnerable packages.
2. Normalize backend URLs and same-origin browser API transport; correct Render build/readiness configuration and document verified deployment requirements.
3. Add authenticated, ownership-bound after-sales requests with explicit status transitions, purchase-time policy snapshots, idempotency, and admin review. Requests alone must not refund money or restock merchandise.
4. Rebuild the storefront system, navigation, home merchandising, categories, catalog cards, purchase information, customer auth, and seller workspace. Use local licensed lifestyle assets for merchandising; actual product images and prices remain catalog data. Functional motion respects reduced-motion settings.
5. Add a catalog-backed basket planner and a seller operations overview using real inventory and fulfillment data. Make every action navigate or perform its stated operation.
6. Run builds, lint, meaningful unit/integration regressions, isolated customer/seller browser journeys, mobile overflow checks, keyboard checks, and accessibility checks. Record results and remaining external prerequisites in a new audit report and changelog.

## Constraints

- No invented reviews, sales counts, delivery guarantees, compliance badges, or stock.
- Do not publish legal/operator details that the operator has not supplied. Surface truthful policy and support status.
- Keep local fixtures and payment simulations isolated from the configured live services.
- User requested work authorizes reversible code and local verification. No production deployment, paid transaction, or external communication is needed to review this change.
- Full Amazon/Flipkart parity involves logistics, operating policies, financing, support operations, and integrations as well as software. Track remaining requirements explicitly; do not describe an unbuilt capability as delivered.
