import express, { Express } from 'express';
import request from 'supertest';
import { createPaymentsRouter } from './payments.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { PaymentService } from '../services/PaymentService.js';
import { EmailService } from '../services/EmailService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Razorpay Payment Flow & Resend Test Safety Guardrails', () => {
  let app: Express;
  let paymentService: PaymentService;
  let customer: Customer;
  let order: Order;

  beforeAll(async () => {
    await initializeTestDatabase();
    paymentService = new PaymentService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/payments', createPaymentsRouter(paymentService));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clear relevant database tables before each test
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE audit_logs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, orders, customers CASCADE');
    await qr.release();

    const customerRepo = TestDataSource.getRepository(Customer);
    customer = await customerRepo.save(
      customerRepo.create({
        email: 'checkout.user@gmail.com',
        name: 'Checkout User',
        role: 'customer',
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: `ORD-TEST-${Date.now()}`,
        status: 'pending',
        subtotal_cents: 250000,
        tax_cents: 0,
        discount_cents: 0,
        total_cents: 250000,
        items: [],
      })
    );
  });

  it('1. Checkout initialization (/payments/create) creates PaymentAttempt without calling /payments/fail', async () => {
    const res = await request(app)
      .post('/api/payments/create')
      .send({ order_id: order.id });

    expect(res.status).toBe(200);
    expect(res.body.razorpay_order_id).toBeDefined();
    expect(res.body.order_id).toBe(order.id);

    // Verify order status is still pending and no failure was recorded
    const orderRepo = TestDataSource.getRepository(Order);
    const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('pending');

    const failureRepo = TestDataSource.getRepository(PaymentFailure);
    const failures = await failureRepo.find();
    expect(failures.length).toBe(0);
  });

  it('2. Genuine payment failure calls /payments/fail exactly once and records payment failure', async () => {
    // Create initial payment attempt
    await request(app)
      .post('/api/payments/create')
      .send({ order_id: order.id });

    // Call /payments/fail with genuine error context
    const failRes = await request(app)
      .post('/api/payments/fail')
      .send({
        order_id: order.id,
        reason: 'Card declined by issuing bank',
        error_context: {
          code: 'BAD_REQUEST_ERROR',
          reason: 'payment_failed',
          metadata: { payment_id: 'pay_fail_attempt_1' },
        },
      });

    expect(failRes.status).toBe(200);

    const failureRepo = TestDataSource.getRepository(PaymentFailure);
    const failures = await failureRepo.find();
    expect(failures.length).toBe(1);
    expect(failures[0].failure_count).toBe(1);

    const paymentRepo = TestDataSource.getRepository(Payment);
    const payment = await paymentRepo.findOne({ where: { order_id: order.id } });
    expect(payment?.status).toBe('failed');
  });

  it('3. Duplicate /payments/fail calls do not duplicate recovery cases', async () => {
    await request(app)
      .post('/api/payments/create')
      .send({ order_id: order.id });

    // First failure call
    await request(app)
      .post('/api/payments/fail')
      .send({
        order_id: order.id,
        reason: 'Payment timed out',
        error_context: { metadata: { payment_id: 'pay_fail_dup_1' } },
      });

    // Duplicate failure call
    await request(app)
      .post('/api/payments/fail')
      .send({
        order_id: order.id,
        reason: 'Payment timed out',
        error_context: { metadata: { payment_id: 'pay_fail_dup_1' } },
      });

    const failureRepo = TestDataSource.getRepository(PaymentFailure);
    const failures = await failureRepo.find();
    expect(failures.length).toBe(1);
    expect(failures[0].failure_count).toBe(2);
  });

  it('4. Payment Retry uses the SAME application order ID and creates attempt #2', async () => {
    // Attempt #1
    const create1 = await request(app)
      .post('/api/payments/create')
      .send({ order_id: order.id });
    expect(create1.body.attempt_number).toBe(1);

    // Fail attempt #1
    await request(app)
      .post('/api/payments/fail')
      .send({ order_id: order.id, reason: 'Failed' });

    // Retry: Attempt #2 on SAME order ID
    const create2 = await request(app)
      .post('/api/payments/create')
      .send({ order_id: order.id });
    expect(create2.status).toBe(200);
    expect(create2.body.attempt_number).toBe(2);
    expect(create2.body.order_id).toBe(order.id);

    const attemptRepo = TestDataSource.getRepository(PaymentAttempt);
    const attempts = await attemptRepo.find({ where: { order_id: order.id } });
    expect(attempts.length).toBe(2);
  });

  it('5. Jest test execution NEVER calls live Resend API over network', async () => {
    const emailService = new EmailService();

    // Verify live Resend call is suppressed in test environment
    const result = await emailService.sendRecoveryNotification(
      'test.user@example.com',
      'Test User',
      'ORD-100',
      { amount: 1000, reason: 'Card declined', recoveryLink: 'http://localhost/rec' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');
  });
});
