import { Router } from 'express';
import { createOrder, verifyPayment, getMyOrders, getOrderById, updateOrderStatus, getInvoice } from '../controllers/order.controller';
import { protectCustomer, protectAdmin } from '../middleware/auth';
import { paymentLimit } from '../middleware/rateLimiter';

const router = Router();

// Protected customer routes
router.use(protectCustomer);
router.post('/', createOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrderById);
router.post('/:id/payment/verify', paymentLimit, verifyPayment);
router.patch('/:id/status', protectAdmin, updateOrderStatus);
router.get('/:id/invoice', getInvoice);

export default router;
