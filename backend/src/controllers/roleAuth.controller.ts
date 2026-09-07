import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { sendEmail, buildOtpEmail } from '../services/email.service';
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

// ─── ADMIN AUTH ────────────────────────────────────────────────────────────────

export const registerAdmin = async (req: Request, res: Response) => {
  const { name, email, password, secretKey } = req.body;

  // Phase 3: Admin Secret Key — server-side only validation
  if (!secretKey || secretKey !== env.ADMIN_SECRET_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing admin secret key. Registration denied.',
      data: null,
    });
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
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

  // 1. Cross-role check: Check if email exists in admin or agent collections
  const isAdmin = await Admin.findOne({ email });
  const isAgent = await DeliveryAgent.findOne({ email });
  if (isAdmin || isAgent) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists under a different role.',
      data: null,
    });
  }

  const existing = await Customer.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists', data: null });
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

  // 2. Email-level OTP rate limiting
  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    return res.status(429).json({
      success: false,
      message: 'Too many OTP requests for this email. Please try again after 10 minutes.',
      data: null,
    });
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const hashedPassword = await bcrypt.hash(password, 12);

  const customer = await Customer.create({
    name,
    email,
    password: hashedPassword,
    phone,
    emailVerified: false,
    isActive: true,
    authProviders: ['email'],
    otp,
    otpExpiry,
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
  } catch (emailErr: any) {
    // Email failed — delete the customer so they can retry registration cleanly
    await Customer.findByIdAndDelete(customer._id);
    console.error(`[OTP] SMTP failed for ${email}:`, emailErr?.message);
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

  const customer = await Customer.findOne({ email });
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Account not found', data: null });
  }

  if (customer.emailVerified) {
    return res.status(400).json({ success: false, message: 'Email is already verified', data: null });
  }

  if (!customer.otp || customer.otp !== otp.toString()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.', data: null });
  }

  if (!customer.otpExpiry || customer.otpExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.', data: null });
  }

  // Mark verified, clear OTP
  await Customer.findByIdAndUpdate(customer._id, {
    emailVerified: true,
    otp: undefined,
    otpExpiry: undefined,
  });

  res.json({
    success: true,
    message: 'Email verified successfully! You can now log in.',
    data: null,
  });
};

export const resendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  const customer = await Customer.findOne({ email });
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Account not found', data: null });
  }

  if (customer.emailVerified) {
    return res.status(400).json({ success: false, message: 'Email is already verified', data: null });
  }

  // Email-level OTP rate limiting
  const emailLimit = await otpEmailRateLimiter.limit(email);
  if (!emailLimit.success) {
    return res.status(429).json({
      success: false,
      message: 'Too many OTP requests for this email. Please try again after 10 minutes.',
      data: null,
    });
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await Customer.findByIdAndUpdate(customer._id, { otp, otpExpiry });

  // Send OTP email
  try {
    await sendEmail({
      to: email,
      subject: 'NexMart — New Verification Code',
      html: buildOtpEmail(customer.name, otp, 'resend'),
    });
  } catch (emailErr: any) {
    console.error(`[OTP] Resend SMTP failed for ${email}:`, emailErr?.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please check your email address or try again later.',
      data: null,
    });
  }

  res.json({
    success: true,
    message: 'A new OTP has been sent to your email.',
    data: null,
  });
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
    await incrementFailedLoginAttempts(ip);
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
  const existing = await DeliveryAgent.findOne({ email });
  if (existing) {
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
    aadharNumber,
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
