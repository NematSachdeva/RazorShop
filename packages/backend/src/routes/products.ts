import { Router, Request, Response } from 'express';
import { ProductService, productService as defaultProductService } from '../services/ProductService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export function createProductsRouter(service: ProductService = defaultProductService): Router {
  const router = Router();

  // GET /api/products
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined;
      const sort = (req.query.sort as string | undefined) as
        | 'price_asc'
        | 'price_desc'
        | 'name_asc'
        | 'name_desc'
        | 'newest'
        | undefined;

      // Validation
      if (page < 1) {
        return res.status(400).json({ error: 'Page must be >= 1' });
      }
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
      }
      if (minPrice !== undefined && minPrice < 0) {
        return res.status(400).json({ error: 'Min price must be >= 0' });
      }
      if (maxPrice !== undefined && maxPrice < 0) {
        return res.status(400).json({ error: 'Max price must be >= 0' });
      }
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        return res.status(400).json({ error: 'Min price must be <= max price' });
      }

      const result = await service.listProducts({
        page,
        limit,
        category,
        search,
        minPrice,
        maxPrice,
        sort,
      });

      res.json(result);
    })
  );

  // GET /api/products/categories
  router.get(
    '/categories',
    asyncHandler(async (_req: Request, res: Response) => {
      const categories = await service.getCategories();
      res.json({ categories });
    })
  );

  // GET /api/products/:id
  router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Validate UUID format
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }

      const product = await service.getProductById(id);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    })
  );

  return router;
}

export default createProductsRouter();

