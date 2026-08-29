import express, { Express } from 'express';
import request from 'supertest';
import { createOrdersRouter } from './orders.js';
import { CartService } from '../services/CartService.js';
import { createCartsRouter } from './carts.js';
import { createRecommendationsRouter } from './recommendations.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { OrderService } from '../services/OrderService.js';
import { RecommendationService } from '../services/RecommendationService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Customer Orders Scoping and Regressions', () => {
  let testApp: Express;
  let testOrderService: OrderService;
  let testCartService: CartService;
  let testRecommendationService: RecommendationService;
  let authService: AuthService;

  let customer1: Customer;
  let customer2: Customer;
  let token1: string;
  let token2: string;
  let testProduct: Product;

  beforeAll(async () => {
    await initializeTestDatabase();
    testOrderService = new OrderService(TestDataSource);
    testCartService = new CartService(TestDataSource);
    testRecommendationService = new RecommendationService(TestDataSource);
    authService = new AuthService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/orders', createOrdersRouter(testOrderService, authService));
    testApp.use('/api/carts', createCartsRouter(testCartService, authService));
    testApp.use('/api/recommendations', createRecommendationsRouter(testRecommendationService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    
    customer1 = await customerRepo.save(customerRepo.create({
      email: `scoping1-${Date.now()}@test.com`,
      name: 'Customer One',
      role: 'customer',
    }));
    token1 = authService.generateToken({ id: customer1.id, email: customer1.email, role: 'customer' });

    customer2 = await customerRepo.save(customerRepo.create({
      email: `scoping2-${Date.now()}@test.com`,
      name: 'Customer Two',
      role: 'customer',
    }));
    token2 = authService.generateToken({ id: customer2.id, email: customer2.email, role: 'customer' });

    const productRepo = TestDataSource.getRepository(Product);
    testProduct = await productRepo.save(productRepo.create({
      name: 'Scoping Test Product',
      description: 'Scoping test product',
      price_cents: 25000,
      category: 'test',
    }));

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    await inventoryRepo.save(inventoryRepo.create({
      product_id: testProduct.id,
      quantity_on_hand: 50,
      reserved: 0,
    }));
  });

  it('customer cannot access another customer\'s orders list', async () => {
    // Attempt to query customer2's orders while authenticated as customer1
    const res = await request(testApp)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token1}`)
      .query({ customer_id: customer2.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('permission');
  });

  it('cart remains converted after order creation and order remains accessible', async () => {
    // Create cart for customer1
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(cartRepo.create({
      customer_id: customer1.id,
      status: 'active',
    }));

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(cartItemRepo.create({
      cart_id: cart.id,
      product_id: testProduct.id,
      quantity: 1,
      price_cents: 25000,
    }));

    // Create order from cart
    const orderRes = await request(testApp)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token1}`)
      .send({ cart_id: cart.id, customer_id: customer1.id });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // Verify cart is converted
    const savedCart = await cartRepo.findOneOrFail({ where: { id: cart.id } });
    expect(savedCart.status).toBe('converted');
    expect(savedCart.converted_to_order_id).toBe(orderId);

    // Verify trying to re-convert cart returns 409
    const reConvertRes = await request(testApp)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token1}`)
      .send({ cart_id: cart.id, customer_id: customer1.id });
    expect(reConvertRes.status).toBe(409);

    // Verify order is accessible by customer1
    const getOrderRes = await request(testApp)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(getOrderRes.status).toBe(200);
    expect(getOrderRes.body.id).toBe(orderId);

    // Verify order is NOT accessible by customer2
    const forbiddenOrderRes = await request(testApp)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(forbiddenOrderRes.status).toBe(403);
  });

  it('cart item deletion persists through DELETE /api/carts/:id/items/:productId', async () => {
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = await cartRepo.save(cartRepo.create({
      customer_id: customer1.id,
      status: 'active',
    }));

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(cartItemRepo.create({
      cart_id: cart.id,
      product_id: testProduct.id,
      quantity: 2,
      price_cents: 25000,
    }));

    // Delete item
    const deleteRes = await request(testApp)
      .delete(`/api/carts/${cart.id}/items/${testProduct.id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.items).toHaveLength(0);
    expect(deleteRes.body.subtotal_cents).toBe(0);

    // Verify in DB
    const itemsInDb = await cartItemRepo.find({ where: { cart_id: cart.id } });
    expect(itemsInDb).toHaveLength(0);
  });

  it('recommendations endpoints match component calls', async () => {
    const prodRes = await request(testApp)
      .get(`/api/recommendations/products/${testProduct.id}`);

    // Should not be 404 route not found (could be 200 or 404 no recommendations found)
    expect(prodRes.status).not.toBe(404);
  });
});
