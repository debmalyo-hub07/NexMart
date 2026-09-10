import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public isOperational = true,
    public code = 'INTERNAL_ERROR',
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 'Resource not found', 404, 'NOT_FOUND');
}

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const request = req as Request & { requestId?: string };
  logger.error('request.failed', {
    requestId: request.requestId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    route: req.path,
  });

  // Malformed request body (body-parser SyntaxError) — 400 with a clean
  // message, not a 500 that leaks the parser's internals (B7)
  if (err.name === 'SyntaxError' && (err as { type?: string }).type === 'entity.parse.failed') {
    sendError(res, 'Invalid JSON in request body.', 400, 'INVALID_JSON');
    return;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(err.flatten().fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1])),
    );
    sendError(res, 'Validation error', 422, 'VALIDATION_ERROR', fieldErrors);
    return;
  }

  // Mongoose duplicate key
  if ((err as { code?: number }).code === 11000) {
    const field = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue || {})[0];
    sendError(res, `${field || 'Resource'} already exists`, 409, 'DUPLICATE_RESOURCE');
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    sendError(res, 'Validation error', 422, 'VALIDATION_ERROR');
    return;
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    sendError(res, 'Invalid resource ID', 400, 'INVALID_ID');
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401, 'INVALID_TOKEN');
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    return;
  }

  // Known operational error
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // Unknown error — don't leak details in production
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500, 'INTERNAL_ERROR');
}
