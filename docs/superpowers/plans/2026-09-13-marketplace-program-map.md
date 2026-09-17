# NexMart Marketplace Transformation — Program Map

**Created:** 2026-09-13
**Status:** map approved; Piece 0 in design

This sits above the per-piece plans in this directory and tracks a multi-piece
effort that spans many sessions.

---

## What this is

The directive is to transform NexMart from an admin-controlled ecommerce store
into a production-grade multi-vendor marketplace. That is roughly fourteen
spec → plan → build cycles, not one project. This file is the map: the pieces,
their dependency order, the decisions already locked with the user, and the
progress tracker.

Each piece leaves the application working with every gate green:

```
backend/   npm run lint && npm run typecheck && npm test
frontend/  npm run lint && npm run build && npm test
```

No piece is a big-bang rewrite. The two structurally destructive moments — the
catalog split (Piece 3) and the order restructure (Piece 4) — are each isolated
into their own piece with an idempotent, reversible migration script and a
first-party-seller landing zone for existing data.

---

## Starting reality (verified in code 2026-09-13, not assumed)

The platform is post-P0–P9: 7.3k LOC backend, 9.4k LOC frontend, 49 components,
15 backend test files, CI green. What matters for this effort:

**Auth is in better shape than the directive assumes.** Google sign-in is
already ID-token verified server-side against Google's tokeninfo (audience
checked, email must be verified at Google, fail-closed). Anti-enumeration is
real and deliberate across register / verify-otp / resend-otp (uniform opaque
202s, unconditional bcrypt for timing parity, OTP rate limit consumed before
lookup). Suspension is enforced per-request in `protectCustomer`, not just at
login. Tokens carry a `jti` and are blacklisted in Redis on logout. NextAuth
`maxAge` matches the 7-day backend cookie.

**The marketplace foundation is genuinely absent, and the conflicts are
structural rather than additive:**

- `Product.createdBy → ref: 'Admin'`. Price, stock and SKU live inside
  `variants[]` on the product document itself. There is no seam for a second
  seller to offer the same product.
- `Order.items[]` is flat. The order carries one `deliveryAgent` and one
  `deliveryId`. `DeliveryAssignment.order` is `unique: true` — one assignment
  per order, enforced at the database index level.
- Money at rest is float rupees (`Order.subtotal`, `tax`, `total` as `Number`).
  `checkout.controller.ts` does careful paise arithmetic internally and then
  divides by 100 to store. Tax is a hardcoded 18%; shipping is a hardcoded ₹49
  under ₹9,999. There is no ledger of any kind.
- Razorpay usage is plain orders / payments / refunds. No linked accounts, no
  transfers, no Route.

---

## Decisions locked with the user (2026-09-13)

1. **Razorpay Route is enabled in test mode.** Build against real Route APIs —
   linked accounts, transfers on capture, reversals on refund, transfer
   webhooks. Piece 6 opens with a live capability probe before any settlement
   code is written against assumptions.
2. **Existing data migrates to a first-party seller.** A system seller record
   ("NexMart Retail", pre-approved) takes ownership of every existing product
   and of the single fulfillment group on every existing order. First-party and
   third-party coexist, which is what real marketplaces do. Nothing is orphaned;
   no history is destroyed.
3. **Integer paise everywhere new, and existing orders migrate.** All new
   financial documents (ledger, fee snapshots, fulfillment groups, settlements)
   store integer paise. `Order` amount fields migrate to paise behind a version
   marker; the API converts at the edge so the frontend keeps receiving rupees.
4. **Decompose all, spec and build one piece at a time.** Cadence per piece:
   short design → user approval → TDD implementation → all gates green → next.
5. **CLAUDE.md rule 9 holds.** The hybrid auth double-login stays as-is and
   documented. It is load-bearing: the browser axios call is what sets the
   backend httpOnly cookie; NextAuth's server-side fetch cannot. No unification
   without a separate migration plan.

---

## The pieces

Dependency order. A piece may not start before its dependencies are green.

