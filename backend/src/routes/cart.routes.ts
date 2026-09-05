import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, mergeGuestCart } from '../controllers/cart.controller';
import { optionalCustomerAuth, protectCustomer } from '../middleware/auth';

const router = Router();

// optionalCustomerAuth binds the cart to the account when logged in,
// guests keep the x-session-id scope. Never rejects.
router.use(optionalCustomerAuth);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);
router.post('/merge', protectCustomer, mergeGuestCart);

export default router;
