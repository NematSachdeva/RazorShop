/**
 * M7 Merchant Dashboard Analytics Service
 * 
 * Provides comprehensive analytics for merchant dashboard using transactional tables only.
 * No separate analytics aggregate table is used - all queries run on transactional data.
 * 
 * Merchant context: Currently uses hardcoded 'default-merchant' to maintain consistency
 * with M5/M6 architecture. Future: Can be parameterized when multi-tenant system is implemented.
 */

import { DataSource, Repository } from 'typeorm';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { PromiseToPay } from '../models/PromiseToPay.js';

export interface DashboardMetrics {
  total_revenue_cents: number;
  revenue_at_risk_cents: number;
  revenue_recovered_cents: number;
  failed_payments_count: number;
  failed_payments_total_cents: number;
  abandoned_carts_count: number;
  recovery_rate_percent: number;
  period: {
    start_date: Date;
    end_date: Date;
  };
}

export interface RecoveryFunnel {
  open: number;
  in_progress: number;
  resolved: number;
  abandoned: number;
  customer_declined: number;
  total: number;
  conversion_rates: {
    open_to_resolved: number; // resolved / (resolved + abandoned + customer_declined)
    open_to_in_progress: number; // in_progress / open
  };
}

export interface CustomerResponseBreakdown {
  accepted: number;
  refused: number;
  promised: number;
  unclear: number;
  total: number;
  percentages: {
    accepted: number;
    refused: number;
    promised: number;
    unclear: number;
  };
}

export interface PaymentFailureReason {
  reason: string;
  count: number;
  total_amount_cents: number;
  recovery_count: number;
  recovery_rate_percent: number;
}

export interface PaymentFailureReasons {
  reasons: PaymentFailureReason[];
  total_failures: number;
  total_amount_cents: number;
}

export interface DailyRevenuePoint {
  date: string; // YYYY-MM-DD
  revenue_cents: number;
  orders_count: number;
  failed_payments_count: number;
  recovered_amount_cents: number;
}

export interface RevenueTimeline {
  data: DailyRevenuePoint[];
  period: {
    start_date: string;
    end_date: string;
  };
  totals: {
    revenue_cents: number;
    orders_count: number;
    failed_payments_count: number;
    recovered_amount_cents: number;
  };
}

