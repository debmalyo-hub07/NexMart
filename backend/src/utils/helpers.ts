import crypto from 'crypto';

export function parsePagination(query: Record<string, unknown>, defaultLimit = 10) {
  const page = Math.max(1, parseInt(String(query.page || 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || defaultLimit))));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
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

/** Alias kept for compatibility */
export const generateOtp = generateNumericOtp;

/** Hash an OTP string with SHA-256 for safe storage */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}
