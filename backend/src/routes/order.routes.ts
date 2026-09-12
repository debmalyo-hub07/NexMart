import { Router } from 'express';
import { createOrder, verifyPayment, getMyOrders, getOrderById, updateOrderStatus, getInvoice } from '../controllers/order.controller';
import { protectCustomer, protectAdmin } from '../middleware/auth';
import { paymentLimit } from '../middleware/rateLimiter';
import { getCheckoutOrder, resumePayment } from '../controllers/checkout.controller';

const router = Router();

// Customer routes — each guarded individually (NOT router-wide: PATCH status is admin)
router.post('/', protectCustomer, createOrder);
router.get('/', protectCustomer, getMyOrders);
router.get('/checkout/:checkoutId', protectCustomer, getCheckoutOrder);
router.get('/:id', protectCustomer, getOrderById);
router.post('/:id/payment', protectCustomer, paymentLimit, resumePayment);
router.post('/:id/payment/verify', protectCustomer, paymentLimit, verifyPayment);
router.get('/:id/invoice', protectCustomer, getInvoice);

// Admin route — order status transitions
router.patch('/:id/status', protectAdmin, updateOrderStatus);

export default router;
