import { Router } from 'express';
import { createOrder, verifyPayment, getMyOrders, getOrderById, updateOrderStatus, getInvoice } from '../controllers/order.controller';
import { protectCustomer, protectAdmin } from '../middleware/auth';
import { paymentLimit } from '../middleware/rateLimiter';
import { getCheckoutOrder, resumePayment } from '../controllers/checkout.controller';
import { getOrderRequests, createOrderRequest } from '../controllers/orderRequest.controller';

const router = Router();

// Customer routes — each guarded individually (NOT router-wide: PATCH status is admin)
// Each customer order create goes through Razorpay's paid orders API, so it is
// rate-limited exactly like the payment routes (audit 2026-09-22 §C5).
router.post('/', protectCustomer, paymentLimit, createOrder);
router.get('/', protectCustomer, getMyOrders);
router.get('/checkout/:checkoutId', protectCustomer, getCheckoutOrder);
router.get('/:id', protectCustomer, getOrderById);
router.post('/:id/payment', protectCustomer, paymentLimit, resumePayment);
router.post('/:id/payment/verify', protectCustomer, paymentLimit, verifyPayment);
router.get('/:id/invoice', protectCustomer, getInvoice);
router.get('/:id/requests', protectCustomer, getOrderRequests);
router.post('/:id/requests', protectCustomer, paymentLimit, createOrderRequest);

// Admin route — order status transitions
router.patch('/:id/status', protectAdmin, updateOrderStatus);

export default router;
