# Responsive, Motion, and Reliability Stabilization

## Problem

The storefront spends too much of the first viewport on staged motion and contains unverified homepage claims. Several shared components still use desktop-only interaction patterns on touch devices, while the global data layer treats transient failures as empty states. The backend also lacks a correlation identifier and a distinct readiness check, which makes production diagnosis and deployment health ambiguous.

## Current implementation

- The homepage uses a full viewport hero, GSAP section reveals, several Framer Motion entrance sequences, animated glow orbs, and a Three.js background.
- Product cards attach tilt/glow/pointer behavior and hover-only controls without a touch-specific presentation.
- Mobile navigation and the cart drawer use viewport-absolute motion but do not lock document scrolling or expose complete dialog semantics.
- React Query is configured with zero retries and no reconnect refetching for every query, including safe GET requests.
- The API has a liveness-style `/health` endpoint but no dependency-aware readiness endpoint or request correlation ID.
- The homepage timeline contains numeric social-proof claims that are not backed by a live metric source.

## Root cause

Motion was applied as a shared visual language without a role/device budget. The storefront was optimized for visual expression before first-action clarity. Failure handling was configured globally for the easiest happy path, and operational metadata was omitted from the HTTP boundary.

## Proposed design

1. Make the homepage commerce-first: use a dynamic viewport-safe hero, immediate search/discovery CTAs, real category/product data, and non-numeric brand story copy.
2. Keep WebGL desktop-only and visibility-aware; use a static poster on mobile and reduced-motion devices.
3. Gate pointer effects behind fine-pointer and reduced-motion checks; keep product information/actions visible on touch.
4. Add a shared `prefers-reduced-motion` CSS gate, safe-area utilities, viewport variables, and stable touch targets.
5. Configure bounded retries only for idempotent query failures and refetch on reconnect; leave mutations opt-in.
6. Add request IDs, sanitized structured request logs, `/health/live`, and dependency-aware `/health/ready` without making liveness depend on third parties.
7. Add tests for query retry classification, API request IDs/health semantics, and the homepage data contract where practical.

## Files changed

- `frontend/src/app/page.tsx`
- `frontend/src/components/common/HeroBackground.tsx`
- `frontend/src/components/common/GlowOrb.tsx`
- `frontend/src/components/product/ProductCard.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/navbar/SearchBar.tsx`
- `frontend/src/app/providers.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/tailwind.config.ts`
- `backend/src/app.ts`
- `backend/src/middleware/requestContext.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/config/database.ts`
- `backend/src/utils/logger.ts`
- relevant tests and documentation

## Interfaces changed

- Adds `X-Request-Id` to every API response and accepts a validated inbound value when present.
- Adds `GET /health/live` and `GET /health/ready`; `/health` remains a compatibility alias for liveness.
- No business or payment payload contracts change.

## Migration requirements

None. The new health endpoints are additive. Deployments should point readiness probes at `/health/ready` after the database dependency is configured.

## Test strategy

- Existing frontend/backend unit suites.
- Frontend production build and lint.
- Backend production build and lint.
- Focused tests for request IDs/readiness and retry classification.
- Playwright smoke checks at 375px and desktop when a local server is available.

## Rollback strategy

Revert this isolated change set. Business data, order transitions, payment verification, and inventory operations are untouched. If a deployment cannot use `/health/ready` yet, retain `/health` as the liveness probe while investigating dependency readiness.

## Verification

Record command output and any environment limitations in the final response and changelog entry.

**Post-review verification (2026-09-11):** the wave was independently reviewed line-by-line plus parallel review agents (backend scan, cross-file tracer, removed-behavior, reuse, simplification, altitude). 20 defects found and fixed — including three enumeration oracles the wave's own anti-enumeration work missed, plaintext OTP persistence + admin leakage, featured-cache poisoning, an unthrottled CSRF-flood vector, and a production-breaking Origin/env divergence (all server-side logins would have 403'd per the documented deploy). Backend: tsc + 59 tests + 0 lint errors. Frontend: build + 5 tests + 0 lint errors. Live-verified: CSRF reject envelope, enumeration parity, cache-poison resistance, slug↔ObjectId parity, NextAuth→backend login round-trip. Details in `docs/CHANGELOG.md` 2026-09-11.
