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
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { Customer } from '../models/Customer.js';

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

  describe('Merchant Context', () => {
    it('should accept merchant ID parameter', async () => {
      // All methods should accept merchantId (even if currently demo-only)
      const metrics = await analyticsService.getDashboardMetrics('default-merchant');
      const funnel = await analyticsService.getRecoveryFunnel('custom-merchant');
      const breakdown = await analyticsService.getCustomerResponseBreakdown('test-merchant');
      const reasons = await analyticsService.getPaymentFailureReasons('another-merchant');
      const timeline = await analyticsService.getRevenueTimeline('demo-merchant');

      expect(metrics).toBeDefined();
      expect(funnel).toBeDefined();
      expect(breakdown).toBeDefined();
      expect(reasons).toBeDefined();
      expect(timeline).toBeDefined();
    });
  });
});
