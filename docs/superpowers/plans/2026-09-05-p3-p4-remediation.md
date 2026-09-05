# P3 + P4 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the CLAUDE.md §8 roadmap — P3 (dishonest data) and P4 (polish & consistency) — then write repo documentation (README + supporting .md files), verify everything, commit, and push.

**Architecture:** Point fixes across the frontend (no backend changes needed except none identified). P3 is small and surgical. P4 includes one real component rewrite (Toast queue), DataTable upgrades (debounce + mobile cards + honest sort), pagination windows, CSS/layout polish, and dead-dependency cleanup.

**Tech Stack:** Next.js 15 / React 19 / TanStack Query / Tailwind 3.4 · vitest.

**Spec:** `D:\NexMart\CLAUDE.md` v3.0 §8 P3/P4 lists.

## Global Constraints

- No new hex values; opacity step-5/bracket only; status = icon + text + color.
- No mock data; honest labels everywhere.
- TypeScript strict; every listener/interval gets cleanup.
- Verify: `cd frontend && npm test && npm run build` after each wave.
- One item is moot: "hero stat row wraps at 360px" — the fabricated stats row was deleted in P1 Task 8. Record as such.
- Commit per task group; push only at the very end after the security check (`.env` never tracked).

---

## P3 tasks (dishonest data)

### Task 1: Admin dashboard + analytics honesty
Files: `frontend/src/app/admin/page.tsx` (hardcoded `change={12/8/5}` deltas, `?? 0` fallbacks rendering as real data), `frontend/src/app/admin/analytics/page.tsx` (isLoading destructured-unused → add skeleton), `frontend/src/components/admin/RevenueChart.tsx` (no loading/empty state).
- Stat deltas: compute real week-over-week deltas from the stats payload if the API provides them (read `GET /admin/dashboard/stats` shape); if not provided, REMOVE the delta chips entirely (no mock). `?? 0` fallbacks become tri-state: loading skeleton, error "—" with retry, else value.
- Analytics: use the isLoading for a skeleton grid mirroring the charts' layout. RevenueChart + bar chart get empty states ("No data for this period").

### Task 2: Admin profile + error.tsx honesty
Files: `frontend/src/app/admin/profile/page.tsx` (MOCK_ACTIVITY fabricated "Security & Activity Log"), `frontend/src/app/error.tsx` (false "Sentry, which is wired in this app" comment; nonexistent `btn-glow` class).
- Delete MOCK_ACTIVITY and its section (or render nothing with a "Activity log coming soon" empty state — prefer deletion per no-fic rule).
- error.tsx: fix the comment to reflect reality (console only); replace `btn-glow` with an existing class (`btn-secondary` or the border style already on the second button).

### Task 3: Delivery panel honesty
Files: `frontend/src/app/delivery/dashboard/page.tsx` ("Delivered Today"/"In Transit"/"Completed" count the current page, `limit=10`), `frontend/src/app/delivery/profile/page.tsx` (unconditional "Verified by Admin" pill), `frontend/src/app/admin/delivery/page.tsx` ("Awaiting Approval" shows 0 off the pending tab; `grid-cols-4` with 3 cards).
- Dashboard stats: derive from the full payload (read what `GET /delivery/my-orders` returns — if it has meta.total per status or the agent stats endpoint exists, use it; else label honestly from the page data: rename cards to reflect what they count, e.g. "On this page" is NOT acceptable — compute from `meta.totalPages * rows` is wrong too; if no aggregate exists, show the count from data available across pages via a separate stats query IF an endpoint exists; otherwise drop to a single honest "Assigned (all pages)" using meta.total and remove the per-page fictions).
- Profile: pill renders only when `status === 'approved'` (read the actual field), else an amber "Pending review"/red "Not approved" badge with icon.
- Admin delivery: "Awaiting Approval" stat always reads the pending query's total (not `activeTab === 'pending' ? total : 0`); grid becomes `grid-cols-3`.

### Task 4: Status colors + icons
Files: `frontend/src/lib/utils.ts` (`getStatusColor` missing `approved, rejected, assigned, picked, attempted`), `frontend/src/components/common/StatusBadge.tsx` (icon + text).
- Add the missing mappings: approved → acid, rejected → red, assigned → violet, picked → amber, attempted → amber (per §2.1 semantics).
- StatusBadge gains a status→icon map (lucide): delivered→CheckCircle, cancelled→XCircle, shipped/out_for_delivery→Truck, placed→ClipboardList, confirmed→BadgeCheck, processing→Loader, returned→RotateCcw, approved→BadgeCheck, rejected→XCircle, assigned→UserCheck, picked→Package, attempted→AlertTriangle + the label text (already present).

### Task 5: LiveSyncBadge honesty
Files: `frontend/src/components/common/LiveSyncBadge.tsx`.
- "LIVE" is a lie — there is no socket on admin/delivery; it's 60s polling. Relabel to "SYNC", keep the pulse tied to `useIsFetching()` (that part is honest), add `title="Auto-refreshes every 60 seconds"` tooltip. If the badge accepts no props, keep the API stable for its three call sites.

## P4 tasks (polish)

