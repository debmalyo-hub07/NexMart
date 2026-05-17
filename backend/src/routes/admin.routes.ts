import { Router } from 'express';
import {
  getDashboardStats,
  getAllOrders,
  getAllUsers,
  getDeliveryAgents,
  getAllAgents,
  assignDeliveryAgent,
  getRevenueAnalytics,
  getAllProducts,
  updateAdminProfile,
} from '../controllers/admin.controller';
import { protectAdmin } from '../middleware/auth';
import { checkIP } from '../middleware/ipWhitelist';
import { authLimit } from '../middleware/rateLimiter';
import { Admin } from '../models/Admin';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { registerAdmin, loginAdmin } from '../controllers/roleAuth.controller';

const router = Router();

// --- Auth Routes (Unprotected but rate-limited) ---
router.post('/auth/register', authLimit, registerAdmin);
router.post('/auth/login', authLimit, loginAdmin);

// --- Protected Routes ---
router.use(protectAdmin, checkIP(Admin));

router.get('/profile', async (req: any, res) => {
  const admin = await Admin.findById(req.user.id).select('-password');
  res.json({ success: true, data: admin });
});
router.put('/profile', updateAdminProfile);

router.get('/dashboard/stats', getDashboardStats);
router.get('/analytics', getRevenueAnalytics);

// ── Customers (users) ─────────────────────────────────────────────────────────
// Both /customers and /users resolve to same handler — fix for frontend URL mismatch
router.get('/customers', getAllUsers);
router.get('/users', getAllUsers); // ← alias: frontend calls /admin/users

// ── Agents management ─────────────────────────────────────────────────────────
// All agents (with optional status filter: ?status=pending|approved|rejected)
router.get('/agents', getAllAgents);
// Legacy — only approved agents (used by delivery assignment dropdown)
router.get('/delivery-agents', getDeliveryAgents);

router.get('/agents/pending', async (req, res) => {
  const agents = await DeliveryAgent.find({ status: 'pending' }).select('-password');
  res.json({ success: true, data: agents });
});
router.patch('/agents/:id/approve', async (req, res) => {
  const agent = await DeliveryAgent.findByIdAndUpdate(
    req.params.id,
    { status: 'approved' },
    { new: true }
  ).select('-password');
  res.json({ success: true, message: 'Agent approved', data: agent });
});
router.patch('/agents/:id/reject', async (req, res) => {
  const agent = await DeliveryAgent.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected' },
    { new: true }
  ).select('-password');
  res.json({ success: true, message: 'Agent rejected', data: agent });
});
router.delete('/agents/:id', async (req, res) => {
  await DeliveryAgent.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Agent removed from system' });
});

// ── Orders / Products ─────────────────────────────────────────────────────────
router.get('/products', getAllProducts);
router.get('/orders', getAllOrders);
router.post('/orders/:orderId/assign/:agentId', assignDeliveryAgent);

export default router;
