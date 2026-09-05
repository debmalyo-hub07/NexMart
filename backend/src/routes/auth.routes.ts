import { Router, Request } from 'express';
import jwt from 'jsonwebtoken';
import { googleAuthCallback } from '../controllers/googleAuth.controller';
import { authLimit, registerLimit, otpLimit } from '../middleware/rateLimiter';
import { blacklistToken } from '../config/redis';
import {
  registerAdmin,
  loginAdmin,
  registerCustomer,
  loginCustomer,
  verifyOtp,
  resendOtp,
  registerAgent,
  loginAgent
} from '../controllers/roleAuth.controller';

const router = Router();

/**
 * POST /api/v1/auth/google/callback
 * Called by Next-Auth's signIn callback (auth.ts) after Google OAuth completes.
 */
router.post('/google/callback', authLimit, googleAuthCallback);

// --- Role-Namespaced Auth Aliases ---
router.post('/admin/login', authLimit, loginAdmin);
router.post('/admin/register', registerLimit, registerAdmin);

router.post('/customer/login', authLimit, loginCustomer);
router.post('/customer/register', registerLimit, registerCustomer);
router.post('/customer/verify-otp', otpLimit, verifyOtp);
router.post('/customer/resend-otp', otpLimit, resendOtp);

router.post('/delivery/login', authLimit, loginAgent);
router.post('/delivery/register', registerLimit, registerAgent);

/**
 * POST /api/v1/auth/logout
 * Called by authStore.logout() — server-side session cleanup.
 * Revokes the presented token(s) by blacklisting their jti in Redis until natural expiry,
 * so a stolen/replayed cookie is rejected immediately instead of staying valid for 7 days.
 */
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const c of raw.split('; ')) {
    const idx = c.indexOf('=');
    if (idx > -1 && c.slice(0, idx) === name) return c.slice(idx + 1);
  }
  return null;
}

router.post('/logout', async (req, res) => {
  const cookieNames = ['nexmart_admin_session', 'nexmart_customer_session', 'nexmart_delivery_session'];
  await Promise.all(cookieNames.map(async (name) => {
    const token = readCookie(req, name);
    if (!token) return;
    try {
      const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        await blacklistToken(decoded.jti, ttl);
      }
    } catch { /* malformed token — nothing to revoke */ }
    res.clearCookie(name, { path: '/' });
  }));
  res.json({ success: true, message: 'Logged out' });
});

export default router;
