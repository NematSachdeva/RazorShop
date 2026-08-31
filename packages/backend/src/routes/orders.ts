import { Router, Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createAuthenticate } from '../middleware/auth.js';

// Regex for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create an orders router with dependency-injected OrderService
 * This allows testing with TestDataSource and production with AppDataSource
 */
export function createOrdersRouter(
  orderService: OrderService,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
      return authenticate(req, res, next);
    }
    next();
  };

  // POST /api/orders
  // Create an order from a cart
  router.post(
    '/',
    optionalAuthenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { cart_id, customer_id, shipping_address } = req.body;

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

      // Ownership check if authenticated
      if (req.user && req.user.role === 'customer' && req.user.id !== customer_id) {
        return res.status(403).json({ error: 'Cart does not belong to this customer' });
      }

      try {
        const order = await orderService.createOrderFromCart(cart_id, customer_id, shipping_address);
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

  // GET /api/orders/:id/timeline
  // Get order timeline history
  router.get(
    '/:id/timeline',
    optionalAuthenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      const order = await orderService.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (req.user && req.user.role === 'customer' && order.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to view this order' });
      }

      const timeline = await orderService.getOrderTimeline(id);
      res.json(timeline);
    })
  );

  // GET /api/orders/:id
  // Get a specific order by ID
  router.get(
    '/:id',
    optionalAuthenticate,
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

      // Ownership check for customer
      if (req.user && req.user.role === 'customer' && order.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to view this order' });
      }

      res.json(order);
    })
  );

  // GET /api/orders
  // List orders for a customer with pagination
  router.get(
    '/',
    optionalAuthenticate,
    asyncHandler(async (req: Request, res: Response) => {
      let { customer_id, page, limit } = req.query;

      // If customer is authenticated, default or enforce customer_id
      if (req.user && req.user.role === 'customer') {
        if (customer_id && customer_id !== req.user.id) {
          return res.status(403).json({ error: 'You do not have permission to view another customer\'s orders' });
        }
        customer_id = req.user.id;
      }

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

  // POST /api/orders/:id/feedback
  // Submit or update customer feedback for an order
  router.post(
    '/:id/feedback',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { rating, comment, category } = req.body;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      if (!req.user || req.user.role !== 'customer') {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const order = await orderService.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to leave feedback for this order' });
      }

      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      }

      const validCategories = ['Payment', 'Product', 'Checkout', 'Delivery', 'Overall Experience'];
      const feedbackCategory = validCategories.includes(category) ? category : 'Overall Experience';

      const feedbackRepo = orderService['dataSource'].getRepository('OrderFeedback');
      let feedback: any = await feedbackRepo.findOne({ where: { order_id: id } });

      if (feedback) {
        feedback.rating = ratingNum;
        feedback.comment = comment ? String(comment).trim() : null;
        feedback.category = feedbackCategory;
      } else {
        feedback = feedbackRepo.create({
          order_id: id,
          customer_id: req.user.id,
          rating: ratingNum,
          comment: comment ? String(comment).trim() : null,
          category: feedbackCategory,
        });
      }

      const savedFeedback = await feedbackRepo.save(feedback);
      res.status(200).json(savedFeedback);
    })
  );

  // GET /api/orders/:id/feedback
  // Get customer feedback for an order
  router.get(
    '/:id/feedback',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      if (!req.user || req.user.role !== 'customer') {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const order = await orderService.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to view feedback for this order' });
      }

      const feedbackRepo = orderService['dataSource'].getRepository('OrderFeedback');
      const feedback = await feedbackRepo.findOne({ where: { order_id: id } });

      res.status(200).json({ feedback });
    })
  );

  // POST /api/orders/:id/cancel
  // Cancel an order (customer action)
  router.post(
    '/:id/cancel',
    optionalAuthenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { reason, customer_id } = req.body;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'Cancellation reason is required' });
      }

      const activeCustomerId = req.user?.id || customer_id;
      if (!activeCustomerId || !UUID_REGEX.test(activeCustomerId)) {
        return res.status(400).json({ error: 'Valid customer_id is required' });
      }

      if (req.user && req.user.role === 'customer' && req.user.id !== activeCustomerId) {
        return res.status(403).json({ error: 'You do not have permission to cancel this order' });
      }

      try {
        const order = await orderService.cancelOrder(id, activeCustomerId, reason);
        res.status(200).json(order);
      } catch (error: any) {
        const msg = error?.message || 'Failed to cancel order';
        if (msg === 'Order not found') return res.status(404).json({ error: msg });
        if (msg === 'Order does not belong to this customer') return res.status(403).json({ error: msg });
        return res.status(400).json({ error: msg });
      }
    })
  );

  // POST /api/orders/:id/return
  // Request a return for a delivered order (customer action)
  router.post(
    '/:id/return',
    optionalAuthenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { reason, customer_id } = req.body;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'Return reason is required' });
      }

      const activeCustomerId = req.user?.id || customer_id;
      if (!activeCustomerId || !UUID_REGEX.test(activeCustomerId)) {
        return res.status(400).json({ error: 'Valid customer_id is required' });
      }

      if (req.user && req.user.role === 'customer' && req.user.id !== activeCustomerId) {
        return res.status(403).json({ error: 'You do not have permission to request return for this order' });
      }

      try {
        const order = await orderService.requestReturn(id, activeCustomerId, reason);
        res.status(200).json(order);
      } catch (error: any) {
        const msg = error?.message || 'Failed to request return';
        if (msg === 'Order not found') return res.status(404).json({ error: msg });
        if (msg === 'Order does not belong to this customer') return res.status(403).json({ error: msg });
        return res.status(400).json({ error: msg });
      }
    })
  );

  return router;
}

// Export default for backwards compatibility - production usage
import { orderService } from '../services/OrderService.js';
export default createOrdersRouter(orderService);
