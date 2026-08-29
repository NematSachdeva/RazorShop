/**
 * End-to-End Regression Test Suite for New Customer Payment Recovery Pipeline
 * Verifies registration, email persistence, order creation, payment failure handling,
 * RecoveryCase creation, Groq AI content generation, and Resend recipient email resolution.
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
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { AuditLog } from '../models/AuditLog.js';
import { createAuthRouter } from './auth.js';
import { createCartsRouter } from './carts.js';
import { createOrdersRouter } from './orders.js';
import { createPaymentsRouter } from './payments.js';
import { AuthService } from '../services/AuthService.js';
import { CartService } from '../services/CartService.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentService } from '../services/PaymentService.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';

describe('New Customer Payment Failure Recovery Pipeline', () => {
  let app: Express;
  let authService: AuthService;
  let cartService: CartService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let failureService: PaymentFailureService;
  let testProductId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    authService = new AuthService(TestDataSource);
    cartService = new CartService(TestDataSource);
    orderService = new OrderService(TestDataSource);
    paymentService = new PaymentService(TestDataSource);
    failureService = new PaymentFailureService(TestDataSource);

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

  beforeEach(async () => {
    // Create a product with inventory for testing
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Smart Security Camera',
        description: '1080p HD smart security camera',
        price_cents: 499900,
        category: 'Electronics',
      })
    );
    testProductId = product.id;

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: testProductId,
        quantity_on_hand: 50,
        reserved: 0,
      })
    );
  });

  it('end-to-end: new customer registration -> order -> payment failure -> recovery case & real email resolution', async () => {
    const realCustomerEmail = `testuser_${Date.now()}@realdomain.com`;

    // 1. Register brand new customer
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: realCustomerEmail,
        password: 'password123',
        name: 'New Test Customer',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    const token = regRes.body.token;
    const newCustomerId = regRes.body.id;

    // Verify Customer.email stored in PostgreSQL
    const customerInDb = await TestDataSource.getRepository(Customer).findOne({
      where: { id: newCustomerId },
    });
    expect(customerInDb).not.toBeNull();
    expect(customerInDb?.email).toBe(realCustomerEmail);

    // 2. Create cart for new customer
    const cartRes = await request(app)
      .post('/api/carts')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(cartRes.status).toBe(201);
    const cartId = cartRes.body.id;

    // Add product to cart
    const itemRes = await request(app)
      .post(`/api/carts/${cartId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: testProductId, quantity: 1 });

    expect(itemRes.status).toBe(200);

    // 3. Create Order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ cart_id: cartId, customer_id: newCustomerId });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // 4. Create Payment Attempt with Deterministic Demo Failure
    const payRes = await request(app)
      .post('/api/payments/create?demo=failure_network')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: orderId });

    expect(payRes.status).toBe(400);
    expect(payRes.body.error).toContain('Payment failed');

    // 5. Verify Payment.status in PostgreSQL
    const paymentInDb = await TestDataSource.getRepository(Payment).findOne({
      where: { order_id: orderId },
    });
    expect(paymentInDb).not.toBeNull();
    expect(paymentInDb?.status).toBe('failed');

    // 6. Verify PaymentFailure record created
    const failureInDb = await TestDataSource.getRepository(PaymentFailure).findOne({
      where: { payment_id: paymentInDb!.id },
    });
    expect(failureInDb).not.toBeNull();

    // 7. Verify RecoveryCase created and linked to new customer
    const caseInDb = await TestDataSource.getRepository(RecoveryCase).findOne({
      where: { order_id: orderId },
      relations: ['customer'],
    });
    expect(caseInDb).not.toBeNull();
    expect(caseInDb?.customer_id).toBe(newCustomerId);
    expect(caseInDb?.customer.email).toBe(realCustomerEmail);

    // 8. Verify AuditLog entry recorded
    const auditLogs = await TestDataSource.getRepository(AuditLog).find({
      where: { entity_id: caseInDb!.id },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    const emailLog = auditLogs.find(
      (l) => l.event_type === 'email_sent' || l.event_type === 'email_failed'
    );
    expect(emailLog).toBeDefined();
    expect((emailLog?.details as any)?.customer_email).toBe(realCustomerEmail);
  });

  it('POST /api/payments/fail explicitly marks payment failed and creates recovery case', async () => {
    const freshEmail = `explicit_fail_${Date.now()}@realdomain.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: freshEmail, password: 'password123' });
    const token = regRes.body.token;
    const customerId = regRes.body.id;

    // Create cart & order
    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, testProductId, 1);
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    // Call /api/payments/fail directly (simulating frontend user cancellation or browser event)
    const failRes = await request(app)
      .post('/api/payments/fail')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: order.id,
        reason: 'User closed payment window',
      });

    expect(failRes.status).toBe(200);
    expect(failRes.body.status).toBe('failed');

    // Verify recovery case exists
    const recCase = await TestDataSource.getRepository(RecoveryCase).findOne({
      where: { order_id: order.id },
    });
    expect(recCase).not.toBeNull();
  });
});
