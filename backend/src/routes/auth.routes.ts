import { Router } from 'express';
import { googleAuthCallback } from '../controllers/googleAuth.controller';
import { authLimit, registerLimit, otpLimit } from '../middleware/rateLimiter';
import { blacklistToken } from '../config/redis';
import { readSessionCookie, sessionCookies } from '../middleware/auth';
import { verifySessionClaims, type SessionRole } from '../services/sessionIdentity.service';
import { env } from '../config/env';
import {
  registerAdmin,
  loginAdmin,
  registerCustomer,
  loginCustomer,
  verifyOtp,
  resendOtp,
  registerAgent,
  loginAgent,
  forgotPassword,
  resetPassword
} from '../controllers/roleAuth.controller';
import {
  loginSeller,
  registerSeller,
  resendSellerVerification,
  verifySellerEmail,
} from '../controllers/sellerAuth.controller';

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
router.post('/customer/forgot-password', otpLimit, forgotPassword);
router.post('/customer/reset-password', otpLimit, resetPassword);

router.post('/delivery/login', authLimit, loginAgent);
router.post('/delivery/register', registerLimit, registerAgent);

router.post('/seller/login', authLimit, loginSeller);
router.post('/seller/register', registerLimit, registerSeller);
router.post('/seller/verify-otp', otpLimit, verifySellerEmail);
router.post('/seller/resend-otp', otpLimit, resendSellerVerification);

/**
 * POST /api/v1/auth/logout
 * Called by authStore.logout() — server-side session cleanup.
 * Revokes the presented token(s) by blacklisting their jti in Redis until natural expiry,
 * so a stolen/replayed cookie is rejected immediately instead of staying valid for 7 days.
 */
router.post('/logout', async (req, res) => {
  const tokens = new Map<string, SessionRole | undefined>();
  for (const [role, name] of Object.entries(sessionCookies)) {
    const token = readSessionCookie(req, name);
    if (token) tokens.set(token, role as SessionRole);
    res.clearCookie(name, { path: '/', httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax' });
  }
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (bearer) tokens.set(bearer, undefined);
  for (const [token, role] of tokens) {
    let claims;
    try { claims = verifySessionClaims(token, role); }
    catch { continue; }
    if (claims.jti) await blacklistToken(claims.jti, claims.exp - Math.floor(Date.now() / 1000));
  }
  res.json({ success: true, message: 'Logged out' });
});

export default router;
