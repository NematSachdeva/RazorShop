/**
 * Test Suite: Customer Cart, Stock Bounds & Itemized Bundle Deal Corrections
 * Verifies accurate stock calculation (quantity_on_hand - reserved),
 * cart quantity bounds, itemized bundle discount application (ignoring unrelated cart items),
 * and discount propagation into Order & Razorpay Payment attempt.
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
import { Recommendation } from '../models/Recommendation.js';
import { createAuthRouter } from './auth.js';
import { createProductsRouter } from './products.js';
import { createCartsRouter } from './carts.js';
import { createOrdersRouter } from './orders.js';
import { createPaymentsRouter } from './payments.js';
import { createMerchantRouter } from './merchant.js';
import { AuthService } from '../services/AuthService.js';
import { ProductService } from '../services/ProductService.js';
import { CartService } from '../services/CartService.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentService } from '../services/PaymentService.js';

describe('Customer Cart, Inventory Stock & Itemized Bundle Deal Pipeline', () => {
  let app: Express;
  let authService: AuthService;
  let productService: ProductService;
  let cartService: CartService;
  let orderService: OrderService;
  let paymentService: PaymentService;

  let customerToken: string;
  let customerId: string;
  let productA: Product;
  let productB: Product;
  let productC: Product;
  let recommendationId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    authService = new AuthService(TestDataSource);
    productService = new ProductService(TestDataSource);
    cartService = new CartService(TestDataSource);
    orderService = new OrderService(TestDataSource);
    paymentService = new PaymentService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/products', createProductsRouter(productService));
    app.use('/api/carts', createCartsRouter(cartService, authService));
    app.use('/api/orders', createOrdersRouter(orderService, authService));
    app.use('/api/payments', createPaymentsRouter(paymentService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    const cEmail = `bundle_cust_${Date.now()}@test.com`;
    const cust = await customerRepo.save(
      customerRepo.create({
        email: cEmail,
        name: 'Bundle Test Customer',
        role: 'customer',
      })
    );
    customerId = cust.id;
    customerToken = authService.generateToken({
      id: cust.id,
      email: cust.email,
      role: 'customer',
    });

    const productRepo = TestDataSource.getRepository(Product);
    const inventoryRepo = TestDataSource.getRepository(Inventory);

    // Product A: ₹1,000 (100000 cents)
    productA = await productRepo.save(
      productRepo.create({
        name: 'Wireless Ergonomic Mouse',
        price_cents: 100000,
        category: 'Accessories',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: productA.id,
        quantity_on_hand: 5,
        reserved: 1, // available = 4
      })
    );

    // Product B: ₹500 (50000 cents)
    productB = await productRepo.save(
      productRepo.create({
        name: 'Mechanical Keycaps Set',
        price_cents: 50000,
        category: 'Accessories',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: productB.id,
        quantity_on_hand: 20,
        reserved: 0, // available = 20
      })
    );

    // Product C: ₹2,000 (200000 cents) - Unrelated expensive item
    productC = await productRepo.save(
      productRepo.create({
        name: 'Gaming Monitor Arm',
        price_cents: 200000,
        category: 'Furniture',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: productC.id,
        quantity_on_hand: 10,
        reserved: 0, // available = 10
      })
    );

    // Create a recommendation bundle containing Product A + Product B with 10% OFF
    const recRepo = TestDataSource.getRepository(Recommendation);
    const rec = await recRepo.save(
      recRepo.create({
        product_id: productA.id,
        recommendation_type: 'product_to_product',
        reason: 'frequently_bought_together' as any,
        recommended_products: [
          { product_id: productB.id, score: 0.95, reason: 'frequently_bought_together' },
        ],
        metadata: {
          bundle: {
            title: 'Desk Ergonomics Combo',
            discount_percent: 10,
            original_total_cents: 150000,
            final_total_cents: 135000,
            savings_cents: 15000,
            products: [
              { id: productA.id, name: productA.name, price_cents: 100000 },
              { id: productB.id, name: productB.name, price_cents: 50000 },
            ],
          },
        },
      })
    );
    recommendationId = rec.id;
  });

  it('1. Product API returns available stock = quantity_on_hand - reserved', async () => {
    const res = await request(app).get(`/api/products/${productA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.inventory.quantity_on_hand).toBe(5);
    expect(res.body.inventory.reserved).toBe(1);
    expect(res.body.inventory.available).toBe(4);
  });

  it('2. Cart quantity controls enforce available stock limits', async () => {
    const cart = await cartService.getOrCreateCart(customerId);

    // Add Product A (available = 4)
    await cartService.addToCart(cart.id, productA.id, 2);

    // Update quantity to 4 (within stock limit)
    const updateRes = await request(app)
      .put(`/api/carts/${cart.id}/items/${productA.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 4 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.items[0].quantity).toBe(4);

    // Attempt to increase quantity to 5 (exceeds available 4)
    const invalidRes = await request(app)
      .put(`/api/carts/${cart.id}/items/${productA.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 5 });

    expect(invalidRes.status).toBe(409);
    expect(invalidRes.body.error).toContain('inventory');
  });

  it('3. Itemized Bundle Discount applies ONLY to bundle products and ignores unrelated cart items', async () => {
    const cart = await cartService.getOrCreateCart(customerId);

    // Add unrelated expensive Product C (₹2,000 / 200000 cents) to cart
    await cartService.addToCart(cart.id, productC.id, 1);

    // Add bundle deal A + B (10% OFF on ₹1,000 + ₹500 = ₹1,500)
    const bundleRes = await request(app)
      .post(`/api/carts/${cart.id}/bundle`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ recommendation_id: recommendationId });

    expect(bundleRes.status).toBe(200);

    // Subtotal = Product C (200000) + Product A (100000) + Product B (50000) = 350000 cents (₹3,500)
    expect(bundleRes.body.subtotal_cents).toBe(350000);

    // Bundle discount MUST be 10% of (100000 + 50000) = 15000 cents (₹150)
    // NOT 10% of ₹3,500 (35000 cents)!
    expect(bundleRes.body.discount_cents).toBe(15000);

    // Total = 350000 - 15000 = 335000 cents (₹3,350)
    expect(bundleRes.body.total_cents).toBe(335000);

    // Verify Product prices remain intact outside discount calculation
    const prodARes = await request(app).get(`/api/products/${productA.id}`);
    expect(prodARes.body.price_cents).toBe(100000);
  });

  it('4. Discounted total propagates accurately into Order and Razorpay payment attempt', async () => {
    const cart = await cartService.getOrCreateCart(customerId);
    await cartService.addToCart(cart.id, productC.id, 1);
    await cartService.addBundleToCart(cart.id, recommendationId);

    // Create Order from Cart
    const order = await orderService.createOrderFromCart(cart.id, customerId);

    expect(order.subtotal_cents).toBe(350000);
    expect(order.discount_cents).toBe(15000);
    expect(order.total_cents).toBe(335000);

    // Create Payment Attempt
    const paymentAttempt = await paymentService.createPaymentAttempt(order.id);
    expect(paymentAttempt.amount_cents).toBe(335000); // Sent to Razorpay!
  });
});
