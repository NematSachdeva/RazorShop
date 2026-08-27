import { Router, Request, Response } from 'express';
import { cartService } from '../services/CartService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/carts
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    if (!customer_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    const cart = await cartService.createCart(customer_id);
    res.status(201).json(cart);
  })
);

// GET /api/carts/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid cart ID format' });
    }

    const cart = await cartService.getCartById(id);

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.json(cart);
  })
);

// POST /api/carts/:id/items
router.post(
  '/:id/items',
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
router.patch(
  '/:id/items/:productId',
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
router.delete(
  '/:id/items/:productId',
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
router.delete(
  '/:id',
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
