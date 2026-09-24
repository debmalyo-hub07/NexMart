import type { Request, Response, NextFunction } from 'express';
import { authRateLimiter, paymentRateLimiter, otpRateLimiter, generalRateLimiter, registrationRateLimiter } from '../config/redis';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { LocalRateLimit } from '../utils/localRateLimit';
import { env } from '../config/env';

type Limiter = { limit: (identifier: string) => Promise<{ success: boolean; remaining?: number; reset?: number }> };
const fallback = new LocalRateLimit();
let nextOutageLog = 0;

function createLimit(limiter: Limiter, scope: string, maximum: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.ip || req.socket?.remoteAddress || 'unknown';
    let result;
    try { result = await limiter.limit(identifier); }
    catch {
      result = fallback.consume(`${scope}:${identifier}`, maximum, windowMs);
      if (Date.now() >= nextOutageLog) {
        logger.error('Shared rate limiter unavailable. Bounded per-process protection is active.');
        nextOutageLog = Date.now() + 60000;
      }
    }
    if (result.remaining !== undefined) res.setHeader('X-RateLimit-Remaining', result.remaining);
    if (result.reset !== undefined) res.setHeader('X-RateLimit-Reset', result.reset);
    if (!result.success) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(((result.reset || Date.now() + windowMs) - Date.now()) / 1000)));
      sendError(res, 'Too many requests. Please wait before trying again.', 429, 'RATE_LIMITED');
      return;
    }
    next();
  };
}

export const generalLimit = createLimit(generalRateLimiter, 'general', Number(env.RATE_LIMIT_MAX_REQUESTS), Number(env.RATE_LIMIT_WINDOW_MS));
export const authLimit = createLimit(authRateLimiter, 'auth', 10, 60000);
export const registerLimit = createLimit(registrationRateLimiter, 'register', 3, 3600000);
export const paymentLimit = createLimit(paymentRateLimiter, 'payment', Number(env.PAYMENT_RATE_LIMIT_MAX), 60000);
export const otpLimit = createLimit(otpRateLimiter, 'otp', 3, 60000);
