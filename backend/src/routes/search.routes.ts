import { Router } from 'express';
import { searchProducts } from '../controllers/search.controller';

const router = Router();

router.get('/', searchProducts);

export default router;
