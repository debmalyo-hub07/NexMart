# NexMart 🛒

> **Production-grade multi-vendor marketplace platform** — Next.js 15 + Express + MongoDB + Upstash Redis + Razorpay — featuring four distinct role portals (customer storefront, seller operations desk, admin governance panel, and delivery agent app), pure marketplace fee engine, double-entry balanced accounting ledger, and a dual-theme design system: a photo-led **light** customer storefront over dark, density-tuned operations portals (**Deep-Space Kinetic Editorial**).

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Node](https://img.shields.io/badge/Node-18+-green?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-green?logo=mongodb)](https://mongodb.com/)

---

## 📦 Project Structure

```
NexMart/
├── backend/              # Express + TypeScript API (src/controllers, routes, models, middleware)
│   └── src/seed/         # First-admin seed script (adminSeed.ts)
├── frontend/             # Next.js 15 App Router + Tailwind CSS 3.4
│   └── src/              # app/ (routes) · components/ · hooks/ · lib/ · store/ (Zustand)
├── docs/
│   ├── superpowers/plans # Dated implementation plans (P0–P9 remediation waves)
│   ├── CHANGELOG.md      # Dated record of every change wave
│   └── CONTRIBUTING.md   # The update workflow (plan → execute → strike roadmap → changelog)
├── CLAUDE.md             # Authoritative dev directive: reality snapshot + design law + P0–P9 roadmap
├── .env.example          # Environment variable template (root, backend reads it)
└── docker-compose.yml    # MongoDB + Redis for local dev
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A MongoDB database (local or [Atlas](https://mongodb.com/atlas))
- An [Upstash](https://upstash.com) Redis database (REST API — used for rate limiting, OTP, caching, token blacklist)
- Razorpay (test mode works), Cloudinary, Brevo SMTP, Google OAuth credentials

### 1. Clone & install

```bash
git clone https://github.com/debmalyo-hub07/NexMart.git
cd NexMart

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2. Set up environment

```bash
cp .env.example .env
# Fill in: MongoDB URI, Upstash URL+token, Razorpay keys, Cloudinary,
# Brevo SMTP, Google OAuth, and the three JWT secrets + ADMIN_SECRET_KEY.
```

> ⚠️ **Verify your Upstash URL resolves before starting.** With a dead/unreachable Upstash database the API **degrades gracefully** (rate limiting, JWT blacklisting, failed-login lockouts, and caches fail open with loud logging; all endpoints still serve real data) — but full protection requires a live database. Test: `nslookup <your-host>.upstash.io` should resolve.

### 3. Start infrastructure (optional, for local MongoDB/Redis)

```bash
docker-compose up mongodb redis -d
```

### 4. Seed the first admin

The first admin cannot be created through the UI (`/admin/register` requires an existing admin session). The seed runs automatically on backend boot if no admin exists — or force it:

```bash
cd backend && npm run build && node dist/seed/adminSeed.js
```

### 5. Run in development

```bash
# Terminal 1 — Backend (http://localhost:4000)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

Health checks: `http://localhost:4000/health/live` (liveness) · `http://localhost:4000/health/ready` (readiness — 503 until MongoDB is connected). `/health` remains as a compatibility alias.

---

## 🌟 Features (as built)

### 🛍️ Customer storefront (`/`, `/products`, `/categories`, `/search`, `/sellers/[id]`, `/terms`, `/privacy`, `/shipping`, `/returns`, `/contact`, `/help`)
- **Photo-led light theme** scoped to `.storefront-shell` (warm paper base, navy actions, marigold promos, emerald savings) with licensed collection photography, below-fold scroll reveals (`Reveal`, IntersectionObserver, reduced-motion safe), and a PDP **trust strip** (delivery info · seller-stated return terms · GST-inclusive note · payment trust — every claim backed by implemented data)
- **Budget-first discovery**: `/budget` six-band price tool (GST/shipping note, plain catalog links) plus a **recently viewed** rail (localStorage only, max 8, explicit clear control)
- **Tax-inclusive pricing**: the listed price *is* the final price — the server reports the contained GST slice, so cart/checkout totals never surprise (audit C2). One tested totals contract (`backend/src/services/pricing.service.ts` + storefront `lib/commerce.ts`): free delivery above ₹999 item total, else flat ₹49, with mirrored boundary tests on both sides
- **Unified Catalog & Search Engine**: Single aggregate-backed query service with normalized Unicode/unit matching, bounded typo fallback, descendant-category traversal, disjunctive facet counts, and stable sorting
- **Faceted Discovery & Merchandising**: URL-backed multi-select filters (`CatalogFilters`), active filter chips, category breadcrumbs, SSR snapshot hydration (`CatalogSnapshot`), and visual category directory (`/categories`)
- **Interactive Product Exploration**: Product cards with same-option price/stock matching, hover secondary preview, Quick View modal (`QuickView`), and side-by-side Product Comparison tray (`CompareTray`)
- **Multi-seller offers** (`SellerOffers`) on product detail pages comparing merchant prices, verified ratings, dispatch speed, and fulfillment badges
- **Seller-grouped cart** (`CartContents`) cleanly partitioning items by merchant storefront with strict offer/variant revalidation
- **Attributed checkout** and multi-package tracking (`/orders/[id]`) showing per-seller fulfillment status and carrier tracking
- **Public Seller Storefronts** (`/sellers/[id]`) highlighting merchant profile, verified status, and published catalog
- **Customer Help & Policy System**: premium information pages sharing one `PolicyLayout` (reading progress, scrollspy contents, per-section copy-links, print/PDF stylesheet) over honest draft content (`storefrontPolicies.ts`); About with live catalog stats; Contact with per-field publication status; searchable Help Center. Business identity stays null-bound until the operator supplies facts (`businessDetails.ts`, `policiesApproved:false` keeps indexing off)
- **Order after-sales**: idempotent customer cancellation/return/help requests (`OrderRequest`, purchase-terms eligibility, `requestKey` idempotency) with a version-guarded admin review queue (`/admin/support`); requests never move money or stock directly — refunds (`RefundAttempt` lease + reconciler) and restocks happen only through the order/payment operations
- **Purchase record**: every order line snapshots seller terms, tax rate/slice, and fee rule; order page joins invoice, shipment events, return eligibility, and support history in one place
- Wishlist (account-bound, optimistic UI), guest-to-account cart merge, and live Socket.IO status updates

### 🏬 Seller Operations Hub (`/seller/*`)
- **Isolated Seller Domain**: Separate auth cookies (`nexmart_seller_session`), `JWT_SECRET_SELLER`, and strict cross-role isolation
- **Business Onboarding**: Multi-step verification collecting legal entity data, PAN, GSTIN, business/pickup/return addresses, with immutable `SellerAuditLog`
- **Catalog & Inventory Desk**: Canonical catalog decoupled from commercial `SellerListing` offers with full state lifecycle (`draft → submitted → moderation → approved → published`); idempotent inventory adjustments with UUID `Idempotency-Key` and `InventoryMovement` audits
- **Order Fulfillment**: Dedicated workflow progressing orders through `placed → confirmed → processing → ready_for_pickup`; carrier dispatch generation (`Shipment`) with tracking IDs
- **Finances & Settlements**: Real-time balance dashboard tracking available payouts, return-window escrow reserves, gross sales, and detailed transaction ledger journal

### 🏪 Admin Governance & Operations (`/admin/*`)
- KPI dashboard with real-time GMV vs platform revenue charts, live sync backstop + socket push
- **Seller Governance**: Merchant application review queue (`submitted → under_review → approved / rejected / suspended / blocked`) with mandatory audit reasons
- **Listing Moderation**: Commercial offer moderation queue (`/admin/listings`) controlling catalog quality
- **Marketplace Fee Rules Engine** (`/admin/fee-rules`): Time-bounded, category-specific fee waterfall configuration (commission BPS, fixed fees, escrow reserves)
- **Double-Entry Ledger Explorer** (`/admin/ledger`): Immutable accounting transparency with balanced debit/credit journal entries across platform, seller payable, escrow reserve, and payment clearing accounts

### 🚚 Delivery app (`/delivery/dashboard`)
- Shipment assignment list with customer contact, address navigation, and forward-only status updates (`picked_up → out_for_delivery → delivered`)

### ⚡ Backend Architecture
- **Role-isolated auth**: Four distinct JWT secrets, four httpOnly session cookies (`nexmart_{admin|customer|seller|delivery}_session`); suspension enforced per-request
- **Pure Fee Engine**: Deterministic calculation using basis points (BPS) and integer paise to eliminate floating-point drift
- **Balanced Double-Entry Ledger**: Every payment capture, commission split, reserve hold, and refund creates balanced credit/debit entries (`assertBalanced`)
- **Upstash Redis**: Sliding-window rate limiters, JWT blacklist, login lockouts, and response caches
- **Session identity plane**: one `sessionIdentity.service` verifying HTTP, optional-cart, and Socket.IO sessions alike (role-pinned secrets, per-request suspension/approval/lifecycle + `credentialsChangedAt` checks); MongoDB-backed `RevokedSession` revocation that survives Redis outages
- **Razorpay Integration**: Multi-seller capture reconciliation, HMAC signature verification, automated stale-order reaper, and a leased full-refund pipeline with provider reconciliation (`RefundAttempt` + 60s reconciler)
- **Integration Test Suite**: 34 backend suites (223 passed — unit + hermetic integration covering lifecycle, race conditions, fee snapshots, ledger consistency, refunds, after-sales requests, session revocation, catalog discovery/offers, and the 2026-09-22 audit fixes) + 13 frontend suites (56 tests)
- **Additive Catalog Seeder**: Idempotent 60-product starter catalog across 9 departments with strict checkout/offer boundaries; idempotently activates legacy `isDemo` samples into sellable stock (`npm run seed:catalog`)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3.4 |
| State/data | Zustand (auth/cart/ui/compare) + TanStack Query v5 |
| Auth | NextAuth v5 (JWT strategy) + backend httpOnly cookies — hybrid, see CLAUDE.md §1.3 |
| Animation | framer-motion, GSAP + ScrollTrigger, Lenis (storefront only), three.js (homepage hero only) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose; collections `admins`, `customers`, `deliveryagents`, `products`, `categories`, `orders`, `carts`, `deliveryassignments`, `wishlists`, `sellers`, `sellerlistings`, `sellerinventories`, `inventorymovements`, `sellerauditlogs`, `listingauditlogs`, `fulfillmentgroups`, `shipments`, `marketplacefeerules`, `marketplaceledgerentries`, `orderrequests`, `refundattempts`, `revokedsessions`) |
| Cache/rate-limit | Upstash Redis (REST) |
| Payments | Razorpay (test mode) |
| Media | Cloudinary |
| Realtime | Socket.IO (canonical event names in `frontend/src/lib/socketEvents.ts`) |
| Email | Brevo SMTP |
| Charts | Recharts |
| Tests | Vitest — `frontend/src/lib/*.test.ts`, `frontend/src/store/*.test.ts` + backend unit & integration tests (`backend/src/test/`, `backend/src/utils/__tests__/`, `backend/src/controllers/__tests__/`, `backend/src/services/__tests__/`) |

