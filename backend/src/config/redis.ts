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

// ── Upstash Redis (REST over HTTPS — always works) ────────────
// signal: every call is bounded at 2.5s — a dead/unresolvable Upstash host
//   must fail fast, not hang each request for the DNS timeout.
//   MUST be a function: with a plain AbortSignal the client swallows the
//   abort into a fake 200 ({result:"Aborted"}) which reads as a truthy
//   cache/blacklist hit; as a function it throws, so callers can fail open.
// retry: disabled — 5 retries with exponential backoff on a dead host would
//   multiply the hang on every request. Callers degrade instead.
export const upstashRedis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  signal: () => AbortSignal.timeout(2500),
  retry: false,
});

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
    const count = await getFailedLoginAttempts(ip);
    const newCount = count + 1;
    await upstashRedis.set(`nexmart:login:failed:${ip}`, newCount, { ex: 900 }); // 15 minutes (900s)
    return newCount;
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
  if (!jti || ttlSeconds <= 0) return;
  await upstashRedis.set(`nexmart:jwt:blacklist:${jti}`, '1', { ex: ttlSeconds });
}

export async function isTokenBlacklisted(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  try {
    const val = await upstashRedis.get(`nexmart:jwt:blacklist:${jti}`);
    return val !== null;
  } catch (err) {
    // Fail OPEN: treat as not-blacklisted so an unreachable Redis cannot
    // 401 every authenticated request. Revocation resumes when Redis returns.
    logger.error('Redis unavailable in isTokenBlacklisted (fail-open):', err instanceof Error ? err.message : err);
    return false;
  }
}
