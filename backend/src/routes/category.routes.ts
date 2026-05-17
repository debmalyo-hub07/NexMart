import { Router } from 'express';
import { getCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { protectAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', protectAdmin, createCategory);
router.put('/:id', protectAdmin, updateCategory);
router.delete('/:id', protectAdmin, deleteCategory);

export default router;
