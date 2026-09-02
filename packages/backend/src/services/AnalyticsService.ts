/**
 * M7 Merchant Dashboard Analytics Service
 * 
 * Provides comprehensive analytics for merchant dashboard using transactional tables only.
 * Multi-tenant safe: Merchant filtering joins via order items to product merchant_id.
 */

import { DataSource, Repository } from 'typeorm';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Product } from '../models/Product.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { PromiseToPay } from '../models/PromiseToPay.js';
import { Cart } from '../models/Cart.js';

export interface CanonicalAbandonedCartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CanonicalAbandonedCartRecord {
  cartId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  updatedAt: Date;
  cartTotalCents: number;
  items: CanonicalAbandonedCartItem[];
}

export interface CanonicalAbandonedCartsResult {
  abandonedCartsCount: number;
  uniqueCartInstancesCount: number;
  pendingOrdersCount: number;
  uniqueCustomersCount: number;
  totalUnitsCount: number;
  activeCartsCount: number;
  cartsReachedCheckoutCount: number;
  revenueAtRiskCents: number;
  carts: CanonicalAbandonedCartRecord[];
  topAbandonedProducts: Array<{
    product_id: string;
    product_name: string;
    abandon_count: number;
  }>;
}

export function isUuid(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export interface DashboardMetrics {
  total_revenue_cents: number;
  revenue_at_risk_cents: number;
  revenue_recovered_cents: number;
  failed_payments_count: number;
  failed_payments_total_cents: number;
  abandoned_carts_count: number;
  recovery_rate_percent: number;
  orders_cancelled_count: number;
  orders_returned_count: number;
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
    open_to_resolved: number;
    open_to_in_progress: number;
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
  date: string;
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

export interface ComprehensiveMerchantAnalytics {
  merchant_id: string;
  payments: {
    total_attempts: number;
    successful_count: number;
    failed_count: number;
    failure_rate_percent: number;
    total_failed_rupees: number;
    total_recovered_rupees: number;
    recovery_rate_percent: number;
    top_failure_reasons: Array<{
      reason: string;
      count: number;
      amount_rupees: number;
    }>;
  };
  carts: {
    total_carts: number;
    active_count: number;
    abandoned_count: number;
    carts_reached_checkout: number;
    abandoned_rate_percent: number;
    revenue_at_risk_rupees: number;
    top_abandoned_products: Array<{
      product_id: string;
      product_name: string;
      abandon_count: number;
    }>;
  };
  recovery: {
    total_cases: number;
    open: number;
    in_progress: number;
    resolved: number;
    abandoned: number;
    customer_declined: number;
    response_breakdown: {
      accepted: number;
      refused: number;
      promised: number;
      unclear: number;
    };
  };
  orders: {
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    returned_orders: number;
    total_revenue_rupees: number;
    average_order_value_rupees: number;
  };
  products_and_inventory: {
    total_listed_products: number;
    total_units_in_stock: number;
    low_stock_count: number;
    out_of_stock_count: number;
    top_selling_products: Array<{
      id: string;
      name: string;
      units_sold: number;
      available: number;
    }>;
  };
  customers: {
    total_unique_customers: number;
    repeat_customers: number;
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
   */
  async getDashboardMetrics(merchantId?: string, startDate?: Date, endDate?: Date): Promise<DashboardMetrics> {
    const hasMerchant = isUuid(merchantId);
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total revenue
    let totalRevQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total')
      .where("order.status NOT IN ('cancelled', 'pending', 'order_returned_to_seller', 'refund_initiated')")
      .andWhere("(order.return_status IS NULL OR order.return_status NOT IN ('order_returned_to_seller', 'refund_initiated'))");
    if (startDate && endDate) {
      totalRevQuery = totalRevQuery.andWhere('order.created_at >= :start AND order.created_at <= :end', { start, end });
    }
    if (hasMerchant) {
      totalRevQuery = totalRevQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const totalRevenueResult = await totalRevQuery.getRawOne();
    const total_revenue_cents = totalRevenueResult?.total ? parseInt(totalRevenueResult.total, 10) : 0;

    // Revenue at risk
    let atRiskQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total')
      .where("order.status = 'pending'")
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from(Payment, 'p')
          .where('p.order_id = order.id')
          .andWhere("p.status = 'failed'")
          .getQuery();
        return `EXISTS ${subQuery}`;
      });
    if (startDate && endDate) {
      atRiskQuery = atRiskQuery.andWhere('order.created_at >= :start AND order.created_at <= :end', { start, end });
    }
    if (hasMerchant) {
      atRiskQuery = atRiskQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const atRiskResult = await atRiskQuery.getRawOne();
    const revenue_at_risk_cents = atRiskResult?.total ? parseInt(atRiskResult.total, 10) : 0;

    // Revenue recovered
    let recoveredQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .select('SUM(order.total_cents)', 'total')
      .where("order.status NOT IN ('cancelled', 'pending', 'order_returned_to_seller', 'refund_initiated')")
      .andWhere("(order.return_status IS NULL OR order.return_status NOT IN ('order_returned_to_seller', 'refund_initiated'))")
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from(Payment, 'p')
          .where('p.order_id = order.id')
          .andWhere("(p.status = 'failed' OR p.failure_reason IS NOT NULL)")
          .getQuery();
        return `EXISTS ${subQuery}`;
      });
    if (startDate && endDate) {
      recoveredQuery = recoveredQuery.andWhere('order.created_at >= :start AND order.created_at <= :end', { start, end });
    }
    if (hasMerchant) {
      recoveredQuery = recoveredQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const recoveredResult = await recoveredQuery.getRawOne();
    const revenue_recovered_cents = recoveredResult?.total ? parseInt(recoveredResult.total, 10) : 0;

    // Failed payments count and total
    let failureStatsQuery = this.dataSource
      .getRepository(PaymentFailure)
      .createQueryBuilder('pf')
      .select('COUNT(pf.id)', 'count')
      .addSelect('SUM(payment.amount_cents)', 'total_amount')
      .innerJoin('pf.payment', 'payment')
      .innerJoin('payment.order', 'order');
    if (startDate && endDate) {
      failureStatsQuery = failureStatsQuery.andWhere('pf.detected_at >= :start AND pf.detected_at <= :end', { start, end });
    }
    if (hasMerchant) {
      failureStatsQuery = failureStatsQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const failureStats = await failureStatsQuery.getRawOne();

    let failed_payments_count = failureStats?.count ? parseInt(failureStats.count, 10) : 0;
    let failed_payments_total_cents = failureStats?.total_amount ? parseInt(failureStats.total_amount, 10) : 0;

    if (failed_payments_count === 0 && !hasMerchant) {
      let fallbackQuery = this.getPaymentRepository()
        .createQueryBuilder('payment')
        .select('COUNT(payment.id)', 'count')
        .addSelect('SUM(payment.amount_cents)', 'total_amount')
        .leftJoin('payment.order', 'order')
        .where("payment.status = 'failed' OR payment.failure_reason IS NOT NULL");
      if (startDate && endDate) {
        fallbackQuery = fallbackQuery.andWhere('payment.created_at >= :start AND payment.created_at <= :end', { start, end });
      }
      const fallbackStats = await fallbackQuery.getRawOne();
      failed_payments_count = fallbackStats?.count ? parseInt(fallbackStats.count, 10) : 0;
      failed_payments_total_cents = fallbackStats?.total_amount ? parseInt(fallbackStats.total_amount, 10) : 0;
    }

    // Abandoned Carts Count (Canonical Calculation)
    let abandonedCartsCount = 0;
    try {
      const canonical = await this.getAbandonedCartsCanonical(merchantId, startDate, endDate);
      abandonedCartsCount = canonical.abandonedCartsCount;
    } catch {
      abandonedCartsCount = 0;
    }

    // Recovery Rate Calculation
    let recovery_rate_percent = 0;
    let rcCountQuery = this.getRecoveryCaseRepository()
      .createQueryBuilder('rc')
      .select('COUNT(rc.id)', 'count')
      .innerJoin('rc.order', 'order');
    if (startDate && endDate) {
      rcCountQuery = rcCountQuery.andWhere('rc.created_at >= :start AND rc.created_at <= :end', { start, end });
    }
    if (hasMerchant) {
      rcCountQuery = rcCountQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const rcCountResult = await rcCountQuery.getRawOne();
    const totalCases = rcCountResult?.count ? parseInt(rcCountResult.count, 10) : 0;

    if (totalCases > 0) {
      let rcResolvedQuery = this.getRecoveryCaseRepository()
        .createQueryBuilder('rc')
        .select('COUNT(rc.id)', 'count')
        .innerJoin('rc.order', 'order')
        .where("(rc.status = 'resolved' OR order.status NOT IN ('cancelled', 'pending', 'order_returned_to_seller', 'refund_initiated'))");
      if (startDate && endDate) {
        rcResolvedQuery = rcResolvedQuery.andWhere('rc.created_at >= :start AND rc.created_at <= :end', { start, end });
      }
      if (hasMerchant) {
        rcResolvedQuery = rcResolvedQuery
          .andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from(OrderItem, 'item')
              .innerJoin('item.product', 'product')
              .where('item.order_id = order.id')
              .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
              .getQuery();
            return `EXISTS ${subQuery}`;
          })
          .setParameter('merchantId', merchantId);
      }
      const rcResolvedResult = await rcResolvedQuery.getRawOne();
      const resolvedCases = rcResolvedResult?.count ? parseInt(rcResolvedResult.count, 10) : 0;
      recovery_rate_percent = Math.min(100, Math.max(0, Math.round((resolvedCases / totalCases) * 100)));
    } else if (failed_payments_count > 0) {
      let recoveredCountQuery = this.getOrderRepository()
        .createQueryBuilder('order')
        .select('COUNT(order.id)', 'count')
        .where("order.status NOT IN ('cancelled', 'pending', 'order_returned_to_seller', 'refund_initiated')")
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(Payment, 'p')
            .where('p.order_id = order.id')
            .andWhere("(p.status = 'failed' OR p.failure_reason IS NOT NULL)")
            .getQuery();
          return `EXISTS ${subQuery}`;
        });
      if (startDate && endDate) {
        recoveredCountQuery = recoveredCountQuery.andWhere('order.created_at >= :start AND order.created_at <= :end', { start, end });
      }
      if (hasMerchant) {
        recoveredCountQuery = recoveredCountQuery
          .andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from(OrderItem, 'item')
              .innerJoin('item.product', 'product')
              .where('item.order_id = order.id')
              .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
              .getQuery();
            return `EXISTS ${subQuery}`;
          })
          .setParameter('merchantId', merchantId);
      }
      const recoveredCountResult = await recoveredCountQuery.getRawOne();
      const recoveredOrders = recoveredCountResult?.count ? parseInt(recoveredCountResult.count, 10) : 0;
      recovery_rate_percent = Math.min(100, Math.max(0, Math.round((recoveredOrders / failed_payments_count) * 100)));
    } else {
      recovery_rate_percent = 0;
    }

    // Orders Cancelled Count
    let cancelledQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'count')
      .where("order.status = 'cancelled'");
    if (startDate && endDate) {
      cancelledQuery = cancelledQuery.andWhere(
        '((order.cancellation_timestamp >= :start AND order.cancellation_timestamp <= :end) OR (order.cancellation_timestamp IS NULL AND order.created_at >= :start AND order.created_at <= :end))',
        { start, end }
      );
    }
    if (hasMerchant) {
      cancelledQuery = cancelledQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const cancelledResult = await cancelledQuery.getRawOne();
    const orders_cancelled_count = cancelledResult?.count ? parseInt(cancelledResult.count, 10) : 0;

    // Orders Returned Count: Authoritative check - ONLY orders that have reached 'order_returned_to_seller' or 'refund_initiated'
    let returnedQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'count')
      .where("(order.return_status IN ('order_returned_to_seller', 'refund_initiated') OR order.status IN ('order_returned_to_seller', 'refund_initiated'))");
    if (startDate && endDate) {
      returnedQuery = returnedQuery.andWhere(
        '((order.returned_to_seller_at >= :start AND order.returned_to_seller_at <= :end) OR (order.returned_to_seller_at IS NULL AND order.created_at >= :start AND order.created_at <= :end))',
        { start, end }
      );
    }
    if (hasMerchant) {
      returnedQuery = returnedQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }
    const returnedResult = await returnedQuery.getRawOne();
    const orders_returned_count = returnedResult?.count ? parseInt(returnedResult.count, 10) : 0;

    return {
      total_revenue_cents,
      revenue_at_risk_cents,
      revenue_recovered_cents,
      failed_payments_count,
      failed_payments_total_cents,
      abandoned_carts_count: abandonedCartsCount,
      recovery_rate_percent,
      orders_cancelled_count,
      orders_returned_count,
      period: {
        start_date: start,
        end_date: end,
      },
    };
  }

  /**
   * Get recovery funnel metrics
   */
  async getRecoveryFunnel(merchantId?: string): Promise<RecoveryFunnel> {
    const hasMerchant = isUuid(merchantId);

    let query = this.getRecoveryCaseRepository()
      .createQueryBuilder('rc')
      .select('rc.status', 'status')
      .addSelect('COUNT(rc.id)', 'count')
      .innerJoin('rc.order', 'order');

    if (hasMerchant) {
      query = query
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const statusCounts = await query.groupBy('rc.status').getRawMany();

    const counts: Record<string, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      abandoned: 0,
      customer_declined: 0,
    };

    let total = 0;
    for (const row of statusCounts) {
      const status = row.status as string;
      const count = parseInt(row.count, 10);
      if (status in counts) {
        counts[status] = count;
      }
      total += count;
    }

    const closedCases = counts.resolved + counts.abandoned + counts.customer_declined;
    const open_to_resolved = closedCases > 0 ? Math.round((counts.resolved / closedCases) * 100) : 0;
    const open_to_in_progress = counts.open > 0 ? Math.round((counts.in_progress / counts.open) * 100) : 0;

    return {
      open: counts.open,
      in_progress: counts.in_progress,
      resolved: counts.resolved,
      abandoned: counts.abandoned,
      customer_declined: counts.customer_declined,
      total,
      conversion_rates: {
        open_to_resolved,
        open_to_in_progress,
      },
    };
  }

  /**
   * Get customer response breakdown
   */
  async getCustomerResponseBreakdown(merchantId?: string): Promise<CustomerResponseBreakdown> {
    const hasMerchant = isUuid(merchantId);

    let query = this.getCustomerInteractionRepository()
      .createQueryBuilder('ci')
      .select('ci.intent', 'intent')
      .addSelect('COUNT(ci.id)', 'count')
      .innerJoin('ci.recovery_case', 'rc')
      .innerJoin('rc.order', 'order');

    if (hasMerchant) {
      query = query
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const intentCounts = await query.groupBy('ci.intent').getRawMany();

    const counts: Record<string, number> = {
      accepted: 0,
      refused: 0,
      promised: 0,
      unclear: 0,
    };

    let total = 0;
    for (const row of intentCounts) {
      const intent = row.intent as string;
      const count = parseInt(row.count, 10);
      if (intent in counts) {
        counts[intent] = count;
      }
      total += count;
    }

    const percentages = {
      accepted: total > 0 ? Math.round((counts.accepted / total) * 100) : 0,
      refused: total > 0 ? Math.round((counts.refused / total) * 100) : 0,
      promised: total > 0 ? Math.round((counts.promised / total) * 100) : 0,
      unclear: total > 0 ? Math.round((counts.unclear / total) * 100) : 0,
    };

    return {
      accepted: counts.accepted,
      refused: counts.refused,
      promised: counts.promised,
      unclear: counts.unclear,
      total,
      percentages,
    };
  }

  /**
   * Get payment failure reasons breakdown
   */
  async getPaymentFailureReasons(merchantId?: string): Promise<PaymentFailureReasons> {
    const hasMerchant = isUuid(merchantId);

    let query = this.getPaymentFailureRepository()
      .createQueryBuilder('pf')
      .select('pf.reason', 'reason')
      .addSelect('COUNT(pf.id)', 'count')
      .addSelect('SUM(payment.amount_cents)', 'total_amount')
      .innerJoin('pf.payment', 'payment')
      .innerJoin('payment.order', 'order');

    if (hasMerchant) {
      query = query
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const failureGroups = await query.groupBy('pf.reason').orderBy('count', 'DESC').getRawMany();

    const reasons: PaymentFailureReason[] = [];
    let total_failures = 0;
    let total_amount_cents = 0;

    for (const group of failureGroups) {
      const reason = group.reason as string;
      const count = parseInt(group.count, 10);
      const totalAmount = group.total_amount ? parseInt(group.total_amount, 10) : 0;

      total_failures += count;
      total_amount_cents += totalAmount;

      let recQuery = this.getRecoveryCaseRepository()
        .createQueryBuilder('rc')
        .select('COUNT(rc.id)', 'count')
        .innerJoin('rc.payment_failure', 'pf')
        .innerJoin('rc.order', 'order')
        .where('pf.reason = :reason', { reason })
        .andWhere("(rc.status = 'resolved' OR order.status IN ('confirmed', 'shipped', 'delivered'))");

      if (hasMerchant) {
        recQuery = recQuery
          .andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from(OrderItem, 'item')
              .innerJoin('item.product', 'product')
              .where('item.order_id = order.id')
              .andWhere('product.merchant_id = :merchantId')
              .getQuery();
            return `EXISTS ${subQuery}`;
          })
          .setParameter('merchantId', merchantId);
      }

      const recResult = await recQuery.getRawOne();
      const recoveryCount = recResult?.count ? parseInt(recResult.count, 10) : 0;
      const recoveryRate = count > 0 ? Math.min(100, Math.max(0, Math.round((recoveryCount / count) * 100))) : 0;

      reasons.push({
        reason,
        count,
        total_amount_cents: totalAmount,
        recovery_count: recoveryCount,
        recovery_rate_percent: recoveryRate,
      });
    }

    return {
      reasons,
      total_failures,
      total_amount_cents,
    };
  }

  /**
   * Get daily revenue timeline data
   */
  async getRevenueTimeline(
    merchantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueTimeline> {
    const hasMerchant = isUuid(merchantId);
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    let ordersQuery = this.getOrderRepository()
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.payments', 'payments')
      .where('order.created_at >= :start AND order.created_at <= :end', { start, end });

    if (hasMerchant) {
      ordersQuery = ordersQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const orders = await ordersQuery.getMany();

    let failuresQuery = this.getPaymentFailureRepository()
      .createQueryBuilder('pf')
      .innerJoinAndSelect('pf.payment', 'payment')
      .innerJoin('payment.order', 'order')
      .where('pf.detected_at >= :start AND pf.detected_at <= :end', { start, end });

    if (hasMerchant) {
      failuresQuery = failuresQuery
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = order.id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const failures = await failuresQuery.getMany();

    const dailyData: Map<string, DailyRevenuePoint> = new Map();

    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      dailyData.set(dateStr, {
        date: dateStr,
        revenue_cents: 0,
        orders_count: 0,
        failed_payments_count: 0,
        recovered_amount_cents: 0,
      });
      curr.setDate(curr.getDate() + 1);
    }

    let totals = {
      revenue_cents: 0,
      orders_count: 0,
      failed_payments_count: 0,
      recovered_amount_cents: 0,
    };

    for (const order of orders) {
      const dateStr = new Date(order.created_at).toISOString().split('T')[0];
      const point = dailyData.get(dateStr);
      if (point) {
        if (['confirmed', 'shipped', 'delivered'].includes(order.status)) {
          const orderTotal = Number(order.total_cents) || 0;
          point.revenue_cents += orderTotal;
          point.orders_count += 1;
          totals.revenue_cents += orderTotal;
          totals.orders_count += 1;

          const payments = order.payments || [];
          const hasFailed = payments.some((p: any) => p.status === 'failed' || p.failure_reason);
          if (hasFailed) {
            point.recovered_amount_cents += orderTotal;
            totals.recovered_amount_cents += orderTotal;
          }
        }
      }
    }

    for (const failure of failures) {
      const dateStr = new Date(failure.detected_at).toISOString().split('T')[0];
      const point = dailyData.get(dateStr);
      if (point) {
        point.failed_payments_count += 1;
        totals.failed_payments_count += 1;
      }
    }

    const data = Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      data,
      period: {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
      },
      totals,
    };
  }

  /**
   * Get store feedback breakdown for merchant
   */
  async getFeedbackBreakdown(
    merchantId?: string,
    rating?: number,
    category?: string
  ) {
    const hasMerchant = isUuid(merchantId);
    let query = this.dataSource
      .getRepository('OrderFeedback')
      .createQueryBuilder('fb')
      .leftJoinAndSelect('fb.order', 'order')
      .leftJoinAndSelect('fb.customer', 'customer');

    if (hasMerchant) {
      query = query
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = fb.order_id')
            .andWhere('product.merchant_id = :merchantId')
            .getQuery();
          return `(EXISTS ${subQuery} OR NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = fb.order_id))`;
        })
        .setParameter('merchantId', merchantId);
    }

    if (rating !== undefined) {
      query = query.andWhere('fb.rating = :rating', { rating });
    }

    if (category) {
      query = query.andWhere('fb.category = :category', { category });
    }

    const feedbacks = await query.orderBy('fb.created_at', 'DESC').getMany();

    const total_feedbacks = feedbacks.length;
    const rating_distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const category_distribution: Record<string, number> = {};
    let ratingSum = 0;

    for (const fb of feedbacks) {
      const r = (fb as any).rating;
      if (r >= 1 && r <= 5) {
        rating_distribution[r] = (rating_distribution[r] || 0) + 1;
        ratingSum += r;
      }
      const cat = (fb as any).category || 'Overall Experience';
      category_distribution[cat] = (category_distribution[cat] || 0) + 1;
    }

    const average_rating = total_feedbacks > 0 ? Number((ratingSum / total_feedbacks).toFixed(1)) : 5.0;

    return {
      total_feedbacks,
      average_rating,
      rating_distribution,
      category_distribution,
      recent_feedbacks: feedbacks.slice(0, 50).map((fb: any) => ({
        id: fb.id,
        order_id: fb.order_id,
        order_number: fb.order?.order_number,
        customer_name: fb.customer?.name || 'Customer',
        rating: fb.rating,
        category: fb.category,
        comment: fb.comment,
        created_at: fb.created_at,
      })),
    };
  }

  /**
   * CANONICAL SOURCE OF TRUTH for abandoned-cart calculations.
   * Both Analytics Dashboard and Merchant Helper consume this exact method.
   */
  async getAbandonedCartsCanonical(
    merchantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CanonicalAbandonedCartsResult> {
    const inactivityMinutes = process.env.CART_ABANDONMENT_MINUTES !== undefined
      ? parseInt(process.env.CART_ABANDONMENT_MINUTES, 10)
      : 5;
    const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const hasMerchant = !!(merchantId && merchantId !== 'default-merchant');

    const cartRepo = this.dataSource.getRepository(Cart);
    let cartQb = cartRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.items', 'ci')
      .innerJoinAndSelect('ci.product', 'p')
      .leftJoinAndSelect('c.customer', 'cust')
      .where("c.status = 'abandoned' OR (c.status = 'active' AND c.updated_at <= :cutoffDate)", { cutoffDate });

    if (hasMerchant) {
      cartQb = cartQb.andWhere('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId });
    }

    if (startDate && endDate) {
      cartQb = cartQb.andWhere('c.created_at >= :start AND c.created_at <= :end', { start: startDate, end: endDate });
    }

    const abandonedCartEntities = await cartQb
      .orderBy('c.updated_at', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .getMany();

    const cartMap = new Map<string, CanonicalAbandonedCartRecord>();
    const customerSet = new Set<string>();
    let totalUnitsCount = 0;
    let inactiveCartsValueCents = 0;

    for (const c of abandonedCartEntities) {
      if (c.customer_id) {
        customerSet.add(c.customer_id);
      } else if (c.customer?.email) {
        customerSet.add(c.customer.email);
      }

      const items: CanonicalAbandonedCartItem[] = [];
      let cartTotalCents = 0;

      for (const it of c.items || []) {
        if (hasMerchant && it.product?.merchant_id && it.product.merchant_id !== merchantId) {
          continue;
        }

        const unitPriceCents = Number(it.price_cents || it.product?.price_cents || 0);
        const qty = Number(it.quantity || 1);
        const lineTotalCents = unitPriceCents * qty;

        cartTotalCents += lineTotalCents;
        totalUnitsCount += qty;

        items.push({
          productId: it.product_id,
          productName: it.product?.name || 'Product',
          quantity: qty,
          unitPriceCents,
          lineTotalCents,
        });
      }

      if (items.length > 0 && !cartMap.has(c.id)) {
        inactiveCartsValueCents += cartTotalCents;
        cartMap.set(c.id, {
          cartId: c.id,
          customerId: c.customer_id,
          customerName: c.customer?.name || 'Customer',
          customerEmail: c.customer?.email || 'N/A',
          updatedAt: c.updated_at,
          cartTotalCents,
          items,
        });
      }
    }

    const cartRecords = Array.from(cartMap.values());
    const uniqueCartInstancesCount = cartRecords.length;

    // 2. Query Active Carts (status='active' AND updated_at > cutoffDate)
    let activeQb = cartRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.id)', 'count')
      .innerJoin('cart_items', 'ci', 'ci.cart_id = c.id')
      .innerJoin('products', 'p', 'p.id = ci.product_id')
      .where("c.status = 'active'")
      .andWhere('c.updated_at > :cutoffDate', { cutoffDate });
    if (hasMerchant) {
      activeQb = activeQb.andWhere('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId });
    }
    const activeRaw = await activeQb.getRawOne();
    const activeCartsCount = activeRaw?.count ? parseInt(activeRaw.count, 10) : 0;

    // 3. Carts reached checkout
    let checkoutQb = cartRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.id)', 'count')
      .innerJoin('cart_items', 'ci', 'ci.cart_id = c.id')
      .innerJoin('products', 'p', 'p.id = ci.product_id')
      .where('c.converted_to_order_id IS NOT NULL');
    if (hasMerchant) {
      checkoutQb = checkoutQb.andWhere('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId });
    }
    const checkoutRaw = await checkoutQb.getRawOne();
    const cartsReachedCheckoutCount = checkoutRaw?.count ? parseInt(checkoutRaw.count, 10) : 0;

    // 4. Query Pending Orders (unpaid checkout started > 5 mins ago)
    const orderRepo = this.getOrderRepository();
    let pendingOrderQb = orderRepo
      .createQueryBuilder('o')
      .select('COUNT(DISTINCT o.id)', 'count')
      .addSelect('SUM(o.total_cents)', 'total')
      .where("o.status = 'pending'")
      .andWhere('o.created_at <= :cutoffDate', { cutoffDate });

    if (startDate && endDate) {
      pendingOrderQb = pendingOrderQb.andWhere('o.created_at >= :start AND o.created_at <= :end', { start: startDate, end: endDate });
    }

    if (hasMerchant) {
      pendingOrderQb = pendingOrderQb
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(OrderItem, 'item')
            .innerJoin('item.product', 'product')
            .where('item.order_id = o.id')
            .andWhere('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        })
        .setParameter('merchantId', merchantId);
    }

    const pendingResult = await pendingOrderQb.getRawOne();
    const pendingOrdersCount = pendingResult?.count ? parseInt(pendingResult.count, 10) : 0;
    const pendingOrdersValueCents = pendingResult?.total ? parseInt(pendingResult.total, 10) : 0;

    const abandonedCartsCount = uniqueCartInstancesCount + pendingOrdersCount;
    const revenueAtRiskCents = inactiveCartsValueCents + pendingOrdersValueCents;

    // Top abandoned products
    const topProdMap = new Map<string, { product_id: string; product_name: string; abandon_count: number }>();
    for (const cr of cartRecords) {
      for (const item of cr.items) {
        if (!topProdMap.has(item.productId)) {
          topProdMap.set(item.productId, {
            product_id: item.productId,
            product_name: item.productName,
            abandon_count: item.quantity,
          });
        } else {
          topProdMap.get(item.productId)!.abandon_count += item.quantity;
        }
      }
    }

    const topAbandonedProducts = Array.from(topProdMap.values())
      .sort((a, b) => b.abandon_count - a.abandon_count)
      .slice(0, 5);

    return {
      abandonedCartsCount,
      uniqueCartInstancesCount,
      pendingOrdersCount,
      uniqueCustomersCount: customerSet.size,
      totalUnitsCount,
      activeCartsCount,
      cartsReachedCheckoutCount,
      revenueAtRiskCents,
      carts: cartRecords,
      topAbandonedProducts,
    };
  }

  /**
   * Get comprehensive aggregated merchant analytics for AI insight generation
   */
  async getComprehensiveMerchantAnalytics(merchantId?: string): Promise<ComprehensiveMerchantAnalytics> {
    const targetMerchantId = isUuid(merchantId) ? merchantId! : 'default-merchant';
    const [metrics, funnel, responseBreakdown, failureReasons, canonical] = await Promise.all([
      this.getDashboardMetrics(merchantId),
      this.getRecoveryFunnel(merchantId),
      this.getCustomerResponseBreakdown(merchantId),
      this.getPaymentFailureReasons(merchantId),
      this.getAbandonedCartsCanonical(merchantId),
    ]);

    const activeCartsCount = canonical.activeCartsCount;
    const abandonedCartsCount = canonical.abandonedCartsCount;
    const cartsReachedCheckoutCount = canonical.cartsReachedCheckoutCount;
    const revenueAtRiskCents = canonical.revenueAtRiskCents;
    const topAbandonedProducts = canonical.topAbandonedProducts;
    const totalCarts = canonical.carts.length + activeCartsCount;

    const abandonedRatePercent = totalCarts > 0 ? Math.round((abandonedCartsCount / totalCarts) * 100) : 0;

    // Query Payment attempts
    const totalPaymentsCount = metrics.failed_payments_count + funnel.resolved;
    const failureRatePercent = totalPaymentsCount > 0 ? Math.round((metrics.failed_payments_count / totalPaymentsCount) * 100) : 0;

    // Query Order metrics
    let totalOrders = 0;
    let completedOrders = 0;
    let pendingOrdersCount = 0;
    try {
      const orderRepo = this.getOrderRepository();
      totalOrders = await orderRepo.count();
      pendingOrdersCount = await orderRepo.count({ where: { status: 'pending' as any } });
      completedOrders = await orderRepo.count({
        where: [
          { status: 'confirmed' as any },
          { status: 'shipped' as any },
          { status: 'delivered' as any },
          { status: 'completed' as any },
        ],
      });
    } catch {
      totalOrders = 0;
    }

    const averageOrderValueCents = completedOrders > 0 ? Math.round(metrics.total_revenue_cents / completedOrders) : 0;

    // Query Products and Inventory
    let totalListedProducts = 0;
    let totalUnitsInStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let topSellingProducts: Array<{ id: string; name: string; units_sold: number; available: number }> = [];

    try {
      const productRepo = this.dataSource.getRepository('Product');
      const inventoryRepo = this.dataSource.getRepository('Inventory');
      const orderItemRepo = this.dataSource.getRepository('OrderItem');

      const allProducts: any[] = await productRepo.find({ take: 100 });
      totalListedProducts = allProducts.length;

      for (const p of allProducts) {
        const inv: any = await inventoryRepo.findOne({ where: { product_id: p.id } });
        const available = Math.max(0, (inv?.quantity_on_hand || 0) - (inv?.reserved || 0));
        totalUnitsInStock += available;

        if (available === 0) outOfStockCount++;
        else if (available <= 5) lowStockCount++;

        const soldRaw = await orderItemRepo
          .createQueryBuilder('oi')
          .select('SUM(oi.quantity)', 'sold')
          .where('oi.product_id = :pId', { pId: p.id })
          .getRawOne();
        const unitsSold = parseInt(soldRaw?.sold || '0', 10);

        topSellingProducts.push({
          id: p.id,
          name: p.name,
          units_sold: unitsSold,
          available,
        });
      }

      topSellingProducts.sort((a, b) => b.units_sold - a.units_sold);
      topSellingProducts = topSellingProducts.slice(0, 5);
    } catch {
      totalListedProducts = 0;
    }

    // Query Customer metrics
    let totalUniqueCustomers = 0;
    let repeatCustomers = 0;
    try {
      const customerRepo = this.dataSource.getRepository('Customer');
      totalUniqueCustomers = await customerRepo.count();

      const repeatRaw = await this.getOrderRepository()
        .createQueryBuilder('o')
        .select('o.customer_id', 'customer_id')
        .addSelect('COUNT(o.id)', 'order_count')
        .where('o.customer_id IS NOT NULL')
        .groupBy('o.customer_id')
        .having('COUNT(o.id) > 1')
        .getRawMany();
      repeatCustomers = repeatRaw.length;
    } catch {
      totalUniqueCustomers = 0;
    }

    // Convert minor currency units (cents) to Rupee amounts (/ 100)
    return {
      merchant_id: targetMerchantId,
      payments: {
        total_attempts: totalPaymentsCount,
        successful_count: funnel.resolved,
        failed_count: metrics.failed_payments_count,
        failure_rate_percent: failureRatePercent,
        total_failed_rupees: Number((metrics.failed_payments_total_cents / 100).toFixed(2)),
        total_recovered_rupees: Number((metrics.revenue_recovered_cents / 100).toFixed(2)),
        recovery_rate_percent: metrics.recovery_rate_percent,
        top_failure_reasons: failureReasons.reasons.map((r) => ({
          reason: r.reason,
          count: r.count,
          amount_rupees: Number((r.total_amount_cents / 100).toFixed(2)),
        })),
      },
      carts: {
        total_carts: totalCarts,
        active_count: activeCartsCount,
        abandoned_count: abandonedCartsCount,
        carts_reached_checkout: cartsReachedCheckoutCount,
        abandoned_rate_percent: abandonedRatePercent,
        revenue_at_risk_rupees: Number((revenueAtRiskCents / 100).toFixed(2)),
        top_abandoned_products: topAbandonedProducts,
      },
      recovery: {
        total_cases: funnel.total,
        open: funnel.open,
        in_progress: funnel.in_progress,
        resolved: funnel.resolved,
        abandoned: funnel.abandoned,
        customer_declined: funnel.customer_declined,
        response_breakdown: {
          accepted: responseBreakdown.accepted,
          refused: responseBreakdown.refused,
          promised: responseBreakdown.promised,
          unclear: responseBreakdown.unclear,
        },
      },
      orders: {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        pending_orders: pendingOrdersCount,
        cancelled_orders: metrics.orders_cancelled_count,
        returned_orders: metrics.orders_returned_count,
        total_revenue_rupees: Number((metrics.total_revenue_cents / 100).toFixed(2)),
        average_order_value_rupees: Number((averageOrderValueCents / 100).toFixed(2)),
      },
      products_and_inventory: {
        total_listed_products: totalListedProducts,
        total_units_in_stock: totalUnitsInStock,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        top_selling_products: topSellingProducts,
      },
      customers: {
        total_unique_customers: totalUniqueCustomers,
        repeat_customers: repeatCustomers,
      },
    };
  }
}
