import jwt, { type JwtPayload } from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../config/env';
import { isTokenBlacklisted } from '../config/redis';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { Seller } from '../models/Seller';

export type SessionRole = 'admin' | 'customer' | 'agent' | 'seller';
export interface SessionIdentity extends JwtPayload {
  id: string;
  userId: string;
  role: SessionRole;
  exp: number;
  iatMs?: number;
  sellerLifecycleStatus?: string;
}
export class SessionError extends Error {
  constructor(message = 'Invalid or expired session. Please sign in again.', readonly status = 401) { super(message); }
}

const secrets: Record<SessionRole, string> = {
  admin: env.JWT_SECRET_ADMIN, customer: env.JWT_SECRET_CUSTOMER,
  agent: env.JWT_SECRET_AGENT, seller: env.JWT_SECRET_SELLER,
};

/** Decode only to choose a key; identity is trusted only after verification. */
export function verifySessionClaims(token: string, expectedRole?: SessionRole): SessionIdentity {
  try {
    if (token.length > 8192) throw new SessionError();
    const untrusted = jwt.decode(token);
    if (!untrusted || typeof untrusted === 'string' || !Object.hasOwn(secrets, untrusted.role)) throw new SessionError();
    const role = untrusted.role as SessionRole;
    if (expectedRole && role !== expectedRole) throw new SessionError();
    const claims = jwt.verify(token, secrets[role], { algorithms: ['HS256'] });
    if (typeof claims === 'string' || claims.role !== role || !isValidObjectId(claims.id) || !Number.isFinite(claims.exp)) throw new SessionError();
    return { ...claims, id: String(claims.id), userId: String(claims.id), role, exp: claims.exp! };
  } catch { throw new SessionError(); }
}

function checkCredentialChange(identity: SessionIdentity, changedAt?: Date): void {
  if (!changedAt) return;
  const mintedAt = typeof identity.iatMs === 'number' ? identity.iatMs : typeof identity.iat === 'number' ? identity.iat * 1000 : undefined;
  if (mintedAt === undefined || mintedAt < changedAt.getTime()) throw new SessionError();
}

/** The same identity checks protect HTTP, optional carts, and realtime rooms. */
export async function resolveSessionIdentity(token: string, expectedRole?: SessionRole): Promise<SessionIdentity> {
  const identity = verifySessionClaims(token, expectedRole);
  if (await isTokenBlacklisted(identity.jti)) throw new SessionError();
  if (identity.role === 'admin') {
    if (!await Admin.exists({ _id: identity.id })) throw new SessionError();
  } else if (identity.role === 'customer') {
    const customer = await Customer.findById(identity.id).select('isActive emailVerified credentialsChangedAt');
    if (!customer) throw new SessionError();
    if (!customer.isActive) throw new SessionError('Your account has been suspended. Please contact support.', 403);
    if (!customer.emailVerified) throw new SessionError('Verify your email before signing in.', 403);
    checkCredentialChange(identity, customer.credentialsChangedAt);
  } else if (identity.role === 'agent') {
    const agent = await DeliveryAgent.findById(identity.id).select('status isApproved');
    if (!agent) throw new SessionError();
    if (agent.status !== 'approved' || !agent.isApproved) throw new SessionError('Your account is pending admin approval.', 403);
  } else {
    const seller = await Seller.findById(identity.id).select('isActive lifecycleStatus credentialsChangedAt');
    if (!seller) throw new SessionError();
    if (!seller.isActive || ['suspended', 'blocked', 'closed'].includes(seller.lifecycleStatus)) throw new SessionError('This seller account is not active. Contact NexMart support.', 403);
    checkCredentialChange(identity, seller.credentialsChangedAt);
    identity.sellerLifecycleStatus = seller.lifecycleStatus;
  }
  return identity;
}
