# Piece 0 — Customer Auth Repair + Account Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give customers a working password reset that invalidates prior sessions, cut registration from nine fields to four, fix eight auth wiring defects, and establish the supertest integration harness that Pieces 1–13 reuse.

**Architecture:** Backend adds two public auth routes (`forgot-password`, `reset-password`) plus one protected route (`set-password`) that reuse the existing OTP machinery and the established anti-enumeration pattern (`sendEligibilityPending`). Reset codes are stored as SHA-256 hashes, never plaintext. A new `credentialsChangedAt` timestamp on `Customer` is checked in `protectCustomer` against the JWT `iat`, which is the single primitive behind both "reset kills old sessions" and "sign out everywhere". Frontend removes the `requiresOtp` inference that the deliberately-opaque 202 can never honestly carry, and extracts the six-box OTP input into a shared component used by both verification and reset.

**Tech Stack:** Express 4 · Mongoose 8 · zod 3 · bcryptjs · vitest 3 · supertest (new) · mongodb-memory-server 11 · Next.js 15 App Router · react-hook-form · NextAuth v5 beta · Zustand

**Spec:** `docs/superpowers/specs/2026-09-13-piece-0-auth-account-design.md`

## Global Constraints

- **Anti-enumeration is absolute.** Every existence-related branch in register / verify-otp / resend-otp / forgot-password / reset-password must return a byte-identical status and body. Use `sendEligibilityPending` for 202s; never introduce a divergent status or message. (CLAUDE.md §1.3)
- **Never store an OTP in plaintext.** Reset codes are SHA-256 hashed at rest. The existing `otp` field for email verification is out of scope for this piece and is not touched.
- **CLAUDE.md rule 9 holds.** Do not unify the two auth route families and do not remove NextAuth. The hybrid is load-bearing.
- **Error responses never leak internals** — no stacks, no ObjectIds, no route paths, no SDK text. (CLAUDE.md §9.10)
- **Mobile-first 375px baseline; touch targets ≥ 44×44px.** (CLAUDE.md §0.3)
- **No new hex values and no new violet steps.** Use existing tokens only. (CLAUDE.md §2.1)
- **Strict TypeScript.** No `any` on API shapes.
- **Password policy, used identically everywhere:** minimum 8 characters, `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/`. Message: `'Password must be at least 8 characters'` / `'Password must contain uppercase, lowercase, and number'`.
- **Test env Origin:** `CORS_ORIGIN` defaults to `http://localhost:3000`. Every mutating request in the integration harness must send `Origin: http://localhost:3000` or the CSRF gate returns 403.
- **Gates, run before every commit that touches that side:**
  `cd backend && npm run lint && npm run typecheck && npm test`
  `cd frontend && npm run lint && npm run build && npm test`

---

### Task 1: Integration test harness

The deliverable every later piece inherits. Build it first so Tasks 2–5 are written against it.

**Files:**
- Modify: `backend/package.json` (add `supertest` + `@types/supertest` to devDependencies)
- Create: `backend/src/test/helpers.ts`
- Create: `backend/src/test/auth.integration.test.ts`

**Interfaces:**
- Consumes: `createApp()` from `backend/src/app.ts` (already exported, does not bind a port)
- Produces:
  - `startTestDb(dbName: string): Promise<void>` — boots `MongoMemoryServer`, connects mongoose
  - `stopTestDb(): Promise<void>` — disconnects and stops
  - `clearCollections(): Promise<void>` — empties every collection between tests
  - `testApp(): express.Application` — the real app from `createApp()`
  - `post(app, path: string, body: unknown, cookie?: string)` — supertest POST with the `Origin` header set
  - `get(app, path: string, cookie?: string)` — supertest GET
  - `sessionCookie(res): string` — extracts `nexmart_customer_session=…` from a response
  - `registerAndVerify(app, email: string, password: string): Promise<{ cookie: string; customerId: string }>`

- [ ] **Step 1: Install supertest**

```bash
cd backend && npm install --save-dev supertest @types/supertest
```

- [ ] **Step 2: Write the harness helpers**

Create `backend/src/test/helpers.ts`:

```ts
import type { Application } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../app';

// The CSRF gate in app.ts rejects any mutating request whose Origin/Referer
// does not match CORS_ORIGIN. In the test env that defaults to localhost:3000.
export const TEST_ORIGIN = 'http://localhost:3000';

let memoryServer: MongoMemoryServer | undefined;

export async function startTestDb(dbName: string): Promise<void> {
  // Plain server, not a replica set: no auth path uses a transaction, and the
  // plain server starts several seconds faster.
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName });
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await memoryServer?.stop();
  memoryServer = undefined;
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function testApp(): Application {
  return createApp();
}

export function post(app: Application, path: string, body: unknown, cookie?: string) {
  const req = request(app).post(path).set('Origin', TEST_ORIGIN).send(body as object);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function put(app: Application, path: string, body: unknown, cookie?: string) {
  const req = request(app).put(path).set('Origin', TEST_ORIGIN).send(body as object);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function get(app: Application, path: string, cookie?: string) {
  const req = request(app).get(path);
  return cookie ? req.set('Cookie', cookie) : req;
}

export function sessionCookie(res: Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith('nexmart_customer_session='));
  if (!found) throw new Error('No customer session cookie on response');
  return found.split(';')[0];
}

/** A verified, logged-in customer plus their session cookie. */
export async function registerAndVerify(
  app: Application,
  email: string,
  password: string,
): Promise<{ cookie: string; customerId: string }> {
  const { Customer } = await import('../models/Customer');
  await post(app, '/api/v1/customer/auth/register', { name: 'Test Customer', email, password });
  // Read the code straight from the document — the email transport is mocked.
  const pending = await Customer.findOne({ email }).select('+otp');
  await post(app, '/api/v1/customer/auth/verify-otp', { email, otp: pending?.otp });
  const login = await post(app, '/api/v1/customer/auth/login', { email, password });
  const customer = await Customer.findOne({ email });
  return { cookie: sessionCookie(login), customerId: String(customer?._id) };
}
```

- [ ] **Step 3: Write the first integration test (lifecycle, no reset yet)**

Create `backend/src/test/auth.integration.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'express';

// External effects are mocked at the module boundary — no network, no Redis,
// no SMTP. Rate limiters resolve "allowed" so tests are order-independent.
vi.mock('../config/redis', () => ({
  otpEmailRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  getFailedLoginAttempts: vi.fn(async () => 0),
  incrementFailedLoginAttempts: vi.fn(async () => 1),
  clearFailedLoginAttempts: vi.fn(async () => undefined),
  blacklistToken: vi.fn(async () => undefined),
  isTokenBlacklisted: vi.fn(async () => false),
  generalRateLimiter: { limit: vi.fn(async () => ({ success: true, remaining: 99, reset: 0 })) },
  authRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  otpRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  registrationRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  paymentRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
  upstashRedis: {},
}));
vi.mock('../services/email.service', () => ({
  sendEmail: vi.fn(async () => undefined),
  buildOtpEmail: vi.fn(() => '<p>otp</p>'),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));

import { startTestDb, stopTestDb, clearCollections, testApp, post, get, sessionCookie } from './helpers';
import { Customer } from '../models/Customer';

let app: Application;

beforeAll(async () => {
  await startTestDb('nexmart_auth_integration');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('customer auth lifecycle', () => {
  it('registers, verifies, logs in and reaches a protected route', async () => {
    const email = 'lifecycle@test.local';
    const password = 'Passw0rdOne';

    const registered = await post(app, '/api/v1/customer/auth/register', {
      name: 'Lifecycle Customer', email, password,
    });
    expect(registered.status).toBe(201);

    const pending = await Customer.findOne({ email }).select('+otp');
    expect(pending?.emailVerified).toBe(false);

    const verified = await post(app, '/api/v1/customer/auth/verify-otp', { email, otp: pending?.otp });
    expect(verified.status).toBe(200);

    const login = await post(app, '/api/v1/customer/auth/login', { email, password });
    expect(login.status).toBe(200);

    const profile = await get(app, '/api/v1/customer/profile', sessionCookie(login));
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);
  });

  it('refuses a protected route without a session', async () => {
    const profile = await get(app, '/api/v1/customer/profile');
    expect(profile.status).toBe(401);
  });

  it('rejects a mutating request whose Origin does not match', async () => {
    const request = (await import('supertest')).default;
    const blocked = await request(app)
      .post('/api/v1/customer/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@test.local', password: 'whatever' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CSRF_REJECTED');
  });
});
```

