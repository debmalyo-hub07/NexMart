import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

export function getRequestId(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string' && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  return randomUUID();
}

/** Adds correlation metadata and one structured completion log per request. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const request = req as Request & { requestId?: string };
  const requestId = getRequestId(req.header('x-request-id'));
  const startedAt = process.hrtime.bigint();
  request.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('close', () => {
    // 'close' fires for both completed and aborted requests; 'finish' misses
    // the mobile-network case where the socket drops mid-request — exactly
    // the failures this correlation log exists to capture.
    const aborted = !res.writableFinished;
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const user = (request as AuthenticatedRequest).user;
    logger.info('http.request', {
      requestId,
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      latencyMs: Math.round(elapsedMs * 100) / 100,
      role: user?.role || 'anonymous',
      userId: user?.userId,
      ...(aborted ? { aborted: true } : {}),
    });
  });

  next();
}
