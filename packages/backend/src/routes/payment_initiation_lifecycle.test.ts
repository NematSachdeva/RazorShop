import express, { Express } from 'express';
import request from 'supertest';
import { createPaymentsRouter } from './payments.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { Inventory } from '../models/Inventory.js';
import { PaymentService } from '../services/PaymentService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Payment Initiation & Lifecycle State Integration Tests', () => {
  let testApp: Express;
  let paymentService: PaymentService;

  let testCustomer: Customer;
  let testProduct: Product;
  let testOrder: Order;

  beforeAll(async () => {
    await initializeTestDatabase();
    paymentService = new PaymentService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/payments', createPaymentsRouter(paymentService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_timeline, order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    const customerRepo = TestDataSource.getRepository(Customer);
    testCustomer = await customerRepo.save(
      customerRepo.create({
        email: `pay-init-${Date.now()}-${Math.random()}@test.com`,
        name: 'Pay Tester',
        role: 'customer',
      })
    );

    const productRepo = TestDataSource.getRepository(Product);
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    testProduct = await productRepo.save(
      productRepo.create({
        name: 'Init Test Product ' + Date.now(),
        description: 'Test product',
        price_cents: 150000,
        category: 'Technology',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: testProduct.id,
        quantity_on_hand: 20,
        reserved: 0,
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    const newOrder = orderRepo.create({
      customer_id: testCustomer.id,
      order_number: `ORD-INIT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'pending',
      subtotal_cents: 150000,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 150000,
      items: [
        {
          product_id: testProduct.id,
          quantity: 1,
          price_cents: 150000,
          unit_price_cents: 150000,
          line_total_cents: 150000,
        } as any,
      ],
    } as any);
    testOrder = (await orderRepo.save(newOrder as any)) as unknown as Order;
  });

  it('1. Initializes payment once, returning valid razorpay_order_id without failure state', async () => {
    const res = await request(testApp)
      .post('/api/payments/create')
      .send({ order_id: testOrder.id });

    expect(res.status).toBe(200);
    expect(res.body.razorpay_order_id).toBeDefined();
    expect(res.body.amount_cents).toBe(150000);

    const orderRepo = TestDataSource.getRepository(Order);
    const updatedOrder = await orderRepo.findOne({ where: { id: testOrder.id } });
    expect(updatedOrder?.status).toBe('pending');
  });

  it('2. Is idempotent when concurrent or duplicate create payment calls arrive', async () => {
    const [res1, res2] = await Promise.all([
      request(testApp).post('/api/payments/create').send({ order_id: testOrder.id }),
      request(testApp).post('/api/payments/create').send({ order_id: testOrder.id }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.razorpay_order_id).toBe(res2.body.razorpay_order_id);
  });

  it('3. Creates failure and RecoveryCase only when POST /api/payments/fail is explicitly called', async () => {
    const createRes = await request(testApp)
      .post('/api/payments/create')
      .send({ order_id: testOrder.id });
    expect(createRes.status).toBe(200);

    const failRes = await request(testApp)
      .post('/api/payments/fail')
      .send({ order_id: testOrder.id, reason: 'Card declined' });

    expect(failRes.status).toBe(200);
    expect(failRes.body.status).toBe('failed');
  });

  it('4. Creates subsequent attempt when payment is retried after a failure', async () => {
    await request(testApp).post('/api/payments/create').send({ order_id: testOrder.id });
    await request(testApp).post('/api/payments/fail').send({ order_id: testOrder.id, reason: 'Insufficient funds' });

    const retryRes = await request(testApp)
      .post('/api/payments/create')
      .send({ order_id: testOrder.id });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.razorpay_order_id).toBeDefined();
  });
});