### Task 6: Toast queue rewrite
Files: `frontend/src/store/uiStore.ts`, `frontend/src/components/common/Toast.tsx`.
- Fix the timer bug (bare setTimeout killing the wrong toast) and single-slot replacement: toasts get an `id`, queue of max 3 (oldest evicted), each with its own 4s (errors 6s) timer cleared on dismiss, pause-on-hover, swipe/click dismiss, `aria-live="polite"` + `role="status"`, variants success/error/info with icon + accent bar. Keep the `showToast(message, type)` signature so all ~20 call sites stay untouched.

### Task 7: DataTable upgrades
Files: `frontend/src/components/admin/DataTable.tsx`.
- Debounced search (300ms) — the search currently fires a request per keystroke on pages wiring it to queries.
- Mobile card view: below `lg`, rows collapse to stacked cards (not `overflow-x-auto` horizontal scroll). Read the current implementation first; keep the expansion + actions behavior working in card view.
- Sort honesty: if the consuming page passes no server sort wiring, sortable headers must not pretend — read how pages use `sortable`; if sort is client-side over one server-paginated page, either remove the sortable affordance or convert to `onSortChange` prop wired by pages that have backend sort support (check whether `GET /admin/orders` and `GET /admin/products` accept a `sort` param — admin products uses `parseSortField` with an allow-list, so wire the products page; orders backend may not — then un-sortable there).
- Sortable headers become `<button>` with `aria-sort`.

### Task 8: Storefront pagination windows
Files: `frontend/src/app/products/page.tsx`, `frontend/src/app/search/page.tsx`, `frontend/src/app/categories/[slug]/page.tsx`.
- All three cap at ~10 numbered buttons with no prev/next → pages 11+ unreachable. Replace with a windowed pagination: prev/next chevrons + numbered window (current ±2) + first/last, disabled at bounds, `aria-label`s.

### Task 9: CSS/layout polish
Files: `frontend/src/components/navbar/MegaMenu.tsx` (fixed `w-[580px]` overflows at lg → `w-[min(580px,calc(100vw-2rem))]` or responsive max), `frontend/src/app/admin/layout.tsx` (nested `overflow-auto` inside `overflow-hidden` fights iOS — restructure to a single scroll container with sticky header), `transition-all` purge (42 uses → specific properties per site: hover colors → `transition-colors`, transforms → `transition-transform`; check each), skeleton shimmer (`.skeleton` animates background-position — switch to opacity pulse, GPU-friendly).

### Task 10: Dead code + deps cleanup
Files: `frontend/package.json` (remove unused: `react-dropzone`, `react-image-crop`, `date-fns`, `class-variance-authority`, `@sentry/nextjs` (installed, zero config — remove the dependency), keep the 13 radix packages (Task P0 uses them conceptually — they're still unused imports-wise but slated for §3; KEEP them, note), `.github/workflows/playwright.yml` (non-functional — no config, no tests: delete the workflow), `frontend/src/app/about/page.tsx` (dead `/auth/register` link → `/customer/register`), `frontend/src/app/error.tsx` (btn-glow — landed in Task 2), unused imports sweep in files touched this session, `not-found.tsx` (create: 404 with search + top categories per CLAUDE.md §4), `loading.tsx` per admin sub-segment (create shape-matched skeletons for products/orders/users/delivery/analytics/categories — read each page's layout and mirror its skeleton; the shared admin/loading.tsx is dashboard-shaped).
- After package.json edits: `npm install` to regenerate the lockfile, then build.

## Final phase (coordinator)

### Task 11: Documentation
- `README.md` (root): project overview, live feature status, stack, 3-role architecture, monorepo layout, getting started (backend → frontend), env setup (reference `.env.example`, never values), scripts, testing, troubleshooting (incl. the Upstash URL note), docs index.
- `docs/CHANGELOG.md`: dated entries for the P0/P1/P2/P3/P4 remediation waves + the CLAUDE.md v3 rewrite.
- `docs/CONTRIBUTING.md`: the update workflow (read CLAUDE.md → plan in docs/superpowers/plans → execute → strike roadmap rows → changelog entry → verify gates).

### Task 12: Verify, commit, security check, push
- `npm test && npm run build` (frontend), `npm run build` (backend).
- Grep gates: no `alert(`/`confirm(`, no dead opacity classes, no flat admin keys.
- **Security check before push:** confirm `.env` is NOT tracked (`git ls-files | grep .env` must be empty; check .gitignore covers it), no secrets in the diff about to be pushed (scan for MONGODB_URI/secret values in tracked files), `.env.example` has placeholders only.
- Commit remaining work-tree changes (pre-existing user modifications that everything built on) as a clearly-labeled commit.
- Strike P3/P4 rows in CLAUDE.md §8 (+ moot note for the deleted stats row).
- `git push origin main`.

## Self-Review

Coverage: every P3 item (9 audit findings) → Tasks 1–5; P4 items → Tasks 6–10 (stats-row item moot, noted); docs → Task 11; push safety → Task 12. Type consistency: `showToast(message, type)` signature preserved (Task 6) so call sites stay untouched; DataTable changes are prop-additive. Riskiest: Task 6 (rewrite) and Task 7 (sort wiring) — both isolated to single files with preserved public APIs.
