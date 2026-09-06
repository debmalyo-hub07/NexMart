# Deployment Guide — Free Tier (₹0)

This guide deploys NexMart with **zero monthly cost**:

| Piece | Platform | Free limits handled |
|---|---|---|
| Frontend (Next.js) | **Cloudflare Pages** | unlimited bandwidth; no commercial-use restriction (why not Vercel Hobby: it prohibits commercial use) |
| Backend (Express + Socket.IO) | **Render** (free web service) | sleeps after 15 min → kept warm by the GitHub keep-alive Action |
| MongoDB | **Atlas M0** (existing) | — |
| Redis | **Upstash** (existing, already kept alive) | — |
| Media | **Cloudinary** (existing) | — |

Total: **₹0/month**, at `https://<name>.pages.dev` + `https://<name>.onrender.com`.

---

## Prerequisites

- The GitHub repo pushed and current (`origin/main`)
- Your existing Atlas / Upstash / Cloudinary / Brevo / Razorpay credentials handy
- Accounts: [Cloudflare](https://dash.cloudflare.com) (free) and [Render](https://render.com) (free)

---

## Step 1 — Backend on Render (~10 min)

1. **Render dashboard → New → Web Service**
2. **Connect the GitHub repo** (`debmalyo-hub07/NexMart`)
3. Settings — either fill the form manually or use the blueprint:
   - *Blueprint route:* **New → Blueprint**, select the repo — `render.yaml` at the repo root defines everything (root dir `backend`, build `npm install && npm run build`, start `node dist/server.js`, health check `/health`, Singapore region).
   - *Manual route:* use those same values in the form.
4. **Environment variables** — the dashboard will prompt for each `sync: false` key from the blueprint (or add them under Environment). Copy values from your local `.env`, with these **changes**:

   | Variable | Local value | Production value |
   |---|---|---|
   | `NODE_ENV` | development | `production` (blueprint sets this) |
   | `CORS_ORIGIN` / `SOCKET_CORS_ORIGIN` / `APP_URL` | `http://localhost:3000` | your Cloudflare URL from Step 2, e.g. `https://nexmart.pages.dev` |
   | `API_URL` | `http://localhost:4000/api/v1` | `https://<render-service>.onrender.com/api/v1` |
   | everything else | same | same |

   > **Chicken-and-egg note:** the Cloudflare URL isn't known until Step 2. Deploy with a placeholder for the three URL vars, get the Render URL, do Step 2, then come back and set the real values + redeploy. First deploy's URL-dependent features (CSRF on POST) won't work until the placeholder is replaced — that's expected.
5. **First deploy** — watch the logs. The server boots, connects to Atlas, and logs the reaper + invoice worker. `RAZORPAY_WEBHOOK_SECRET` **must** be set: production boot aborts without it.
6. **Verify:** `https://<render-service>.onrender.com/health` → `{"status":"ok",...,"env":"production"}`

### Razorpay webhook (after first deploy)

Razorpay Dashboard → Settings → Webhooks → Add:
- **URL:** `https://<render-service>.onrender.com/api/v1/webhooks/razorpay`
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`
- **Events:** `payment.captured`, `payment.failed`, `order.paid`

### Keep-alive (do this after the Render URL exists)

1. GitHub repo → **Settings → Secrets and variables → Actions → New secret**
   - Name: `RENDER_HEALTH_URL`
   - Value: `https://<render-service>.onrender.com/health`
2. **Actions → Render keep-alive → Run workflow** once to test (should go green and print `200`).
3. From now on it runs every 10 minutes automatically, keeping the service warm 24/7 (~730 of 750 free instance-hours — inside the cap).

### Atlas Network Access

If your cluster's IP list isn't `0.0.0.0/0`, add Render's egress IPs (Render dashboard → your service → Settings → show egress IPs). With `0.0.0.0/0` nothing to do — you rotated the leaked password, so open access is acceptable, though narrowing later is good hygiene.

---

## Step 2 — Frontend on Cloudflare Pages (~5 min)

Cloudflare's wizard needs the **Render URL** from Step 1 for the env var, so do this after the first backend deploy (placeholder backend URL is fine — you can edit env vars and redeploy).

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Select the repo. Configuration:
   - **Project name:** `nexmart` (becomes `nexmart.pages.dev`)
   - **Production branch:** `main`
   - **Build settings:**
     - Framework preset: **Next.js**
     - **Root directory:** `frontend`
     - Build command: `npx next build` (preset default)
     - Output directory: preset default
   - **Environment variables (Production):**

     | Variable | Value |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://<render-service>.onrender.com/api/v1` |
     | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | your Razorpay key id |
     | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | your cloud name |
     | `API_URL` | same as `NEXT_PUBLIC_API_URL` (server-side NextAuth calls use it) |
     | `AUTH_SECRET` | a fresh 64-char random string (generate: `openssl rand -base64 48`) |
     | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud console |

3. **Deploy.** First build takes a few minutes.
4. **Verify:** open `https://nexmart.pages.dev` — the storefront loads, the logo renders, and products appear (the API is warm from Step 1's keep-alive).

### Google OAuth callback (if using Google sign-in)

Google Cloud Console → Credentials → your OAuth client:
- **Authorized JavaScript origins:** add `https://nexmart.pages.dev`
- **Authorized redirect URI:** add `https://nexmart.pages.dev/api/auth/callback/google`

---

## Step 3 — Final wiring (5 min)

1. Back on **Render** → Environment: replace the placeholder URL vars with the real values:
   - `APP_URL`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN` → `https://nexmart.pages.dev`
2. Trigger a redeploy (Render → Manual Deploy → Deploy latest commit). POST requests (login/register/checkout) now pass the CSRF origin check.
3. End-to-end smoke test from `https://nexmart.pages.dev`:
   - Register a customer → OTP email arrives → verify
   - Browse → add to cart → checkout (Razorpay **test mode** cards work against the live deployment)
   - Admin login → the order appears → confirm → assign
   - Socket updates arrive (order status changes reflect without refresh)

---

## Free-tier realities (known and handled)

| Limitation | Impact | Mitigation |
|---|---|---|
| Render cold start (~60s) | First request after idle | Keep-alive Action pings every 10 min — the service never idles |
| Render redeploy (~1–2 min) | Live sockets drop once, reconnect automatically; reaper resets | Frontend socket auto-reconnects; reaper is idempotent per cycle |
| 750 instance-hours/month | Full 24/7 needs ~730 | Pings every 10 min stay under; if you ever see the service suspended early, stretch the cron to `*/14` |
| No background workers on free | Reaper/invoice queue run **in-process** with the server | Already the architecture (in-process by design — no Redis queue needed) |
| Ephemeral filesystem | Generated PDFs must live in Cloudinary | Already the architecture (invoices upload to Cloudinary) |
| Build minutes / bandwidth caps | Build minutes shared per workspace | Normal usage is nowhere near the caps |

## Cost when you outgrow free

- Render Starter: ~$7/mo → always-on, no pings needed
- Cloudflare Pages stays free effectively forever
- Everything else (Atlas/Upstash/Cloudinary/Brevo) has its own free tier headroom

Upgrade triggers: you see "service suspended" on Render, or real customers hitting cold starts during traffic spikes.
