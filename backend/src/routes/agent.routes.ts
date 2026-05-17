import { Router } from 'express';
import { protectAgent } from '../middleware/auth';
import { checkIP } from '../middleware/ipWhitelist';
import { authLimit } from '../middleware/rateLimiter';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { registerAgent, loginAgent } from '../controllers/roleAuth.controller';

const router = Router();

// --- Auth Routes (Unprotected but rate-limited) ---
router.post('/auth/register', authLimit, registerAgent);
router.post('/auth/login', authLimit, loginAgent);

// --- Protected Routes ---
router.use(protectAgent, checkIP(DeliveryAgent));

router.get('/profile', async (req: any, res) => {
  const agent = await DeliveryAgent.findById(req.user.id).select('-password');
  res.json({ success: true, data: agent });
});

export default router;
