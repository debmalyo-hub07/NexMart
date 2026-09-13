# Piece 0 — Customer Auth Repair + Account Repair/Extension

**Date:** 2026-09-13
**Program:** [Marketplace Transformation](../plans/2026-09-13-marketplace-program-map.md) — Piece 0 of 14
**Status:** approved, in implementation

---

## Why this piece is first

It has no schema dependency on anything the marketplace needs, it repairs
defects that exist today, and it establishes the integration test harness that
Pieces 1–13 reuse. The cross-seller denial tests that Piece 9 depends on are
this harness with a seller fixture — building it here means every later piece
inherits it rather than re-inventing it under deadline.

---

## Starting state (verified in code, 2026-09-13)

The customer auth path is in better shape than the master directive assumes.
What already works and must not regress:

- Google sign-in is ID-token verified server-side against Google's tokeninfo
  endpoint — audience checked against our client id, email must be verified at
  Google, fails closed (`services/googleToken.service.ts`).
- Anti-enumeration is real and deliberate across register / verify-otp /
  resend-otp: uniform opaque 202s via `sendEligibilityPending`, field
  validation before existence checks, unconditional bcrypt for timing parity,
  OTP rate limit consumed before lookup.
- Suspension is enforced per request in `protectCustomer`, not only at login.
- Tokens carry a `jti` and are blacklisted in Redis on logout.
- NextAuth `maxAge` matches the 7-day backend cookie (`lib/sessionConstants`).
- `app.ts` exports `createApp()` separately from `server.ts` — an integration
  harness can mount the real app without binding a port.
- `app/profile/page.tsx` already has Radix tabs, full address CRUD with confirm
  dialogs, avatar upload with type and size validation, `QueryError` tri-state
  and `aria-describedby` wiring.

### Defects this piece fixes

| # | Defect | Evidence |
|---|--------|----------|
| 1 | No password reset exists anywhere in either application | zero references to forgot/reset in `backend/src` or `frontend/src` |
| 2 | Registration demands 9 fields including a full address | `app/customer/register/page.tsx`; checkout already collects the address at `app/checkout/page.tsx:99-102` |
| 3 | The opaque 202 is mishandled: re-registering an unverified email really does send an OTP but returns `requiresOtp: false`, so the user is routed to login where they cannot log in | `AuthForm.tsx:104` vs `roleAuth.controller.ts:167-193` |
| 4 | Login copy reads "Welcome back to your workspace" | `AuthForm.tsx:161` |
| 5 | `refreshUser` clears auth on any failure — a 500 or timeout reads as a logout | `store/authStore.ts:141-147` |
| 6 | Google linking sets `googleId` but never updates `authProviders`, so the array that answers "how can I sign in?" is wrong for every linked account — and the security tab renders from it | `googleAuth.controller.ts:76-84`, consumed by `app/profile/page.tsx` security tab |
| 7 | An unverified customer's correct password increments the 5-strike IP lockout counter | `roleAuth.controller.ts:394` |
| 8 | One `showPassword` state reveals password and confirm-password together | `AuthForm.tsx` |
| 9 | `PUT /customer/profile` has no validation — `req.body` fields spread straight into `$set` | `routes/customer.routes.ts:38-52` |
| 10 | A Google-only customer has no way to set a password; the security tab dead-ends them | `app/profile/page.tsx` security tab |
| 11 | No integration test harness — `supertest` is not installed, and every auth test mocks at the controller boundary | `backend/package.json`, `src/controllers/__tests__/` |

---

## Scope decision

The user initially chose "auth + full account rebuild". On reading
`app/profile/page.tsx` the account page turned out not to need rebuilding — it
is well built. The scope was corrected, with the user's agreement, to **auth
repair plus account repair and extension**: fix what lies (defect 6), add what
dead-ends (defect 10), validate what is unvalidated (defect 9), and add the
session control that makes a password reset meaningful. No rewrite of working
UI.

---

## Design

### 1. Password reset — OTP, reusing the §5.5 flow

Two new public routes:

```
POST /customer/auth/forgot-password  { email }                  → always 202
POST /customer/auth/reset-password   { email, otp, password }   → 200 | uniform 400
```

**Anti-enumeration is held to the standard already set in this file.**
`forgot-password` consumes the OTP email rate limit *before* any lookup (the
`resendOtp` pattern), performs work of comparable cost on every branch, and
answers unknown email, admin/agent email, and Google-only account with the
identical 202 body. `reset-password` answers unknown email, wrong code and
expired code with one uniform 400. Any new branch added here later must keep
every existence-related response byte-identical.

**Reset codes are stored hashed.** The P7 review flagged plaintext OTP
persistence as a defect; a reset code is strictly more sensitive than a
verification code. New `Customer` fields:

- `resetOtpHash` — SHA-256 of the 6-digit code, never the code itself
- `resetOtpExpiry` — 15 minutes
- `resetOtpAttempts` — capped at 5, after which the code is dead

