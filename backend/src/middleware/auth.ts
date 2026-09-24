import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { Seller } from '../models/Seller';
import type { AuthenticatedRequest } from '../types';
import { resolveSessionIdentity, SessionError, type SessionRole } from '../services/sessionIdentity.service';

export function generateToken(payload: Record<string, unknown>, secret: string, expiresIn: string): string {
  return jwt.sign({ ...payload, jti: randomUUID(), iatMs: Date.now() }, secret, { algorithm: 'HS256', expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export const sessionCookies: Record<SessionRole, string> = {
  admin: 'nexmart_admin_session', customer: 'nexmart_customer_session',
  agent: 'nexmart_delivery_session', seller: 'nexmart_seller_session',
};

export function readSessionCookie(req: Request, name: string): string | undefined {
  return req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function requestToken(req: Request, role: SessionRole): string | undefined {
  // An explicitly supplied, freshly rotated token wins over an older cookie.
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  return bearer || readSessionCookie(req, sessionCookies[role]);
}

function protect(role: SessionRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = requestToken(req, role);
    if (!token) { sendUnauthorized(res, 'No token provided'); return; }
    try {
      (req as AuthenticatedRequest).user = await resolveSessionIdentity(token, role);
      next();
    } catch (error) {
      if (error instanceof SessionError) {
        if (error.status === 403) sendForbidden(res, error.message);
        else sendUnauthorized(res, error.message);
      } else next(error); // A database outage is not an invalid identity.
    }
  };
}

export const protectAdmin = protect('admin');
export const protectCustomer = protect('customer');
export const protectAgent = protect('agent');
export const protectSeller = protect('seller');

export async function requireActiveSeller(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) { sendUnauthorized(res, 'No seller session'); return; }
  const seller = await Seller.findById(userId).select('isActive lifecycleStatus');
  if (!seller || !seller.isActive || seller.lifecycleStatus !== 'active') {
    sendForbidden(res, 'Seller approval is required before this operation.'); return;
  }
  next();
}

export async function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = requestToken(req, 'customer');
  if (token) {
    try { (req as AuthenticatedRequest).user = await resolveSessionIdentity(token, 'customer'); }
    catch (error) { if (!(error instanceof SessionError)) { next(error); return; } }
  }
  next();
}
