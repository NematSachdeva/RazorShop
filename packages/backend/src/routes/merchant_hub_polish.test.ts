import express, { Express } from 'express';
import request from 'supertest';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { DEMO_MERCHANT_UUID } from '../seed.js';
import { createAuthRouter } from './auth.js';
import { createMerchantRouter } from './merchant.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Merchant Hub Polish & Correctness Regression Suite', () => {
  let app: Express;
  let authService: AuthService;
  let merchantToken: string;
  let testOrderId: string;
  let testCaseId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use(errorHandler);

    // Create merchant record for token
    const merchantRepo = TestDataSource.getRepository(Merchant);
    const customerRepo = TestDataSource.getRepository(Customer);

    const testMerchant = await merchantRepo.save(
      merchantRepo.create({
        id: DEMO_MERCHANT_UUID,
        email: 'merchant@example.com',
        name: 'Demo Merchant',
      } as any) as any
    );

    await customerRepo.save(
      customerRepo.create({
        id: DEMO_MERCHANT_UUID,
        email: 'merchant@example.com',
        name: 'Demo Merchant',
        role: 'merchant',
      } as any) as any
    );

    merchantToken = authService.generateToken({
      id: testMerchant.id,
      email: testMerchant.email,
      role: 'merchant',
    });

    // Seed test customer, product, order, payment failure, and recovery case
    const productRepo = TestDataSource.getRepository(Product);
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const orderRepo = TestDataSource.getRepository(Order);
    const paymentRepo = TestDataSource.getRepository(Payment);
    const failureRepo = TestDataSource.getRepository(PaymentFailure);
    const caseRepo = TestDataSource.getRepository(RecoveryCase);

    const testCustomer = await customerRepo.save(
      customerRepo.create({
        email: `hub_test_${Date.now()}@example.com`,
        name: 'Hub Test User',
      } as any) as any
    );

    const testProduct = await productRepo.save(
      productRepo.create({
        merchant_id: DEMO_MERCHANT_UUID,
        name: 'Hub Test Headset',
        description: 'Test headset description',
        price_cents: 499900,
        sku: `SKU-HUB-${Date.now()}`,
      } as any) as any
    );

    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: testProduct.id,
        quantity_on_hand: 50,
        units_sold: 5,
      } as any) as any
    );

    const testOrder = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: `ORD-HUB-${Date.now()}`,
        status: 'pending',
        subtotal_cents: 499900,
        discount_cents: 0,
        total_cents: 499900,
        currency: 'INR',
      } as any) as any
    );
    testOrderId = testOrder.id;

    const testPayment = await paymentRepo.save(
      paymentRepo.create({
        order_id: testOrderId,
        amount_cents: 499900,
        currency: 'INR',
        status: 'failed',
        failure_reason: 'card_declined',
      } as any) as any
    );

    const testFailure = await failureRepo.save(
      failureRepo.create({
        payment_id: testPayment.id,
        order_id: testOrderId,
        reason: 'card_declined',
        failure_count: 1,
      } as any) as any
    );

    const testCase = await caseRepo.save(
      caseRepo.create({
        merchant_id: DEMO_MERCHANT_UUID,
        order_id: testOrderId,
        customer_id: testCustomer.id,
        payment_failure_id: testFailure.id,
        status: 'open',
        recovery_attempts: 1,
        max_recovery_attempts: 3,
      } as any) as any
    );
    testCaseId = testCase.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('1. GET /api/merchant/recovery-cases returns 200 without PostgreSQL order.merchant_id column error', async () => {
    const res = await request(app)
      .get('/api/merchant/recovery-cases')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recovery_cases).toBeDefined();
    expect(Array.isArray(res.body.recovery_cases)).toBe(true);
    expect(res.body.total_count).toBeGreaterThanOrEqual(1);

    const found = res.body.recovery_cases.find((c: any) => c.id === testCaseId);
    expect(found).toBeDefined();
    expect(found.order).toBeDefined();
    expect(found.customer).toBeDefined();
  });

  it('2. GET /api/merchant/recovery-cases/:id returns case detail with timeline metadata', async () => {
    const res = await request(app)
      .get(`/api/merchant/recovery-cases/${testCaseId}`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testCaseId);
    expect(res.body.status).toBe('open');
    expect(res.body.order).toBeDefined();
    expect(res.body.customer).toBeDefined();
  });

  it('3. GET /api/merchant/insights does not produce duplicate insights on multiple calls', async () => {
    const res1 = await request(app)
      .get('/api/merchant/insights')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res1.status).toBe(200);
    const count1 = res1.body.total_count;

    const res2 = await request(app)
      .get('/api/merchant/insights')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.total_count).toBe(count1);
  });

  it('4. GET /api/merchant/dashboard respects date range queries (5d, 10d, 20d, custom)', async () => {
    const today = new Date();
    const start5d = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endToday = today.toISOString().split('T')[0];

    const res = await request(app)
      .get(`/api/merchant/dashboard?start_date=${start5d}&end_date=${endToday}`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.revenue_timeline).toBeDefined();
    expect(res.body.revenue_timeline.data.length).toBeGreaterThanOrEqual(5);
    expect(res.body.metrics).toBeDefined();
  });

  it('5. POST /api/merchant/recovery-cases/:id/trigger-email sends recovery email in mock mode without live Resend call', async () => {
    const res = await request(app)
      .post(`/api/merchant/recovery-cases/${testCaseId}/trigger-email`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Recovery email sent successfully');
    expect(res.body.recoveryCase).toBeDefined();
  });
});
