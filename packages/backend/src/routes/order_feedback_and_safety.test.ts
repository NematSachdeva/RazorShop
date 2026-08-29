import express, { Express } from 'express';
import request from 'supertest';
import { createOrdersRouter } from './orders.js';
import { createMerchantRouter } from './merchant.js';
import { createCartsRouter } from './carts.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { OrderFeedback } from '../models/OrderFeedback.js';
import { Recommendation } from '../models/Recommendation.js';
import { AuthService } from '../services/AuthService.js';
import { OrderService } from '../services/OrderService.js';
import { CartService } from '../services/CartService.js';
import { EmailService } from '../services/EmailService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Order Feedback System, Bundle Pricing Scoping, and Environmental Safety Tests', () => {
  let app: Express;
  let authService: AuthService;
  let orderService: OrderService;
  let cartService: CartService;

  let customer1: Customer;
  let customer2: Customer;
  let customer1Token: string;
  let customer2Token: string;

  let merchant: Merchant;
  let merchantToken: string;

  let productA: Product;
  let productB: Product;
  let productUnrelated: Product;
  let testOrder: Order;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);
    orderService = new OrderService(TestDataSource);
    cartService = new CartService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/orders', createOrdersRouter(orderService, authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use('/api/carts', createCartsRouter(cartService, authService));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_feedbacks, audit_logs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    const customerRepo = TestDataSource.getRepository(Customer);
    customer1 = await customerRepo.save(
      customerRepo.create({
        email: 'customer1.feedback@test.com',
        name: 'Feedback Tester 1',
        role: 'customer',
      })
    );
    customer2 = await customerRepo.save(
      customerRepo.create({
        email: 'customer2.feedback@test.com',
        name: 'Feedback Tester 2',
        role: 'customer',
      })
    );

    customer1Token = authService.generateToken({ id: customer1.id, email: customer1.email, role: 'customer' });
    customer2Token = authService.generateToken({ id: customer2.id, email: customer2.email, role: 'customer' });

    const merchantRepo = TestDataSource.getRepository(Merchant);
    merchant = await merchantRepo.save(
      merchantRepo.create({
        email: 'merchant.feedback@test.com',
        name: 'Merchant Feedback Tester',
      })
    );
    merchantToken = authService.generateToken({ id: merchant.id, email: merchant.email, role: 'merchant' });

    const productRepo = TestDataSource.getRepository(Product);
    productA = await productRepo.save(
      productRepo.create({
        name: 'Product A (₹1000)',
        price_cents: 100000,
        category: 'Electronics',
        merchant_id: merchant.id,
      })
    );
    productB = await productRepo.save(
      productRepo.create({
        name: 'Product B (₹2000)',
        price_cents: 200000,
        category: 'Electronics',
        merchant_id: merchant.id,
      })
    );
    productUnrelated = await productRepo.save(
      productRepo.create({
        name: 'Product Unrelated C (₹50000)',
        price_cents: 5000000,
        category: 'Luxury',
        merchant_id: merchant.id,
      })
    );

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(inventoryRepo.create({ product_id: productA.id, quantity_on_hand: 50, reserved: 0 }));
    await inventoryRepo.save(inventoryRepo.create({ product_id: productB.id, quantity_on_hand: 50, reserved: 0 }));
    await inventoryRepo.save(inventoryRepo.create({ product_id: productUnrelated.id, quantity_on_hand: 50, reserved: 0 }));

    const orderRepo = TestDataSource.getRepository(Order);
    testOrder = await orderRepo.save(
      orderRepo.create({
        customer_id: customer1.id,
        order_number: `ORD-FB-${Date.now()}`,
        status: 'confirmed',
        subtotal_cents: 300000,
        tax_cents: 0,
        discount_cents: 0,
        total_cents: 300000,
        items: [],
      })
    );
  });

  it('1. Customer can submit and update feedback on their own order', async () => {
    // Initial feedback submission
    const res1 = await request(app)
      .post(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        rating: 5,
        comment: 'Excellent delivery and packaging!',
        category: 'Delivery',
      });

    expect(res1.status).toBe(200);
    expect(res1.body.rating).toBe(5);
    expect(res1.body.comment).toBe('Excellent delivery and packaging!');
    expect(res1.body.category).toBe('Delivery');

    // Update existing feedback
    const res2 = await request(app)
      .post(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        rating: 4,
        comment: 'Updated: Product quality is great too.',
        category: 'Product',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.rating).toBe(4);
    expect(res2.body.comment).toBe('Updated: Product quality is great too.');

    // Fetch feedback
    const fetchRes = await request(app)
      .get(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.feedback.rating).toBe(4);
  });

  it('2. Customer cannot submit or view feedback on another customer\'s order', async () => {
    // Customer 2 attempts to submit feedback on Customer 1's order
    const submitRes = await request(app)
      .post(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        rating: 1,
        comment: 'Malicious feedback attempt',
      });

    expect(submitRes.status).toBe(403);

    // Customer 2 attempts to view Customer 1's feedback
    const viewRes = await request(app)
      .get(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(viewRes.status).toBe(403);
  });

  it('3. Feedback rating validation rejects non 1-5 values', async () => {
    const invalidRes = await request(app)
      .post(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        rating: 6,
        comment: 'Out of bounds',
      });

    expect(invalidRes.status).toBe(400);
  });

  it('4. Merchant feedback dashboard endpoint returns real database feedback analytics', async () => {
    // Submit feedback for customer1
    await request(app)
      .post(`/api/orders/${testOrder.id}/feedback`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        rating: 5,
        comment: 'Super fast checkout',
        category: 'Checkout',
      });

    // Merchant fetches feedback metrics
    const merchantRes = await request(app)
      .get('/api/merchant/feedback')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(merchantRes.status).toBe(200);
    expect(merchantRes.body.total_feedbacks).toBe(1);
    expect(merchantRes.body.average_rating).toBe(5);
    expect(merchantRes.body.rating_distribution[5]).toBe(1);
    expect(merchantRes.body.recent_feedbacks.length).toBe(1);
  });

  it('5. Bundle discount applies ONLY to bundle products (₹1000 + ₹2000 = ₹300 discount) while ₹50000 item stays undiscounted', async () => {
    // Create recommendation bundle containing Product A + Product B
    const recRepo = TestDataSource.getRepository(Recommendation);
    const rec = await recRepo.save(
      recRepo.create({
        product_id: productA.id,
        recommendation_type: 'product_to_product',
        reason: 'frequently_bought_together',
        recommended_products: [{ product_id: productB.id, score: 0.9 }],
        metadata: {
          bundle: {
            products: [productA, productB],
            original_total_cents: 300000,
            discount_percent: 10,
            savings_cents: 30000,
            final_total_cents: 270000,
          },
        },
      })
    );

    // Create cart for customer1
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(
      cartRepo.create({
        customer_id: customer1.id,
        status: 'active',
      })
    );

    // Add bundle (Product A + Product B) to cart
    await cartService.addBundleToCart(cart.id, rec.id);

    // Add unrelated high-value product C (₹50000 = 5,000,000 cents) to cart
    await cartService.addToCart(cart.id, productUnrelated.id, 1);

    // Fetch cart response
    const cartRes = await cartService.getCartById(cart.id);

    expect(cartRes).not.toBeNull();
    if (cartRes) {
      // Subtotal = 1,000,00 + 2,000,00 + 50,000,00 = 53,000,00 cents (₹53000)
      expect(cartRes.subtotal_cents).toBe(5300000);
      // Bundle discount (10% of ₹3000 = ₹300 = 30000 cents)
      expect((cartRes as any).discount_cents).toBe(30000);
      // Final total = ₹53000 - ₹300 = ₹52700 (5,270,000 cents)
      expect(cartRes.total_cents).toBe(5270000);
    }
  });

  it('6. EmailService defaults to mock safety mode suppressing network calls when EMAIL_DELIVERY_MODE is not live', async () => {
    const emailService = new EmailService();

    const result = await emailService.sendRecoveryNotification(
      'safe.customer@gmail.com',
      'Safe Customer',
      'ORD-SAFE-99',
      { amount: 2500, reason: 'card_declined', recoveryLink: 'http://localhost/rec' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');
  });
});