---

## 🔑 Environment Variables

See [.env.example](./.env.example) — every variable is documented inline. The essentials:

| Variable | Notes |
|----------|-------|
| `MONGODB_URI` | Atlas or local |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Must be a live Upstash database (see warning above) |
| `JWT_SECRET_ADMIN` / `_CUSTOMER` / `_AGENT` / `_SELLER` | Four role-isolated secrets — never mix |
| `ADMIN_SECRET_KEY` | Required to register additional admins |
| `RAZORPAY_KEY_ID` / `_SECRET` | Test mode works end-to-end |
| `GOOGLE_CLIENT_ID` / `_SECRET` | For customer Google Sign-In |
| `CLOUDINARY_*`, `SMTP_*` (Brevo) | Media + transactional email |

`SESSION_MAXAGE` in `.env` is informational — the frontend pins the NextAuth session to 7 days (`frontend/src/lib/sessionConstants.ts`) to match backend cookie TTLs.

---

## 🧪 Scripts

| Where | Command | What |
|-------|---------|------|
| `backend/` | `npm run dev` / `build` / `start` | nodemon / tsc / production server |
| `backend/` | `npm test` | Vitest unit & integration tests (34 suites, 223 passed / 15 skipped) |
| `backend/` | `npm run seed:catalog` | Additive starter catalog seeder (guarded by `--apply --database=nexmart`); also activates legacy samples into sellable stock |
| `backend/` | `npm run seed:categories` | Department & subcategory taxonomy seeder |
| `frontend/` | `npm run dev` / `build` / `start` | dev server / production build / serve |
| `frontend/` | `npm test` | Vitest unit tests (13 suites, 56 tests) |
| `frontend/` | `npm run lint` | ESLint (next/core-web-vitals) |

