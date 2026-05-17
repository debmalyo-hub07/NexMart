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

// ── Upstash Redis (REST over HTTPS — always works) ────────────
export const upstashRedis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
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
