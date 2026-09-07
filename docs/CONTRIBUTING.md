# Contributing to NexMart

This repo runs on a documented workflow. Follow it and every change stays verifiable, reviewable, and recorded.

## The ground rules

1. **Read [`CLAUDE.md`](../CLAUDE.md) first** — it is the single source of truth: the reality snapshot (§1, actual routes/collections/auth), the design law (§2), the interaction contracts (§5), and the living roadmap (§8). If code and CLAUDE.md disagree, the code wins and the doc gets updated in the same change.
2. **No mock data, ever.** No hardcoded stats, fake deltas, fabricated logs. Real data or an honest empty state.
3. **No silent failures.** Every request path has loading / error / empty states; server messages pass through (`getApiError`); status is icon + text + color.
4. **Design tokens only** — no new hex values, no new violet steps, opacity only step-5 or bracket values. One brand gradient (violet→fuchsia). Acid green = action/success only.
5. **Motion stays scoped**: storefront vocabulary never leaks into admin/delivery/checkout; `prefers-reduced-motion` is a hard gate; animate only `transform`/`opacity`/`filter`.
6. **Mobile-first at 375px**; touch targets ≥44px (delivery ≥48px); WCAG 2.2 AA contrast floors.

## The workflow

### 1. Plan before you build

Anything larger than a one-file fix gets a plan in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`:
- Goal, files touched, interfaces produced
- Bite-sized steps with the actual code
- Verification steps and commit points

### 2. Execute

- Read the file before editing it. Match surrounding style.
- TypeScript strict — no new `any` on API shapes.
- Every `useEffect` with listeners/intervals/sockets returns its cleanup.
- Query keys are hierarchical tuples (`['admin', 'orders', …]`).
- Forms use react-hook-form + zod with inline adaptive errors.

### 3. Verify (the gates)

```bash
cd frontend && npm test && npm run build   # tests + production build
cd ../backend && npm test && npm run build # vitest + tsc

# Grep gates
grep -rEn "white/(3|4|6|7|8)\b" frontend/src/          # must be empty
grep -rn "alert(\|confirm(" frontend/src/app frontend/src/components | grep -v ConfirmDialog  # must be empty
grep -rn "admin-products\|admin-categories" frontend/src/ # must be empty (tuple keys only)
```

Manual checks when the stack is running: 375px layout, keyboard nav on new overlays, reduced-motion (OS setting) kills all decorative motion, the three-role journeys still work end-to-end.

### 4. Commit

One logical change per commit, imperative subject line, body explains *why*. Reference the roadmap row when closing one.

### 5. Document the change

- **Strike the roadmap row** in CLAUDE.md §8 (`| 42 ✅ 2026-09-05 |`) — a row is only struck when its acceptance criterion is demonstrably true.
- **Add a CHANGELOG entry** in [`docs/CHANGELOG.md`](./CHANGELOG.md) under the current date.
- If you changed architecture (routes, auth, collections, event names), update CLAUDE.md §1 in the same commit — the reality snapshot must never rot.

## Environment notes

- `.env` is gitignored; never commit secrets. `.env.example` is the template.
- **Upstash must be live**: the global rate limiter calls it on every request — a dead `UPSTASH_REDIS_REST_URL` 500s the whole API. Test with `nslookup <host>.upstash.io`.
- Three JWT secrets (`JWT_SECRET_ADMIN/_CUSTOMER/_AGENT`), three cookies — never mix. Delivery role value is `'agent'`.
- The first admin comes from the seed script; `/admin/register` requires an existing admin session by design.

## Testing

- Unit: vitest — `npm test` in `frontend/` (`src/lib/*.test.ts`) and in `backend/` (`src/utils/__tests__/`: order transition graph, cart-merge + password schemas, Cloudinary URL parser).
- Pure logic (route builders, event-name contracts, formatters, state machines, schemas) gets a test; UI verification is the build + the manual gates above.
- Backend behavior changes get a live red/green check against a running stack when a unit test can't reach them (assert the correct behavior before the fix, re-run after).
