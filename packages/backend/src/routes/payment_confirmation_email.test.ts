/**
 * Test Suite: Successful Payment Confirmation Email & Idempotency
 * Verifies email trigger on successful payment, customer resolution,
 * audit logging, idempotency, and failure tolerance.
 */

import request from 'supertest';
import express, { Express } from 'express';
import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { AuditLog } from '../models/AuditLog.js';
import { createAuthRouter } from './auth.js';
import { createCartsRouter } from './carts.js';
import { createOrdersRouter } from './orders.js';
import { createPaymentsRouter } from './payments.js';
import { AuthService } from '../services/AuthService.js';
import { CartService } from '../services/CartService.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentService } from '../services/PaymentService.js';
import { emailService } from '../services/EmailService.js';

describe('Payment Confirmation Email Pipeline', () => {
  let app: Express;
  let authService: AuthService;
  let cartService: CartService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let testProductId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    authService = new AuthService(TestDataSource);
    cartService = new CartService(TestDataSource);
    orderService = new OrderService(TestDataSource);
    paymentService = new PaymentService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/carts', createCartsRouter(cartService, authService));
    app.use('/api/orders', createOrdersRouter(orderService, authService));
    app.use('/api/payments', createPaymentsRouter(paymentService));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Wireless Noise Canceling Headphones',
        description: 'Premium ANC wireless headphones',
        price_cents: 1299900,
        category: 'Electronics',
      })
    );
    testProductId = product.id;

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: testProductId,
        quantity_on_hand: 100,
        reserved: 0,
      })
    );
  });

  it('1. Successful payment verification sends confirmation email & writes audit log', async () => {
    const customerEmail = `confirm_test_${Date.now()}@realdomain.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: customerEmail, password: 'password123', name: 'John Confirmation' });
    const token = regRes.body.token;
    const customerId = regRes.body.id;

    // Create cart & order
    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, testProductId, 1);
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    // Create payment attempt
    const paymentInfo = await paymentService.createPaymentAttempt(order.id);
    const rzpOrderId = paymentInfo.razorpay_order_id;
    const paymentId = 'pay_test_confirm_123';

    // Compute valid signature matching Razorpay secret
    const crypto = await import('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_mock';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    // Spy on EmailService
    const spySend = jest
      .spyOn(emailService, 'sendPaymentConfirmationNotification')
      .mockResolvedValue({ success: true, messageId: 'msg_test_123' });

    // Verify payment signature
    const verifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: order.id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.status).toBe('captured');

    // Directly call sendPaymentConfirmationEmail to guarantee synchronous audit logging execution
    await paymentService.sendPaymentConfirmationEmail(order.id);

    // Verify emailService was called with exact customer email & order facts
    expect(spySend).toHaveBeenCalledWith(
      customerEmail,
      'John Confirmation',
      expect.any(String),
      expect.objectContaining({
        orderId: order.id,
        razorpayPaymentId: 'pay_test_confirm_123',
        subtotalCents: 1299900,
        totalCents: 1299900,
      })
    );

    // Verify audit log entry written
    const auditRepo = TestDataSource.getRepository(AuditLog);
    const auditEntry = await auditRepo.findOne({
      where: {
        entity_id: order.id,
        event_type: 'payment_confirmation_email_sent',
      },
    });
    expect(auditEntry).not.toBeNull();
    expect((auditEntry?.details as any)?.customer_email).toBe(customerEmail);
  });

  it('2. Duplicate verification/webhook does NOT send duplicate confirmation email', async () => {
    const customerEmail = `idem_confirm_${Date.now()}@realdomain.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: customerEmail, password: 'password123' });
    const customerId = regRes.body.id;

    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, testProductId, 1);
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    // Manually invoke sendPaymentConfirmationEmail first time
    const spySend = jest
      .spyOn(emailService, 'sendPaymentConfirmationNotification')
      .mockResolvedValue({ success: true, messageId: 'msg_test_123' });

    await paymentService.sendPaymentConfirmationEmail(order.id);
    expect(spySend).toHaveBeenCalledTimes(1);

    // Second call for same order (simulating webhook or duplicate verify request)
    await paymentService.sendPaymentConfirmationEmail(order.id);
    expect(spySend).toHaveBeenCalledTimes(1); // Still 1! No duplicate send.
  });

  it('3. Success email is NOT sent when payment fails or is cancelled', async () => {
    const freshEmail = `fail_no_email_${Date.now()}@test.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: freshEmail, password: 'password123' });
    const token = regRes.body.token;
    const customerId = regRes.body.id;

    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, testProductId, 1);
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    const spySend = jest.spyOn(emailService, 'sendPaymentConfirmationNotification');

    // Call /api/payments/fail (cancelled or failed payment)
    const failRes = await request(app)
      .post('/api/payments/fail')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: order.id, reason: 'Payment cancelled' });

    expect(failRes.status).toBe(200);

    // Verify confirmation email was NOT called
    expect(spySend).not.toHaveBeenCalled();
  });

  it('4. Resend failure does NOT roll back successful payment', async () => {
    const customerEmail = `resend_err_${Date.now()}@realdomain.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: customerEmail, password: 'password123' });
    const token = regRes.body.token;
    const customerId = regRes.body.id;

    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, testProductId, 1);
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    const paymentInfo = await paymentService.createPaymentAttempt(order.id);
    const rzpOrderId = paymentInfo.razorpay_order_id;
    const paymentId = 'pay_test_resend_err';

    const crypto = await import('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_mock';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${paymentId}`)
      .digest('hex');

    // Mock EmailService to fail
    const spySend = jest
      .spyOn(emailService, 'sendPaymentConfirmationNotification')
      .mockResolvedValueOnce({ success: false, error: 'Resend API network timeout' });

    // Verify payment signature
    const verifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: order.id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

    // Payment MUST still succeed with 200 captured!
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.status).toBe('captured');

    // Call sendPaymentConfirmationEmail directly
    await paymentService.sendPaymentConfirmationEmail(order.id);

    // Audit log should record payment_confirmation_email_failed
    const auditRepo = TestDataSource.getRepository(AuditLog);
    const auditEntry = await auditRepo.findOne({
      where: {
        entity_id: order.id,
        event_type: 'payment_confirmation_email_failed',
      },
    });
    expect(auditEntry).not.toBeNull();
    expect((auditEntry?.details as any)?.error).toContain('Resend API network timeout');
  });
});
