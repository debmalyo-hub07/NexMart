import { Request, Response, NextFunction } from 'express';
import { authRateLimiter, paymentRateLimiter, otpRateLimiter, generalRateLimiter, registrationRateLimiter } from '../config/redis';
import { sendError } from '../utils/response';

function getIdentifier(req: Request): string {
  return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
}

export async function generalLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { success, remaining, reset } = await generalRateLimiter.limit(getIdentifier(req));
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);
  if (!success) {
    sendError(res, 'Too many requests. Please try again later.', 429);
    return;
  }
  next();
}

export async function authLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { success } = await authRateLimiter.limit(getIdentifier(req));
  if (!success) {
    sendError(res, 'Too many auth attempts. Please wait 1 minute.', 429);
    return;
  }
  next();
}

export async function registerLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { success } = await registrationRateLimiter.limit(getIdentifier(req));
  if (!success) {
    sendError(res, 'Too many registration attempts. Please wait 1 hour.', 429);
    return;
  }
  next();
}

export async function paymentLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { success } = await paymentRateLimiter.limit(getIdentifier(req));
  if (!success) {
    sendError(res, 'Too many payment requests. Please wait.', 429);
    return;
  }
  next();
}

export async function otpLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { success } = await otpRateLimiter.limit(getIdentifier(req));
  if (!success) {
    sendError(res, 'Too many OTP requests. Please wait.', 429);
    return;
  }
  next();
}
