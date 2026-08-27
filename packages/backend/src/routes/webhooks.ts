import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import crypto from 'crypto';
import { AppDataSource } from '../config/database.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { env } from '../config/env.js';

/**
 * Razorpay webhook signature verification
 * Verify that the webhook came from Razorpay and hasn't been tampered with
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Create webhooks router with dependency injection
 */
export function createWebhooksRouter(dataSource: DataSource = AppDataSource) {
  const router = Router();

  /**
   * POST /api/webhooks/razorpay
   * Handles Razorpay payment webhooks
   *
   * Expected headers:
   * - X-Razorpay-Signature: HMAC-SHA256 signature of the payload
   *
   * Expected payload:
   * {
   *   event: 'payment.captured' | 'payment.failed' | 'payment.authorized',
   *   created_at: timestamp,
   *   payload: {
   *     payment: {
   *       entity: {
   *         id: 'pay_xxxxx',
   *         amount: 50000,
   *         currency: 'INR',
   *         status: 'captured' | 'failed',
   *         ...
   *       }
   *     }
   *   },
   *   ...
   * }
   *
   * Response:
   * - 200 OK: Webhook processed successfully
   * - 400 Bad Request: Invalid signature or malformed payload
   * - 409 Conflict: Webhook already processed (idempotent)
   */
  router.post('/razorpay', async (req: Request, res: Response) => {
    try {
      // 1. Verify webhook signature from headers
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        return res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
      }

      // Reconstructing the exact payload for verification
      // Razorpay sends raw body, so we need the raw string
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      const isValidSignature = verifyWebhookSignature(
        payload,
        signature,
        env.RAZORPAY_WEBHOOK_SECRET
      );

      if (!isValidSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      // 2. Parse the webhook payload
      const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // 3. Extract event details
      const eventType = webhookData.event;
      const paymentEntity = webhookData.payload?.payment?.entity;

      if (!eventType || !paymentEntity) {
        return res.status(400).json({ error: 'Malformed webhook payload' });
      }

      // 4. Check for idempotency using webhook_id
      // Razorpay sends a unique webhook_id for each event
      const webhookId = webhookData.id;
      if (!webhookId) {
        return res.status(400).json({ error: 'Missing webhook ID' });
      }

      const webhookEventRepo = dataSource.getRepository(WebhookEvent);
      const existingEvent = await webhookEventRepo.findOne({
        where: { webhook_id: webhookId },
      });

      if (existingEvent && existingEvent.status === 'processed') {
        // Already processed this webhook, return success (idempotent)
        return res.status(200).json({
          message: 'Webhook already processed',
          webhook_id: webhookId,
          status: 'processed',
        });
      }

      // 5. Create or update webhook event record
      let webhookEvent = existingEvent || webhookEventRepo.create({
        webhook_id: webhookId,
        event_type: eventType,
        status: 'processing',
        payload: webhookData,
      });

      if (!existingEvent) {
        webhookEvent = await webhookEventRepo.save(webhookEvent);
      }

      // 6. Process the webhook based on event type
      try {
        const paymentRepo = dataSource.getRepository(Payment);
        const orderRepo = dataSource.getRepository(Order);

        const razorpayPaymentId = paymentEntity.id;

        switch (eventType) {
          case 'payment.captured': {
            // Find payment by razorpay_payment_id
            // If not found yet, it will be matched when the client calls verifyPayment
            let payment = await paymentRepo.findOne({
              where: { razorpay_payment_id: razorpayPaymentId },
            });

            if (payment) {
              // Update payment status
              payment.status = 'captured';
              await paymentRepo.save(payment);

              // Update order status
              const order = await orderRepo.findOne({
                where: { id: payment.order_id },
              });

              if (order) {
                order.status = 'confirmed';
                await orderRepo.save(order);
              }
            } else {
              // Payment not found yet - this is normal in test/async scenarios
              // In production, the client would have already called /verify
              console.log(`Payment with ID ${razorpayPaymentId} not found in webhook`);
            }
            break;
          }

          case 'payment.failed': {
            // Find payment by razorpay_payment_id
            let payment = await paymentRepo.findOne({
              where: { razorpay_payment_id: razorpayPaymentId },
            });

            if (payment) {
              // Update payment status
              payment.status = 'failed';
              payment.failure_reason = paymentEntity.failure_reason || 'Unknown';
              await paymentRepo.save(payment);

              // Order stays in pending state (payment failed)
              // Frontend can retry payment with a new PaymentAttempt
            } else {
              console.log(`Payment with ID ${razorpayPaymentId} not found in webhook`);
            }
            break;
          }

          case 'payment.authorized': {
            // Razorpay authorized payment, but not yet captured
            // For now, treat similar to captured (in test mode)
            let payment = await paymentRepo.findOne({
              where: { razorpay_payment_id: razorpayPaymentId },
            });

            if (payment) {
              payment.status = 'captured';
              await paymentRepo.save(payment);

              const order = await orderRepo.findOne({
                where: { id: payment.order_id },
              });

              if (order) {
                order.status = 'confirmed';
                await orderRepo.save(order);
              }
            } else {
              console.log(`Payment with ID ${razorpayPaymentId} not found in webhook`);
            }
            break;
          }

          default: {
            // Unknown event type - log but don't fail
            console.log(`Received unknown webhook event type: ${eventType}`);
          }
        }

        // 7. Mark webhook as processed
        webhookEvent.status = 'processed';
        webhookEvent.processed_at = new Date();
        await webhookEventRepo.save(webhookEvent);

        return res.status(200).json({
          message: 'Webhook processed successfully',
          webhook_id: webhookId,
          event_type: eventType,
          status: 'processed',
        });
      } catch (processingError) {
        // Mark webhook as failed if processing fails
        webhookEvent.status = 'failed';
        await webhookEventRepo.save(webhookEvent);

        // Log the error but don't expose it to Razorpay
        console.error('Webhook processing error:', processingError);

        // Return 200 anyway so Razorpay doesn't retry
        return res.status(200).json({
          message: 'Webhook received but processing failed',
          webhook_id: webhookId,
          status: 'failed',
        });
      }
    } catch (error) {
      console.error('Webhook error:', error);

      // Return 200 so Razorpay doesn't retry on malformed requests
      // Log the error for manual investigation
      return res.status(200).json({
        message: 'Webhook received but error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

// Default export for use in app.ts
export default createWebhooksRouter();
