import { Request, Response } from 'express';
import { getProducts } from './product.controller';

// Search and browse share validation, facets, price selection and ranking.
export async function searchProducts(req: Request, res: Response): Promise<void> {
  await getProducts(req, res);
}
