# NexMart 🛒

> **Production-ready full-stack e-commerce platform** built with Next.js 15, Node.js, MongoDB, Redis, and Razorpay — featuring the **Deep-Space Kinetic Glassmorphism** design system.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)](https://mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io/)

---

## 📦 Project Structure

```
NexMart/
├── backend/          # Node.js + Express + TypeScript API
├── frontend/         # Next.js 15 App Router + Tailwind CSS
├── .env.example      # Environment variable template
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for MongoDB + Redis)
- Git

### 1. Clone & install

```bash
git clone https://github.com/debmalyo-hub07/NexMart.git
cd NexMart

# Install backend deps
cd backend && npm install && cd ..

# Install frontend deps
cd frontend && npm install --legacy-peer-deps && cd ..
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your credentials (MongoDB, Razorpay, Google OAuth, etc.)

cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local
```

### 3. Start infrastructure

```bash
# Start MongoDB + Redis via Docker
docker-compose up mongodb redis -d
```

### 4. Run in development

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:3000
- API Docs: http://localhost:4000/api/v1/health

---

## 🌟 Features

### 🛍️ Customer Experience
- **Deep-Space Kinetic Glassmorphism** design system
- GSAP-powered hero animations
- Smart search with debounce + trending
- Product gallery with lightbox zoom
- Variant selector with stock awareness
- Cart with GST calculation & free shipping threshold
- Multi-step checkout: Address → Razorpay/COD → Confirmation
- Real-time order tracking via Socket.io
- Order history with PDF invoice download

### 🔐 Authentication
- Email + Password with OTP email verification
- Google OAuth 2.0
- Phone OTP via Twilio (optional)
- JWT with role-based access (customer / admin / delivery)

### 🏪 Admin Panel
- Live KPI dashboard (revenue, orders, customers)
- Revenue & orders analytics with 7/14/30/90d range
- Product management (CRUD, images via Cloudinary)
- Order management with inline status updates
- Customer directory
- Delivery agent assignment

### 🚚 Delivery App
- Dedicated delivery agent dashboard
- Assigned orders list with real-time updates
- Inline status updates (picked → out_for_delivery → delivered)

### ⚡ Backend
- BullMQ for async PDF invoice generation
- Cloudinary image optimization
- Razorpay payment verification with HMAC
- Rate limiting per route
- Helmet + CORS + mongo-sanitize security
- Winston structured logging

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| State | Zustand + TanStack Query v5 |
| Auth | NextAuth v5 + JWT |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose) |
| Cache/Queue | Redis (BullMQ) |
| Payments | Razorpay |
| Storage | Cloudinary |
| Real-time | Socket.io |
| Email | Brevo (Sendinblue) SMTP |
| SMS | Twilio |

---

## 🔑 Environment Variables

See [.env.example](./.env.example) for full documentation.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `REDIS_URL` | ✅ | Redis URL for BullMQ |
| `RAZORPAY_KEY_ID` | ✅ | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | ✅ | Razorpay secret key |
| `JWT_SECRET` | ✅ | JWT signing secret (32+ chars) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `CLOUDINARY_*` | ✅ | Cloudinary credentials |
| `SMTP_*` | ✅ | SMTP credentials (Brevo) |
| `TWILIO_*` | ⚠️ | Twilio for phone OTP (optional) |

---

## 📸 Design System

NexMart uses the **Deep-Space Kinetic Glassmorphism** design language:

- **Palettes**: `space` (dark backgrounds), `violet` (primary), `acid` (CTA/success)
- **Glass effects**: `glass`, `glass-hover`, `glow-violet`
- **Typography**: Syne (headings) + Inter (body)
- **Animations**: Framer Motion + GSAP (hero only)

---

## 🐳 Docker

Run the full stack with Docker Compose:

```bash
docker-compose up --build
```

Services:
- `nexmart_mongodb` → port 27017
- `nexmart_redis` → port 6379
- `nexmart_backend` → port 4000
- `nexmart_frontend` → port 3000

---

## 📄 License

MIT © 2024 NexMart