- [ ] **Step 4: Run and verify it passes**

Run: `cd backend && npx vitest run src/test/auth.integration.test.ts`
Expected: 3 passing. If the register call 404s, confirm the route path is `/api/v1/customer/auth/register` per `routes/customer.routes.ts`.

- [ ] **Step 5: Run the whole suite and the gates**

```bash
cd backend && npm run lint && npm run typecheck && npm test
```
Expected: all previously-green tests still green, plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/test/
git commit -m "test: integration harness over the real Express app

supertest + mongodb-memory-server mounting createApp() with Redis and SMTP
mocked at the module boundary. Helpers (startTestDb, registerAndVerify,
sessionCookie, Origin-stamped post/put/get) are the base that later pieces
reuse for cross-tenant and IDOR tests."
```

---

### Task 2: Reset-code storage + session invalidation primitive

Schema and middleware only — no routes yet. This is the security foundation the reset flow rests on, and it is independently testable.

**Files:**
- Modify: `backend/src/models/Customer.ts`
- Modify: `backend/src/middleware/auth.ts:57-85` (`protectCustomer`)
- Create: `backend/src/utils/resetCode.ts`
- Create: `backend/src/utils/__tests__/resetCode.test.ts`
- Create: `backend/src/test/sessionInvalidation.integration.test.ts`

**Interfaces:**
- Consumes: `startTestDb`, `registerAndVerify`, `post`, `get`, `sessionCookie` from Task 1
- Produces:
  - `hashResetCode(code: string): string` — SHA-256 hex
  - `generateResetCode(): string` — 6 digits via `crypto.randomInt`
  - `RESET_CODE_TTL_MS = 15 * 60 * 1000`
  - `RESET_CODE_MAX_ATTEMPTS = 5`
  - `Customer` fields: `resetOtpHash?: string`, `resetOtpExpiry?: Date`, `resetOtpAttempts?: number`, `credentialsChangedAt?: Date`

- [ ] **Step 1: Write the failing unit test for the code utility**

Create `backend/src/utils/__tests__/resetCode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../resetCode';

