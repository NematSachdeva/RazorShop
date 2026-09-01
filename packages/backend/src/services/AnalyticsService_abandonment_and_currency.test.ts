/**
 * AnalyticsService 5-Minute Cart Abandonment & Currency Regression Test Suite
 * 
 * Verifies exact 5-minute abandonment lifecycle rules, dynamic fulfillment decreases,
 * Razorpay pending checkout tracking, empty cart exclusions, and ₹ currency formatting.
 */

import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { AnalyticsService } from './AnalyticsService.js';
import { MerchantAgent } from './MerchantAgent.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Product } from '../models/Product.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { randomUUID } from 'crypto';

describe('5-Minute Cart Abandonment & Currency Regression Suite', () => {
  let analyticsService: AnalyticsService;
  let merchantAgent: MerchantAgent;
  let testCustomer: Customer;
  let testMerchant: Merchant;

  beforeAll(async () => {
    await initializeTestDatabase();
    analyticsService = new AnalyticsService(TestDataSource);
    merchantAgent = new MerchantAgent(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    delete process.env.CART_ABANDONMENT_MINUTES;

    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    const customerRepo = TestDataSource.getRepository(Customer);
    testCustomer = await customerRepo.save(
      customerRepo.create({
        email: `customer-${Date.now()}@example.com`,
        name: 'Test Customer',
        role: 'customer',
      })
    );

    const merchantRepo = TestDataSource.getRepository(Merchant);
    testMerchant = await merchantRepo.save(
      merchantRepo.create({
        id: randomUUID(),
        email: `merchant-${Date.now()}@example.com`,
        name: 'Test Merchant',
      })
    );

    const configRepo = TestDataSource.getRepository(MerchantConfig);
    await configRepo.save(
      configRepo.create({
        merchant_id: testMerchant.id,
        ai_insights_enabled: true,
        max_discount_percent: 30,
        min_confidence_score: 70,
      })
    );
  });

  test('TEST 1: Cart inactive for 4 minutes -> NOT abandoned', async () => {
    // Default 5-minute timeout applies
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: '4-Min Inactive Item',
        price_cents: 349222,
        merchant_id: testMerchant.id,
      })
    );

    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'active',
        updated_at: new Date(Date.now() - 4 * 60 * 1000), // 4 minutes ago
      })
    );

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 349222,
      })
    );

    const analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.active_count).toBe(1);
    expect(analytics.carts.abandoned_count).toBe(0);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(0);
  });

  test('TEST 2: Cart inactive for exactly/over 5 minutes -> abandoned', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: '5-Min Inactive Item',
        price_cents: 349222,
        merchant_id: testMerchant.id,
      })
    );

    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'active',
        updated_at: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
      })
    );

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 349222,
      })
    );

    const analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(1);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(3492.22);
  });

  test('TEST 3: Cart becomes abandoned -> count = 1. Then customer completes order -> abandoned count decreases to 0', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Fulfill Test Item',
        price_cents: 250000,
        merchant_id: testMerchant.id,
      })
    );

    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'active',
        updated_at: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      })
    );

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 250000,
      })
    );

    // T+10 min: Inactive -> Abandoned count = 1
    let analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(1);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(2500.00);

    // Customer returns and completes checkout
    const orderRepo = TestDataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: 'ORD-FULFILLED-1',
        status: 'confirmed',
        subtotal_cents: 250000,
        total_cents: 250000,
      })
    );

    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 250000,
        line_total_cents: 250000,
      })
    );

    cart.status = 'converted';
    cart.converted_to_order_id = order.id;
    await cartRepo.save(cart);

    // After fulfillment: Abandoned count decreases to 0!
    analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(0);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(0);
    expect(analytics.orders.completed_orders).toBe(1);
    expect(analytics.orders.total_revenue_rupees).toBe(2500.00);
  });

  test('TEST 4: Successful payment/order -> counted as completed conversion and revenue -> NOT counted as abandoned', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Direct Order Product',
        price_cents: 120000,
        merchant_id: testMerchant.id,
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: 'ORD-DIRECT-1',
        status: 'confirmed',
        subtotal_cents: 120000,
        total_cents: 120000,
      })
    );

    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 120000,
        line_total_cents: 120000,
      })
    );

    const analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.orders.completed_orders).toBe(1);
    expect(analytics.orders.total_revenue_rupees).toBe(1200.00);
    expect(analytics.carts.abandoned_count).toBe(0);
  });

  test('TEST 5: Razorpay checkout opened but payment not completed -> order pending -> after 5 minutes contributes to abandoned/at-risk analytics', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Razorpay Unpaid Product',
        price_cents: 499900,
        merchant_id: testMerchant.id,
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: 'ORD-RAZORPAY-PENDING',
        status: 'pending',
        subtotal_cents: 499900,
        total_cents: 499900,
        created_at: new Date(Date.now() - 6 * 60 * 1000), // 6 mins ago
      })
    );

    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 499900,
        line_total_cents: 499900,
      })
    );

    const cartRepo = TestDataSource.getRepository(Cart);
    await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'converted',
        converted_to_order_id: order.id,
        updated_at: new Date(Date.now() - 6 * 60 * 1000),
      })
    );

    const analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.orders.completed_orders).toBe(0);
    expect(analytics.orders.pending_orders).toBe(1);
    expect(analytics.carts.abandoned_count).toBe(1);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(4999.00);
  });

  test('TEST 6: Pending checkout later successfully paid -> removed from abandoned/at-risk analytics -> counted as successful revenue', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Razorpay Paid Later Product',
        price_cents: 300000,
        merchant_id: testMerchant.id,
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: 'ORD-RAZORPAY-LATER-PAID',
        status: 'pending',
        subtotal_cents: 300000,
        total_cents: 300000,
        created_at: new Date(Date.now() - 15 * 60 * 1000),
      })
    );

    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 300000,
        line_total_cents: 300000,
      })
    );

    // Initial state: Pending -> Abandoned count = 1
    let analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(1);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(3000.00);

    // Customer completes payment
    order.status = 'confirmed';
    await orderRepo.save(order);

    // After payment: Removed from abandoned analytics & counted as successful revenue
    analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(0);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(0);
    expect(analytics.orders.completed_orders).toBe(1);
    expect(analytics.orders.total_revenue_rupees).toBe(3000.00);
  });

  test('TEST 7: Empty cart -> never counted as abandoned', async () => {
    const cartRepo = TestDataSource.getRepository(Cart);
    await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'active',
        updated_at: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      })
    );

    const analytics = await analyticsService.getComprehensiveMerchantAnalytics(testMerchant.id);
    expect(analytics.carts.abandoned_count).toBe(0);
    expect(analytics.carts.revenue_at_risk_rupees).toBe(0);
  });

  test('TEST 8: Verify analytics amount continues to use existing ₹ convention everywhere in merchant insights/dashboard', async () => {
    const productRepo = TestDataSource.getRepository(Product);
    const product = await productRepo.save(
      productRepo.create({
        name: 'Format Verification Watch',
        price_cents: 349222,
        merchant_id: testMerchant.id,
      })
    );

    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(
      cartRepo.create({
        customer_id: testCustomer.id,
        status: 'active',
        updated_at: new Date(Date.now() - 10 * 60 * 1000),
      })
    );

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: cart.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 349222,
      })
    );

    const insights = await merchantAgent.generateDailyInsights(testMerchant.id);
    const cartInsight = insights.find((i) => i.type === 'abandoned_cart_patterns');

    expect(cartInsight).toBeDefined();
    // Must contain ₹3,492.22 and NEVER cents, paise, or INR
    expect(cartInsight?.summary).toContain('₹3,492.22');
    expect(cartInsight?.summary).not.toContain('349222 cents');
    expect(cartInsight?.summary).not.toContain('INR');
  });
});
