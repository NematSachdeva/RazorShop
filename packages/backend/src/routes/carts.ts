import { Router, Request, Response } from 'express';
import { CartService, cartService as defaultCartService } from '../services/CartService.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuthenticate, requireCustomer } from '../middleware/auth.js';

export function createCartsRouter(
  service: CartService = defaultCartService,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  // POST /api/carts
  // Create or get active cart for authenticated customer
  router.post(
    '/',
    authenticate,
    requireCustomer,
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      try {
        // Get or create active cart for authenticated customer
        const cart = await service.getOrCreateCart(req.user.id);
        res.status(201).json(cart);
      } catch (error) {
        if (error instanceof Error && error.message === 'Customer not found') {
          return res.status(401).json({ error: 'Customer not found or invalid session' });
        }
        throw error;
      }
    })
  );

  // GET /api/carts/:id
  // Requires authentication to view cart
  router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      const cart = await service.getCartById(id);

      if (!cart) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      // Verify ownership: cart must belong to authenticated customer
      if (cart.customer_id !== req.user?.id) {
        return res.status(403).json({ error: 'You do not have permission to view this cart' });
      }

      res.json(cart);
    })
  );

  // POST /api/carts/:id/items
  // Requires authentication
  router.post(
    '/:id/items',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { product_id, quantity } = req.body;

      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      if (!product_id) {
        return res.status(400).json({ error: 'product_id is required' });
      }

      if (!product_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive integer' });
      }

      try {
        const cart = await service.addToCart(id, product_id, quantity);
        res.status(200).json(cart);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Insufficient inventory') {
            return res.status(409).json({ error: error.message });
          }
          if (error.message === 'Product not found') {
            return res.status(404).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // PATCH / PUT /api/carts/:id/items/:productId
  // Requires authentication
  const updateQuantityHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id, productId } = req.params;
    const { quantity } = req.body;

    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid cart ID format' });
    }

    if (!productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative integer' });
    }

    try {
      const cart = await service.updateCartItemQuantity(id, productId, quantity);
      res.json(cart);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('inventory') || error.message.includes('Insufficient')) {
          return res.status(409).json({ error: error.message });
        }
        if (error.message === 'Item not in cart') {
          return res.status(404).json({ error: error.message });
        }
      }
      throw error;
    }
  });

  router.patch('/:id/items/:productId', authenticate, updateQuantityHandler);
  router.put('/:id/items/:productId', authenticate, updateQuantityHandler);

  // DELETE /api/carts/:id/items/:productId
  // Requires authentication
  router.delete(
    '/:id/items/:productId',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id, productId } = req.params;

      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      if (!productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }

      try {
        const cart = await service.removeFromCart(id, productId);
        res.json(cart);
      } catch (error) {
        if (error instanceof Error && error.message === 'Item not in cart') {
          return res.status(404).json({ error: error.message });
        }
        throw error;
      }
    })
  );

  // DELETE /api/carts/:id
  // Requires authentication
  router.delete(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      const cart = await service.clearCart(id);
      res.json(cart);
    })
  );

  // POST /api/carts/:id/bundle
  // Add bundle to cart with discount calculation
  router.post(
    '/:id/bundle',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { recommendation_id } = req.body;

      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid cart ID format' });
      }

      if (!recommendation_id || !recommendation_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid or missing recommendation_id' });
      }

      try {
        const cart = await service.addBundleToCart(id, recommendation_id);
        res.status(200).json(cart);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(404).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  return router;
}

export default createCartsRouter();