describe('reset code utility', () => {
  it('generates a six-digit numeric code', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateResetCode()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes deterministically and never returns the plaintext', () => {
    const hash = hashResetCode('123456');
    expect(hash).toBe(hashResetCode('123456'));
    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different codes', () => {
    expect(hashResetCode('123456')).not.toBe(hashResetCode('123457'));
  });

  it('exposes the policy constants', () => {
    expect(RESET_CODE_TTL_MS).toBe(15 * 60 * 1000);
    expect(RESET_CODE_MAX_ATTEMPTS).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run src/utils/__tests__/resetCode.test.ts`
Expected: FAIL — `Cannot find module '../resetCode'`.

- [ ] **Step 3: Implement the utility**

Create `backend/src/utils/resetCode.ts`:

```ts
import crypto from 'crypto';

/** Reset codes live 15 minutes. */
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;

/** After this many wrong guesses the code is dead and must be re-requested. */
export const RESET_CODE_MAX_ATTEMPTS = 5;

export function generateResetCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Reset codes are stored hashed, never in plaintext. A password-reset code is
 * strictly more sensitive than a verification code: anyone who can read the
 * document could otherwise take over the account. SHA-256 is appropriate here
 * (not bcrypt) because the input is high-entropy-per-attempt and guarded by a
 * 5-attempt cap and a 15-minute expiry, and the check sits in a request path.
 */
export function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx vitest run src/utils/__tests__/resetCode.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Add the Customer fields**

In `backend/src/models/Customer.ts`, add to the `ICustomer` interface after `otpExpiry?: Date;`:

```ts
  // Password reset — code stored hashed, never plaintext
  resetOtpHash?: string;
  resetOtpExpiry?: Date;
  resetOtpAttempts?: number;
  /** Any session issued before this instant is rejected (reset / sign-out-everywhere). */
  credentialsChangedAt?: Date;
```

And to the schema, after the `otpExpiry: { type: Date },` line:

```ts
    // Reset codes are select:false — they must never ride along on a profile read.
    resetOtpHash: { type: String, select: false },
    resetOtpExpiry: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    credentialsChangedAt: { type: Date },
```

- [ ] **Step 6: Write the failing integration test for session invalidation**

Create `backend/src/test/sessionInvalidation.integration.test.ts`. Copy the two `vi.mock` blocks verbatim from `src/test/auth.integration.test.ts` (Task 1, Step 3) to the top of the file, then:

```ts
import { startTestDb, stopTestDb, clearCollections, testApp, get, registerAndVerify } from './helpers';
import { Customer } from '../models/Customer';
import type { Application } from 'express';

let app: Application;

beforeAll(async () => {
  await startTestDb('nexmart_session_invalidation');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); });

describe('credentialsChangedAt invalidates prior sessions', () => {
  it('rejects a session issued before credentials changed', async () => {
    const { cookie, customerId } = await registerAndVerify(app, 'invalidate@test.local', 'Passw0rdOne');

    const before = await get(app, '/api/v1/customer/profile', cookie);
    expect(before.status).toBe(200);

    // Stamp one second into the future: JWT `iat` has whole-second resolution,
    // so a same-second stamp would not reliably compare as "after".
    await Customer.findByIdAndUpdate(customerId, { credentialsChangedAt: new Date(Date.now() + 1000) });

    const after = await get(app, '/api/v1/customer/profile', cookie);
    expect(after.status).toBe(401);
  });

  it('leaves sessions issued after the change working', async () => {
    const { customerId } = await registerAndVerify(app, 'stillvalid@test.local', 'Passw0rdOne');
    await Customer.findByIdAndUpdate(customerId, { credentialsChangedAt: new Date(Date.now() - 60_000) });

    const fresh = await registerAndVerify(app, 'stillvalid2@test.local', 'Passw0rdOne');
    const profile = await get(app, '/api/v1/customer/profile', fresh.cookie);
    expect(profile.status).toBe(200);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `cd backend && npx vitest run src/test/sessionInvalidation.integration.test.ts`
Expected: FAIL on the first test — the stale session still returns 200 because nothing checks `credentialsChangedAt` yet.

- [ ] **Step 8: Enforce it in protectCustomer**

In `backend/src/middleware/auth.ts`, inside `protectCustomer`, immediately after the `if (!customer.isActive) return sendForbidden(...)` line:

```ts
    // A password reset or an explicit "sign out everywhere" stamps
    // credentialsChangedAt. Every token minted before that instant dies here —
    // without this, an attacker holding a live session keeps it through the
    // victim's reset, which would make the reset security-theatre.
    if (customer.credentialsChangedAt && typeof decoded.iat === 'number') {
      const issuedAtMs = decoded.iat * 1000;
      if (issuedAtMs < customer.credentialsChangedAt.getTime()) {
        return sendUnauthorized(res, 'Session expired. Please login again.');
      }
    }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/test/sessionInvalidation.integration.test.ts`
Expected: 2 passing.

- [ ] **Step 10: Run the gates and commit**

```bash
cd backend && npm run lint && npm run typecheck && npm test
git add backend/src/models/Customer.ts backend/src/middleware/auth.ts backend/src/utils/resetCode.ts backend/src/utils/__tests__/resetCode.test.ts backend/src/test/sessionInvalidation.integration.test.ts
git commit -m "feat(auth): hashed reset codes and credentialsChangedAt session cutoff

Reset codes are SHA-256 at rest with a 15-minute TTL and a 5-attempt cap.
protectCustomer rejects any token whose iat predates credentialsChangedAt —
one primitive behind both password reset and sign-out-everywhere."
```

---

### Task 3: Password reset endpoints

**Files:**
- Modify: `backend/src/utils/validation.ts` (add schemas)
- Modify: `backend/src/controllers/roleAuth.controller.ts` (add two handlers, fix the lockout counter)
- Modify: `backend/src/routes/auth.routes.ts` (two routes)
- Modify: `backend/src/routes/customer.routes.ts` (two aliases)
- Modify: `backend/src/services/email.service.ts` (two templates)
- Create: `backend/src/test/passwordReset.integration.test.ts`

**Interfaces:**
- Consumes: `hashResetCode`, `generateResetCode`, `RESET_CODE_TTL_MS`, `RESET_CODE_MAX_ATTEMPTS` (Task 2); `sendEligibilityPending` (existing, `roleAuth.controller.ts`); harness helpers (Task 1)
- Produces:
  - `forgotPassword(req, res)` — always 202
  - `resetPassword(req, res)` — 200, or uniform 400 on every miss
  - `buildResetEmail(name: string, code: string): string`
  - `buildGoogleOnlyResetEmail(name: string): string`
  - Routes: `POST /api/v1/customer/auth/forgot-password`, `POST /api/v1/customer/auth/reset-password` (and the `/auth/customer/...` aliases)
  - `forgotPasswordSchema`, `resetPasswordSchema` in `utils/validation.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `backend/src/test/passwordReset.integration.test.ts`. Copy the two `vi.mock` blocks verbatim from Task 1 Step 3, but capture the email mock so the tests can assert on what was sent:

```ts
const mailer = vi.hoisted(() => ({ send: vi.fn(async () => undefined) }));
vi.mock('../services/email.service', () => ({
  sendEmail: mailer.send,
  buildOtpEmail: vi.fn(() => '<p>otp</p>'),
  buildResetEmail: vi.fn((_name: string, code: string) => `<p>reset ${code}</p>`),
  buildGoogleOnlyResetEmail: vi.fn(() => '<p>use google</p>'),
  sendOrderStatusEmail: vi.fn(async () => undefined),
}));
```

Then the suite:

```ts
import { startTestDb, stopTestDb, clearCollections, testApp, post, get, registerAndVerify, sessionCookie } from './helpers';
import { Customer } from '../models/Customer';
import { hashResetCode } from '../utils/resetCode';
import type { Application } from 'express';

let app: Application;
const PASSWORD = 'Passw0rdOne';
const NEXT_PASSWORD = 'Passw0rdTwo';

async function readResetCode(email: string): Promise<string> {
  // The code itself is never stored, so tests read it from the mocked mail.
  const call = mailer.send.mock.calls.at(-1)?.[0] as { to: string; html: string } | undefined;
  if (!call || call.to !== email) throw new Error(`No mail sent to ${email}`);
  const match = call.html.match(/\d{6}/);
  if (!match) throw new Error('No six-digit code in the reset mail');
  return match[0];
}

beforeAll(async () => {
  await startTestDb('nexmart_password_reset');
  app = testApp();
}, 120_000);
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearCollections(); vi.clearAllMocks(); });

describe('forgot-password is opaque', () => {
  it('answers identically for a real account and an unknown address', async () => {
    await registerAndVerify(app, 'real@test.local', PASSWORD);

    const known = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'real@test.local' });
    const unknown = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'nobody@test.local' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  it('sends a Google-sign-in mail, never a code, for a Google-only account', async () => {
    await Customer.create({
      name: 'Google Only', email: 'googler@test.local', googleId: 'g-123',
      emailVerified: true, isActive: true, authProviders: ['google'],
    });

    const res = await post(app, '/api/v1/customer/auth/forgot-password', { email: 'googler@test.local' });
    expect(res.status).toBe(202);

    const sent = mailer.send.mock.calls.at(-1)?.[0] as { html: string };
    expect(sent.html).not.toMatch(/\d{6}/);

    const stored = await Customer.findOne({ email: 'googler@test.local' }).select('+resetOtpHash');
    expect(stored?.resetOtpHash).toBeUndefined();
  });

  it('stores the code hashed, never in plaintext', async () => {
    await registerAndVerify(app, 'hashed@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'hashed@test.local' });

    const code = await readResetCode('hashed@test.local');
    const stored = await Customer.findOne({ email: 'hashed@test.local' }).select('+resetOtpHash');
    expect(stored?.resetOtpHash).toBe(hashResetCode(code));
    expect(stored?.resetOtpHash).not.toBe(code);
  });
});

describe('reset-password', () => {
  it('resets the password, kills the old session, and accepts the new one', async () => {
    const { cookie } = await registerAndVerify(app, 'reset@test.local', PASSWORD);
    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(200);

    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'reset@test.local' });
    const code = await readResetCode('reset@test.local');

    const reset = await post(app, '/api/v1/customer/auth/reset-password', {
      email: 'reset@test.local', otp: code, password: NEXT_PASSWORD,
    });
    expect(reset.status).toBe(200);

    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(401);
    expect((await post(app, '/api/v1/customer/auth/login', { email: 'reset@test.local', password: PASSWORD })).status).toBe(401);

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'reset@test.local', password: NEXT_PASSWORD });
    expect(login.status).toBe(200);
    expect((await get(app, '/api/v1/customer/profile', sessionCookie(login))).status).toBe(200);
  });

  it('answers a wrong code, an unknown email and an expired code identically', async () => {
    await registerAndVerify(app, 'uniform@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'uniform@test.local' });

    const wrong = await post(app, '/api/v1/customer/auth/reset-password', { email: 'uniform@test.local', otp: '000000', password: NEXT_PASSWORD });
    const absent = await post(app, '/api/v1/customer/auth/reset-password', { email: 'nobody@test.local', otp: '000000', password: NEXT_PASSWORD });

    await Customer.findOneAndUpdate({ email: 'uniform@test.local' }, { resetOtpExpiry: new Date(Date.now() - 1000) });
    const code = await readResetCode('uniform@test.local');
    const expired = await post(app, '/api/v1/customer/auth/reset-password', { email: 'uniform@test.local', otp: code, password: NEXT_PASSWORD });

    expect(wrong.status).toBe(400);
    expect(absent.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(wrong.body).toEqual(absent.body);
    expect(expired.body).toEqual(absent.body);
  });

  it('kills the code after five wrong attempts', async () => {
    await registerAndVerify(app, 'attempts@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'attempts@test.local' });
    const code = await readResetCode('attempts@test.local');

    for (let i = 0; i < 5; i += 1) {
      await post(app, '/api/v1/customer/auth/reset-password', { email: 'attempts@test.local', otp: '000000', password: NEXT_PASSWORD });
    }

    // The sixth try uses the CORRECT code and must still fail.
    const afterBurn = await post(app, '/api/v1/customer/auth/reset-password', { email: 'attempts@test.local', otp: code, password: NEXT_PASSWORD });
    expect(afterBurn.status).toBe(400);

    expect((await post(app, '/api/v1/customer/auth/login', { email: 'attempts@test.local', password: NEXT_PASSWORD })).status).toBe(401);
  });

  it('refuses to reuse a code after a successful reset', async () => {
    await registerAndVerify(app, 'reuse@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'reuse@test.local' });
    const code = await readResetCode('reuse@test.local');

    expect((await post(app, '/api/v1/customer/auth/reset-password', { email: 'reuse@test.local', otp: code, password: NEXT_PASSWORD })).status).toBe(200);
    expect((await post(app, '/api/v1/customer/auth/reset-password', { email: 'reuse@test.local', otp: code, password: 'Passw0rdThree' })).status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    await registerAndVerify(app, 'weak@test.local', PASSWORD);
    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'weak@test.local' });
    const code = await readResetCode('weak@test.local');

    const res = await post(app, '/api/v1/customer/auth/reset-password', { email: 'weak@test.local', otp: code, password: 'short' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `cd backend && npx vitest run src/test/passwordReset.integration.test.ts`
Expected: FAIL — the routes 404.

- [ ] **Step 3: Add the validation schemas**

Append to `backend/src/utils/validation.ts`:

```ts
// Password reset. The email is the only input on request; the code plus the
// new password on completion. The strength policy is identical to
// passwordChangeSchema — one policy, stated once per schema so the messages
// reach the client through the standard `errors` key.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});
```

- [ ] **Step 4: Add the two email templates**

Append to `backend/src/services/email.service.ts`. Match the existing dark-palette inline styles used by `buildOtpEmail` (`background:#1a1035`, `border:1.5px solid #6d28d9`):

```ts
/** Password-reset code mail. Six digits, 15-minute expiry stated plainly. */
export function buildResetEmail(name: string, code: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#050508;padding:32px;color:#ffffff;">
    <h1 style="font-size:20px;margin:0 0 16px;">Reset your NexMart password</h1>
    <p style="color:#c9c9d4;margin:0 0 20px;">Hi ${name}, use this code to set a new password. It expires in 15 minutes.</p>
    <p style="font-size:32px;letter-spacing:10px;font-weight:bold;background:#1a1035;border:1.5px solid #6d28d9;border-radius:10px;padding:16px;text-align:center;margin:0 0 20px;">${code}</p>
    <p style="color:#9a9aa8;font-size:13px;margin:0;">If you did not ask for this, you can ignore this email — your password will not change.</p>
  </div>`;
}

/**
 * Sent when a Google-only account asks for a password reset. There is no
 * password to reset, so the honest answer is "use Google" — delivered by mail,
 * where only the true owner can read it. The HTTP response stays identical to
 * every other forgot-password branch.
 */
export function buildGoogleOnlyResetEmail(name: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#050508;padding:32px;color:#ffffff;">
    <h1 style="font-size:20px;margin:0 0 16px;">Sign in with Google</h1>
    <p style="color:#c9c9d4;margin:0 0 20px;">Hi ${name}, your NexMart account signs in with Google, so it has no password to reset.</p>
    <p style="color:#c9c9d4;margin:0 0 20px;">Use "Continue with Google" on the sign-in page. You can add a password afterwards from your account's security settings.</p>
    <p style="color:#9a9aa8;font-size:13px;margin:0;">If you did not ask for this, you can ignore this email.</p>
  </div>`;
}
```

- [ ] **Step 5: Implement the two handlers**

In `backend/src/controllers/roleAuth.controller.ts`, extend the existing imports:

```ts
import { sendEmail, buildOtpEmail, buildResetEmail, buildGoogleOnlyResetEmail } from '../services/email.service';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../utils/resetCode';
import { forgotPasswordSchema, resetPasswordSchema } from '../utils/validation';
```

Then append the handlers:

```ts
/**
 * POST forgot-password — always 202, whatever the truth is.
 *
 * Anti-enumeration (CLAUDE.md §1.3): the rate limit is consumed BEFORE the
 * lookup so even a 429 cannot prove an address exists, and unknown address,
 * cross-role address, and Google-only account all answer with the identical
 * body. Only the true owner — who can read the inbox — experiences the
 * difference between these branches.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Enter a valid email address', data: null });
    return;
  }
  const { email } = parsed.data;

  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  const customer = await Customer.findOne({ email });

  if (!customer || !customer.isActive) {
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  if (!customer.password) {
    // Google-only: no password exists to reset. Tell the owner by mail; the
    // HTTP response is the same as every other branch.
    try {
      await sendEmail({
        to: email,
        subject: 'NexMart — Signing in to your account',
        html: buildGoogleOnlyResetEmail(customer.name),
      });
    } catch (emailErr: unknown) {
      console.error(`[Reset] Google-only notice failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
    }
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  const code = generateResetCode();
  await Customer.findByIdAndUpdate(customer._id, {
    $set: {
      resetOtpHash: hashResetCode(code),
      resetOtpExpiry: new Date(Date.now() + RESET_CODE_TTL_MS),
      resetOtpAttempts: 0,
    },
  });

  try {
    await sendEmail({
      to: email,
      subject: 'NexMart — Reset your password',
      html: buildResetEmail(customer.name, code),
    });
  } catch (emailErr: unknown) {
    console.error(`[Reset] SMTP failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
  }

  sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
};

/**
 * POST reset-password — one uniform 400 for every miss.
 *
 * Unknown address, wrong code, expired code and a burnt code are
 * indistinguishable. On success the password is replaced and
 * credentialsChangedAt is stamped, which kills every session issued earlier.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    res.status(400).json({ success: false, message: 'Check the code and your new password.', code: 'VALIDATION_ERROR', errors, data: null });
    return;
  }
  const { email, otp, password } = parsed.data;

  const fail = (): void => {
    res.status(400).json({
      success: false,
      message: 'Unable to reset with that code. Please request a new one.',
      data: null,
    });
  };

  const customer = await Customer.findOne({ email }).select('+resetOtpHash +resetOtpExpiry +resetOtpAttempts');

  // Timing parity: hash on every path, present or absent.
  const presented = hashResetCode(otp);

  if (!customer || !customer.resetOtpHash || !customer.resetOtpExpiry || !customer.isActive) { fail(); return; }
  if (customer.resetOtpExpiry.getTime() < Date.now()) { fail(); return; }
  if ((customer.resetOtpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) { fail(); return; }

  if (presented !== customer.resetOtpHash) {
    await Customer.findByIdAndUpdate(customer._id, { $inc: { resetOtpAttempts: 1 } });
    fail();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await Customer.findByIdAndUpdate(customer._id, {
    $set: {
      password: hashedPassword,
      // A reset proves control of the inbox, which is what verification asks.
      emailVerified: true,
      credentialsChangedAt: new Date(),
    },
    $unset: { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 },
    $addToSet: { authProviders: 'email' },
  });

  res.json({ success: true, message: 'Password updated. Sign in with your new password.', data: null });
};
```

- [ ] **Step 6: Fix the unverified-login lockout counter (defect 7)**

In the same file, in `loginCustomer`, the unverified branch currently increments the counter. Replace:

```ts
  if (!customer.emailVerified) {
    await incrementFailedLoginAttempts(ip);
```

with:

```ts
  if (!customer.emailVerified) {
    // A correct password on an unverified account is not a failed attempt —
    // counting it locked legitimate users out of their own signup (the same
    // reasoning already applied to pending agents in P1-15).
```

- [ ] **Step 7: Wire the routes**

In `backend/src/routes/auth.routes.ts`, extend the import from `roleAuth.controller` with `forgotPassword, resetPassword`, then add beside the other customer routes:

```ts
router.post('/customer/forgot-password', otpLimit, forgotPassword);
router.post('/customer/reset-password', otpLimit, resetPassword);
```

In `backend/src/routes/customer.routes.ts`, extend the same import and add beside the other OTP routes:

```ts
router.post('/auth/forgot-password', otpLimit, forgotPassword);
router.post('/auth/reset-password', otpLimit, resetPassword);
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/test/passwordReset.integration.test.ts`
Expected: 9 passing.

- [ ] **Step 9: Run the gates and commit**

```bash
cd backend && npm run lint && npm run typecheck && npm test
git add backend/src/utils/validation.ts backend/src/controllers/roleAuth.controller.ts backend/src/routes/ backend/src/services/email.service.ts backend/src/test/passwordReset.integration.test.ts
git commit -m "feat(auth): OTP password reset with session invalidation

forgot-password always answers 202; reset-password answers one uniform 400 for
unknown address, wrong code, expired code and burnt code alike. Codes are
hashed, expire in 15 minutes and die after 5 attempts. A successful reset
stamps credentialsChangedAt, killing every prior session. Google-only accounts
get a 'use Google' mail, never a code.

Also stops an unverified account's correct password from feeding the IP
lockout counter — same reasoning as P1-15 for pending agents."
```

---

### Task 4: Set-password, sign-out-everywhere, profile validation

**Files:**
- Modify: `backend/src/utils/validation.ts`
- Modify: `backend/src/controllers/googleAuth.controller.ts:76-84`
- Modify: `backend/src/routes/customer.routes.ts` (profile validation + two routes)
- Create: `backend/src/scripts/backfillAuthProviders.ts`
- Create: `backend/src/test/accountSecurity.integration.test.ts`

**Interfaces:**
- Consumes: reset machinery (Task 3), harness (Task 1)
- Produces:
  - `POST /api/v1/customer/set-password` (protected) — `{ otp, password }`
  - `POST /api/v1/customer/sign-out-everywhere` (protected)
  - `profileUpdateSchema` in `utils/validation.ts`
  - `setPasswordSchema` in `utils/validation.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/accountSecurity.integration.test.ts` with the same mock blocks as Task 3 Step 1 (including the `mailer` hoisted capture and `readResetCode` helper), then:

```ts
describe('set-password for a Google-only account', () => {
  it('adds a password after an emailed code and records the provider', async () => {
    await Customer.create({
      name: 'Google Only', email: 'setpw@test.local', googleId: 'g-set',
      emailVerified: true, isActive: true, authProviders: ['google'],
    });
    // Sign in the way Google customers do — mint a session via the Google path.
    const customer = await Customer.findOne({ email: 'setpw@test.local' });
    const { generateToken } = await import('../middleware/auth');
    const { env } = await import('../config/env');
    const token = generateToken({ id: customer!._id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '7d');
    const cookie = `nexmart_customer_session=${token}`;

    await post(app, '/api/v1/customer/auth/forgot-password', { email: 'setpw@test.local' });
    // Google-only accounts get the "use Google" mail, so ask for a set-password code.
    const requested = await post(app, '/api/v1/customer/set-password/request', {}, cookie);
    expect(requested.status).toBe(202);
    const code = await readResetCode('setpw@test.local');

    const res = await post(app, '/api/v1/customer/set-password', { otp: code, password: 'Passw0rdOne' }, cookie);
    expect(res.status).toBe(200);

    const updated = await Customer.findOne({ email: 'setpw@test.local' });
    expect(updated?.authProviders).toContain('email');
    expect(updated?.authProviders).toContain('google');

    const login = await post(app, '/api/v1/customer/auth/login', { email: 'setpw@test.local', password: 'Passw0rdOne' });
    expect(login.status).toBe(200);
  });
});

describe('sign out everywhere', () => {
  it('invalidates the calling session and every other one', async () => {
    const { cookie } = await registerAndVerify(app, 'signout@test.local', 'Passw0rdOne');
    const second = await post(app, '/api/v1/customer/auth/login', { email: 'signout@test.local', password: 'Passw0rdOne' });
    const secondCookie = sessionCookie(second);

    // iat has whole-second resolution — wait so the stamp lands strictly after.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const res = await post(app, '/api/v1/customer/sign-out-everywhere', {}, cookie);
    expect(res.status).toBe(200);

    expect((await get(app, '/api/v1/customer/profile', cookie)).status).toBe(401);
    expect((await get(app, '/api/v1/customer/profile', secondCookie)).status).toBe(401);
  });
});

describe('profile update validation', () => {
  it('rejects a bad phone and ignores unknown fields', async () => {
    const { cookie, customerId } = await registerAndVerify(app, 'profile@test.local', 'Passw0rdOne');

    const bad = await put(app, '/api/v1/customer/profile', { name: 'Fine', phone: '12345' }, cookie);
    expect(bad.status).toBe(400);

    const sneaky = await put(app, '/api/v1/customer/profile', { name: 'Fine', role: 'admin', isActive: false }, cookie);
    expect(sneaky.status).toBe(200);

    const stored = await Customer.findById(customerId);
    expect(stored?.role).toBe('customer');
    expect(stored?.isActive).toBe(true);
  });
});

describe('google linking records the provider', () => {
  it('adds google to authProviders when linking an existing email account', async () => {
    await registerAndVerify(app, 'linkme@test.local', 'Passw0rdOne');
    const { verifyGoogleIdToken } = await import('../services/googleToken.service');
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      googleId: 'g-link', email: 'linkme@test.local', name: 'Link Me', picture: '',
    });

    const res = await post(app, '/api/v1/auth/google/callback', { idToken: 'stub' });
    expect(res.status).toBe(200);

    const stored = await Customer.findOne({ email: 'linkme@test.local' });
    expect(stored?.authProviders).toEqual(expect.arrayContaining(['email', 'google']));
  });
});
```

Add this mock alongside the others at the top of the file:

```ts
vi.mock('../services/googleToken.service', () => ({ verifyGoogleIdToken: vi.fn() }));
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `cd backend && npx vitest run src/test/accountSecurity.integration.test.ts`
Expected: FAIL — the routes 404 and `authProviders` lacks `'google'`.

- [ ] **Step 3: Add the schemas**

Append to `backend/src/utils/validation.ts`:

```ts
// POST /customer/set-password — for accounts created through Google, which
// have no current password to prove ownership with. The emailed code is the
// proof instead.
export const setPasswordSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

// PUT /customer/profile — previously unvalidated: req.body fields were spread
// straight into $set. Strict so that role, isActive, email and password can
// never ride in on a profile update.
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').or(z.literal('')).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say', '']).optional(),
  city: z.string().trim().max(100).optional(),
}).strict();
```

- [ ] **Step 4: Record the provider on Google link**

In `backend/src/controllers/googleAuth.controller.ts`, the existing link branch reads:

```ts
      if (!customer.googleId) {
        customer.googleId = googleId;
        customer.emailVerified = true; // verified at Google
        if (picture && !customer.profilePicture) {
          customer.profilePicture = picture;
        }
        await customer.save();
      }
