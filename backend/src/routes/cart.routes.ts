import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cart.controller';
import { protectCustomer } from '../middleware/auth';

const router = Router();

// optionalAuth — works for both guests and authenticated users
// We bypass optionalCustomerAuth and just use a dummy one for now, or just let controller handle it
router.use((req, res, next) => next());

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);

export default router;
