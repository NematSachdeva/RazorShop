import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import crypto from 'crypto';
import { AppDataSource } from '../config/database.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { Order } from '../models/Order.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { env } from '../config/env.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';

/**
 * Razorpay webhook signature verification
 * Verify that the webhook came from Razorpay and hasn't been tampered with
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    // Timing-safe comparison or signature format error
    return false;
  }
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
        const paymentAttemptRepo = dataSource.getRepository(PaymentAttempt);
        const orderRepo = dataSource.getRepository(Order);

        const razorpayPaymentId = paymentEntity.id;
        const razorpayOrderId = paymentEntity.order_id; // Razorpay order ID from webhook

        switch (eventType) {
          case 'payment.captured': {
            // Improved lookup: Use Razorpay order ID to find PaymentAttempt, then Payment
            let payment: Payment | null = null;
            let orderId: string | null = null;

            // Strategy 1: Look up by razorpay_order_id through PaymentAttempt
            if (razorpayOrderId) {
              const paymentAttempt = await paymentAttemptRepo.findOne({
                where: { razorpay_order_id: razorpayOrderId },
              });

              if (paymentAttempt) {
                orderId = paymentAttempt.order_id;
                payment = await paymentRepo.findOne({
                  where: { order_id: orderId },
                });
              }
            }

            // Strategy 2: Fallback to razorpay_payment_id lookup (if already set by verify endpoint)
            if (!payment && razorpayPaymentId) {
              payment = await paymentRepo.findOne({
                where: { razorpay_payment_id: razorpayPaymentId },
              });
            }

            if (payment && orderId) {
              // Update payment status
              payment.status = 'captured';
              payment.razorpay_payment_id = razorpayPaymentId;
              await paymentRepo.save(payment);

              // Update order status
              const order = await orderRepo.findOne({
                where: { id: orderId },
              });

              if (order) {
                order.status = 'confirmed';
                await orderRepo.save(order);

                // Record ORDER_CONFIRMED timeline event
                const timelineRepo = dataSource.getRepository(OrderTimeline);
                const existingEvent = await timelineRepo.findOne({
                  where: { order_id: order.id, event_type: 'ORDER_CONFIRMED' },
                });
                if (!existingEvent) {
                  await timelineRepo.save(
                    timelineRepo.create({
                      order_id: order.id,
                      event_type: 'ORDER_CONFIRMED',
                      actor_role: 'system',
                      description: 'Payment captured via webhook. Order confirmed.',
                    })
                  );
                }

                // Resolve any open recovery cases for this order
                const recoveryCaseRepo = dataSource.getRepository(RecoveryCase);
                const openCases = await recoveryCaseRepo.find({
                  where: { order_id: order.id },
                });
                for (const rc of openCases) {
                  if (rc.status !== 'resolved') {
                    rc.status = 'resolved';
                    rc.resolved_at = new Date();
                    rc.recovery_notes = rc.recovery_notes
                      ? `${rc.recovery_notes}; Payment captured via webhook`
                      : 'Payment captured via webhook';
                    await recoveryCaseRepo.save(rc);
                  }
                }

                // Trigger payment confirmation email (idempotency prevents duplicates)
                const { paymentService } = await import('../services/PaymentService.js');
                paymentService.sendPaymentConfirmationEmail(order.id).catch((emailErr) => {
                  console.error('[Webhook] Error sending confirmation email:', emailErr);
                });
              }
            } else if (!payment && razorpayOrderId) {
              // Webhook arrived before verify endpoint - log for investigation
              console.log(`Payment attempt found but Payment record not found for Razorpay order ${razorpayOrderId}`);
            } else {
              console.log(`Payment with Razorpay ID ${razorpayPaymentId} not found in webhook`);
            }
            break;
          }

          case 'payment.failed': {
            // Improved lookup similar to capture
            let payment: Payment | null = null;
            let orderId: string | null = null;

            if (razorpayOrderId) {
              const paymentAttempt = await paymentAttemptRepo.findOne({
                where: { razorpay_order_id: razorpayOrderId },
              });

              if (paymentAttempt) {
                orderId = paymentAttempt.order_id;
                payment = await paymentRepo.findOne({
                  where: { order_id: orderId },
                });
              }
            }

            if (!payment && razorpayPaymentId) {
              payment = await paymentRepo.findOne({
                where: { razorpay_payment_id: razorpayPaymentId },
              });
            }

            if (payment) {
              payment.status = 'failed';
              payment.failure_reason = paymentEntity.failure_reason || paymentEntity.vpa_failure_reason || 'Unknown';
              await paymentRepo.save(payment);
              // Order stays in pending state - user can retry
              
              // M5: Detect failure and initiate recovery
              const failureService = new PaymentFailureService(dataSource);
              try {
                await failureService.handlePaymentFailure(
                  payment.id,
                  payment.failure_reason || 'Unknown',
                  {
                    razorpay_error: paymentEntity.error_reason,
                    description: paymentEntity.error_description,
                    gateway_response: paymentEntity,
                  }
                );
              } catch (recoveryError) {
                console.error('Failed to create recovery case:', recoveryError);
              }
            } else {
              console.log(`Payment with Razorpay ID ${razorpayPaymentId} not found in webhook`);
            }
            break;
          }

          case 'payment.authorized': {
            // Payment authorized but not yet captured - treat as capture in our flow
            let payment: Payment | null = null;
            let orderId: string | null = null;

            if (razorpayOrderId) {
              const paymentAttempt = await paymentAttemptRepo.findOne({
                where: { razorpay_order_id: razorpayOrderId },
              });

              if (paymentAttempt) {
                orderId = paymentAttempt.order_id;
                payment = await paymentRepo.findOne({
                  where: { order_id: orderId },
                });
              }
            }

            if (!payment && razorpayPaymentId) {
              payment = await paymentRepo.findOne({
                where: { razorpay_payment_id: razorpayPaymentId },
              });
            }

            if (payment && orderId) {
              payment.status = 'captured';
              payment.razorpay_payment_id = razorpayPaymentId;
              await paymentRepo.save(payment);

              const order = await orderRepo.findOne({
                where: { id: orderId },
              });

              if (order) {
                order.status = 'confirmed';
                await orderRepo.save(order);
              }
            } else {
              console.log(`Payment with Razorpay ID ${razorpayPaymentId} not found in webhook`);
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