```

Replace it with:

```ts
      if (!customer.googleId) {
        customer.googleId = googleId;
        customer.emailVerified = true; // verified at Google
        if (picture && !customer.profilePicture) {
          customer.profilePicture = picture;
        }
        await customer.save();
      }
      // authProviders is what the account's security screen renders from, so it
      // has to reflect reality — previously linking set googleId and left the
      // array saying 'email' only, and the screen told the customer they had
      // no Google sign-in.
      if (!customer.authProviders?.includes('google')) {
        await Customer.updateOne({ _id: customer._id }, { $addToSet: { authProviders: 'google' } });
      }
```

- [ ] **Step 5: Add the routes**

In `backend/src/routes/customer.routes.ts`, replace the unvalidated `PUT /profile` handler body with a validated one:

```ts
router.put('/profile', async (req: any, res) => {
  const values = profileUpdateSchema.parse(req.body);
  const customer = await Customer.findByIdAndUpdate(
    req.user.id,
    { $set: values },
    { new: true }
  ).select('-password -otp -otpExpiry');
  res.json({ success: true, data: customer, message: 'Profile updated' });
});
```

Add the new imports at the top of the file:

```ts
import crypto from 'crypto';
import { profileUpdateSchema, setPasswordSchema } from '../utils/validation';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../utils/resetCode';
import { sendEmail, buildResetEmail } from '../services/email.service';
```

Then append, inside the protected section:

```ts
/**
 * Ask for a code to set a first password. Only reachable by an authenticated
 * customer, so there is nothing to enumerate — but an account that already has
 * a password must use the current-password route instead.
 */