**A Google-only account still receives an email**, but one that says the
account signs in with Google and links to sign-in, rather than carrying a code.
The owner gets a truthful, actionable message; an attacker observing the HTTP
response learns nothing, because the response is the same 202.

**A successful reset invalidates every session that predates it.** New
`credentialsChangedAt` timestamp on `Customer`; `protectCustomer` rejects any
token whose `iat` is older. Without this, an attacker holding a live session
keeps it after the victim resets — which would make the whole feature
security-theatre. The same primitive backs "sign out everywhere", so both
features rest on one mechanism rather than two.

### 2. Registration — nine fields to four

`name`, `email`, `password`, `confirmPassword`. The backend already treats
phone and address as optional, so this is a frontend change plus aligning the
form's password rule with the backend policy that already exists in
`validation.ts` (minimum 8, upper + lower + digit). Checkout continues to
collect the delivery address exactly as it does today.

### 3. The 202 routing bug — fix the cause

`AuthForm` infers OTP state from `requiresOtp`, which a deliberately opaque
response can never honestly carry. The inference is removed. **Registration
always routes to `/customer/verify-otp?email=…`** with copy that is true on
every branch: "If that address is eligible, we've sent a 6-digit code." New
account, existing-unverified (which genuinely did just receive a code),
existing-verified, and cross-role email all land somewhere useful, and none of
them is distinguishable from the others.

### 4. Wiring defects

- `refreshUser` clears auth state only on 401/403; network and 5xx failures
  leave the session intact.
- `authProviders` gains `'google'` when an account is linked and `'email'` when
  a Google-only account sets a password. A one-shot idempotent backfill script
  repairs existing accounts that have a `googleId` but no `'google'` entry.
- Unverified login stops incrementing the lockout counter — the same reasoning
  already applied to pending agents in P1-15.
- `showPassword` becomes per-field state.
- Login copy becomes "Sign in to your NexMart account".

### 5. Account surface — repair and extend

- `POST /customer/set-password` for Google-only accounts. There is no old
  password to prove ownership, so the route requires an emailed OTP; it reuses
  the reset machinery rather than introducing a second code path. On success
  `'email'` joins `authProviders`.
- The security tab renders the real provider list, so it stops lying.
- "Sign out everywhere" writes `credentialsChangedAt`.
- `PUT /customer/profile` gets a zod schema, matching every other write path.
- "Forgot password?" link on the login page.

### 6. Integration test harness

`supertest` is added. `createApp()` is mounted against `MongoMemoryServer` —
the plain server rather than the replica set, since no transaction is involved
in auth and the plain server starts substantially faster. Redis and SMTP are
mocked at the module boundary; no external service is contacted.

Helpers live in `src/test/helpers.ts` for later pieces to import:

- `makeApp()` — boot the real Express app against the in-memory database
- `registerAndVerify()` — produce a logged-in customer and their cookie

Coverage, written test-first:

- Full lifecycle: register → verify → login → protected route → reset →
  the pre-reset session is rejected and a fresh login succeeds
- Anti-enumeration: an existing and an unknown email produce identical status
  and body on register, forgot-password and verify-otp
- Reset: wrong code, expired code, sixth attempt, and reuse after success
- Lockout: wrong passwords increment the counter; an unverified login does not
- Google-only: forgot-password sends the "use Google" mail and never a code

---

## Files

**Backend.** `models/Customer.ts` (four additive fields);
`controllers/roleAuth.controller.ts` (two handlers, one counter fix);
`middleware/auth.ts` (`credentialsChangedAt` check);
`routes/auth.routes.ts` and `routes/customer.routes.ts`;
`services/email.service.ts` (two templates);
`controllers/googleAuth.controller.ts` (provider recording);
`utils/validation.ts` (reset, set-password and profile schemas);
`scripts/backfillAuthProviders.ts`; `src/test/helpers.ts` and three test files.

**Frontend.** `components/auth/AuthForm.tsx`;
`components/auth/OtpInput.tsx` — extracted from the verify-otp page so the
verification and reset flows share one component rather than duplicating the
six-box behaviour; `app/customer/{register,login,verify-otp,forgot-password,reset-password}/page.tsx`;
`app/profile/page.tsx` (security tab); `store/authStore.ts`.

**Migration.** Additive fields only. No destructive change and therefore no
reverse script. The `authProviders` backfill is idempotent and safe to re-run.

---

## Acceptance criteria

1. A customer who forgets their password recovers it by email, and the reset
   invalidates every session that existed before it.
2. Registration asks for four fields.
3. No auth response distinguishes a real account from an absent one — verified
   by tests asserting byte-identical responses.
4. A Google-only customer can add a password, and the security tab reports
   truthfully how their account can sign in.
5. `npm test` in `backend/` runs integration tests against a real Express app
   with real routing, middleware and database queries.
6. All gates green: `backend/` lint + typecheck + test; `frontend/` lint +
   build + test.

---

## Out of scope

Seller anything (Piece 1). Admin and agent auth changes beyond what the shared
controller requires. Unifying the two auth route families — CLAUDE.md rule 9
holds, the hybrid is load-bearing. Rebuilding the profile page UI.
