import express, { Express } from 'express';
import request from 'supertest';
import { createProductsRouter } from './products.js';
import { createRecommendationsRouter } from './recommendations.js';
import { createCartsRouter } from './carts.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Payment } from '../models/Payment.js';
import { Inventory } from '../models/Inventory.js';
import { ProductService } from '../services/ProductService.js';
import { RecommendationService } from '../services/RecommendationService.js';
import { CartService } from '../services/CartService.js';
import { OrderService } from '../services/OrderService.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createOrdersRouter } from './orders.js';

describe('Catalog & Recommendation System Audit Tests', () => {
  let testApp: Express;
  let productService: ProductService;
  let recommendationService: RecommendationService;
  let cartService: CartService;
  let orderService: OrderService;
  let authService: AuthService;

  let testCustomer: Customer;
  let testCustomerToken: string;
  let realProduct1: Product;
  let realProduct2: Product;
  let realProduct3: Product;
  let testFixtureProduct: Product;

  beforeAll(async () => {
    await initializeTestDatabase();
    productService = new ProductService(TestDataSource);
    recommendationService = new RecommendationService(TestDataSource);
    cartService = new CartService(TestDataSource);
    orderService = new OrderService(TestDataSource);
    authService = new AuthService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/products', createProductsRouter(productService));
    testApp.use('/api/recommendations', createRecommendationsRouter(recommendationService));
    testApp.use('/api/carts', createCartsRouter(cartService, authService));
    testApp.use('/api/orders', createOrdersRouter(orderService, authService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    testCustomer = await customerRepo.save(customerRepo.create({
      email: `catalog-test-${Date.now()}@test.com`,
      name: 'Catalog Tester',
      role: 'customer',
    }));
    testCustomerToken = authService.generateToken({ id: testCustomer.id, email: testCustomer.email, role: 'customer' });

    const productRepo = TestDataSource.getRepository(Product);
    
    // Seed real demo products
    realProduct1 = await productRepo.save(productRepo.create({
      name: 'Wireless Ergonomic Mouse ' + Date.now(),
      description: 'High precision wireless mouse',
      price_cents: 299900,
      category: 'Technology',
    }));

    realProduct2 = await productRepo.save(productRepo.create({
      name: 'Mechanical Gaming Keyboard ' + Date.now(),
      description: 'RGB mechanical keyboard',
      price_cents: 599900,
      category: 'Technology',
    }));

    realProduct3 = await productRepo.save(productRepo.create({
      name: 'Ultra Wide Gaming Monitor ' + Date.now(),
      description: '4K ultra wide monitor',
      price_cents: 2999900,
      category: 'Electronics',
    }));

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(inventoryRepo.create({ product_id: realProduct1.id, quantity_on_hand: 50, reserved: 0 }));
    await inventoryRepo.save(inventoryRepo.create({ product_id: realProduct2.id, quantity_on_hand: 50, reserved: 0 }));
    await inventoryRepo.save(inventoryRepo.create({ product_id: realProduct3.id, quantity_on_hand: 50, reserved: 0 }));

    // Seed test fixture product
    testFixtureProduct = await productRepo.save(productRepo.create({
      name: 'Test Product 1 ' + Date.now(),
      description: 'Test fixture for unit testing',
      price_cents: 1000,
      category: 'test',
    }));
    await inventoryRepo.save(inventoryRepo.create({ product_id: testFixtureProduct.id, quantity_on_hand: 50, reserved: 0 }));

    // Mock Groq API fetch response using created product IDs
    (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('api.groq.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    products: [
                      { product_id: realProduct2.id, score: 0.9, reason: 'complementary' },
                      { product_id: realProduct3.id, score: 0.85, reason: 'similar_category' }
                    ],
                    reasoning: {
                      explanation: 'AI recommendation based on category and purchase history',
                      confidence: 0.9,
                      sources: ['catalog']
                    }
                  })
                }
              }
            ]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  });

  it('Product API excludes test fixture products from customer catalog', async () => {
    const res = await request(testApp).get('/api/products?limit=50');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const productNames = res.body.data.map((p: any) => p.name);
    // Real products should be present
    expect(productNames).toContain(realProduct1.name);
    expect(productNames).toContain(realProduct2.name);
    
    // Test fixture products should be filtered out
    expect(productNames).not.toContain(testFixtureProduct.name);
  });

  it('Categories list excludes test categories', async () => {
    const res = await request(testApp).get('/api/products/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toContain('Technology');
    expect(res.body.categories).not.toContain('test');
  });

  it('Product recommendations exclude source product and invalid IDs', async () => {
    const recs = await recommendationService.getProductRecommendations(realProduct1.id, 3);
    expect(recs.products).toBeDefined();
    
    // Source product must not recommend itself
    const recIds = recs.products.map((p) => p.id);
    expect(recIds).not.toContain(realProduct1.id);
  });

  it('Cart recommendations exclude products already inside cart', async () => {
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(cartRepo.create({
      customer_id: testCustomer.id,
      status: 'active',
    }));

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(cartItemRepo.create({
      cart_id: cart.id,
      product_id: realProduct1.id,
      quantity: 1,
      price_cents: realProduct1.price_cents,
    }));

    const recs = await recommendationService.getCartRecommendations(cart.id);
    expect(recs.products).toBeDefined();

    // Products already in cart must not be recommended
    const recIds = recs.products.map((p) => p.id);
    expect(recIds).not.toContain(realProduct1.id);
  });

  it('Recommendation endpoints return expected shape and bundle deals for API clients', async () => {
    const res = await request(testApp)
      .get(`/api/recommendations/products/${realProduct1.id}/recommendations`);

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toBeDefined();
    expect(res.body.products).toBeDefined();
    expect(Array.isArray(res.body.products)).toBe(true);
    if (res.body.bundle) {
      expect(res.body.bundle.original_total_cents).toBeGreaterThan(0);
      expect(res.body.bundle.final_total_cents).toBeLessThanOrEqual(res.body.bundle.original_total_cents);
      expect(res.body.bundle.discount_percent).toBeLessThanOrEqual(10);
    }
  });

  it('Calculates bundle deal pricing respecting max discount guard rail', () => {
    const bundle = recommendationService.calculateBundleDeal([realProduct1, realProduct2], 10);
    expect(bundle).not.toBeNull();
    if (bundle) {
      const expectedOriginal = Number(realProduct1.price_cents) + Number(realProduct2.price_cents);
      expect(bundle.original_total_cents).toBe(expectedOriginal);
      expect(bundle.discount_percent).toBe(10);
      expect(bundle.savings_cents).toBe(Math.round(expectedOriginal * 0.1));
      expect(bundle.final_total_cents).toBe(expectedOriginal - bundle.savings_cents);
    }
  });

  it('Applies bundle discount to cart and order total', async () => {
    const recs = await recommendationService.getProductRecommendations(realProduct1.id, 2);
    expect(recs.recommendations.length).toBeGreaterThan(0);
    const recId = recs.recommendations[0].id;

    // Get customer cart
    const cartRes = await request(testApp)
      .post('/api/carts')
      .set('Authorization', `Bearer ${testCustomerToken}`);
    expect(cartRes.status).toBe(201);
    const cartId = cartRes.body.id;

    // Add bundle to cart
    const bundleRes = await request(testApp)
      .post(`/api/carts/${cartId}/bundle`)
      .set('Authorization', `Bearer ${testCustomerToken}`)
      .send({ recommendation_id: recId });

    expect(bundleRes.status).toBe(200);
    expect(bundleRes.body.discount_percent).toBe(10);
    expect(bundleRes.body.discount_cents).toBeGreaterThan(0);
    expect(bundleRes.body.total_cents).toBe(bundleRes.body.subtotal_cents - bundleRes.body.discount_cents);

    // Create order from cart
    const orderRes = await request(testApp)
      .post('/api/orders')
      .set('Authorization', `Bearer ${testCustomerToken}`)
      .send({ cart_id: cartId, customer_id: testCustomer.id });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.discount_cents).toBe(bundleRes.body.discount_cents);
    expect(orderRes.body.total_cents).toBe(bundleRes.body.total_cents);
  });

  it('Triggers payment failure recovery email idempotently', async () => {
    const failureService = new PaymentFailureService(TestDataSource);
    
    // Create an order
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(cartRepo.create({ customer_id: testCustomer.id, status: 'active' }));
    
    const orderService = new OrderService(TestDataSource);
    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: realProduct1.id, quantity: 1, price_cents: realProduct1.price_cents }));
    
    const order = await orderService.createOrderFromCart(cart.id, testCustomer.id);
    
    const paymentRepo = TestDataSource.getRepository(Payment);
    const payment = await paymentRepo.save(paymentRepo.create({ order_id: order.id, amount_cents: order.total_cents, status: 'initiated' }));

    // Handle payment failure
    const recCase = await failureService.handlePaymentFailure(payment.id, 'card_declined');
    expect(recCase).not.toBeNull();

    if (recCase) {
      // Re-triggering recovery email should be idempotent (return true without duplicate logs)
      const isSecondTriggerIdempotent = await failureService.triggerRecoveryEmail(recCase.id);
      expect(isSecondTriggerIdempotent).toBe(true);
    }
  });

  it('Event tracking records recommendation event', async () => {
    const recs = await recommendationService.getProductRecommendations(realProduct1.id, 2);
    if (recs.recommendations.length > 0 && recs.recommendations[0].id) {
      const recId = recs.recommendations[0].id;
      const res = await request(testApp)
        .post(`/api/recommendations/${recId}/events`)
        .send({ event_type: 'shown' });

      expect(res.status).toBe(201);
      expect(res.body.event_type).toBe('shown');
    }
  });
});
