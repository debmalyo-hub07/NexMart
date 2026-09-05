# NexMart 🛒

> **Full-stack e-commerce platform** — Next.js 15 + Express + MongoDB + Upstash Redis + Razorpay — with three role portals (customer storefront, admin panel, delivery agent app) and the **Deep-Space Kinetic Editorial** design system.

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
│   ├── superpowers/plans # Dated implementation plans (P0–P4 remediation waves)
│   ├── CHANGELOG.md      # Dated record of every change wave
│   └── CONTRIBUTING.md   # The update workflow (plan → execute → strike roadmap → changelog)
├── CLAUDE.md             # Authoritative dev directive: reality snapshot + design law + roadmap
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

> ⚠️ **Verify your Upstash URL resolves before starting** — if `UPSTASH_REDIS_REST_URL` points to a deleted database, every API request 500s (the global rate limiter calls Upstash on every request). Test: `nslookup <your-host>.upstash.io` should resolve.

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

Health check: `http://localhost:4000/health`

---

## 🌟 Features (as built)

### 🛍️ Customer storefront (`/`, `/products`, `/categories`, `/search`)
- Deep-Space Kinetic Editorial design: char-reveal headlines, magnetic CTAs, WebGL particle hero (desktop only, reduced-motion safe)
- Debounced typo-tolerant search with recent-history
- Variant selector with stock awareness, gallery lightbox, reviews with verified-purchase badges
- Wishlist (account-bound, optimistic UI) + `navigator.share`
- Guest cart → account cart merge on login; GST + free-shipping threshold
- Checkout: address form (pincode/phone validated) → Razorpay online or COD → confirmation
- Order history + live status updates (Socket.IO) + PDF invoice download
- Auth: email+password with OTP email verification, or Google Sign-In

### 🏪 Admin panel (`/admin`)
- KPI dashboard with real deltas, revenue chart, 60s auto-sync backstop + socket push
- Products CRUD (variants, MRP, images via Cloudinary), categories tree (incl. inactive), orders with inline status + row-detail expansion
- Customer directory with suspend/activate, delivery agent approve/reject + assignment
- Analytics with skeletons and empty states; storefronst read-preview for product pages

### 🚚 Delivery app (`/delivery/dashboard`)
- Assignment list with tap-to-call customer phone and Google Maps deep link
- Inline status updates (picked → out for delivery → delivered) — forward-only, never regresses the order
- Honest approval-status badge; per-row spinners

### ⚡ Backend
- Role-isolated auth: three JWT secrets, three httpOnly cookies (`nexmart_{admin|customer|delivery}_session`)
- Upstash Redis: sliding-window rate limits (global + auth + OTP + payment), JWT blacklist, caches
- Razorpay order creation with server-authoritative amounts + HMAC signature verification + webhook
- Cloudinary uploads, in-process invoice queue (PDFKit), Brevo transactional emails
- Helmet, CORS, CSRF origin check, mongo-sanitize, hpp, Winston logging

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
| Tests | Vitest (`frontend/src/lib/*.test.ts`) |

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
| [CLAUDE.md](./CLAUDE.md) | **Read first.** Reality snapshot, design law, interaction contracts, P0–P4 roadmap with status |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Dated record of every change wave |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | How to make changes (the plan → execute → verify → document workflow) |
| [docs/superpowers/plans/](./docs/superpowers/plans/) | Implementation plans per wave |

---

## 📄 License

MIT © NexMart
