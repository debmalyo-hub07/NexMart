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
import { authLimit, registerLimit } from '../middleware/rateLimiter';
import { Admin } from '../models/Admin';
import { DeliveryAgent } from '../models/DeliveryAgent';
import { Customer } from '../models/Customer';
import { registerAdmin, loginAdmin } from '../controllers/roleAuth.controller';
import { sendAgentStatusEmail } from '../services/email.service';

const router = Router();

// --- Auth Routes (Unprotected but rate-limited) ---
router.post('/auth/register', registerLimit, registerAdmin);
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
router.patch('/customers/:id/status', async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean', data: null });
  }
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select('-password -otp -otpExpiry');
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found', data: null });
  res.json({ success: true, message: `Customer ${isActive ? 'activated' : 'suspended'}`, data: customer });
});

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
    { status: 'approved', isApproved: true },
    { new: true }
  ).select('-password');
  if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

  try {
    await sendAgentStatusEmail(agent.email, agent.name, 'approved');
  } catch (err) {
    console.error('SMTP agent approval email failed:', err);
  }
  res.json({ success: true, message: 'Agent approved', data: agent });
});
router.patch('/agents/:id/reject', async (req, res) => {
  const agent = await DeliveryAgent.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', isApproved: false },
    { new: true }
  ).select('-password');
  if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

  try {
    await sendAgentStatusEmail(agent.email, agent.name, 'rejected');
  } catch (err) {
    console.error('SMTP agent rejection email failed:', err);
  }
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
