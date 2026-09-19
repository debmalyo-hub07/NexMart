import { Router } from 'express';
import { getProducts, getProductBySlug, getProductForAdmin, createProduct, updateProduct, deleteProduct, uploadProductImages, getProductReviews, addProductReview } from '../controllers/product.controller';
import { getProductOffers } from '../controllers/listing.controller';
import { protectAdmin, protectCustomer } from '../middleware/auth';
import { imageUpload } from '../middleware/upload';

const router = Router();

router.get('/', getProducts);
router.get('/:id/manage', protectAdmin, getProductForAdmin);
router.get('/:id/offers', getProductOffers);
router.get('/:slug', getProductBySlug);

// Reviews (subdocument routes — no conflict with /:slug, different segment count)
router.get('/:id/reviews', getProductReviews);
router.post('/:id/reviews', protectCustomer, addProductReview);

// Admin-only writes
router.post('/', protectAdmin, imageUpload.array('images', 10), createProduct);
router.put('/:id', protectAdmin, updateProduct);
router.delete('/:id', protectAdmin, deleteProduct);
router.post('/:id/images', protectAdmin, imageUpload.array('images', 10), uploadProductImages);

export default router;
