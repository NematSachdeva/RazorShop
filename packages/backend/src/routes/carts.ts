import { Router, Request, Response } from 'express';
import { cartService } from '../services/CartService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';

const router = Router();

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

    // Get or create active cart for authenticated customer
    const cart = await cartService.getOrCreateCart(req.user.id);
    res.status(201).json(cart);
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

    const cart = await cartService.getCartById(id);

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
      const cart = await cartService.addToCart(id, product_id, quantity);
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

// PATCH /api/carts/:id/items/:productId
// Requires authentication
router.patch(
  '/:id/items/:productId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
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
      const cart = await cartService.updateCartItemQuantity(id, productId, quantity);
      res.json(cart);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Insufficient inventory for requested quantity') {
          return res.status(409).json({ error: error.message });
        }
        if (error.message === 'Item not in cart') {
          return res.status(404).json({ error: error.message });
        }
      }
      throw error;
    }
  })
);

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
      const cart = await cartService.removeFromCart(id, productId);
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

    const cart = await cartService.clearCart(id);
    res.json(cart);
  })
);

export default router;
