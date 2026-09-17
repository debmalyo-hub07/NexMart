import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { Seller } from '../models/Seller';
import { Customer } from '../models/Customer';
import { Admin } from '../models/Admin';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { sendEmail, buildOtpEmail } from '../services/email.service';
import {
  clearFailedLoginAttempts,
  getFailedLoginAttempts,
  incrementFailedLoginAttempts,
  otpEmailRateLimiter,
} from '../config/redis';
import { sendEligibilityPending } from './roleAuth.controller';

const PASSWORD = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number');

export const sellerRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: PASSWORD,
  confirmPassword: z.string().min(1),
  legalBusinessName: z.string().trim().min(2).max(160),
  storefrontName: z.string().trim().min(2).max(120),
  businessType: z.enum(['individual', 'proprietorship', 'partnership', 'llp', 'private_limited', 'other']),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});

export const sellerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const verificationCodeTtlMs = 10 * 60 * 1000;
const verificationCodeMaxAttempts = 5;

function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function codesMatch(presented: string, stored: string): boolean {
  const left = Buffer.from(hashVerificationCode(presented), 'utf8');
  const right = Buffer.from(stored, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sellerCookie(res: Response, token: string): void {
  res.cookie('nexmart_seller_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function publicSeller(seller: InstanceType<typeof Seller>): Record<string, unknown> {
  return {
    id: seller._id,
    name: seller.name,
    email: seller.email,
    role: 'seller',
    phone: seller.phone,
    emailVerified: seller.emailVerified,
    phoneVerified: seller.phoneVerified,
    isActive: seller.isActive,
    lifecycleStatus: seller.lifecycleStatus,
    legalBusinessName: seller.legalBusinessName,
    storefrontName: seller.storefrontName,
    businessType: seller.businessType,
    kycState: seller.kycState,
    complianceState: seller.complianceState,
    payout: seller.payout ? {
      bankAccountLast4: seller.payout.bankAccountLast4,
      ifscLast4: seller.payout.ifscLast4,
      verificationState: seller.payout.verificationState,
    } : undefined,
    performance: seller.performance,
    rejectionReason: seller.rejectionReason,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
  };
}

/**
 * Seller registration is intentionally opaque. A caller can learn that an
 * email is registered only by controlling that inbox and receiving a code.
 */
export async function registerSeller(req: Request, res: Response): Promise<void> {
  const input = sellerRegistrationSchema.parse(req.body);
  const emailLimit = await otpEmailRateLimiter.limit(input.email);
  if (!emailLimit.success) {
    sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.');
    return;
  }

  // Pay the password hashing cost on every valid request, including duplicates.
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [customer, admin, agent, existing] = await Promise.all([
    Customer.findOne({ email: input.email }).select('_id').lean(),
    Admin.findOne({ email: input.email }).select('_id').lean(),
    DeliveryAgent.findOne({ email: input.email }).select('_id').lean(),
    Seller.findOne({ email: input.email }).select('+verificationCodeHash +verificationCodeExpiry'),
  ]);

  if (customer || admin || agent || existing) {
    // A pending seller can safely receive a replacement code. All other role
    // collisions get the same response and no mutation.
    if (existing && !existing.emailVerified && existing.isActive) {
      const code = generateVerificationCode();
      existing.verificationCodeHash = hashVerificationCode(code);
      existing.verificationCodeExpiry = new Date(Date.now() + verificationCodeTtlMs);
      existing.verificationCodeAttempts = 0;
      await existing.save();
      try {
        await sendEmail({ to: input.email, subject: 'NexMart Seller - verify your email', html: buildOtpEmail(existing.name, code, 'resend') });
      } catch { /* Keep the account resumable; the next request can retry delivery. */ }
    }
    sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.', { email: input.email });
    return;
  }

  const code = generateVerificationCode();
  const seller = await Seller.create({
    name: input.name,
    email: input.email,
    password: passwordHash,
    phone: input.phone,
    legalBusinessName: input.legalBusinessName,
    storefrontName: input.storefrontName,
    businessType: input.businessType,
    role: 'seller',
    emailVerified: false,
    isActive: true,
    lifecycleStatus: 'draft',
    verificationCodeHash: hashVerificationCode(code),
    verificationCodeExpiry: new Date(Date.now() + verificationCodeTtlMs),
    verificationCodeAttempts: 0,
  });

  try {
    await sendEmail({ to: seller.email, subject: 'NexMart Seller - verify your email', html: buildOtpEmail(seller.name, code, 'verify') });
  } catch {
    // Do not delete the account on a transient email failure. The owner can
    // request another code without recreating the business identity.
  }

  sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.', { email: seller.email });
}

export async function verifySellerEmail(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Unable to verify that code. Please request a new one.', data: null });
    return;
  }
  const seller = await Seller.findOne({ email: parsed.data.email }).select('+verificationCodeHash +verificationCodeExpiry +verificationCodeAttempts');
  const fail = (): void => { res.status(400).json({ success: false, message: 'Unable to verify that code. Please request a new one.', data: null }); };
  if (!seller || seller.emailVerified || !seller.verificationCodeHash || !seller.verificationCodeExpiry) { fail(); return; }
  if (seller.verificationCodeExpiry.getTime() < Date.now() || seller.verificationCodeAttempts >= verificationCodeMaxAttempts) { fail(); return; }
  if (!codesMatch(parsed.data.otp, seller.verificationCodeHash)) {
    await Seller.updateOne({ _id: seller._id, verificationCodeAttempts: { $lt: verificationCodeMaxAttempts } }, { $inc: { verificationCodeAttempts: 1 } });
    fail();
    return;
  }
  await Seller.updateOne({ _id: seller._id }, {
    $set: { emailVerified: true },
    $unset: { verificationCodeHash: 1, verificationCodeExpiry: 1, verificationCodeAttempts: 1 },
  });
  res.json({ success: true, message: 'Seller email verified. Complete your store setup to apply.', data: null });
}

export async function resendSellerVerification(req: Request, res: Response): Promise<void> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
  if (!parsed.success) {
    sendEligibilityPending(res, 'If the address is eligible, a new code will be sent.');
    return;
  }
  const emailLimit = await otpEmailRateLimiter.limit(parsed.data.email);
  if (!emailLimit.success) { sendEligibilityPending(res, 'If the address is eligible, a new code will be sent.'); return; }
  const seller = await Seller.findOne({ email: parsed.data.email }).select('+verificationCodeHash +verificationCodeExpiry');
  if (seller && !seller.emailVerified && seller.isActive) {
    const code = generateVerificationCode();
    seller.verificationCodeHash = hashVerificationCode(code);
    seller.verificationCodeExpiry = new Date(Date.now() + verificationCodeTtlMs);
    seller.verificationCodeAttempts = 0;
    await seller.save();
    try { await sendEmail({ to: seller.email, subject: 'NexMart Seller - new verification code', html: buildOtpEmail(seller.name, code, 'resend') }); } catch { /* opaque response */ }
  }
  sendEligibilityPending(res, 'If the address is eligible, a new code will be sent.');
}

export async function loginSeller(req: Request, res: Response): Promise<void> {
  const input = sellerLoginSchema.parse(req.body);
  const ip = req.ip || String(req.headers['x-forwarded-for'] || 'unknown');
  if (await getFailedLoginAttempts(ip) >= 5) {
    res.status(429).json({ success: false, message: 'Too many failed login attempts. Please try again after 15 minutes.', data: null });
    return;
  }

  const [customer, admin, agent, seller] = await Promise.all([
    Customer.findOne({ email: input.email }).select('_id').lean(),
    Admin.findOne({ email: input.email }).select('_id').lean(),
    DeliveryAgent.findOne({ email: input.email }).select('_id').lean(),
    Seller.findOne({ email: input.email }).select('+password'),
  ]);
  if (customer || admin || agent || !seller || !seller.password) {
    await incrementFailedLoginAttempts(ip);
    res.status(401).json({ success: false, message: 'Invalid seller credentials.', data: null });
    return;
  }
  if (!await bcrypt.compare(input.password, seller.password)) {
    await incrementFailedLoginAttempts(ip);
    res.status(401).json({ success: false, message: 'Invalid seller credentials.', data: null });
    return;
  }
  if (!seller.emailVerified) {
    res.status(403).json({ success: false, message: 'Verify your seller email before signing in.', data: { requiresOtp: true, email: seller.email } });
    return;
  }
  if (!seller.isActive || ['suspended', 'blocked', 'closed'].includes(seller.lifecycleStatus)) {
    res.status(403).json({ success: false, message: 'This seller account is not active. Contact NexMart support.', data: { lifecycleStatus: seller.lifecycleStatus } });
    return;
  }
  await clearFailedLoginAttempts(ip);
  const token = generateToken({ id: seller._id, role: 'seller' }, env.JWT_SECRET_SELLER, env.JWT_EXPIRES_IN);
  sellerCookie(res, token);
  res.json({ success: true, message: 'Seller sign-in successful', data: { token, user: publicSeller(seller) } });
}
