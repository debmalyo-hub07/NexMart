import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { Seller } from '../models/Seller';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { sendEmail, buildOtpEmail, buildResetEmail, buildGoogleOnlyResetEmail } from '../services/email.service';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../utils/resetCode';
import { forgotPasswordSchema, resetPasswordSchema, passwordSchema } from '../utils/validation';
import {
  getFailedLoginAttempts,
  incrementFailedLoginAttempts,
  clearFailedLoginAttempts,
  otpEmailRateLimiter
} from '../config/redis';

// ─── OTP helpers ───────────────────────────────────────────────────────────────

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Anti-enumeration responses (audit §9). Registration, verification, and OTP
 * resend must not reveal whether an email belongs to an account, so every
 * "no such account / already exists / already verified" branch answers with
 * the same opaque 202. One shape, three handlers — never hand-patch a copy.
 */
export function sendEligibilityPending(res: Response, message: string, data?: Record<string, unknown>): void {
  res.status(202).json({
    success: true,
    message,
    ...(data ? { data } : { data: null }),
  });
}

// ─── ADMIN AUTH ────────────────────────────────────────────────────────────────

export const registerAdmin = async (req: Request, res: Response) => {
  const { name, email, password, secretKey } = req.body;

  // Phase 3: Admin Secret Key — server-side only validation. Compared in
  // constant time, and registration stays CLOSED when no key is configured
  // (audit §C7: raw !== let a timing oracle nibble the secret).
  const provided = Buffer.from(typeof secretKey === 'string' ? secretKey : '');
  const expected = Buffer.from(env.ADMIN_SECRET_KEY || '');
  if (!expected.length || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing admin secret key. Registration denied.',
      data: null,
    });
  }

  // Credentials policy applies to admins too (audit §B3).
  if (!name || typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter a name and a valid email address', data: null });
  }
  const passwordPolicy = passwordSchema.safeParse(password);
  if (!passwordPolicy.success) {
    return res.status(400).json({ success: false, message: passwordPolicy.error.issues[0].message, data: null });
  }

  const existing = await Admin.findOne({ email });
  const sellerExists = await Seller.findOne({ email }).select('_id').lean();
  if (existing || sellerExists) {
    return res.status(400).json({ success: false, message: 'Admin already exists', data: null });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await Admin.create({ name, email, password: hashedPassword });

  res.status(201).json({
    success: true,
    message: 'Admin registered successfully',
    data: { id: admin._id },
  });
};

export const loginAdmin = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

  // 1. Rate limiting on failed attempts
  const failedAttempts = await getFailedLoginAttempts(ip);
  if (failedAttempts >= 5) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Please try again after 15 minutes.',
      data: null,
    });
  }

  // 2. Cross-role isolation: Deny customers
  const isCustomer = await Customer.findOne({ email });
  if (isCustomer) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. This portal is for authorized personnel only.',
      data: null,
    });
  }

  const isAgent = await DeliveryAgent.findOne({ email });
  if (isAgent) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. This portal is for authorized personnel only.',
      data: null,
    });
  }

  const isSeller = await Seller.findOne({ email });
  if (isSeller) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Use the seller portal for this account.',
      data: null,
    });
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.password) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  // Success: Clear failed attempts
  await clearFailedLoginAttempts(ip);

  const token = generateToken({ id: admin._id, role: 'admin' }, env.JWT_SECRET_ADMIN, env.JWT_EXPIRES_IN);

  // Set namespaced httpOnly cookie
  res.cookie('nexmart_admin_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    },
  });
};

// ─── CUSTOMER AUTH ─────────────────────────────────────────────────────────────

