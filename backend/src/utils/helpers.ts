import crypto from 'crypto';
import mongoose from 'mongoose';
import { Category } from '../models/Category';

export function parsePagination(query: Record<string, unknown>, defaultLimit = 10) {
  const parsedPage = Number.parseInt(String(query.page ?? '1'), 10);
  const parsedLimit = Number.parseInt(String(query.limit ?? defaultLimit), 10);
  const page = Number.isFinite(parsedPage) ? Math.min(Math.max(1, parsedPage), 100_000) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : Math.min(100, Math.max(1, defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Resolve a `?category=` filter value that may be an ObjectId or a slug.
 * Returns undefined when no filter was supplied; null when the category does
 * not exist (or is inactive) — the caller sends an empty page in that case.
 * One shared resolution so /products and /search can never disagree on the
 * same slug.
 */
export async function resolveCategoryFilter(value: unknown): Promise<mongoose.Types.ObjectId | string | null | undefined> {
  if (!value) return undefined;
  const categoryValue = String(value);
  if (mongoose.isValidObjectId(categoryValue)) return categoryValue;
  const category = await Category.findOne({ slug: categoryValue, isActive: true }).select('_id').lean();
  return category ? (category._id as mongoose.Types.ObjectId) : null;
}

/** Escape user text before it is used as a regular expression. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseSortField(
  sort: string | undefined,
  allowed: string[],
  defaultSort: string
): string {
  if (!sort) return defaultSort;
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  return allowed.includes(field) ? sort : defaultSort;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export function generateDeliveryId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEL-${ts}-${rand}`;
}

export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/** Generate a random numeric OTP of the given length */
export function generateNumericOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * Mask an email for logs: debmalyobarman2003@gmail.com → deb***@gmail.com
 * Emails are PII — they never appear in full in log output.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 3);
  return `${visible}${visible.length < local.length ? '***' : ''}@${domain}`;
}

/** Alias kept for compatibility */
export const generateOtp = generateNumericOtp;

/** Hash an OTP string with SHA-256 for safe storage */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}
