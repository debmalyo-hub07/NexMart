# 2026-09-09 — CI + Lint Safety Net (Piece 1)

Part of the production-hardening effort. First piece: the safety net that guards every later change.

## Problem
No automated quality gate existed: `.github/workflows/` held only Redis/Render keep-alive crons, so a broken build, failing test, or lint error could reach `main` unnoticed (directive §51). The backend `lint` script (`eslint src --ext .ts`) referenced ESLint, which was **not installed** — `npm run lint` errored with `'eslint' is not recognized` (CLAUDE.md P5 known-open). A confirmed dead dependency (`express-rate-limit`) also lingered (§52 — Upstash Ratelimit is what's actually used).

## Current implementation (before)
- CI: only `.github/workflows/{redis,render}-keepalive.yml`.
- Backend lint: script present, `eslint` absent from devDependencies, no config file.
- Frontend lint: `next lint` (works, but deprecated → removed in Next 16) via `.eslintrc.json` (`next/core-web-vitals`).
- Baseline gate state: backend build ✓, test ✓ (56), lint ✗ (eslint missing); frontend build ✓, test ✓ (2), lint ✓.

## Root cause
Lint was configured but its toolchain was never installed, and there was never a CI harness to catch that — or any other regression — before it hit `main`.

## Design
1. **Backend ESLint** — install `eslint@10`, `typescript-eslint@8`, `@eslint/js`, `globals`; add `backend/eslint.config.mjs` (flat config; ESLint 10 dropped `.eslintrc` and `--ext`). Pragmatic ruleset: real problems (unused vars, `require()`, self-assign, useless assignment, missing error `cause`) are errors; framework-boundary `any` and intentional empty catches are warnings — a visible, non-blocking backlog. Lint script → `eslint "src/**/*.ts"`.
2. **GitHub Actions CI** — `.github/workflows/ci.yml`, on `push:[main]` + `pull_request`. Two parallel jobs:
   - backend (Node 24, matches render.yaml): `npm ci` → lint → typecheck → build → test.
   - frontend (Node 22, matches netlify.toml): `npm ci` → lint → test → build. Build gets placeholder `NEXT_PUBLIC_API_URL`/`AUTH_SECRET`/`NEXTAUTH_URL` — never real secrets.
   - `concurrency` cancels superseded runs; npm caching per app; least-privilege `permissions: contents: read`. Lint fails only on errors, not warnings (ESLint default exit behavior).
3. **Dead dep** — remove `express-rate-limit`.
4. **Code fixes surfaced by the new lint (15 errors → 0), all behavior-preserving:** removed dead imports/vars (`path`, `OrderStatus`, `Category`, `stats`, `restockOrderItems`), `let`→`const` (`order`, `customer`), removed a `data.name = data.name` no-op in product update, converted `require('bcryptjs')` → `import bcrypt`, removed redundant initializers (`valid`, `payments`), added `{ cause: err }` to a re-thrown error in `googleToken.service`, `_`-prefixed unused mock args. 56 backend tests still pass.
5. **tsconfig `lib` `ES2020`→`ES2022`** — required so `new Error(msg, { cause })` types. The runtime is already Node 24 (render.yaml) using ES2022 APIs; `lib` was artificially behind it. Emit `target` unchanged (ES2020); adding lib defs only widens available types → no behavior/emit change (typecheck + build confirm).

## Files changed
- `backend/package.json` (+ `package-lock.json`) — eslint toolchain in, `express-rate-limit` out, lint script.
- `backend/eslint.config.mjs` (new)
- `backend/tsconfig.json` — `lib: ["ES2022"]`
- `backend/src/**` — 15 lint-fix edits across 12 files
- `.github/workflows/ci.yml` (new)

## Interfaces changed
None. No route/schema/API change. `verifyGoogleIdToken`'s re-throw now carries `{ cause }` (additive, aids debugging).

## Migration
None — no data or schema changes.

## Verification (all run locally, green)
- backend: `npm run lint` → 0 errors / 45 warnings; `typecheck` → 0; `build` → 0; `test` → 56 pass.
- frontend: `npm run lint` → 0 (deprecation notice only); `test` → 2 pass; `build` → 0; plus a clean-env build (`.env.local` moved aside, placeholder env only) → 0, proving CI's secret-free frontend build.
- GitHub Actions itself is verified on first push.

## Rollback
`git revert` the commit. No stateful changes. Deleting `ci.yml` disables the gate; reverting package.json/lockfile/tsconfig restores the prior toolchain.

## Follow-ups (tracked, out of scope here)
- Migrate frontend off deprecated `next lint` → ESLint CLI before Next 16.
- Strict-typing pass to clear the 45 `any` warnings (CLAUDE.md §0.6) as its own piece.
- 2 frontend `exhaustive-deps` warnings.
- 2 moderate `npm audit` advisories in the new eslint dependency tree — review.
