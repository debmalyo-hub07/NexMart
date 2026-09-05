import { Router } from 'express';
import { createOrder, verifyPayment, getMyOrders, getOrderById, updateOrderStatus, getInvoice } from '../controllers/order.controller';
import { protectCustomer, protectAdmin } from '../middleware/auth';
import { paymentLimit } from '../middleware/rateLimiter';

const router = Router();

// Customer routes — each guarded individually (NOT router-wide: PATCH status is admin)
router.post('/', protectCustomer, createOrder);
router.get('/', protectCustomer, getMyOrders);
router.get('/:id', protectCustomer, getOrderById);
router.post('/:id/payment/verify', protectCustomer, paymentLimit, verifyPayment);
router.get('/:id/invoice', protectCustomer, getInvoice);

// Admin route — order status transitions
router.patch('/:id/status', protectAdmin, updateOrderStatus);

export default router;