export class AnalyticsService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  private getOrderRepository(): Repository<Order> {
    return this.dataSource.getRepository(Order);
  }

  private getPaymentRepository(): Repository<Payment> {
    return this.dataSource.getRepository(Payment);
  }

  private getPaymentFailureRepository(): Repository<PaymentFailure> {
    return this.dataSource.getRepository(PaymentFailure);
  }

  private getRecoveryCaseRepository(): Repository<RecoveryCase> {
    return this.dataSource.getRepository(RecoveryCase);
  }

  private getCustomerInteractionRepository(): Repository<CustomerInteraction> {
    return this.dataSource.getRepository(CustomerInteraction);
  }

  private getPromiseToPayRepository(): Repository<PromiseToPay> {
    return this.dataSource.getRepository(PromiseToPay);
  }

  /**
   * Get comprehensive dashboard metrics
   * Includes: total revenue, at-risk revenue, recovered revenue, failure counts, recovery rate
   */
  async getDashboardMetrics(merchantId: string = 'default-merchant'): Promise<DashboardMetrics> {
    // Total revenue (all completed orders)
    const totalRevenueResult = await this.getOrderRepository()
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total')
      .where("order.status IN ('confirmed', 'shipped', 'delivered')")
      .getRawOne();
    const total_revenue_cents = totalRevenueResult?.total ? parseInt(totalRevenueResult.total) : 0;

    // Revenue at risk (unpaid pending orders that have failed payment attempts or active recovery cases)
    const atRiskResult = await this.dataSource
      .createQueryBuilder()
      .select('SUM(DISTINCT order.total_cents)', 'total')
      .from(Order, 'order')
      .innerJoin('order.payments', 'payment', "payment.status = 'failed'")
      .where("order.status = 'pending'")
      .getRawOne();
    const revenue_at_risk_cents = atRiskResult?.total ? parseInt(atRiskResult.total) : 0;

    // Revenue recovered (confirmed orders that previously entered the recovery/at-risk pipeline via failed payment or failure reason)
    const recoveredResult = await this.dataSource
      .createQueryBuilder()
      .select('SUM(DISTINCT order.total_cents)', 'total')
      .from(Order, 'order')
      .innerJoin('order.payments', 'payment', "payment.status = 'failed' OR payment.failure_reason IS NOT NULL")
      .where("order.status IN ('confirmed', 'shipped', 'delivered')")
      .getRawOne();
    const revenue_recovered_cents = recoveredResult?.total ? parseInt(recoveredResult.total) : 0;

    // Failed payments count and total (historical count of failed payment attempts, preserved after retries)
    const pfRepo = this.dataSource.getRepository(PaymentFailure);
    const failureStats = await pfRepo
      .createQueryBuilder('pf')
      .select('COUNT(pf.id)', 'count')
      .addSelect('SUM(payment.amount_cents)', 'total_amount')
      .innerJoin('pf.payment', 'payment')
      .getRawOne();

    let failed_payments_count = failureStats?.count ? parseInt(failureStats.count) : 0;
    let failed_payments_total_cents = failureStats?.total_amount ? parseInt(failureStats.total_amount) : 0;

    if (failed_payments_count === 0) {
      const fallbackStats = await this.getPaymentRepository()
        .createQueryBuilder('payment')
        .select('COUNT(payment.id)', 'count')
        .addSelect('SUM(payment.amount_cents)', 'total_amount')
        .where("payment.status = 'failed' OR payment.failure_reason IS NOT NULL")
        .getRawOne();
      failed_payments_count = fallbackStats?.count ? parseInt(fallbackStats.count) : 0;
      failed_payments_total_cents = fallbackStats?.total_amount ? parseInt(fallbackStats.total_amount) : 0;
    }

    // Abandoned carts (for completeness - count of orders with no payments)
    const abandonedResult = await this.getOrderRepository()
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.payments', 'payment')
      .select('COUNT(DISTINCT order.id)', 'count')
      .where("order.status = 'pending'")
      .andWhere('payment.id IS NULL')
      .getRawOne();
    const abandoned_carts_count = abandonedResult?.count ? parseInt(abandonedResult.count) : 0;

    // Recovery rate (resolved cases / total cases)
    const caseStats = await this.getRecoveryCaseRepository()
      .createQueryBuilder('rc')
      .select('COUNT(CASE WHEN rc.status = :resolved THEN 1 END)', 'resolved_count')
      .addSelect('COUNT(rc.id)', 'total_count')
      .setParameters({ resolved: 'resolved' })
      .getRawOne();
    const resolved_count = caseStats?.resolved_count ? parseInt(caseStats.resolved_count) : 0;
    const total_cases = caseStats?.total_count ? parseInt(caseStats.total_count) : 0;
    const recovery_rate_percent = total_cases > 0 ? Math.round((resolved_count / total_cases) * 100) : 0;

    return {
      total_revenue_cents,
      revenue_at_risk_cents,
      revenue_recovered_cents,
      failed_payments_count,
      failed_payments_total_cents,
      abandoned_carts_count,
      recovery_rate_percent,
      period: {
        start_date: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end_date: new Date(),
      },
    };
  }

  /**
   * Get recovery funnel breakdown
   * Shows distribution of recovery cases by status and conversion rates
   */
  async getRecoveryFunnel(merchantId: string = 'default-merchant'): Promise<RecoveryFunnel> {
    const statuses = await this.getRecoveryCaseRepository()
      .createQueryBuilder('rc')
      .select("rc.status", 'status')
      .addSelect('COUNT(rc.id)', 'count')
      .groupBy('rc.status')
      .getRawMany();

    const countByStatus: { [key: string]: number } = {};
    statuses.forEach((row) => {
      countByStatus[row.status] = parseInt(row.count);
    });

    const open = countByStatus['open'] || 0;
    const in_progress = countByStatus['in_progress'] || 0;
    const resolved = countByStatus['resolved'] || 0;
    const abandoned = countByStatus['abandoned'] || 0;
    const customer_declined = countByStatus['customer_declined'] || 0;
    const total = open + in_progress + resolved + abandoned + customer_declined;

    // Conversion rates
    const resolvable = resolved + abandoned + customer_declined;
    const open_to_resolved = resolvable > 0 ? Math.round((resolved / resolvable) * 100) : 0;
    const open_to_in_progress = open > 0 ? Math.round((in_progress / open) * 100) : 0;

    return {
      open,
      in_progress,
      resolved,
      abandoned,
      customer_declined,
      total,
      conversion_rates: {
        open_to_resolved,
        open_to_in_progress,
      },
    };
  }

  /**
   * Get customer response breakdown
   * Shows how customers responded to recovery attempts (intent breakdown)
   */
  async getCustomerResponseBreakdown(
    merchantId: string = 'default-merchant'
  ): Promise<CustomerResponseBreakdown> {
    const responses = await this.getCustomerInteractionRepository()
      .createQueryBuilder('ci')
      .select('ci.intent', 'intent')
      .addSelect('COUNT(ci.id)', 'count')
      .groupBy('ci.intent')
      .getRawMany();

    const countByIntent: { [key: string]: number } = {};
    responses.forEach((row) => {
      countByIntent[row.intent] = parseInt(row.count);
    });

    const accepted = countByIntent['accepted'] || 0;
    const refused = countByIntent['refused'] || 0;
    const promised = countByIntent['promised'] || 0;
    const unclear = countByIntent['unclear'] || 0;
    const total = accepted + refused + promised + unclear;

    return {
      accepted,
      refused,
      promised,
      unclear,
      total,
      percentages: {
        accepted: total > 0 ? Math.round((accepted / total) * 100) : 0,
        refused: total > 0 ? Math.round((refused / total) * 100) : 0,
        promised: total > 0 ? Math.round((promised / total) * 100) : 0,
        unclear: total > 0 ? Math.round((unclear / total) * 100) : 0,
      },
    };
  }

  /**
   * Get payment failure reasons breakdown
   * Shows which payment failure reasons are most common and their recovery rates
   */
  async getPaymentFailureReasons(merchantId: string = 'default-merchant'): Promise<PaymentFailureReasons> {
    // Get all failures with their reasons
    const failures = await this.getPaymentFailureRepository()
      .createQueryBuilder('pf')
      .leftJoinAndSelect('pf.payment', 'payment')
      .leftJoinAndSelect('pf.recovery_cases', 'rc')
      .select('pf.reason', 'reason')
      .addSelect('COUNT(pf.id)', 'count')
      .addSelect('SUM(payment.amount_cents)', 'total_amount')
      .groupBy('pf.reason')
      .orderBy('COUNT(pf.id)', 'DESC')
      .getRawMany();

    const reasons: PaymentFailureReason[] = [];
    let total_failures = 0;
    let total_amount_cents = 0;

    for (const failure of failures) {
      const reason = failure.reason;
      const count = parseInt(failure.count);
      const amount = failure.total_amount ? parseInt(failure.total_amount) : 0;

      // Get recovery count for this reason
      const recoveryStats = await this.getRecoveryCaseRepository()
        .createQueryBuilder('rc')
        .innerJoin('rc.payment_failure', 'pf', 'pf.reason = :reason')
        .where("rc.status = 'resolved'")
        .setParameters({ reason })
        .select('COUNT(rc.id)', 'recovery_count')
        .getRawOne();

      const recovery_count = recoveryStats?.recovery_count ? parseInt(recoveryStats.recovery_count) : 0;
      const recovery_rate_percent = count > 0 ? Math.round((recovery_count / count) * 100) : 0;

      reasons.push({
        reason,
        count,
        total_amount_cents: amount,
        recovery_count,
        recovery_rate_percent,
      });

      total_failures += count;
      total_amount_cents += amount;
    }

    return {
      reasons,
      total_failures,
      total_amount_cents,
    };
  }

  /**
   * Get revenue timeline over a date range
   * Daily breakdown of revenue, orders, failures, and recoveries
   */
  async getRevenueTimeline(
    merchantId: string = 'default-merchant',
    startDate: Date = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
    endDate: Date = new Date()
  ): Promise<RevenueTimeline> {
    // Get daily revenue data
    const dailyData = await this.getOrderRepository()
      .createQueryBuilder('order')
      .select("DATE(order.created_at)", 'date')
      .addSelect('SUM(order.total_cents)', 'revenue')
      .addSelect('COUNT(DISTINCT order.id)', 'orders_count')
      .where('order.created_at >= :startDate AND order.created_at <= :endDate')
      .where("order.status IN ('confirmed', 'shipped', 'delivered')")
      .setParameters({ startDate, endDate })
      .groupBy("DATE(order.created_at)")
      .orderBy("DATE(order.created_at)", 'ASC')
      .getRawMany();

    // Get daily failed payments
    const failedPayments = await this.getPaymentFailureRepository()
      .createQueryBuilder('pf')
      .innerJoinAndSelect('pf.payment', 'payment')
      .select("DATE(pf.detected_at)", 'date')
      .addSelect('COUNT(pf.id)', 'failure_count')
      .addSelect('SUM(payment.amount_cents)', 'total_amount')
      .where('pf.detected_at >= :startDate AND pf.detected_at <= :endDate')
      .setParameters({ startDate, endDate })
      .groupBy("DATE(pf.detected_at)")
      .getRawMany();

    // Get daily recovered revenue
    const recoveredByDay = await this.dataSource
      .createQueryBuilder()
      .select("DATE(rc.resolved_at)", 'date')
      .addSelect('SUM(order.total_cents)', 'recovered_amount')
      .from(RecoveryCase, 'rc')
      .innerJoin('rc.order', 'order')
      .where('rc.status = :resolved')
      .andWhere('rc.resolved_at >= :startDate AND rc.resolved_at <= :endDate')
      .setParameters({ resolved: 'resolved', startDate, endDate })
      .groupBy("DATE(rc.resolved_at)")
      .getRawMany();

    // Combine data by date
    const dateMap: { [key: string]: DailyRevenuePoint } = {};

    // Initialize all dates in range
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      dateMap[dateStr] = {
        date: dateStr,
        revenue_cents: 0,
        orders_count: 0,
        failed_payments_count: 0,
        recovered_amount_cents: 0,
      };
      current.setDate(current.getDate() + 1);
    }

    // Fill in data from query results
    dailyData.forEach((row) => {
      const dateStr = row.date.toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].revenue_cents = parseInt(row.revenue) || 0;
        dateMap[dateStr].orders_count = parseInt(row.orders_count) || 0;
      }
    });

    failedPayments.forEach((row) => {
      const dateStr = row.date.toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].failed_payments_count = parseInt(row.failure_count) || 0;
      }
    });

    recoveredByDay.forEach((row) => {
      const dateStr = row.date.toISOString().split('T')[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].recovered_amount_cents = parseInt(row.recovered_amount) || 0;
      }
    });

    // Convert to array and calculate totals
    const data = Object.values(dateMap);
    const totals = {
      revenue_cents: 0,
      orders_count: 0,
      failed_payments_count: 0,
      recovered_amount_cents: 0,
    };

    data.forEach((point) => {
      totals.revenue_cents += point.revenue_cents;
      totals.orders_count += point.orders_count;
      totals.failed_payments_count += point.failed_payments_count;
      totals.recovered_amount_cents += point.recovered_amount_cents;
    });

    return {
      data,
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      },
      totals,
    };
  }
}
