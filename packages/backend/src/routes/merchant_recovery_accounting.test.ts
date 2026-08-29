import express, { Express } from 'express';
import request from 'supertest';
import { createMerchantRouter } from './merchant.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Merchant Recovery Revenue Accounting Integration Tests', () => {
  let testApp: Express;
  let analyticsService: AnalyticsService;
  let authService: AuthService;

  let testCustomer: Customer;
  let merchantCustomer: Customer;
  let merchantToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    analyticsService = new AnalyticsService(TestDataSource);
    authService = new AuthService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    
    // Save customer for merchant auth
    merchantCustomer = await customerRepo.save(
      customerRepo.create({
        email: `merchant-user-${Date.now()}-${Math.random()}@test.com`,
        name: 'Merchant Tester',
        role: 'merchant',
      })
    );

    // Save merchant entity matching id
    const merchantRepo = TestDataSource.getRepository(Merchant);
    await merchantRepo.save(
      merchantRepo.create({
        id: merchantCustomer.id,
        email: merchantCustomer.email,
        name: merchantCustomer.name,
        status: 'active',
      })
    );

    testCustomer = await customerRepo.save(
      customerRepo.create({
        email: `customer-acct-${Date.now()}-${Math.random()}@test.com`,
        name: 'Customer Acct Tester',
        role: 'customer',
      })
    );

    merchantToken = authService.generateToken({
      id: merchantCustomer.id,
      email: merchantCustomer.email,
      role: 'merchant',
    });
  });

  it('verifies 8 merchant recovery accounting scenarios correctly', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const paymentRepo = TestDataSource.getRepository(Payment);
    const pfRepo = TestDataSource.getRepository(PaymentFailure);

    // Initial baseline metrics check
    const initialMetrics = await analyticsService.getDashboardMetrics();
    const baselineRevenue = initialMetrics.total_revenue_cents;
    const baselineAtRisk = initialMetrics.revenue_at_risk_cents;
    const baselineRecovered = initialMetrics.revenue_recovered_cents;
    const baselineFailures = initialMetrics.failed_payments_count;

    const initialRes = await request(testApp)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(initialRes.status).toBe(200);

    // Scenario 8: Normal successful order (no prior failure)
    const normalOrderEntity = orderRepo.create({
      customer_id: testCustomer.id,
      order_number: `ORD-NORM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'confirmed',
      subtotal_cents: 500000,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 500000, // ₹5,000
      items: [],
    } as any);
    const normalOrder = (await orderRepo.save(normalOrderEntity as any)) as unknown as Order;

    await paymentRepo.save(
      paymentRepo.create({
        order_id: normalOrder.id,
        amount_cents: 500000,
        status: 'captured',
        razorpay_order_id: 'rzp_normal_' + Date.now(),
        razorpay_payment_id: 'pay_normal_' + Date.now(),
      } as any)
    );

    const normalMetrics = await analyticsService.getDashboardMetrics();
    expect(normalMetrics.total_revenue_cents - baselineRevenue).toBe(500000);
    expect(normalMetrics.revenue_recovered_cents - baselineRecovered).toBe(0);

    // Scenario 1 & 2: Order payment fails -> at-risk increases & failure count increases
    const failedOrderEntity = orderRepo.create({
      customer_id: testCustomer.id,
      order_number: `ORD-FAIL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'pending',
      subtotal_cents: 300000,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 300000, // ₹3,000
      items: [],
    } as any);
    const failedOrder = (await orderRepo.save(failedOrderEntity as any)) as unknown as Order;

    const failedPaymentEntity = paymentRepo.create({
      order_id: failedOrder.id,
      amount_cents: 300000,
      status: 'failed',
      failure_reason: 'Card declined',
      razorpay_order_id: 'rzp_failed_' + Date.now(),
    } as any);
    const failedPayment = (await paymentRepo.save(failedPaymentEntity as any)) as unknown as Payment;

    await pfRepo.save(
      pfRepo.create({
        payment_id: failedPayment.id,
        reason: 'card_declined' as any,
        failure_count: 1,
        last_failure_at: new Date(),
      })
    );

    const atRiskMetrics = await analyticsService.getDashboardMetrics();
    expect(atRiskMetrics.revenue_at_risk_cents - baselineAtRisk).toBe(300000);
    expect(atRiskMetrics.failed_payments_count - baselineFailures).toBe(1);

    // Scenario 3, 4 & 5: Customer retries & recovers payment -> order status updated to confirmed, payment captured
    failedOrder.status = 'confirmed';
    await orderRepo.save(failedOrder);

    failedPayment.status = 'captured';
    failedPayment.razorpay_payment_id = 'pay_recovered_' + Date.now();
    await paymentRepo.save(failedPayment);

    const recoveredMetrics = await analyticsService.getDashboardMetrics();
    expect(recoveredMetrics.revenue_at_risk_cents - baselineAtRisk).toBe(0); // At-risk decreased back to 0
    expect(recoveredMetrics.revenue_recovered_cents - baselineRecovered).toBe(300000); // Recovered revenue increased by 300000
    expect(recoveredMetrics.total_revenue_cents - baselineRevenue).toBe(800000); // 500000 + 300000

    // Scenario 6: Failed payment historical count remains unchanged (+1) after successful retry
    expect(recoveredMetrics.failed_payments_count - baselineFailures).toBe(1);

    // Scenario 7: Duplicate webhook / payment success check does not double count recovered revenue
    const duplicateMetrics = await analyticsService.getDashboardMetrics();
    expect(duplicateMetrics.revenue_recovered_cents - baselineRecovered).toBe(300000);
  });
});