---

## 📸 Design System

**Two themes, one law** — governed by `CLAUDE.md` §2:

- **Customer storefront + information pages** — photo-led **light** theme scoped to `.storefront-shell` (ink `#192F43` text on paper, brand `#163E64` actions, marigold promos, emerald savings; navy utility strip over the white main nav). Info pages (`/about`, `/terms`, `/privacy`, `/shipping`, `/returns`, `/contact`, `/help`) share a premium editorial system: display type, reading progress, scrollspy contents, copy-links, print stylesheet.
- **Seller workspace + auth** — light operations material (`.workspace-shell` / `.auth-shell`) with the same brand tokens and readable controls.
- **Admin / delivery portals** — **Deep-Space Kinetic Editorial** dark: `space` ramp (`950→700`), elevation = lightness, never shadows; one violet ramp (600/500/400); acid green = action/success only; amber = warning; red = danger; one brand gradient (violet→fuchsia).
- Shared components (ConfirmDialog, QueryError, EmptyState, Pagination…) consume dual-theme tokens (`:root` dark defaults, overridden under `.storefront-shell`), so they read correctly on both surfaces.
- Type: Outfit (display) · Inter (body) · JetBrains Mono (prices/IDs) — all via `next/font`
- Motion: compositor-only properties; storefront vocabulary never leaks into admin/delivery/checkout; `prefers-reduced-motion` is a hard gate

---

## 🐳 Docker

`docker-compose.yml` provides MongoDB (27017) and Redis (6379) for local development. The app services themselves run via npm (above).

---

## 📚 Documentation Index

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](./CLAUDE.md) | **Read first.** Reality snapshot, design law, interaction contracts, P0–P10 roadmap with status |
| [docs/STOREFRONT-AUDIT-2026-09-19.md](./docs/STOREFRONT-AUDIT-2026-09-19.md) | Storefront audit, data flow, research citations, catalog provenance, and browser QA results |
| [docs/AUDIT-REPORT-2026-09-22.md](./docs/AUDIT-REPORT-2026-09-22.md) | End-to-end audit: P0–P3 findings, competitive research, fix order, and the verification record |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Free-tier (₹0) deployment: Netlify + Render with keep-alive |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Dated record of every change wave |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | How to make changes (the plan → execute → verify → document workflow) |
| [docs/superpowers/plans/](./docs/superpowers/plans/) | Implementation plans per wave (including `2026-09-17-storefront-discovery.md`) |

---

## 📄 License

MIT © NexMart
