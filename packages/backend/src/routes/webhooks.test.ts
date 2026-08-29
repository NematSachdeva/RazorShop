import express, { Express } from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { createWebhooksRouter } from './webhooks.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentService, RazorpayClient } from '../services/PaymentService.js';
import { env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Razorpay Webhooks', () => {
  let testApp: Express;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let mockRazorpayClient: RazorpayClient;
  let testCustomerId: string;
  let testProductId: string;
  let testOrderId: string;
  let testPaymentId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    mockRazorpayClient = new RazorpayClient('rzp_test_mock', 'test_secret_mock');
    
    // Mock the Razorpay SDK for testing (prevent real API calls)
    let orderCounter = 0;
    (mockRazorpayClient as any).razorpayInstance = {
      orders: {
        create: async (params: any) => ({
          id: `order_test_${++orderCounter}_${Date.now()}`,
        }),
      },
    };

    orderService = new OrderService(TestDataSource);
    paymentService = new PaymentService(TestDataSource, mockRazorpayClient);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/webhooks', createWebhooksRouter(TestDataSource));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  afterEach(async () => {
    const queryRunner = TestDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Delete in correct order respecting foreign keys
      await queryRunner.query('DELETE FROM "recommendation_events"');
      await queryRunner.query('DELETE FROM "recommendations"');
      await queryRunner.query('DELETE FROM "webhook_events"');
      await queryRunner.query('DELETE FROM "payment_attempts"');
      await queryRunner.query('DELETE FROM "payments"');
      await queryRunner.query('DELETE FROM "order_items"');
      await queryRunner.query('DELETE FROM "orders"');
      await queryRunner.query('DELETE FROM "cart_items"');
      await queryRunner.query('DELETE FROM "carts"');
      await queryRunner.query('DELETE FROM "inventory"');
      await queryRunner.query('DELETE FROM "products"');
      await queryRunner.query('DELETE FROM "customers"');
    } finally {
      await queryRunner.release();
    }
  });

  beforeEach(async () => {
    // Create customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `webhook-test-${Date.now()}@test.com`,
      name: 'Webhook Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      price_cents: 50000,
      category: 'test',
    });
    const savedProduct = await productRepo.save(product);
    testProductId = savedProduct.id;

    // Create inventory
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: testProductId,
      quantity_on_hand: 100,
      reserved: 0,
    });
    await inventoryRepo.save(inventory);

    // Create cart
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({
      customer_id: testCustomerId,
      status: 'active',
    });
    const savedCart = await cartRepo.save(cart);

    // Add item to cart
    const cartItemRepo = TestDataSource.getRepository(CartItem);
    const cartItem = cartItemRepo.create({
      cart_id: savedCart.id,
      product_id: testProductId,
      quantity: 2,
      price_cents: 50000,
    });
    await cartItemRepo.save(cartItem);

    // Create order
    const order = await orderService.createOrderFromCart(savedCart.id, testCustomerId);
    testOrderId = order.id;

    // Create payment
    const paymentResponse = await paymentService.createPaymentAttempt(testOrderId);
    testPaymentId = 'pay_test_123'; // Mock payment ID
  });

  describe('POST /api/webhooks/razorpay', () => {
    it('should store webhook event even if payment not yet verified', async () => {
      // In real scenario, Razorpay sends webhook after payment succeeds
      // but before client calls /verify
      const webhookData = {
        id: 'webhook_' + Date.now(),
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123_from_webhook',
              amount: 100000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('processed');

      // Verify webhook event was stored
      const webhookEventRepo = TestDataSource.getRepository(WebhookEvent);
      const webhookEvent = await webhookEventRepo.findOne({
        where: { webhook_id: webhookData.id },
      });

      expect(webhookEvent).toBeDefined();
      expect(webhookEvent?.event_type).toBe('payment.captured');
      expect(webhookEvent?.status).toBe('processed');
    });

    it('should reject missing X-Razorpay-Signature header', async () => {
      const webhookData = {
        id: 'webhook_' + Date.now(),
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: testPaymentId },
          },
        },
      };

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing X-Razorpay-Signature');
    });

    it('should reject invalid webhook signature', async () => {
      const webhookData = {
        id: 'webhook_' + Date.now(),
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: testPaymentId },
          },
        },
      };

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'invalid_signature_12345')
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid webhook signature');
    });

    it('should be idempotent - duplicate webhook returns 200', async () => {
      const webhookData = {
        id: 'webhook_idempotent_test',
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_dup_test',
              amount: 100000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      // First webhook
      const response1 = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      expect(response1.status).toBe(200);
      expect(response1.body.status).toBe('processed');

      // Second webhook (duplicate)
      const response2 = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      expect(response2.status).toBe(200);
      expect(response2.body.status).toBe('processed');
      expect(response2.body.message).toContain('already processed');

      // Verify only one webhook event was recorded
      const webhookEventRepo = TestDataSource.getRepository(WebhookEvent);
      const events = await webhookEventRepo.find({
        where: { webhook_id: 'webhook_idempotent_test' },
      });
      expect(events.length).toBe(1);
    });

    it('should handle malformed payload gracefully', async () => {
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update('{}')
        .digest('hex');

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Malformed');
    });

    it('should handle unknown webhook events gracefully', async () => {
      const webhookData = {
        id: 'webhook_' + Date.now(),
        event: 'invoice.paid',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_unknown_event',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      // Should still return 200 (don't fail on unknown events)
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('processed');
    });

    it('should store webhook event in database', async () => {
      const webhookId = 'webhook_store_test_' + Date.now();
      const webhookData = {
        id: webhookId,
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_store_test',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      // Verify webhook event was stored
      const webhookEventRepo = TestDataSource.getRepository(WebhookEvent);
      const webhookEvent = await webhookEventRepo.findOne({
        where: { webhook_id: webhookId },
      });

      expect(webhookEvent).toBeDefined();
      expect(webhookEvent?.event_type).toBe('payment.captured');
      expect(webhookEvent?.status).toBe('processed');
      expect(webhookEvent?.payload).toEqual(webhookData);
      expect(webhookEvent?.processed_at).toBeDefined();
    });

    it('should reject webhook missing webhook ID', async () => {
      const webhookData = {
        // id is missing
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: { id: 'pay_test' },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing webhook ID');
    });

    it('should handle payment.authorized webhook', async () => {
      const webhookData = {
        id: 'webhook_' + Date.now(),
        event: 'payment.authorized',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_auth_test',
              amount: 100000,
              currency: 'INR',
              status: 'authorized',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookData);
      const signature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', signature)
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('processed');
    });
  });
});
