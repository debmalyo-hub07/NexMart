import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';

export function generateToken(payload: any, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export const protectAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_ADMIN) as any;
    const admin = await Admin.findById(decoded.id);
    if (!admin) return sendUnauthorized(res, 'Admin not found');
    
    (req as any).user = { id: admin.id, role: admin.role, ...decoded };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired admin token');
  }
};

export const protectCustomer = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_CUSTOMER) as any;
    const customer = await Customer.findById(decoded.id);
    if (!customer) return sendUnauthorized(res, 'Customer not found');
    
    (req as any).user = { id: customer.id, role: customer.role, ...decoded };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired customer token');
  }
};

export const protectAgent = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_AGENT) as any;
    const agent = await DeliveryAgent.findById(decoded.id);
    if (!agent) return sendUnauthorized(res, 'Agent not found');
    if (agent.status !== 'approved') {
        return sendForbidden(res, 'Your account is pending admin approval.');
    }
    
    (req as any).user = { id: agent.id, role: agent.role, ...decoded };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired agent token');
  }
};
