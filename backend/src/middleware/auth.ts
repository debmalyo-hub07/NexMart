import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { isTokenBlacklisted } from '../config/redis';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';

export function generateToken(payload: any, secret: string, expiresIn: string): string {
  // Every token carries a unique jti so it can be revoked (blacklisted) on logout.
  // Node's built-in randomUUID replaces the uuid package (CVE in <11.1.1).
  return jwt.sign({ ...payload, jti: randomUUID() }, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

const getCookieToken = (req: Request, cookieName: string): string | null => {
  if (req.headers.cookie) {
    const rawCookies = req.headers.cookie.split('; ');
    for (const c of rawCookies) {
      const [name, val] = c.split('=');
      if (name === cookieName) return val;
    }
  }
  return null;
};

export const protectAdmin = async (req: Request, res: Response, next: NextFunction) => {
  let token = getCookieToken(req, 'nexmart_admin_session');

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return sendUnauthorized(res, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_ADMIN) as any;
    if (await isTokenBlacklisted(decoded.jti)) return sendUnauthorized(res, 'Session expired. Please login again.');
    const admin = await Admin.findById(decoded.id);
    if (!admin) return sendUnauthorized(res, 'Admin not found');

    (req as any).user = { id: admin.id, role: admin.role, ...decoded, userId: admin.id };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired admin token');
  }
};

export const protectCustomer = async (req: Request, res: Response, next: NextFunction) => {
  let token = getCookieToken(req, 'nexmart_customer_session');

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return sendUnauthorized(res, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_CUSTOMER) as any;
    if (await isTokenBlacklisted(decoded.jti)) return sendUnauthorized(res, 'Session expired. Please login again.');
    const customer = await Customer.findById(decoded.id);
    if (!customer) return sendUnauthorized(res, 'Customer not found');
    // B3: suspension must kill existing sessions too, not just block login —
    // tokens live 7 days, so the check has to happen per request.
    if (!customer.isActive) return sendForbidden(res, 'Your account has been suspended. Please contact support.');

    (req as any).user = { id: customer.id, role: customer.role, ...decoded, userId: customer.id };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired customer token');
  }
};

export const protectAgent = async (req: Request, res: Response, next: NextFunction) => {
  let token = getCookieToken(req, 'nexmart_delivery_session');

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return sendUnauthorized(res, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_AGENT) as any;
    if (await isTokenBlacklisted(decoded.jti)) return sendUnauthorized(res, 'Session expired. Please login again.');
    const agent = await DeliveryAgent.findById(decoded.id);
    if (!agent) return sendUnauthorized(res, 'Agent not found');
    if (agent.status !== 'approved' || !agent.isApproved) {
        return sendForbidden(res, 'Your account is pending admin approval.');
    }
    
    (req as any).user = { id: agent.id, role: agent.role, ...decoded, userId: agent.id };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired agent token');
  }
};

// Attaches req.user when a valid customer token is present; never rejects.
// Used by the cart routes so a logged-in user's cart binds to their account
// while guests keep working via x-session-id.
export const optionalCustomerAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token = getCookieToken(req, 'nexmart_customer_session');
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_CUSTOMER) as any;
    if (await isTokenBlacklisted(decoded.jti)) return next(); // fall back to guest
    const customer = await Customer.findById(decoded.id);
    // B3: suspended customers lose their account cart binding too — they fall
    // back to guest like any unauthenticated visitor (this middleware never rejects).
    if (customer?.isActive) {
      (req as any).user = { id: customer.id, role: customer.role, ...decoded, userId: customer.id };
    }
  } catch {
    // Invalid/expired token → treat as guest, don't block the cart
  }
  next();
};