| # | Piece | Depends on | Why it sits here | Principal risk |
|---|-------|-----------|------------------|----------------|
| 0 | Customer auth repair + account UX | — | No schema dependency. Establishes the supertest integration harness every later piece reuses | Low; pure repair |
| 1 | Seller identity + seller auth | 0 | Everything downstream needs a seller to own things. Seeds NexMart Retail | New JWT secret / cookie / role across middleware and NextAuth |
| 2 | Seller onboarding + KYC + admin review | 1 | Approval must exist before an approved seller can list | Private document storage: authenticated Cloudinary delivery, admin-only access |
| 3 | Catalog: canonical product ↔ seller listing | 2 | First structural migration. Products become identity; price / stock / SKU move to listings | Every storefront read path changes (buy-box selection). Migration must be idempotent |
| 4 | Multi-seller orders + money → paise | 3 | One migration of `orders`, not two: fulfillment groups and integer paise land together | `DeliveryAssignment.order` unique index blocks multi-shipment; the checkout transaction must stay correct |
| 5 | Fee engine + immutable ledger | 4 | Needs groups and paise. Versioned config, snapshot frozen per group, append-only entries | Balance invariants; no silent mutation of history |
| 6 | Razorpay Route: linked accounts, transfers, settlement | 5 | Needs the ledger as authority — Route is an executor, never the source of truth | Route API surface must be confirmed live; SDK 2.9.2 may need a bump |
| 7 | Refunds / returns / chargebacks → reverse money | 6 | Needs settlement before you can claw back from a settled seller | The directive's deterministic scenario (§48) is this piece's acceptance test |
| 8 | Shipment-centric delivery | 4, 7 | Needs fulfillment groups; one order → many shipments | Migrating existing assignments; field UX must not regress |
| 9 | Seller portal | 2, 3, 5, 8 | Needs all seller-side backend to be real | Data isolation server-enforced and tested, never hidden UI |
| 10 | Admin marketplace control center | 9 | Governs everything the prior pieces created | Every sensitive action audited |
| 11 | Customer marketplace UX | 3, 4, 8 | Seller-aware PDP and offer comparison, grouped cart and checkout, multi-shipment tracking, seller storefront | The buy-box must not make "cheapest" read as "most trustworthy" |
| 12 | Design and motion elevation + performance | 9, 10, 11 | Elevates a system whose information architecture has stopped moving | Doing it earlier means doing it twice |
| 13 | Production hardening | all | IDOR / BOLA / replay / race suites, Playwright E2E, live smoke, documentation | — |

---

## Cross-cutting rules

These hold in every piece and are checked at every piece's done-definition.

- **No fabricated anything.** No fake seller ratings, no invented trust
  statistics, no placeholder revenue, no fictional compliance claims. Empty
  states stay empty. This extends CLAUDE.md §0.2 to marketplace surfaces.
- **The ledger is the authority; Razorpay is an executor.** Transfers are
  recorded from ledger intent. Provider state is reconciled against the ledger,
  never read back as truth.
- **Compliance stays configurable.** GST, TCS and withholding rates live in
  versioned configuration carrying an explicit "requires professional review"
  marker. No hardcoded legal interpretations.
- **Server-authoritative business rules.** Price, stock, seller status and
  listing status are re-validated server-side at checkout. The browser never
  supplies a total, a role, or a seller.
- **Seller data isolation is server-enforced.** Every seller-scoped resource is
  authorized by seller identity in the query itself, and every piece that adds
  one adds its cross-seller denial test.
- **Existing verified behavior is preserved.** The checkout transaction, order
  reaper, restock helper, shared transition graph and webhook idempotency are
  all audit-verified. Generalize them; do not replace them casually.
- **Money that already works keeps working.** Every migration ships with its
  reverse script and is proven idempotent before it runs against real data.

---

## Progress tracker

Update the status column as pieces land. A piece is DONE only when its
acceptance criteria are demonstrably true and every gate is green.

| # | Piece | Status | Plan document |
|---|-------|--------|---------------|
| 0 | Customer auth repair + account UX | CODE DONE 2026-09-13 — live smoke + backfill pending | [2026-09-13-piece-0-auth-account.md](2026-09-13-piece-0-auth-account.md) |
| 1 | Seller identity + seller auth | QUEUED | — |
| 2 | Seller onboarding + KYC + admin review | QUEUED | — |
| 3 | Catalog: canonical product ↔ seller listing | QUEUED | — |
| 4 | Multi-seller orders + money → paise | QUEUED | — |
| 5 | Fee engine + immutable ledger | QUEUED | — |
| 6 | Razorpay Route | QUEUED | — |
| 7 | Refunds / returns / chargebacks | QUEUED | — |
| 8 | Shipment-centric delivery | QUEUED | — |
| 9 | Seller portal | QUEUED | — |
| 10 | Admin marketplace control center | QUEUED | — |
| 11 | Customer marketplace UX | QUEUED | — |
| 12 | Design and motion elevation | QUEUED | — |
| 13 | Production hardening | QUEUED | — |

---

## Open questions carried into later pieces

- **Piece 0 live verification (outstanding).** The code is complete with all six
  gates green, but two steps send real effects and were left for the user: a
  smoke walk of the reset flow against a real inbox, and running
  `src/scripts/backfillAuthProviders.ts` against Atlas to repair `authProviders`
  on existing Google-linked accounts. Until the backfill runs, those customers
  see "Add a password" instead of "Change password" on the security tab.
- **Password change and session invalidation (deferred, Piece 0 scope call).**
  `PUT /customer/password` deliberately does *not* stamp `credentialsChangedAt`.
  Doing so would sign the customer out of the session they just used to change
  their password, and `PasswordModal` has no re-authentication flow. Worth
  revisiting alongside any session-management work.
- **Route capability probe (Piece 6).** The account is reported Route-enabled in
  test mode. Confirm linked-account creation and a test transfer against the
  live API before designing settlement. The razorpay SDK is pinned at 2.9.2;
  check whether Route endpoints need a newer major.
- **Razorpay webhook mode (carried from P5).** The dashboard webhook was created
  in live mode while the keys are test mode, so test payments never fire it. The
  reaper backstops. Resolve before Piece 6 transfer webhooks are relied upon.
- **COD settlement model (Piece 6 / 7).** COD cash reaches the platform, not the
  seller. The collection-to-settlement reconciliation model is a business
  decision to be made explicitly and documented, not inferred.
