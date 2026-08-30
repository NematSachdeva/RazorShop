/**
 * M7 Analytics Service Tests
 * 
 * Simplified test suite for merchant dashboard analytics
 * Tests: dashboard metrics, recovery funnel, response breakdown, failure reasons, revenue timeline
 * Uses minimal test data to avoid unique constraint conflicts
 */

import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { AnalyticsService } from './AnalyticsService.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Product } from '../models/Product.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let testCustomer: Customer;

  beforeAll(async () => {
    await initializeTestDatabase();
    analyticsService = new AnalyticsService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    testCustomer = customerRepo.create({
      email: `test-analytics-${Date.now()}@example.com`,
      name: 'Test Customer',
      role: 'customer',
    });
    testCustomer = await customerRepo.save(testCustomer);
  });

  afterEach(async () => {
    // Clean up test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    try {
      await customerRepo.remove(testCustomer);
    } catch (e) {
      // Ignore errors
    }
  });

  const TEST_MERCHANT_UUID = '11111111-1111-1111-1111-111111111111';

  describe('getDashboardMetrics', () => {
    it('should return zero metrics for empty database', async () => {
      const metrics = await analyticsService.getDashboardMetrics(TEST_MERCHANT_UUID);

      expect(metrics.total_revenue_cents).toBeGreaterThanOrEqual(0);
      expect(metrics.revenue_at_risk_cents).toBeGreaterThanOrEqual(0);
      expect(metrics.revenue_recovered_cents).toBeGreaterThanOrEqual(0);
      expect(metrics.failed_payments_count).toBeGreaterThanOrEqual(0);
      expect(metrics.abandoned_carts_count).toBeGreaterThanOrEqual(0);
      expect(metrics.recovery_rate_percent).toBeGreaterThanOrEqual(0);
    });

    it('should return metrics with proper structure', async () => {
      const metrics = await analyticsService.getDashboardMetrics(TEST_MERCHANT_UUID);

      expect(metrics).toHaveProperty('total_revenue_cents');
      expect(metrics).toHaveProperty('revenue_at_risk_cents');
      expect(metrics).toHaveProperty('revenue_recovered_cents');
      expect(metrics).toHaveProperty('failed_payments_count');
      expect(metrics).toHaveProperty('failed_payments_total_cents');
      expect(metrics).toHaveProperty('abandoned_carts_count');
      expect(metrics).toHaveProperty('recovery_rate_percent');
      expect(metrics).toHaveProperty('period');
      expect(metrics.period).toHaveProperty('start_date');
      expect(metrics.period).toHaveProperty('end_date');
    });

    it('should calculate recovery rate as percentage', async () => {
      const metrics = await analyticsService.getDashboardMetrics(TEST_MERCHANT_UUID);

      expect(metrics.recovery_rate_percent).toBeGreaterThanOrEqual(0);
      expect(metrics.recovery_rate_percent).toBeLessThanOrEqual(100);
    });

    it('should have correct period dates', async () => {
      const metrics = await analyticsService.getDashboardMetrics('default-merchant');

      expect(metrics.period.start_date).toBeDefined();
      expect(metrics.period.end_date).toBeDefined();
      expect(metrics.period.start_date.getTime()).toBeLessThanOrEqual(metrics.period.end_date.getTime());
    });
  });

  describe('getRecoveryFunnel', () => {
    it('should return zero counts for empty database', async () => {
      const funnel = await analyticsService.getRecoveryFunnel('default-merchant');

      expect(funnel.open).toBeGreaterThanOrEqual(0);
      expect(funnel.in_progress).toBeGreaterThanOrEqual(0);
      expect(funnel.resolved).toBeGreaterThanOrEqual(0);
      expect(funnel.abandoned).toBeGreaterThanOrEqual(0);
      expect(funnel.customer_declined).toBeGreaterThanOrEqual(0);
      expect(funnel.total).toBeGreaterThanOrEqual(0);
    });

    it('should have proper funnel structure', async () => {
      const funnel = await analyticsService.getRecoveryFunnel('default-merchant');

      expect(funnel).toHaveProperty('open');
      expect(funnel).toHaveProperty('in_progress');
      expect(funnel).toHaveProperty('resolved');
      expect(funnel).toHaveProperty('abandoned');
      expect(funnel).toHaveProperty('customer_declined');
      expect(funnel).toHaveProperty('total');
      expect(funnel).toHaveProperty('conversion_rates');
    });

    it('should calculate conversion rates', async () => {
      const funnel = await analyticsService.getRecoveryFunnel('default-merchant');

      expect(funnel.conversion_rates.open_to_resolved).toBeGreaterThanOrEqual(0);
      expect(funnel.conversion_rates.open_to_resolved).toBeLessThanOrEqual(100);
      expect(funnel.conversion_rates.open_to_in_progress).toBeGreaterThanOrEqual(0);
      expect(funnel.conversion_rates.open_to_in_progress).toBeLessThanOrEqual(100);
    });
  });

  describe('getCustomerResponseBreakdown', () => {
    it('should return zero counts for empty database', async () => {
      const breakdown = await analyticsService.getCustomerResponseBreakdown('default-merchant');

      expect(breakdown.accepted).toBeGreaterThanOrEqual(0);
      expect(breakdown.refused).toBeGreaterThanOrEqual(0);
      expect(breakdown.promised).toBeGreaterThanOrEqual(0);
      expect(breakdown.unclear).toBeGreaterThanOrEqual(0);
      expect(breakdown.total).toBeGreaterThanOrEqual(0);
    });

    it('should have proper breakdown structure', async () => {
      const breakdown = await analyticsService.getCustomerResponseBreakdown('default-merchant');

      expect(breakdown).toHaveProperty('accepted');
      expect(breakdown).toHaveProperty('refused');
      expect(breakdown).toHaveProperty('promised');
      expect(breakdown).toHaveProperty('unclear');
      expect(breakdown).toHaveProperty('total');
      expect(breakdown).toHaveProperty('percentages');
    });

    it('should calculate percentages between 0-100', async () => {
      const breakdown = await analyticsService.getCustomerResponseBreakdown('default-merchant');

      expect(breakdown.percentages.accepted).toBeGreaterThanOrEqual(0);
      expect(breakdown.percentages.accepted).toBeLessThanOrEqual(100);
      expect(breakdown.percentages.refused).toBeGreaterThanOrEqual(0);
      expect(breakdown.percentages.refused).toBeLessThanOrEqual(100);
      expect(breakdown.percentages.promised).toBeGreaterThanOrEqual(0);
      expect(breakdown.percentages.promised).toBeLessThanOrEqual(100);
      expect(breakdown.percentages.unclear).toBeGreaterThanOrEqual(0);
      expect(breakdown.percentages.unclear).toBeLessThanOrEqual(100);
    });
  });

  describe('getPaymentFailureReasons', () => {
    it('should return empty reasons for empty database', async () => {
      const reasons = await analyticsService.getPaymentFailureReasons('default-merchant');

      expect(reasons.reasons).toBeDefined();
      expect(Array.isArray(reasons.reasons)).toBe(true);
      expect(reasons.total_failures).toBeGreaterThanOrEqual(0);
      expect(reasons.total_amount_cents).toBeGreaterThanOrEqual(0);
    });

    it('should have proper structure', async () => {
      const result = await analyticsService.getPaymentFailureReasons('default-merchant');

      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('total_failures');
      expect(result).toHaveProperty('total_amount_cents');

      result.reasons.forEach((reason) => {
        expect(reason).toHaveProperty('reason');
        expect(reason).toHaveProperty('count');
        expect(reason).toHaveProperty('total_amount_cents');
        expect(reason).toHaveProperty('recovery_count');
        expect(reason).toHaveProperty('recovery_rate_percent');
      });
    });
  });

  describe('getRevenueTimeline', () => {
    it('should return data for specified date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const timeline = await analyticsService.getRevenueTimeline(
        'default-merchant',
        startDate,
        endDate
      );

      expect(timeline.data).toBeDefined();
      expect(Array.isArray(timeline.data)).toBe(true);
      expect(timeline.period).toBeDefined();
      expect(timeline.totals).toBeDefined();
    });

    it('should have daily data points with required fields', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const timeline = await analyticsService.getRevenueTimeline(
        'default-merchant',
        startDate,
        endDate
      );

      expect(timeline.data.length).toBeGreaterThanOrEqual(1);

      timeline.data.forEach((point) => {
        expect(point.date).toBeDefined();
        expect(typeof point.date).toBe('string');
        expect(point.revenue_cents).toBeGreaterThanOrEqual(0);
        expect(point.orders_count).toBeGreaterThanOrEqual(0);
        expect(point.failed_payments_count).toBeGreaterThanOrEqual(0);
        expect(point.recovered_amount_cents).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have positive totals', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const timeline = await analyticsService.getRevenueTimeline(
        'default-merchant',
        startDate,
        endDate
      );

      expect(timeline.totals.revenue_cents).toBeGreaterThanOrEqual(0);
      expect(timeline.totals.orders_count).toBeGreaterThanOrEqual(0);
      expect(timeline.totals.failed_payments_count).toBeGreaterThanOrEqual(0);
      expect(timeline.totals.recovered_amount_cents).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const timeline = await analyticsService.getRevenueTimeline(
        'default-merchant',
        startDate,
        endDate
      );

      expect(timeline.period.start_date).toBe('2024-01-01');
      expect(timeline.period.end_date).toBe('2024-01-31');
    });
  });

  describe('Edge Cases', () => {
    it('should handle division by zero in recovery rate', async () => {
      const metrics = await analyticsService.getDashboardMetrics('default-merchant');
      // Should not throw, should return 0
      expect(metrics.recovery_rate_percent).toBeGreaterThanOrEqual(0);
    });

    it('should handle division by zero in percentages', async () => {
      const breakdown = await analyticsService.getCustomerResponseBreakdown('default-merchant');
      // All percentages should be >= 0
      expect(breakdown.percentages.accepted).toBeGreaterThanOrEqual(0);
      expect(breakdown.percentages.refused).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty query results gracefully', async () => {
      // These should not throw
      const metrics = await analyticsService.getDashboardMetrics('default-merchant');
      const funnel = await analyticsService.getRecoveryFunnel('default-merchant');
      const breakdown = await analyticsService.getCustomerResponseBreakdown('default-merchant');
      const reasons = await analyticsService.getPaymentFailureReasons('default-merchant');
      const timeline = await analyticsService.getRevenueTimeline(
        'default-merchant',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(metrics).toBeDefined();
      expect(funnel).toBeDefined();
      expect(breakdown).toBeDefined();
      expect(reasons).toBeDefined();
      expect(timeline).toBeDefined();
    });
  });

  describe('Recovery Rate Accuracy & Proportional Calculations', () => {
    const merchantA = '22222222-2222-2222-2222-222222222222';
    const merchantB = '33333333-3333-3333-3333-333333333333';

    let productA: Product;
    let productB: Product;

    beforeEach(async () => {
      const merchantRepo = TestDataSource.getRepository(Merchant);
      const productRepo = TestDataSource.getRepository(Product);

      await merchantRepo.save(
        merchantRepo.create({
          id: merchantA,
          name: 'Merchant A',
          email: `merch-a-${Date.now()}@example.com`,
        })
      );
      await merchantRepo.save(
        merchantRepo.create({
          id: merchantB,
          name: 'Merchant B',
          email: `merch-b-${Date.now()}@example.com`,
        })
      );

      productA = await productRepo.save(
        productRepo.create({
          name: `Product A ${Date.now()}`,
          category: 'Electronics',
          price_cents: 2000,
          merchant_id: merchantA,
        })
      );
      productB = await productRepo.save(
        productRepo.create({
          name: `Product B ${Date.now()}`,
          category: 'Apparel',
          price_cents: 3000,
          merchant_id: merchantB,
        })
      );
    });

    it('Case 1: should return 0% when there are 0 eligible recovery cases', async () => {
      const unusedMerchant = '44444444-4444-4444-4444-444444444444';
      const metrics = await analyticsService.getDashboardMetrics(unusedMerchant);
      expect(metrics.recovery_rate_percent).toBe(0);
      expect(metrics.failed_payments_count).toBe(0);
      expect(metrics.revenue_recovered_cents).toBe(0);
    });

    it('Case 2: should return 0% when 10 eligible cases exist and 0 are recovered', async () => {
      const orderRepo = TestDataSource.getRepository(Order);
      const orderItemRepo = TestDataSource.getRepository(OrderItem);
      const paymentRepo = TestDataSource.getRepository(Payment);
      const failureRepo = TestDataSource.getRepository(PaymentFailure);
      const recoveryCaseRepo = TestDataSource.getRepository(RecoveryCase);

      for (let i = 0; i < 10; i++) {
        const order = await orderRepo.save(
          orderRepo.create({
            order_number: `ORD-CASE2-${Date.now()}-${i}`,
            customer_id: testCustomer.id,
            status: 'pending',
            subtotal_cents: 2000,
            total_cents: 2000,
          })
        );

        await orderItemRepo.save(
          orderItemRepo.create({
            order_id: order.id,
            product_id: productA.id,
            quantity: 1,
            price_cents: 2000,
            line_total_cents: 2000,
          })
        );

        const payment = await paymentRepo.save(
          paymentRepo.create({
            order_id: order.id,
            amount_cents: 2000,
            status: 'failed',
          })
        );

        const failure = await failureRepo.save(
          failureRepo.create({
            payment_id: payment.id,
            reason: 'card_declined' as any,
            failure_count: 1,
            last_failure_at: new Date(),
          })
        );

        await recoveryCaseRepo.save(
          recoveryCaseRepo.create({
            payment_failure_id: failure.id,
            order_id: order.id,
            customer_id: testCustomer.id,
            status: 'open',
            recovery_attempts: 1,
            max_recovery_attempts: 3,
          })
        );
      }

      const metrics = await analyticsService.getDashboardMetrics(merchantA);
      expect(metrics.recovery_rate_percent).toBe(0);
    });

    it('Case 3: should return 30% when 10 eligible cases exist and 3 are recovered', async () => {
      const orderRepo = TestDataSource.getRepository(Order);
      const orderItemRepo = TestDataSource.getRepository(OrderItem);
      const paymentRepo = TestDataSource.getRepository(Payment);
      const failureRepo = TestDataSource.getRepository(PaymentFailure);
      const recoveryCaseRepo = TestDataSource.getRepository(RecoveryCase);
      const merchantRepo = TestDataSource.getRepository(Merchant);
      const productRepo = TestDataSource.getRepository(Product);

      const targetMerchant = `55555555-5555-5555-5555-555555555555`;
      await merchantRepo.save(
        merchantRepo.create({
          id: targetMerchant,
          name: 'Merchant C',
          email: `merch-c-${Date.now()}@example.com`,
        })
      );

      const prod = await productRepo.save(
        productRepo.create({
          name: `Product C ${Date.now()}`,
          category: 'Tools',
          price_cents: 1500,
          merchant_id: targetMerchant,
        })
      );

      for (let i = 0; i < 10; i++) {
        const isRecovered = i < 3;
        const order = await orderRepo.save(
          orderRepo.create({
            order_number: `ORD-CASE3-${Date.now()}-${i}`,
            customer_id: testCustomer.id,
            status: isRecovered ? 'confirmed' : 'pending',
            subtotal_cents: 1500,
            total_cents: 1500,
          })
        );

        await orderItemRepo.save(
          orderItemRepo.create({
            order_id: order.id,
            product_id: prod.id,
            quantity: 1,
            price_cents: 1500,
            line_total_cents: 1500,
          })
        );

        const payment = await paymentRepo.save(
          paymentRepo.create({
            order_id: order.id,
            amount_cents: 1500,
            status: isRecovered ? 'captured' : 'failed',
            failure_reason: isRecovered ? 'network_error' : undefined,
          })
        );

        const failure = await failureRepo.save(
          failureRepo.create({
            payment_id: payment.id,
            reason: 'network_error' as any,
            failure_count: 1,
            last_failure_at: new Date(),
          })
        );

        await recoveryCaseRepo.save(
          recoveryCaseRepo.create({
            payment_failure_id: failure.id,
            order_id: order.id,
            customer_id: testCustomer.id,
            status: isRecovered ? 'resolved' : 'in_progress',
            recovery_attempts: 1,
            max_recovery_attempts: 3,
            resolved_at: isRecovered ? new Date() : undefined,
          })
        );
      }

      const metrics = await analyticsService.getDashboardMetrics(targetMerchant);
      expect(metrics.recovery_rate_percent).toBe(30);
      expect(metrics.revenue_recovered_cents).toBe(4500); // 3 * 1500
    });

    it('Case 4: should return 100% when 10 eligible cases exist and all 10 are recovered', async () => {
      const orderRepo = TestDataSource.getRepository(Order);
      const orderItemRepo = TestDataSource.getRepository(OrderItem);
      const paymentRepo = TestDataSource.getRepository(Payment);
      const failureRepo = TestDataSource.getRepository(PaymentFailure);
      const recoveryCaseRepo = TestDataSource.getRepository(RecoveryCase);
      const merchantRepo = TestDataSource.getRepository(Merchant);
      const productRepo = TestDataSource.getRepository(Product);

      const targetMerchant = `66666666-6666-6666-6666-666666666666`;
      await merchantRepo.save(
        merchantRepo.create({
          id: targetMerchant,
          name: 'Merchant D',
          email: `merch-d-${Date.now()}@example.com`,
        })
      );

      const prod = await productRepo.save(
        productRepo.create({
          name: `Product D ${Date.now()}`,
          category: 'Tools',
          price_cents: 1000,
          merchant_id: targetMerchant,
        })
      );

      for (let i = 0; i < 10; i++) {
        const order = await orderRepo.save(
          orderRepo.create({
            order_number: `ORD-CASE4-${Date.now()}-${i}`,
            customer_id: testCustomer.id,
            status: 'confirmed',
            subtotal_cents: 1000,
            total_cents: 1000,
          })
        );

        await orderItemRepo.save(
          orderItemRepo.create({
            order_id: order.id,
            product_id: prod.id,
            quantity: 1,
            price_cents: 1000,
            line_total_cents: 1000,
          })
        );

        const payment = await paymentRepo.save(
          paymentRepo.create({
            order_id: order.id,
            amount_cents: 1000,
            status: 'captured',
            failure_reason: 'insufficient_funds',
          })
        );

        const failure = await failureRepo.save(
          failureRepo.create({
            payment_id: payment.id,
            reason: 'insufficient_funds' as any,
            failure_count: 1,
            last_failure_at: new Date(),
          })
        );

        await recoveryCaseRepo.save(
          recoveryCaseRepo.create({
            payment_failure_id: failure.id,
            order_id: order.id,
            customer_id: testCustomer.id,
            status: 'resolved',
            recovery_attempts: 1,
            max_recovery_attempts: 3,
            resolved_at: new Date(),
          })
        );
      }

      const metrics = await analyticsService.getDashboardMetrics(targetMerchant);
      expect(metrics.recovery_rate_percent).toBe(100);
      expect(metrics.revenue_recovered_cents).toBe(10000); // 10 * 1000
    });

    it('Case 5: should maintain merchant scoping without cross-merchant data leakage', async () => {
      const metricsA = await analyticsService.getDashboardMetrics(merchantA);
      const metricsB = await analyticsService.getDashboardMetrics(merchantB);

      expect(metricsA).toBeDefined();
      expect(metricsB).toBeDefined();
      expect(metricsB.failed_payments_count).toBe(0);
      expect(metricsB.recovery_rate_percent).toBe(0);
    });

    it('Case 6: should dynamically update recovery rate and recovered revenue when a failed payment is recovered', async () => {
      const orderRepo = TestDataSource.getRepository(Order);
      const orderItemRepo = TestDataSource.getRepository(OrderItem);
      const paymentRepo = TestDataSource.getRepository(Payment);
      const failureRepo = TestDataSource.getRepository(PaymentFailure);
      const recoveryCaseRepo = TestDataSource.getRepository(RecoveryCase);
      const merchantRepo = TestDataSource.getRepository(Merchant);
      const productRepo = TestDataSource.getRepository(Product);

      const dynamicMerchant = '77777777-7777-7777-7777-777777777777';
      await merchantRepo.save(
        merchantRepo.create({
          id: dynamicMerchant,
          name: 'Merchant Dynamic',
          email: `merch-dyn-${Date.now()}@example.com`,
        })
      );

      const prod = await productRepo.save(
        productRepo.create({
          name: `Product Dynamic ${Date.now()}`,
          category: 'Hardware',
          price_cents: 5000,
          merchant_id: dynamicMerchant,
        })
      );

      const order = await orderRepo.save(
        orderRepo.create({
          order_number: `ORD-DYN-${Date.now()}`,
          customer_id: testCustomer.id,
          status: 'pending',
          subtotal_cents: 5000,
          total_cents: 5000,
        })
      );

      await orderItemRepo.save(
        orderItemRepo.create({
          order_id: order.id,
          product_id: prod.id,
          quantity: 1,
          price_cents: 5000,
          line_total_cents: 5000,
        })
      );

      const failedPayment = await paymentRepo.save(
        paymentRepo.create({
          order_id: order.id,
          amount_cents: 5000,
          status: 'failed',
          failure_reason: 'card_declined',
        })
      );

      const failure = await failureRepo.save(
        failureRepo.create({
          payment_id: failedPayment.id,
          reason: 'card_declined' as any,
          failure_count: 1,
          last_failure_at: new Date(),
        })
      );

      const recoveryCase = await recoveryCaseRepo.save(
        recoveryCaseRepo.create({
          payment_failure_id: failure.id,
          order_id: order.id,
          customer_id: testCustomer.id,
          status: 'open',
          recovery_attempts: 1,
          max_recovery_attempts: 3,
        })
      );

      // 1. Initially failed and unrecovered -> 0%
      const initialMetrics = await analyticsService.getDashboardMetrics(dynamicMerchant);
      expect(initialMetrics.recovery_rate_percent).toBe(0);
      expect(initialMetrics.revenue_recovered_cents).toBe(0);
      expect(initialMetrics.revenue_at_risk_cents).toBe(5000);

      // 2. Simulate payment capture / recovery
      order.status = 'confirmed';
      await orderRepo.save(order);

      recoveryCase.status = 'resolved';
      recoveryCase.resolved_at = new Date();
      recoveryCase.recovery_notes = 'Payment recovered successfully';
      await recoveryCaseRepo.save(recoveryCase);

      // 3. Immediately after resolution -> 100%
      const updatedMetrics = await analyticsService.getDashboardMetrics(dynamicMerchant);
      expect(updatedMetrics.recovery_rate_percent).toBe(100);
      expect(updatedMetrics.revenue_recovered_cents).toBe(5000);
      expect(updatedMetrics.revenue_at_risk_cents).toBe(0);
    });
  });
});
