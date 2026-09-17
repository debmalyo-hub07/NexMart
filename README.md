# NexMart 🛒

> **Production-grade multi-vendor marketplace platform** — Next.js 15 + Express + MongoDB + Upstash Redis + Razorpay — featuring four distinct role portals (customer storefront, seller operations desk, admin governance panel, and delivery agent app), pure marketplace fee engine, double-entry balanced accounting ledger, and the **Deep-Space Kinetic Editorial** design system.

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

### 🛍️ Customer storefront (`/`, `/products`, `/categories`, `/search`, `/sellers/[id]`)
- Deep-Space Kinetic Editorial design: char-reveal headlines, magnetic CTAs, WebGL particle hero (desktop only, reduced-motion safe)
- **Multi-seller offers** (`SellerOffers`) on product detail pages comparing merchant prices, verified ratings, dispatch speed, and fulfillment badges
- **Seller-grouped cart** (`CartContents`) cleanly partitioning items by merchant storefront
- **Attributed checkout** and multi-package tracking (`/orders/[id]`) showing per-seller fulfillment status and carrier tracking
- **Public Seller Storefronts** (`/sellers/[id]`) highlighting merchant profile, verified status, and published catalog
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
- **Razorpay Integration**: Multi-seller capture reconciliation, HMAC signature verification, and automated stale-order reaper
- **Integration Test Suite**: 25 test suites, 142 hermetic tests covering lifecycle, race conditions, fee snapshots, and ledger consistency

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3.4 |
| State/data | Zustand (auth/cart/ui) + TanStack Query v5 |
| Auth | NextAuth v5 (JWT strategy) + backend httpOnly cookies — hybrid, see CLAUDE.md §1.3 |
| Animation | framer-motion, GSAP + ScrollTrigger, Lenis (storefront only), three.js (homepage hero only) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose; collections `admins`, `customers`, `deliveryagents`, `products`, `categories`, `orders`, `carts`, `deliveryassignments`, `wishlists`) |
| Cache/rate-limit | Upstash Redis (REST) |
| Payments | Razorpay (test mode) |
| Media | Cloudinary |
| Realtime | Socket.IO (canonical event names in `frontend/src/lib/socketEvents.ts`) |
| Email | Brevo SMTP |
| Charts | Recharts |
| Tests | Vitest — `frontend/src/lib/*.test.ts` + backend unit tests (`backend/src/utils/__tests__/`) |

---

## 🔑 Environment Variables

See [.env.example](./.env.example) — every variable is documented inline. The essentials:

| Variable | Notes |
|----------|-------|
| `MONGODB_URI` | Atlas or local |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Must be a live Upstash database (see warning above) |
| `JWT_SECRET_ADMIN` / `_CUSTOMER` / `_AGENT` | Three separate secrets — never mix |
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
| `backend/` | `npm test` | Vitest unit tests (order transition graph, cart-merge & password schemas, Cloudinary URL parser) |
| `frontend/` | `npm run dev` / `build` / `start` | dev server / production build / serve |
| `frontend/` | `npm test` | Vitest unit tests |
| `frontend/` | `npm run lint` | ESLint (next/core-web-vitals) |

---

## 📸 Design System

**Deep-Space Kinetic Editorial** — governed by `CLAUDE.md` §2:

- Surfaces: `space` ramp (`950→700`), elevation = lightness, never shadows
- Accents: one violet ramp (600/500/400), acid green reserved for action/success, amber = warning, red = danger
- One brand gradient: violet→fuchsia
- Type: Outfit (display) · Inter (body) · JetBrains Mono (prices/IDs) — all via `next/font`
- Motion: compositor-only properties; storefront vocabulary never leaks into admin/delivery/checkout; `prefers-reduced-motion` is a hard gate

---

## 🐳 Docker

`docker-compose.yml` provides MongoDB (27017) and Redis (6379) for local development. The app services themselves run via npm (above).

---

## 📚 Documentation Index

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](./CLAUDE.md) | **Read first.** Reality snapshot, design law, interaction contracts, P0–P9 roadmap with status |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Free-tier (₹0) deployment: Cloudflare Pages + Render with keep-alive |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Dated record of every change wave |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | How to make changes (the plan → execute → verify → document workflow) |
| [docs/superpowers/plans/](./docs/superpowers/plans/) | Implementation plans per wave |

---

## 📄 License

MIT © NexMart