router.post('/set-password/request', otpLimit, async (req: any, res) => {
  const customer = await Customer.findById(req.user.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Account not found' });
  if (customer.password) {
    return res.status(409).json({ success: false, message: 'This account already has a password. Change it from your security settings.' });
  }

  const code = generateResetCode();
  await Customer.findByIdAndUpdate(customer._id, {
    $set: { resetOtpHash: hashResetCode(code), resetOtpExpiry: new Date(Date.now() + RESET_CODE_TTL_MS), resetOtpAttempts: 0 },
  });
  try {
    await sendEmail({ to: customer.email, subject: 'NexMart — Set your password', html: buildResetEmail(customer.name, code) });
  } catch (emailErr: unknown) {
    console.error('[SetPassword] SMTP failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
  }
  res.status(202).json({ success: true, message: 'If your account can take a password, we have sent a code.', data: null });
});

/** Complete the first-password flow with the emailed code. */
router.post('/set-password', async (req: any, res) => {
  const { otp, password } = setPasswordSchema.parse(req.body);
  const customer = await Customer.findById(req.user.id).select('+resetOtpHash +resetOtpExpiry +resetOtpAttempts');
  if (!customer) return res.status(404).json({ success: false, message: 'Account not found' });
  if (customer.password) {
    return res.status(409).json({ success: false, message: 'This account already has a password.' });
  }

  const fail = () => res.status(400).json({ success: false, message: 'Unable to set a password with that code. Please request a new one.', data: null });
  if (!customer.resetOtpHash || !customer.resetOtpExpiry) return fail();
  if (customer.resetOtpExpiry.getTime() < Date.now()) return fail();
  if ((customer.resetOtpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) return fail();
  if (hashResetCode(otp) !== customer.resetOtpHash) {
    await Customer.findByIdAndUpdate(customer._id, { $inc: { resetOtpAttempts: 1 } });
    return fail();
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await Customer.findByIdAndUpdate(customer._id, {
    $set: { password: hashedPassword },
    $unset: { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 },
    $addToSet: { authProviders: 'email' },
  });
  res.json({ success: true, message: 'Password set. You can now sign in with your email too.', data: null });
});

/**
 * Sign out everywhere. Stamps credentialsChangedAt, which protectCustomer
 * checks against each token's iat — so every session, including this one,
 * stops working immediately.
 */
router.post('/sign-out-everywhere', async (req: any, res) => {
  await Customer.findByIdAndUpdate(req.user.id, { $set: { credentialsChangedAt: new Date() } });
  res.clearCookie('nexmart_customer_session', { path: '/' });
  res.json({ success: true, message: 'Signed out on all devices.', data: null });
});
```

- [ ] **Step 6: Write the backfill script**

Create `backend/src/scripts/backfillAuthProviders.ts`:

```ts
/**
 * One-shot, idempotent repair: accounts linked to Google before the provider
 * was recorded have a googleId but no 'google' entry in authProviders, which
 * the account security screen renders from. Safe to re-run.
 *
 * Usage: cd backend && npx ts-node -r tsconfig-paths/register src/scripts/backfillAuthProviders.ts
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);

  const linked = await Customer.updateMany(
    { googleId: { $exists: true, $ne: null }, authProviders: { $ne: 'google' } },
    { $addToSet: { authProviders: 'google' } },
  );
  const passworded = await Customer.updateMany(
    { password: { $exists: true, $ne: null }, authProviders: { $ne: 'email' } },
    { $addToSet: { authProviders: 'email' } },
  );

  logger.info(`Backfill complete — google: ${linked.modifiedCount}, email: ${passworded.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error('Backfill failed', error);
  process.exit(1);
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/test/accountSecurity.integration.test.ts`
Expected: 4 passing.

- [ ] **Step 8: Run the gates and commit**

```bash
cd backend && npm run lint && npm run typecheck && npm test
git add backend/src/utils/validation.ts backend/src/controllers/googleAuth.controller.ts backend/src/routes/customer.routes.ts backend/src/scripts/backfillAuthProviders.ts backend/src/test/accountSecurity.integration.test.ts
git commit -m "feat(account): set-password, sign-out-everywhere, profile validation

Google-only customers can add a password via an emailed code. Sign out
everywhere stamps credentialsChangedAt. PUT /customer/profile gains a strict
zod schema — it previously spread req.body into \$set, so role and isActive
were writable from a profile update. Google linking now records the provider,
and a backfill repairs existing accounts."
```

---

### Task 5: Frontend — reset flow, four-field registration, OTP component

**Files:**
- Create: `frontend/src/components/auth/OtpInput.tsx`
- Create: `frontend/src/app/customer/forgot-password/page.tsx`
- Create: `frontend/src/app/customer/reset-password/page.tsx`
- Modify: `frontend/src/app/customer/register/page.tsx`
- Modify: `frontend/src/app/customer/verify-otp/page.tsx`
- Modify: `frontend/src/components/auth/AuthForm.tsx`
- Modify: `frontend/src/store/authStore.ts:141-147`
- Modify: `frontend/src/middleware.ts`

**Interfaces:**
- Consumes: `POST /customer/auth/forgot-password`, `POST /customer/auth/reset-password` (Task 3)
- Produces: `<OtpInput value={string[]} onChange={(next: string[]) => void} disabled?: boolean />`

- [ ] **Step 1: Extract the OTP input component**

Create `frontend/src/components/auth/OtpInput.tsx`. Behaviour is lifted verbatim from the verify-otp page — auto-advance, backspace-back, full paste, `one-time-code` autocomplete on the first box:

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface OtpInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * The six-box code input (CLAUDE.md §5.5). Extracted from the verify-otp page
 * so email verification and password reset share one implementation.
 */
export function OtpInput({ value, onChange, disabled, autoFocus = true }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (autoFocus) inputRefs.current[0]?.focus(); }, [autoFocus]);

  function handleChange(index: number, raw: string) {
    if (!/^\d*$/.test(raw)) return;
    const next = [...value];
    next[index] = raw.slice(-1);
    onChange(next);
    if (raw && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      onChange(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  return (
    <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          aria-label={`Verification digit ${index + 1}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          suppressHydrationWarning
          className="h-[52px] w-11 rounded-xl border border-white/15 bg-black/50 text-center text-xl font-bold text-white transition-[border-color,box-shadow] focus-visible:border-violet-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Use it in the verify-otp page**

In `frontend/src/app/customer/verify-otp/page.tsx`: import `OtpInput`, delete `handleChange`, `handleKeyDown`, `handlePaste`, `inputRefs` and the first-box focus effect, and replace the hand-rolled OTP box `<div>` (the block starting `{/* OTP boxes */}`) with:

```tsx
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
```

Also change the header copy so it is true on every registration branch:

```tsx
              <h1 className="text-xl font-bold text-white font-outfit mb-2">Check your email</h1>
              <p className="text-sm text-muted leading-relaxed">
                If that address is eligible, we sent a 6-digit code to<br />
                <span className="text-violet-400 font-medium">{email}</span>
              </p>
```

- [ ] **Step 3: Build the forgot-password page**

Create `frontend/src/app/customer/forgot-password/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { Logo } from '@/components/common/Logo';

const schema = z.object({ email: z.string().min(1, 'Enter your email').email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function submit(values: Values) {
    setError('');
    try {
      await api.post('/customer/auth/forgot-password', { email: values.email });
      // The response is deliberately opaque, so the next screen says the same
      // thing whatever the truth is.
      router.push(`/customer/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-space-950 p-4">
      <div className="absolute inset-0 z-0 bg-hero-gradient opacity-50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-space-800/90 p-6 shadow-glow-violet backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-8 inline-flex items-center gap-3">
            <Logo size={38} />
            <span className="font-outfit text-2xl font-bold tracking-tight text-white">NexMart</span>
          </Link>
          <h1 className="mb-2 font-outfit text-3xl font-bold tracking-tight text-white">Reset your password</h1>
          <p className="font-inter text-sm text-muted">Enter your email and we will send a 6-digit code.</p>
        </div>

        {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-300">{error}</p>}

        <form onSubmit={handleSubmit(submit)} noValidate>
          <fieldset disabled={isSubmitting} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">Email address</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white placeholder-white/30 transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                placeholder="Enter your email address…"
              />
              {errors.email && <p id="forgot-email-error" role="alert" className="mt-1 text-xs text-red-300">{errors.email.message}</p>}
            </div>
            <button type="submit" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-white py-3.5 font-outfit font-semibold text-black transition-opacity disabled:opacity-70">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Send reset code'}
            </button>
          </fieldset>
        </form>

        <div className="mt-8 border-t border-white/[0.05] pt-6 text-center">
          <Link href="/customer/login" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-inter text-sm text-secondary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build the reset-password page**

Create `frontend/src/app/customer/reset-password/page.tsx`. Wrap the content in `<Suspense>` exactly as `verify-otp/page.tsx` does, because it reads `useSearchParams`:

```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { Logo } from '@/components/common/Logo';
import { OtpInput } from '@/components/auth/OtpInput';

function ResetPasswordContent() {
  const router = useRouter();
  const email = decodeURIComponent(useSearchParams().get('email') || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strongEnough = password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
  const ready = otp.join('').length === 6 && strongEnough && password === confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) {
      if (!strongEnough) setError('Use at least 8 characters with uppercase, lowercase, and a number.');
      else if (password !== confirm) setError('Passwords must match.');
      else setError('Enter all 6 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/customer/auth/reset-password', { email, otp: otp.join(''), password });
      setDone(true);
      setTimeout(() => router.push('/customer/login'), 2500);
    } catch (err) {
      setError(getApiError(err));
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-space-950 p-4">
      <div className="absolute inset-0 z-0 bg-hero-gradient opacity-50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-space-800/90 p-6 shadow-glow-violet backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Logo size={34} />
          <span className="font-outfit text-xl font-bold tracking-tight text-white">NexMart</span>
        </div>

        {done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-acid-400/20 bg-acid-400/10">
              <CheckCircle size={32} className="text-acid-400" aria-hidden />
            </div>
            <h1 className="mb-2 font-outfit text-xl font-bold text-white">Password updated</h1>
            <p className="text-sm text-muted">Taking you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <h1 className="mb-2 font-outfit text-xl font-bold text-white">Enter your code</h1>
              <p className="text-sm leading-relaxed text-muted">
                If that address is eligible, we sent a 6-digit code to<br />
                <span className="font-medium text-violet-400">{email}</span>
              </p>
            </div>

            {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{error}</p>}

            <form onSubmit={submit} noValidate>
              <fieldset disabled={loading}>
                <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                <div className="mb-4 space-y-1.5">
                  <label htmlFor="reset-password" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">New password</label>
                  <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30" />
                  <p className="ml-1 text-xs text-muted">At least 8 characters, with uppercase, lowercase, and a number.</p>
                </div>

                <div className="mb-5 space-y-1.5">
                  <label htmlFor="reset-confirm" className="ml-1 block font-inter text-xs font-medium uppercase tracking-wider text-secondary">Confirm password</label>
                  <input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="w-full min-h-12 rounded-xl border border-white/[0.12] bg-black/40 px-4 py-3 font-inter text-sm text-white transition-[background-color,border-color,box-shadow] focus-visible:border-violet-500/70 focus-visible:bg-space-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30" />
                </div>

                <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-white py-3.5 font-outfit font-semibold text-black transition-opacity disabled:opacity-50">
                  {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Set new password'}
                </button>
              </fieldset>
            </form>

            <div className="mt-6 border-t border-white/[0.05] pt-5 text-center">
              <Link href="/customer/forgot-password" className="inline-flex min-h-11 items-center px-3 text-xs text-secondary transition-colors hover:text-white">
                Need a new code?
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100svh] items-center justify-center bg-space-950"><Loader2 size={28} className="animate-spin text-violet-400" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
```

- [ ] **Step 5: Cut registration to four fields**

Replace the `fields` array in `frontend/src/app/customer/register/page.tsx` with:

```tsx
      fields={[
        { name: 'name', label: 'Full Name', type: 'text' },
        { name: 'email', label: 'Email Address', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'confirmPassword', label: 'Confirm Password', type: 'password' },
      ]}
```

Phone and address are collected at checkout, which already validates them and offers saved addresses.

- [ ] **Step 6: Fix AuthForm — copy, per-field toggle, password policy, 202 routing**

Four edits in `frontend/src/components/auth/AuthForm.tsx`.

Password policy in `fieldSchema` — replace the password branch:

```tsx
  if (field.type === 'password') {
    if (field.name === 'confirmPassword') return z.string().min(1, 'Confirm your password');
    return z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number');
  }
```

Per-field visibility — replace `const [showPassword, setShowPassword] = useState(false);` with:

```tsx
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
```

and in the field loop replace the `type=` expression and the toggle button:

```tsx
                  type={field.type === 'password' && visibleFields[field.name] ? 'text' : field.type}
```

```tsx
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setVisibleFields((prev) => ({ ...prev, [field.name]: !prev[field.name] }))}
                    aria-label={visibleFields[field.name] ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                    aria-pressed={!!visibleFields[field.name]}
                    className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                  >
                    {visibleFields[field.name] ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                )}
```

Registration routing — replace the whole `if (type === 'register')` branch of `onSubmit`:

```tsx
      if (type === 'register') {
        const res = await api.post(`/${portal}/auth/register`, values);
        if (res.data.success) {
          if (portal === 'customer') {
            // The backend answers registration with a deliberately opaque 202 on
            // every existence branch, so `requiresOtp` can never honestly say
            // whether a code was sent. Always route to the code screen — its
            // copy is true whether the address was new, already pending (which
            // really did just receive a code), or already taken.
            router.push(`/customer/verify-otp?email=${encodeURIComponent(values.email)}`);
          } else {
            showToast(res.data.message);
            router.push(redirectUrl);
          }
        }
      }
```

Sign-in copy — replace the subtitle line:

```tsx
        <p className="text-sm text-muted font-inter">{type === 'login' ? 'Sign in to your NexMart account' : 'Create your NexMart account'}</p>
```

Forgot-password link — add directly after the submit `</form>`, rendered only on customer login:

```tsx
        {type === 'login' && portal === 'customer' && (
          <div className="mt-4 text-center">
            <Link href="/customer/forgot-password" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-inter text-sm text-secondary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60">
              Forgot your password?
            </Link>
          </div>
        )}
```

- [ ] **Step 7: Stop refreshUser from logging out on transient failures**

In `frontend/src/store/authStore.ts`, replace the `refreshUser` catch:

```ts
      refreshUser: async () => {
        try {
          const role = get().user?.role || 'customer';
          const endpoint = role === 'agent' ? '/agent/profile' : `/${role}/profile`;
          const { data } = await api.get(endpoint);
          if (data.data) {
            set((state) => ({ user: { ...state.user!, ...data.data } }));
          }
        } catch (error) {
          // Only a rejected identity clears the session. A timeout, a 5xx or an
          // offline moment must not read as a logout — the axios interceptor
          // already handles a real 401 by routing to the login page.
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403) {
            set({ user: null, token: null, isAuthenticated: false });
            clearToken();
          }
        }
      },
```

- [ ] **Step 8: Let the new pages through middleware**

In `frontend/src/middleware.ts`, the customer block sends any authenticated visitor away from `/customer/*` auth pages, and unauthenticated visitors must reach the new ones. Directly above the existing `if (pathname.startsWith('/customer/verify-otp'))` line, add:

```ts
  // Password recovery must stay reachable for signed-out visitors, exactly
  // like verify-otp. Signed-in customers are sent to their account instead.
  if (pathname.startsWith('/customer/forgot-password') || pathname.startsWith('/customer/reset-password')) {
    if (isAuthenticated && role === 'customer') {
      return NextResponse.redirect(new URL('/profile', req.url));
    }
    return NextResponse.next();
  }
```

- [ ] **Step 9: Run the frontend gates**

```bash
cd frontend && npm run lint && npm run build && npm test
```
Expected: clean build, 0 lint errors (jsx-a11y is enforced), existing tests green.

- [ ] **Step 10: Verify at 375px**

Run `cd frontend && npm run dev`, then in a 375px-wide viewport walk: `/customer/login` → "Forgot your password?" → submit an address → the six boxes and both password fields on `/customer/reset-password`. Confirm no horizontal scroll, every control ≥44px tall, and visible focus rings when tabbing.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/auth/ frontend/src/app/customer/ frontend/src/store/authStore.ts frontend/src/middleware.ts
git commit -m "feat(auth): password reset UI, four-field signup, shared OTP input

Registration drops to name/email/password/confirm — checkout already collects
the address properly. AuthForm stops inferring OTP state from a deliberately
opaque 202 and always routes to the code screen, whose copy is true on every
branch. Per-field password visibility, real strength policy, account-oriented
copy. refreshUser no longer treats a timeout as a logout."
```

---

### Task 6: Account security tab

**Files:**
- Modify: `frontend/src/app/profile/page.tsx` (security tab only)
- Create: `frontend/src/components/profile/SetPasswordModal.tsx`

**Interfaces:**
- Consumes: `POST /customer/set-password/request`, `POST /customer/set-password`, `POST /customer/sign-out-everywhere` (Task 4); `OtpInput` (Task 5)

- [ ] **Step 1: Build the set-password modal**

Create `frontend/src/components/profile/SetPasswordModal.tsx`, following the `PasswordModal` structure (Overlay, `useId`, `getApiError`, toast):

```tsx
'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api, { getApiError } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';
import { Overlay } from '@/components/common/Overlay';
import { OtpInput } from '@/components/auth/OtpInput';

/**
 * First password for an account created through Google. There is no current
 * password to prove ownership with, so the backend emails a code instead.
 */
export function SetPasswordModal({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: () => void }) {
  const id = useId();
  const toast = useUIStore((s) => s.showToast);
  const [stage, setStage] = useState<'request' | 'enter'>('request');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    setStage('request'); setOtp(['', '', '', '', '', '']); setPassword(''); setError(''); onClose();
  }

  async function requestCode() {
    setBusy(true); setError('');
    try { await api.post('/customer/set-password/request', {}); setStage('enter'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password) || password.length < 8) {
      setError('Use at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }
    setBusy(true); setError('');
    try {
      await api.post('/customer/set-password', { otp: otp.join(''), password });
      toast('Password set. You can now sign in with your email too.');
      onDone(); close();
    } catch (err) { setError(getApiError(err)); setOtp(['', '', '', '', '', '']); }
    finally { setBusy(false); }
  }

  return (
    <Overlay open={isOpen} onClose={close} title="Add a password" description="Your account signs in with Google. Add a password to sign in by email as well." busy={busy}>
      {error && <p role="alert" className="field-error mb-4">{error}</p>}
      {stage === 'request' ? (
        <div className="space-y-4">
          <p className="text-sm text-secondary">We will email you a 6-digit code to confirm it is you.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void requestCode()} disabled={busy}>
              {busy && <Loader2 size={17} className="animate-spin" aria-hidden />}{busy ? 'Sending…' : 'Email me a code'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy} className="space-y-4">
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            <div>
              <label htmlFor={`${id}-password`} className="field-label">New password</label>
              <input id={`${id}-password`} type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="field-hint">At least 8 characters, with uppercase, lowercase, and a number.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="submit" className="btn-primary">{busy && <Loader2 size={17} className="animate-spin" aria-hidden />}{busy ? 'Saving…' : 'Set password'}</button>
            </div>
          </fieldset>
        </form>
      )}
    </Overlay>
  );
}
```

- [ ] **Step 2: Rewrite the security tab**

In `frontend/src/app/profile/page.tsx`, replace the whole `<Tabs.Content value="security" …>` element with:

```tsx
      <Tabs.Content value="security" className="card max-w-2xl"><h2 className="mb-5 text-xl">Sign-in and security</h2>
        <p className="break-words text-sm text-secondary">Email: {profile.email}</p>
        <p className="mt-2 text-sm text-secondary">{profile.emailVerified ? 'Your email is verified.' : 'Your email is not verified.'}</p>
        <h3 className="mt-6 text-lg">How you sign in</h3>
        <ul className="mt-2 space-y-1 text-sm text-secondary">
          {profile.authProviders?.includes('email') && <li>Email and password</li>}
          {profile.authProviders?.includes('google') && <li>Google</li>}
          {!profile.authProviders?.length && <li>No sign-in method recorded for this account.</li>}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          {profile.authProviders?.includes('email')
            ? <button type="button" className="btn-secondary" onClick={() => setPasswordOpen(true)}>Change password</button>
            : <button type="button" className="btn-secondary" onClick={() => setSetPasswordOpen(true)}>Add a password</button>}
          <button type="button" className="btn-secondary" onClick={() => setSignOutOpen(true)}>Sign out on all devices</button>
        </div>
      </Tabs.Content>
```

- [ ] **Step 3: Wire the new state and dialogs**

Add to the component's state block:

```tsx
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
```

Add the handler beside the other async functions:

```tsx
  async function signOutEverywhere() {
    setSignOutBusy(true);
    try {
      await api.post('/customer/sign-out-everywhere', {});
      // This session is gone too, so leave through the normal logout path
      // rather than leaving a dead session in the store.
      await useAuthStore.getState().logout();
    } catch (error) { setError(getApiError(error)); }
    finally { setSignOutBusy(false); setSignOutOpen(false); }
  }
```

Add the imports (`SetPasswordModal` beside `PasswordModal`), and render beside the existing `<PasswordModal …/>`:

```tsx
    <SetPasswordModal isOpen={setPasswordOpen} onClose={() => setSetPasswordOpen(false)} onDone={() => void query.refetch()} />
    <ConfirmDialog open={signOutOpen} title="Sign out on all devices?" description="Every signed-in device, including this one, will be signed out. You will need to sign in again." confirmLabel="Sign out everywhere" onConfirm={() => void signOutEverywhere()} onCancel={() => setSignOutOpen(false)} isLoading={signOutBusy} />
```

- [ ] **Step 4: Run the frontend gates**

```bash
cd frontend && npm run lint && npm run build && npm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/profile/page.tsx frontend/src/components/profile/SetPasswordModal.tsx
git commit -m "feat(account): honest provider list, add-password, sign out everywhere

The security tab now renders the real authProviders list instead of dead-ending
Google customers, who can add a password via an emailed code. Sign out on all
devices stamps credentialsChangedAt through the new endpoint."
```

---

### Task 7: Live verification and documentation

**Files:**
- Modify: `CLAUDE.md` (§1.3 auth architecture, §8 roadmap tail)
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-09-13-marketplace-program-map.md` (tracker → DONE)

- [ ] **Step 1: Run every gate together**

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd ../frontend && npm run lint && npm run build && npm test
```
Expected: all green. Record the actual test counts for the changelog entry.

- [ ] **Step 2: Live smoke the reset flow**

Start both apps (`cd backend && npm run dev`, `cd frontend && npm run dev`). With a real address you control:

1. Register with four fields → land on the code screen → verify → sign in.
2. Sign out. "Forgot your password?" → submit → receive the code → set a new password.
3. Confirm the old password is refused and the new one works.
4. Sign in on a second browser, then use "Sign out on all devices" in the first — confirm the second browser is signed out on its next request.
5. Submit `forgot-password` for an address with no account — confirm the response is a 202 identical to the real one (browser devtools, Network tab) and no mail arrives.

Do not print any real credential or code into the transcript.

- [ ] **Step 3: Run the backfill against the live database**

```bash
cd backend && npx ts-node -r tsconfig-paths/register src/scripts/backfillAuthProviders.ts
```
Expected: a count line. Re-run it once — the second run must report 0 modified, proving idempotence.

- [ ] **Step 4: Update CLAUDE.md**

In §1.3, append to the auth bullet list:

```markdown
- Password reset is OTP-based (`POST /customer/auth/forgot-password` → `reset-password`), codes SHA-256 hashed at rest with a 15-minute TTL and a 5-attempt cap. A successful reset — and the `POST /customer/sign-out-everywhere` route — stamps `credentialsChangedAt` on the customer; `protectCustomer` rejects any token whose `iat` predates it. That timestamp is the only session-invalidation primitive: use it rather than inventing a second one.
- `authProviders` is authoritative for "how can this account sign in?" and is written on Google link and on set-password. The account security screen renders from it.
- Customer registration collects name, email, password, confirm. Phone and address belong to checkout and the address book, never to signup.
- Integration tests live in `backend/src/test/` and run the real app through supertest against `mongodb-memory-server`. Mutating requests must send `Origin: http://localhost:3000` or the CSRF gate rejects them. Reuse `src/test/helpers.ts` rather than rebuilding a harness.
```

- [ ] **Step 5: Add the changelog entry**

Prepend to `docs/CHANGELOG.md` under a `## 2026-09-13 — Piece 0: customer auth repair + account extension` heading: the reset flow, the four-field signup, the eight defects with their one-line causes, the new integration harness and the real test counts from Step 1.

- [ ] **Step 6: Flip the tracker**

In `docs/superpowers/plans/2026-09-13-marketplace-program-map.md`, set Piece 0's status to `DONE 2026-09-13` and fill its plan-document column with this file's path.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: Piece 0 complete — auth repair, account extension, test harness"
```

---

## Self-review

**Spec coverage.** Every spec section maps to a task: reset flow → Task 3; hashed codes and `credentialsChangedAt` → Task 2; registration 9→4 → Task 5 Step 5; the 202 routing bug → Task 5 Step 6; the five wiring defects → `refreshUser` Task 5 Step 7, `authProviders` Task 4 Step 4 plus the backfill Step 6, lockout counter Task 3 Step 6, per-field toggle Task 5 Step 6, copy Task 5 Step 6; set-password → Task 4 plus Task 6; honest provider list → Task 6 Step 2; sign-out-everywhere → Task 4 Step 5 and Task 6; profile zod → Task 4 Steps 3 and 5; the harness → Task 1. All six acceptance criteria are exercised by a named test or a Task 7 smoke step.

**Type consistency.** `hashResetCode` / `generateResetCode` / `RESET_CODE_TTL_MS` / `RESET_CODE_MAX_ATTEMPTS` are defined in Task 2 and used with those exact names in Tasks 3 and 4. `OtpInput`'s `{ value, onChange, disabled, autoFocus }` signature is defined in Task 5 Step 1 and consumed identically in Steps 2 and 4 and in Task 6. Harness helper names (`startTestDb`, `stopTestDb`, `clearCollections`, `testApp`, `post`, `put`, `get`, `sessionCookie`, `registerAndVerify`) are defined in Task 1 and used unchanged throughout — note `put` is exported in Task 1 because Task 4's profile test needs it.

**One risk flagged for the executor.** Task 4's set-password test mints its session with `generateToken` directly rather than through a login, because a Google-only account has no password to log in with. If `protectCustomer` later gains a check that this bypasses, that test is the first place to look.
