import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendCreated(res: Response, data: unknown, message = 'Created successfully') {
  return res.status(201).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  message = 'Something went wrong',
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  errors?: Record<string, string[]>,
) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors ? { errors } : {}),
    ...(res.locals?.requestId ? { requestId: res.locals.requestId } : {}),
  });
}

export function sendNotFound(res: Response, message = 'Resource not found') {
  return res.status(404).json({ success: false, message, code: 'NOT_FOUND', ...(res.locals?.requestId ? { requestId: res.locals.requestId } : {}) });
}

export function sendBadRequest(res: Response, message = 'Bad request') {
  return res.status(400).json({ success: false, message, code: 'BAD_REQUEST', ...(res.locals?.requestId ? { requestId: res.locals.requestId } : {}) });
}

export function sendUnauthorized(res: Response, message = 'Unauthorized') {
  return res.status(401).json({ success: false, message, code: 'UNAUTHENTICATED', ...(res.locals?.requestId ? { requestId: res.locals.requestId } : {}) });
}

export function sendForbidden(res: Response, message = 'Forbidden') {
  return res.status(403).json({ success: false, message, code: 'FORBIDDEN', ...(res.locals?.requestId ? { requestId: res.locals.requestId } : {}) });
}

export function sendPaginated(
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
) {
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: { page, limit, total, totalPages },
  });
}