export const registerCustomer = async (req: Request, res: Response) => {
  const { name, email, password, address, city, phone, state, pincode } = req.body;

  // 1. Field validation FIRST — running it after the existence checks made
  // the 400-vs-202 divergence itself an enumeration oracle (invalid phone +
  // 400 ⇒ email was free; 202 ⇒ account exists).
  if (!name || typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Enter your name and a valid email address', data: null });
  }
  // Server-side password policy (audit §B3): previously `password || ''` hashed
  // a missing password into an empty-string credential.
  const passwordPolicy = passwordSchema.safeParse(password);
  if (!passwordPolicy.success) {
    return res.status(400).json({ success: false, message: passwordPolicy.error.issues[0].message, data: null });
  }
  if (phone && !/^[6-9]\d{9}$/.test(String(phone).trim())) {
    return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number', data: null });
  }
  if (pincode && !/^\d{6}$/.test(String(pincode).trim())) {
    return res.status(400).json({ success: false, message: 'Enter a valid 6-digit pincode', data: null });
  }
  if (state && state.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Enter your state (minimum 2 characters)', data: null });
  }

  // 2. Timing parity: hash unconditionally so the bcrypt cost (~200ms) is
  // paid on every path — otherwise response latency alone reveals whether
  // an email already has an account. (password is policy-validated above.)
  const hashedPassword = await bcrypt.hash(password, 12);

  // 3. Cross-role + duplicate check — all answered with the same opaque 202.
  const [isAdmin, isAgent, isSeller, existing] = await Promise.all([
    Admin.findOne({ email }).select('_id').lean(),
    DeliveryAgent.findOne({ email }).select('_id').lean(),
    Seller.findOne({ email }).select('_id').lean(),
    Customer.findOne({ email }),
  ]);

  if (existing && !existing.emailVerified) {
    // The email already has a pending-verification account. The owner's most
    // likely intent is "my code expired / never arrived" — serve it honestly
    // (resend the OTP) but with the same opaque response, so an attacker
    // learns nothing while the owner still recovers.
    const emailLimit = await otpEmailRateLimiter.limit(email);
    if (!emailLimit.success) {
      sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.', { requiresOtp: false });
      return;
    }
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    // Stored SHA-256 hashed — a readable OTP on the document is one query
    // away from account takeover (audit §B2).
    await Customer.findByIdAndUpdate(existing._id, { otp: hashResetCode(otp), otpExpiry, otpAttempts: 0 });
    try {
      await sendEmail({
        to: email,
        subject: 'NexMart — Verify Your Email',
        html: buildOtpEmail(existing.name, otp, 'resend'),
      });
    } catch (emailErr: unknown) {
      console.error(`[OTP] Re-register resend failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
    }
    sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.', { requiresOtp: false });
    return;
  }

  if (isAdmin || isAgent || isSeller || existing) {
    sendEligibilityPending(res, 'If the address is eligible, we will send the next step by email.', { requiresOtp: false });
    return;
  }

  // 4. Email-level OTP rate limiting
  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests for this email. Please try again after 10 minutes.',
      data: null,
    });
    return;
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const customer = await Customer.create({
    name,
    email,
    password: hashedPassword,
    phone,
    emailVerified: false,
    isActive: true,
    authProviders: ['email'],
    otp: hashResetCode(otp),
    otpExpiry,
    otpAttempts: 0,
    addresses: address && city ? [{
      label: 'Home',
      fullName: name,
      phone: phone || '',
      addressLine1: address,
      city: city,
      state: state || '',
      pincode: pincode || '',
      isDefault: true
    }] : []
  });

  // Send OTP email — awaited so we can surface delivery errors
  try {
    await sendEmail({
      to: email,
      subject: 'NexMart — Verify Your Email',
      html: buildOtpEmail(name, otp, 'verify'),
    });
  } catch (emailErr: unknown) {
    // Email failed — delete the customer so they can retry registration cleanly
    await Customer.findByIdAndDelete(customer._id);
    console.error(`[OTP] SMTP failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
    return res.status(500).json({
      success: false,
      message: 'Account created but we could not send the verification email. Please try again or contact support.',
      data: null,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Account created! Please check your email for the verification code.',
    data: {
      requiresOtp: true,
      email,
    },
  });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required', data: null });
  }

  // Anti-enumeration: unknown email, already-verified, exhausted guesses and
  // wrong-code must all be indistinguishable — every miss returns the same 400
  // (the legitimate owner sees the same actionable copy). Codes are stored
  // SHA-256 hashed and die after RESET_CODE_MAX_ATTEMPTS wrong guesses,
  // mirroring the seller flow: only the IP-wide otpLimit guarded this 6-digit
  // space before, which a distributed guesser bypasses (audit §B2).
  const customer = await Customer.findOne({ email });
  const pending = !!customer && !customer.emailVerified && !!customer.otp;
  const matches = !!pending && customer!.otp === hashResetCode(String(otp));
  const exhausted = !!pending && (customer!.otpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS;

  if (!matches || exhausted) {
    if (pending && !exhausted) {
      const attempted = await Customer.findOneAndUpdate({ _id: customer!._id, otp: customer!.otp, otpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, { $inc: { otpAttempts: 1 } }, { new: true });
      if (attempted && (attempted.otpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) {
        // Burn the code: exactly five guesses per code, per account.
        await Customer.updateOne({ _id: customer!._id, otp: customer!.otp, otpAttempts: { $gte: RESET_CODE_MAX_ATTEMPTS } }, { $unset: { otp: 1, otpExpiry: 1, otpAttempts: 1 } });
      }
    }
    return res.status(400).json({ success: false, message: 'Unable to verify that code. Please request a new one.', data: null });
  }

  if (!customer!.otpExpiry || customer!.otpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.', data: null });
  }

  // Mark verified, clear OTP ($unset — $set with undefined is a mongoose
  // no-op, which previously left the OTP on the document forever)
  const verified = await Customer.updateOne({ _id: customer!._id, emailVerified: false, isActive: true, otp: customer!.otp, otpExpiry: { $gt: new Date() }, otpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, {
    $set: { emailVerified: true },
    $unset: { otp: 1, otpExpiry: 1, otpAttempts: 1 },
  });
  if (verified.modifiedCount !== 1) {
    return res.status(400).json({ success: false, message: 'Unable to verify that code. Please request a new one.', data: null });
  }

  res.json({
    success: true,
    message: 'Email verified successfully! You can now log in.',
    data: null,
  });
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  // Anti-enumeration: the rate limit is consumed BEFORE the lookup so even a
  // 429 cannot reveal whether the email belongs to an unverified account, and
  // every outcome answers with the same opaque 202. Only the true owner (who
  // receives the email) experiences the difference.
  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests for this email. Please try again after 10 minutes.',
      data: null,
    });
    return;
  }

  const customer = await Customer.findOne({ email });
  if (!customer || customer.emailVerified) {
    sendEligibilityPending(res, 'If the address is eligible, a new code will be sent.');
    return;
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await Customer.findByIdAndUpdate(customer._id, { otp: hashResetCode(otp), otpExpiry, otpAttempts: 0 });

  // Send OTP email
  try {
    await sendEmail({
      to: email,
      subject: 'NexMart — New Verification Code',
      html: buildOtpEmail(customer.name, otp, 'resend'),
    });
  } catch (emailErr: unknown) {
    console.error(`[OTP] Resend SMTP failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please check your email address or try again later.',
      data: null,
    });
    return;
  }

  sendEligibilityPending(res, 'If the address is eligible, a new code will be sent.');
};

export const loginCustomer = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

  // 1. Rate limiting on failed attempts
  const failedAttempts = await getFailedLoginAttempts(ip);
  if (failedAttempts >= 5) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Please try again after 15 minutes.',
      data: null,
    });
  }

  // Phase 7: Reject admin/agent credentials at customer login
  const isAdmin = await Admin.findOne({ email });
  if (isAdmin) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'This account is not a customer account. Please use the correct login portal.',
      data: null,
    });
  }

  const isAgent = await DeliveryAgent.findOne({ email });
  if (isAgent) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'This account is not a customer account. Please use the correct login portal.',
      data: null,
    });
  }

  const isSeller = await Seller.findOne({ email });
  if (isSeller) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'This account is not a customer account. Please use the seller portal.',
      data: null,
    });
  }

  const customer = await Customer.findOne({ email });
  if (!customer || !customer.password) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  // Block login if email not verified
  if (!customer.emailVerified) {
    // A correct password on an unverified account is not a failed attempt —
    // counting it locked legitimate users out of their own signup (the same
    // reasoning already applied to pending agents in P1-15).
    return res.status(403).json({
      success: false,
      message: 'Please verify your email before logging in. Check your inbox for the OTP.',
      data: { requiresOtp: true, email },
    });
  }

  // B3: a suspended account cannot log in (previously isActive was never
  // checked — suspension was cosmetic and suspended customers kept ordering)
  if (!customer.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      data: null,
    });
  }

  // Success: Clear failed attempts
  await clearFailedLoginAttempts(ip);

  const token = generateToken({ id: customer._id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, env.JWT_EXPIRES_IN);

  // Set namespaced httpOnly cookie
  res.cookie('nexmart_customer_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        role: customer.role,
        profilePicture: customer.profilePicture,
      },
    },
  });
};

// ─── AGENT AUTH ────────────────────────────────────────────────────────────────

export const registerAgent = async (req: Request, res: Response) => {
  const { name, email, password, vehicleType, vehicleModel, licensePlate, city, address, aadharNumber } = req.body;
  // This path had NO validation at all (audit §B3): a missing password was
  // hashed as-is and the identity number was stored unchecked.
  if (!name || typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Enter your name and a valid email address', data: null });
  }
  const passwordPolicy = passwordSchema.safeParse(password);
  if (!passwordPolicy.success) {
    return res.status(400).json({ success: false, message: passwordPolicy.error.issues[0].message, data: null });
  }
  const aadharDigits = String(aadharNumber ?? '').replace(/[\s-]/g, '');
  if (aadharDigits && !/^\d{12}$/.test(aadharDigits)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 12-digit Aadhaar number', data: null });
  }
  const existing = await DeliveryAgent.findOne({ email });
  const sellerExists = await Seller.findOne({ email }).select('_id').lean();
  if (existing || sellerExists) {
    return res.status(400).json({ success: false, message: 'Agent already exists', data: null });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const agent = await DeliveryAgent.create({
    name,
    email,
    password: hashedPassword,
    vehicleType,
    vehicleModel,
    licensePlate,
    city,
    address,
    aadharNumber: aadharDigits || undefined,
    status: 'pending',
    isApproved: false,
  });

  res.status(201).json({
    success: true,
    message: 'Registration submitted. Please wait for admin approval before logging in.',
    data: { id: agent._id },
  });
};

export const loginAgent = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

  // 1. Rate limiting on failed attempts
  const failedAttempts = await getFailedLoginAttempts(ip);
  if (failedAttempts >= 5) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed login attempts. Please try again after 15 minutes.',
      data: null,
    });
  }

  // 2. Cross-role isolation: Deny customers
  const isCustomer = await Customer.findOne({ email });
  if (isCustomer) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. This portal is for authorized personnel only.',
      data: null,
    });
  }

  // Deny admins
  const isAdmin = await Admin.findOne({ email });
  if (isAdmin) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. This portal is for authorized personnel only.',
      data: null,
    });
  }

  const isSeller = await Seller.findOne({ email });
  if (isSeller) {
    await incrementFailedLoginAttempts(ip);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Use the seller portal for this account.',
      data: null,
    });
  }

  const agent = await DeliveryAgent.findOne({ email });
  if (!agent || !agent.password) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  const isMatch = await bcrypt.compare(password, agent.password);
  if (!isMatch) {
    await incrementFailedLoginAttempts(ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
  }

  // 3. Status checks — rejected is checked FIRST: reject sets isApproved=false,
  // and the pending branch's `!agent.isApproved` used to shadow it, showing
  // rejected agents a misleading "pending admin approval" message (B6).
  if (agent.status === 'rejected') {
    return res.status(403).json({
      success: false,
      message: 'Your registration was not approved. Contact support.',
      data: null,
    });
  }
  if (agent.status === 'pending' || !agent.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending admin approval.',
      data: null,
    });
  }

  // Success: Clear failed attempts
  await clearFailedLoginAttempts(ip);

  const token = generateToken({ id: agent._id, role: 'agent' }, env.JWT_SECRET_AGENT, env.JWT_EXPIRES_IN);

  // Set namespaced httpOnly cookie
  res.cookie('nexmart_delivery_session', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: { id: agent._id, name: agent.name, email: agent.email, role: agent.role },
    },
  });
};

// ─── PASSWORD RESET ────────────────────────────────────────────────────────────

/**
 * POST forgot-password — always 202, whatever the truth is.
 *
 * Anti-enumeration (CLAUDE.md §1.3): the rate limit is consumed BEFORE the
 * lookup so even a 429 cannot prove an address exists, and unknown address,
 * cross-role address, and Google-only account all answer with the identical
 * body. Only the true owner — who can read the inbox — experiences the
 * difference between these branches.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Enter a valid email address', data: null });
    return;
  }
  const { email } = parsed.data;

  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  const customer = await Customer.findOne({ email });

  if (!customer || !customer.isActive) {
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  if (!customer.password) {
    // Google-only: no password exists to reset. Tell the owner by mail; the
    // HTTP response is the same as every other branch.
    try {
      await sendEmail({
        to: email,
        subject: 'NexMart — Signing in to your account',
        html: buildGoogleOnlyResetEmail(customer.name),
      });
    } catch (emailErr: unknown) {
      console.error(`[Reset] Google-only notice failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
    }
    sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
    return;
  }

  const code = generateResetCode();
  await Customer.findByIdAndUpdate(customer._id, {
    $set: {
      resetOtpHash: hashResetCode(code),
      resetOtpExpiry: new Date(Date.now() + RESET_CODE_TTL_MS),
      resetOtpAttempts: 0,
    },
  });

  try {
    await sendEmail({
      to: email,
      subject: 'NexMart — Reset your password',
      html: buildResetEmail(customer.name, code),
    });
  } catch (emailErr: unknown) {
    console.error(`[Reset] SMTP failed for ${email}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
  }

  sendEligibilityPending(res, 'If the address is eligible, we will send a reset code by email.');
};

/**
 * POST reset-password — one uniform 400 for every miss.
 *
 * Unknown address, wrong code, expired code and a burnt code are
 * indistinguishable. On success the password is replaced and
 * credentialsChangedAt is stamped, which kills every session issued earlier.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    res.status(400).json({ success: false, message: 'Check the code and your new password.', code: 'VALIDATION_ERROR', errors, data: null });
    return;
  }
  const { email, otp, password } = parsed.data;

  const fail = (): void => {
    res.status(400).json({
      success: false,
      message: 'Unable to reset with that code. Please request a new one.',
      data: null,
    });
  };

  const customer = await Customer.findOne({ email }).select('+resetOtpHash +resetOtpExpiry +resetOtpAttempts');

  // Timing parity: hash on every path, present or absent.
  const presented = hashResetCode(otp);

  if (!customer || !customer.resetOtpHash || !customer.resetOtpExpiry || !customer.isActive) { fail(); return; }
  if (customer.resetOtpExpiry.getTime() < Date.now()) { fail(); return; }
  if ((customer.resetOtpAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) { fail(); return; }

  if (presented !== customer.resetOtpHash) {
    await Customer.updateOne({ _id: customer._id, resetOtpHash: customer.resetOtpHash, resetOtpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, { $inc: { resetOtpAttempts: 1 } });
    fail();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const changed = await Customer.updateOne({ _id: customer._id, isActive: true, resetOtpHash: presented, resetOtpExpiry: { $gt: new Date() }, resetOtpAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS } }, {
    $set: {
      password: hashedPassword,
      // A reset proves control of the inbox, which is what verification asks.
      emailVerified: true,
      credentialsChangedAt: new Date(),
    },
    $unset: { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 },
    $addToSet: { authProviders: 'email' },
  });
  if (changed.modifiedCount !== 1) { fail(); return; }

  res.json({ success: true, message: 'Password updated. Sign in with your new password.', data: null });
};
