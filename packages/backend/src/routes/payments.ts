import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService.js';
import { PaymentSimulator } from '../services/PaymentSimulator.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Regex for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a payments router with dependency-injected PaymentService
 */
export function createPaymentsRouter(paymentService: PaymentService): Router {
  const router = Router();

  // POST /api/payments/create
  // Initiate a payment for an order
  // Query params: ?demo=failure_network (optional, for testing failure scenarios)
  router.post(
    '/create',
    asyncHandler(async (req: Request, res: Response) => {
      const { order_id } = req.body;
      const { demo } = req.query;

      // Validation
      if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
      }

      if (!UUID_REGEX.test(order_id)) {
        return res.status(400).json({ error: 'Invalid order_id format' });
      }

      try {
        // Create payment attempt row in PostgreSQL
        const paymentInfo = await paymentService.createPaymentAttempt(order_id);

        // Check for demo mode failure injection
        const demoFailure = demo ? PaymentSimulator.shouldInjectFailure(demo as string) : null;
        if (demoFailure) {
          // Trigger deterministic failure recovery pipeline in DB
          await paymentService.markPaymentFailed(order_id, demoFailure.failure.reason, {
            scenario: demoFailure.scenario,
            demo: true,
          });

          return res.status(400).json({
            error: 'Payment failed (demo mode)',
            scenario: demoFailure.scenario,
            reason: demoFailure.failure.reason,
            recoverable: demoFailure.failure.shouldRetry,
            recoverableBy: demoFailure.failure.recoverableBy,
            razorpay_order_id: paymentInfo.razorpay_order_id,
          });
        }

        res.status(200).json(paymentInfo);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Order not found') {
            return res.status(404).json({ error: error.message });
          }
          if (
            error.message === 'Order is not in pending state' ||
            error.message === 'Order payment already captured' ||
            error.message === 'Cannot create new payment attempt while one is pending'
          ) {
            return res.status(409).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // POST /api/payments/fail
  // Explicitly mark payment as failed and trigger M5/M6 recovery pipeline
  router.post(
    '/fail',
    asyncHandler(async (req: Request, res: Response) => {
      const { order_id, reason, error_context } = req.body;

      if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
      }

      if (!UUID_REGEX.test(order_id)) {
        return res.status(400).json({ error: 'Invalid order_id format' });
      }

      try {
        const payment = await paymentService.markPaymentFailed(
          order_id,
          reason || 'Payment failed or cancelled by user',
          error_context
        );
        res.status(200).json(payment);
      } catch (error) {
        if (error instanceof Error && error.message === 'Order not found') {
          return res.status(404).json({ error: error.message });
        }
        throw error;
      }
    })
  );

  // POST /api/payments/verify
  // Verify a payment signature and mark as captured
  router.post(
    '/verify',
    asyncHandler(async (req: Request, res: Response) => {
      const { order_id, razorpay_payment_id, razorpay_signature } = req.body;

      // Validation
      if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
      }

      if (!razorpay_payment_id) {
        return res.status(400).json({ error: 'razorpay_payment_id is required' });
      }

      if (!razorpay_signature) {
        return res.status(400).json({ error: 'razorpay_signature is required' });
      }

      if (!UUID_REGEX.test(order_id)) {
        return res.status(400).json({ error: 'Invalid order_id format' });
      }

      try {
        const payment = await paymentService.verifyPayment({
          order_id,
          razorpay_payment_id,
          razorpay_signature,
        });
        res.status(200).json(payment);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Payment not found for order' || error.message === 'Payment attempt not found for order') {
            return res.status(404).json({ error: error.message });
          }
          if (error.message === 'Invalid payment signature') {
            return res.status(400).json({ error: error.message });
          }
          if (
            error.message === 'Order payment already captured with different payment ID' ||
            error.message === 'Missing required payment verification fields'
          ) {
            return res.status(409).json({ error: error.message });
          }
        }
        throw error;
      }
    })
  );

  // GET /api/payments/:orderId
  // Get payment information for an order
  router.get(
    '/:orderId',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      // Validate UUID format
      if (!UUID_REGEX.test(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      const payment = await paymentService.getPaymentByOrderId(orderId);

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json(payment);
    })
  );

  return router;
}

// Export default for backwards compatibility - production usage
import { paymentService } from '../services/PaymentService.js';
export default createPaymentsRouter(paymentService);
