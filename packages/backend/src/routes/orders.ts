import { Router, Request, Response } from 'express';
import { OrderService } from '../services/OrderService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Regex for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create an orders router with dependency-injected OrderService
 * This allows testing with TestDataSource and production with AppDataSource
 */
export function createOrdersRouter(orderService: OrderService): Router {
  const router = Router();

  // POST /api/orders
  // Create an order from a cart
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const { cart_id, customer_id } = req.body;

      // Validation
      if (!cart_id) {
        return res.status(400).json({ error: 'cart_id is required' });
      }

      if (!customer_id) {
        return res.status(400).json({ error: 'customer_id is required' });
      }

      if (!UUID_REGEX.test(cart_id)) {
        return res.status(400).json({ error: 'Invalid cart_id format' });
      }

      if (!UUID_REGEX.test(customer_id)) {
        return res.status(400).json({ error: 'Invalid customer_id format' });
      }

      try {
        const order = await orderService.createOrderFromCart(cart_id, customer_id);
        res.status(201).json(order);
      } catch (error) {
        if (error instanceof Error) {
          // Map service errors to appropriate HTTP statuses
          if (error.message === 'Cart not found') {
            return res.status(404).json({ error: error.message });
          }
          if (error.message === 'Customer not found') {
            return res.status(404).json({ error: error.message });
          }
          if (error.message === 'Cart does not belong to this customer') {
            return res.status(403).json({ error: error.message });
          }
          if (error.message === 'Cart has already been converted to an order') {
            return res.status(409).json({ error: error.message });
          }
          if (error.message === 'Cannot create order from empty cart') {
            return res.status(400).json({ error: error.message });
          }
          if (error.message.includes('Insufficient inventory')) {
            return res.status(409).json({ error: error.message });
          }
          if (error.message.includes('Product') && error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
          }
          if (error.message.includes('Invalid quantity')) {
            return res.status(400).json({ error: error.message });
          }
          if (error.message === 'Cart is not active') {
            return res.status(400).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // GET /api/orders/:id
  // Get a specific order by ID
  router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Validate UUID format
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      const order = await orderService.getOrderById(id);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    })
  );

  // GET /api/orders
  // List orders for a customer with pagination
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const { customer_id, page, limit } = req.query;

      // Validation
      if (!customer_id) {
        return res.status(400).json({ error: 'customer_id is required' });
      }

      if (typeof customer_id !== 'string') {
        return res.status(400).json({ error: 'customer_id must be a string' });
      }

      if (!UUID_REGEX.test(customer_id)) {
        return res.status(400).json({ error: 'Invalid customer_id format' });
      }

      let pageNum = 1;
      let limitNum = 10;

      // Parse page
      if (page !== undefined) {
        const parsedPage = parseInt(page as string);
        if (!Number.isInteger(parsedPage) || parsedPage < 1) {
          return res.status(400).json({ error: 'Page must be an integer >= 1' });
        }
        pageNum = parsedPage;
      }

      // Parse limit
      if (limit !== undefined) {
        const parsedLimit = parseInt(limit as string);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({ error: 'Limit must be an integer >= 1' });
        }
        if (parsedLimit > 100) {
          return res.status(400).json({ error: 'Limit must be <= 100' });
        }
        limitNum = parsedLimit;
      }

      const result = await orderService.listOrdersByCustomer(customer_id, pageNum, limitNum);

      res.json(result);
    })
  );

  return router;
}

// Export default for backwards compatibility - production usage
import { orderService } from '../services/OrderService.js';
export default createOrdersRouter(orderService);
