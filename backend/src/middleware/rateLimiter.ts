import { Request, Response, NextFunction } from 'express';
import { authRateLimiter, paymentRateLimiter, otpRateLimiter, generalRateLimiter, registrationRateLimiter } from '../config/redis';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

function getIdentifier(req: Request): string {
  return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
}

/**
 * All limiters fail OPEN on Redis errors: rate limiting is a protection, not a
 * functional requirement — an unreachable Redis must never take the whole API
 * down (it did: the global generalLimit 500'd every request while Upstash DNS
 * was dead). Degradation is logged loudly so it is visible in ops.
 */
function limiterDown(where: string, err: unknown): void {
  logger.error(`Rate limiter unavailable (fail-open) in ${where}:`, err instanceof Error ? err.message : err);
}

export async function generalLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { success, remaining, reset } = await generalRateLimiter.limit(getIdentifier(req));
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);
    if (!success) {
      sendError(res, 'Too many requests. Please try again later.', 429, 'RATE_LIMITED');
      return;
    }
  } catch (err) {
    limiterDown('generalLimit', err);
  }
  next();
}

export async function authLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { success } = await authRateLimiter.limit(getIdentifier(req));
    if (!success) {
      sendError(res, 'Too many auth attempts. Please wait 1 minute.', 429, 'RATE_LIMITED');
      return;
    }
  } catch (err) {
    limiterDown('authLimit', err);
  }
  next();
}

export async function registerLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { success } = await registrationRateLimiter.limit(getIdentifier(req));
    if (!success) {
      sendError(res, 'Too many registration attempts. Please try again after some time.', 429, 'RATE_LIMITED');
      return;
    }
  } catch (err) {
    limiterDown('registerLimit', err);
  }
  next();
}

export async function paymentLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { success } = await paymentRateLimiter.limit(getIdentifier(req));
    if (!success) {
      sendError(res, 'Too many payment requests. Please wait.', 429, 'RATE_LIMITED');
      return;
    }
  } catch (err) {
    limiterDown('paymentLimit', err);
  }
  next();
}

export async function otpLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { success } = await otpRateLimiter.limit(getIdentifier(req));
    if (!success) {
      sendError(res, 'Too many OTP requests. Please wait.', 429, 'RATE_LIMITED');
      return;
    }
  } catch (err) {
    limiterDown('otpLimit', err);
  }
  next();
}
