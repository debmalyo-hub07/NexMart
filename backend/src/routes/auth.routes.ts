import { Router } from 'express';
import { googleAuthCallback } from '../controllers/googleAuth.controller';
import { authLimit } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/auth/google/callback
 *
 * Called by Next-Auth's signIn callback (auth.ts) after Google OAuth completes.
 * Implements Phase 7 multi-role Gmail logic — see googleAuth.controller.ts.
 */
router.post('/google/callback', authLimit, googleAuthCallback);

/**
 * POST /api/v1/auth/logout
 * Called by authStore.logout() — server-side session cleanup.
 * JWT is stateless so this is a no-op, but having the route prevents 404 errors in the client.
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

export default router;
