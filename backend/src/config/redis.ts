/**
 * Redis config — Upstash REST API only
 *
 * Uses @upstash/redis (HTTP/HTTPS — no TCP port 6380 needed).
 * Rate limiting, OTP storage, and caching all work over port 443.
 *
 * BullMQ invoice queue has been replaced with an in-process async queue
 * (see queues/invoiceQueue.ts) — no IORedis dependency required.
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from './env';
import { logger } from '../utils/logger';
import { RevokedSession } from '../models/RevokedSession';

// ── Upstash Redis (REST over HTTPS — always works) ────────────
// signal: every call is bounded at 2.5s — a dead/unresolvable Upstash host
//   must fail fast, not hang each request for the DNS timeout.
//   MUST be a function: with a plain AbortSignal the client swallows the
//   abort into a fake 200 ({result:"Aborted"}) which reads as a truthy
//   cache/blacklist hit; as a function it throws, so callers can fail open.
// retry: disabled — 5 retries with exponential backoff on a dead host would
//   multiply the hang on every request. Callers degrade instead.
const realRedis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  signal: () => AbortSignal.timeout(2500),
  retry: false,
});

// ── Circuit breaker ────────────────────────────────────────────
// While Upstash is unreachable, every request still paid a failed round-trip
// (rate limiter on all routes, blacklist check on protected ones) — tens of
// ms with cached DNS failures, up to the full 2.5s when the DNS cache
// expires. After BREAKER_THRESHOLD consecutive failures the circuit OPENS:
// all calls reject instantly for BREAKER_COOLDOWN_MS, then one probe is
// allowed (half-open). Success closes the circuit — recovery is automatic
// the moment the URL in .env points at a live database again.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30_000;
const breaker = { failures: 0, openUntil: 0 };

function recordSuccess(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

function recordFailure(): void {
  breaker.failures += 1;
  if (breaker.failures >= BREAKER_THRESHOLD) {
    breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    logger.error(
      `Upstash Redis unreachable — circuit OPEN for ${BREAKER_COOLDOWN_MS / 1000}s. ` +
      'Requests proceed WITHOUT Redis (rate limiting, blacklist, caches, OTP degraded). ' +
      'Check UPSTASH_REDIS_REST_URL in .env.'
    );
  }
}

export const upstashRedis = new Proxy(realRedis, {
  get(target, prop) {
    const value = Reflect.get(target, prop, target);
    if (typeof value !== 'function') return value;

    return function circuitWrapped(this: unknown, ...args: unknown[]) {
      if (Date.now() < breaker.openUntil) {
        return Promise.reject(new Error('Upstash circuit open (Redis unreachable)'));
      }
      const result = (value as (...a: unknown[]) => unknown).apply(target, args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).then(
          (v) => { recordSuccess(); return v; },
          (e) => { recordFailure(); throw e; }
        );
      }
      return result; // sync method (pipeline builders etc.) — passthrough
    };
  },
}) as Redis;

// ── Rate Limiters ─────────────────────────────────────────────
export const generalRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(
    parseInt(env.RATE_LIMIT_MAX_REQUESTS),
    `${parseInt(env.RATE_LIMIT_WINDOW_MS) / 1000}s`
  ),
  prefix: 'nexmart:ratelimit:general',
});

export const authRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(10, '60s'),
  prefix: 'nexmart:ratelimit:auth',
});

export const paymentRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(
    parseInt(env.PAYMENT_RATE_LIMIT_MAX),
    '60s'
  ),
  prefix: 'nexmart:ratelimit:payment',
});

export const otpRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(3, '60s'),
  prefix: 'nexmart:ratelimit:otp',
});

export const registrationRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(3, '3600s'), // 3 per hour
  prefix: 'nexmart:ratelimit:registration',
});

export const otpEmailRateLimiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(3, '600s'), // 3 per 10 minutes
  prefix: 'nexmart:ratelimit:otp:email',
});

// ── OTP Redis helpers ─────────────────────────────────────────
export async function setOtpLock(key: string, ttlSeconds: number): Promise<void> {
  await upstashRedis.set(`nexmart:otp:lock:${key}`, '1', { ex: ttlSeconds });
}

export async function getOtpLock(key: string): Promise<boolean> {
  const val = await upstashRedis.get(`nexmart:otp:lock:${key}`);
  return val !== null;
}

export async function deleteOtpLock(key: string): Promise<void> {
  await upstashRedis.del(`nexmart:otp:lock:${key}`);
}

// ── Failed Login Attempt helpers ──────────────────────────────
// All fail OPEN on Redis errors: brute-force lockout is a protection, not a
// functional requirement — an unreachable Redis must not 500 every login.
// Degradation is logged loudly so it is visible in ops.
export async function getFailedLoginAttempts(ip: string): Promise<number> {
  try {
    const count = await upstashRedis.get<number>(`nexmart:login:failed:${ip}`);
    return count || 0;
  } catch (err) {
    logger.error('Redis unavailable in getFailedLoginAttempts (fail-open):', err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function incrementFailedLoginAttempts(ip: string): Promise<number> {
  try {
    // Count and expiry change atomically, so simultaneous failures cannot
    // overwrite each other. The IP middleware also limits attempts during
    // cache outages using a bounded in-process fallback.
    return await upstashRedis.eval<[], number>(
      "local n = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 900); return n",
      [`nexmart:login:failed:${ip}`], [],
    );
  } catch (err) {
    logger.error('Redis unavailable in incrementFailedLoginAttempts (fail-open):', err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function clearFailedLoginAttempts(ip: string): Promise<void> {
  try {
    await upstashRedis.del(`nexmart:login:failed:${ip}`);
  } catch (err) {
    logger.error('Redis unavailable in clearFailedLoginAttempts (fail-open):', err instanceof Error ? err.message : err);
  }
}

// ── JWT Blacklist helpers (revoke tokens on logout) ───────────
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!jti || jti.length > 128 || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
  await RevokedSession.updateOne({ jti }, { $max: { expiresAt: new Date(Date.now() + ttlSeconds * 1000) } }, { upsert: true });
  try { await upstashRedis.set(`nexmart:jwt:blacklist:${jti}`, '1', { ex: Math.ceil(ttlSeconds) }); }
  catch { logger.warn('Session revoked in MongoDB; Redis revocation cache is unavailable.'); }
}

export async function isTokenBlacklisted(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  try {
    const val = await upstashRedis.get(`nexmart:jwt:blacklist:${jti}`);
    if (val !== null) return true;
  } catch { /* MongoDB is authoritative, including revocations written during an outage. */ }
  return Boolean(await RevokedSession.exists({ jti, expiresAt: { $gt: new Date() } }));
}
