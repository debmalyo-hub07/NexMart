import { Router } from 'express';
import { getProducts, getProductBySlug, createProduct, updateProduct, deleteProduct, uploadProductImages } from '../controllers/product.controller';
import { protectAdmin } from '../middleware/auth';
import { imageUpload } from '../middleware/upload';

const router = Router();

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);

// Admin-only writes
router.post('/', protectAdmin, imageUpload.array('images', 10), createProduct);
router.put('/:id', protectAdmin, updateProduct);
router.delete('/:id', protectAdmin, deleteProduct);
router.post('/:id/images', protectAdmin, imageUpload.array('images', 10), uploadProductImages);

export default router;
