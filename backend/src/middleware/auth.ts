import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { isTokenBlacklisted } from '../config/redis';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { Seller } from '../models/Seller';

export function generateToken(payload: any, secret: string, expiresIn: string): string {
  // Every token carries a unique jti so it can be revoked (blacklisted) on logout.
  // Node's built-in randomUUID replaces the uuid package (CVE in <11.1.1).
  //
  // iatMs is millisecond-precision mint time. The standard `iat` claim is whole
  // seconds, which cannot be ordered against a sub-second event: a password
  // reset and the login that follows it land in the same second, and a
  // second-resolution comparison either keeps the session it was meant to kill
  // or kills the one it just issued. iatMs removes the ambiguity.
  return jwt.sign({ ...payload, jti: randomUUID(), iatMs: Date.now() }, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
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

    // A password reset or an explicit "sign out everywhere" stamps
    // credentialsChangedAt. Every token minted before that instant dies here —
    // without this, an attacker holding a live session keeps it through the
    // victim's reset, which would make the reset security-theatre.
    //
    // iatMs (see generateToken) is used rather than the standard `iat` because
    // a reset and the login that follows it occur within the same second, and
    // whole-second precision cannot order them. Tokens minted before this
    // claim existed fall back to `iat`, which is correct for them: they are
    // necessarily older than any subsequent credential change.
    if (customer.credentialsChangedAt) {
      const changedAtMs = customer.credentialsChangedAt.getTime();
      const mintedAtMs = typeof decoded.iatMs === 'number'
        ? decoded.iatMs
        : typeof decoded.iat === 'number' ? decoded.iat * 1000 : undefined;
      if (mintedAtMs !== undefined && mintedAtMs < changedAtMs) {
        return sendUnauthorized(res, 'Session expired. Please login again.');
      }
    }

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

/**
 * Authenticates a seller account but deliberately does not imply marketplace
 * activation. Draft and under-review sellers need access to onboarding; write
 * operations that publish inventory must add requireActiveSeller.
 */
export const protectSeller = async (req: Request, res: Response, next: NextFunction) => {
  let token = getCookieToken(req, 'nexmart_seller_session');

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
  }
  if (!token) return sendUnauthorized(res, 'No token provided');

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_SELLER) as any;
    if (await isTokenBlacklisted(decoded.jti)) return sendUnauthorized(res, 'Session expired. Please login again.');
    const seller = await Seller.findById(decoded.id);
    if (!seller) return sendUnauthorized(res, 'Seller account not found');
    if (!seller.isActive || ['suspended', 'blocked', 'closed'].includes(seller.lifecycleStatus)) {
      return sendForbidden(res, 'This seller account is not active. Contact NexMart support.');
    }
    if (seller.credentialsChangedAt) {
      const mintedAtMs = typeof decoded.iatMs === 'number'
        ? decoded.iatMs
        : typeof decoded.iat === 'number' ? decoded.iat * 1000 : undefined;
      if (mintedAtMs !== undefined && mintedAtMs < seller.credentialsChangedAt.getTime()) {
        return sendUnauthorized(res, 'Session expired. Please login again.');
      }
    }
    (req as any).user = {
      ...decoded,
      id: seller.id,
      userId: seller.id,
      role: 'seller',
      sellerLifecycleStatus: seller.lifecycleStatus,
    };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired seller token');
  }
};

/** Requires a seller to have passed admin approval and be active. */
export const requireActiveSeller = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.userId;
  if (!userId) return sendUnauthorized(res, 'No seller session');
  const seller = await Seller.findById(userId).select('isActive lifecycleStatus');
  if (!seller || !seller.isActive || seller.lifecycleStatus !== 'active') {
    return sendForbidden(res, 'Seller approval is required before this operation.');
  }
  next();
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
