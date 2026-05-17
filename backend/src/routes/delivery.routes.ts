import { Router } from 'express';
import { getMyDeliveries, getDeliveryOrderById, updateDeliveryStatus } from '../controllers/delivery.controller';
import { protectAgent } from '../middleware/auth';

const router = Router();

router.use(protectAgent);

router.get('/my-orders', getMyDeliveries);
router.get('/orders/:id', getDeliveryOrderById);
router.patch('/orders/:id/status', updateDeliveryStatus);

export default router;
