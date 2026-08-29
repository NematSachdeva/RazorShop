import express, { Express } from 'express';
import request from 'supertest';
import { createOrdersRouter } from './orders.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { OrderService } from '../services/OrderService.js';
import { AuthService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Order Routes', () => {
  let testApp: Express;
  let testOrderService: OrderService;
  let testCustomerId: string;
  let testProductId: string;
  let testCartId: string;
  let testOrderId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    
    // Create OrderService with TestDataSource
    testOrderService = new OrderService(TestDataSource);
    const authService = new AuthService(TestDataSource);
    
    // Create a test Express app with the orders router
    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/orders', createOrdersRouter(testOrderService, authService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `order-route-test-${Date.now()}@test.com`,
      name: 'Order Route Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create test product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      description: 'Test product for order routes',
      price_cents: 50000, // ₹500
      category: 'test',
    });
    const savedProduct = await productRepo.save(product);
    testProductId = savedProduct.id;

    // Create inventory
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: testProductId,
      quantity_on_hand: 100,
      reserved: 0,
    });
    await inventoryRepo.save(inventory);

    // Create cart
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({
      customer_id: testCustomerId,
      status: 'active',
    });
    const savedCart = await cartRepo.save(cart);
    testCartId = savedCart.id;

    // Add item to cart
    const cartItemRepo = TestDataSource.getRepository(CartItem);
    const cartItem = cartItemRepo.create({
      cart_id: testCartId,
      product_id: testProductId,
      quantity: 2,
      price_cents: 50000,
    });
    await cartItemRepo.save(cartItem);
  });

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.order_number).toBeDefined();
      expect(response.body.customer_id).toBe(testCustomerId);
      expect(response.body.status).toBe('pending');
      expect(response.body.items.length).toBe(1);
      expect(Number(response.body.subtotal_cents)).toBe(100000);
      expect(Number(response.body.total_cents)).toBe(100000);

      testOrderId = response.body.id;
    });

    it('should reject missing cart_id', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('cart_id');
    });

    it('should reject missing customer_id', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('customer_id');
    });

    it('should reject invalid cart_id UUID', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: 'not-a-uuid',
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid cart_id format');
    });

    it('should reject invalid customer_id UUID', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid customer_id format');
    });

    it('should return 404 for nonexistent cart', async () => {
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: '00000000-0000-0000-0000-000000000000',
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Cart not found');
    });

    it('should reject empty cart', async () => {
      // Create empty cart
      const cartRepo = TestDataSource.getRepository(Cart);
      const emptyCart = cartRepo.create({
        customer_id: testCustomerId,
        status: 'active',
      });
      const savedEmptyCart = await cartRepo.save(emptyCart);

      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: savedEmptyCart.id,
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('empty cart');
    });

    it('should return 409 for already converted cart', async () => {
      // Convert cart first
      await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });

      // Try to convert again
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already been converted');
    });

    it('should reject insufficient inventory', async () => {
      // Reduce inventory
      const inventoryRepo = TestDataSource.getRepository(Inventory);
      const inventory = await inventoryRepo.findOne({ where: { product_id: testProductId } });
      if (inventory) {
        inventory.quantity_on_hand = 1;
        await inventoryRepo.save(inventory);
      }

      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Insufficient inventory');
    });

    it('should return 403 for customer/cart ownership mismatch', async () => {
      // Create another customer
      const customerRepo = TestDataSource.getRepository(Customer);
      const otherCustomer = customerRepo.create({
        email: `other-${Date.now()}@test.com`,
      });
      const savedOtherCustomer = await customerRepo.save(otherCustomer);

      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: savedOtherCustomer.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('does not belong to this customer');
    });

    it('should rollback transaction if order creation fails', async () => {
      // Reduce inventory to cause failure
      const inventoryRepo = TestDataSource.getRepository(Inventory);
      const inventory = await inventoryRepo.findOne({ where: { product_id: testProductId } });
      if (inventory) {
        inventory.reserved = 99;
        await inventoryRepo.save(inventory);
      }

      const orderRepo = TestDataSource.getRepository(Order);
      const initialOrderCount = await orderRepo.count();

      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });

      expect(response.status).toBe(409);

      // Verify no order was created
      const finalOrderCount = await orderRepo.count();
      expect(finalOrderCount).toBe(initialOrderCount);

      // Verify cart is still active
      const cartRepo = TestDataSource.getRepository(Cart);
      const cart = await cartRepo.findOne({ where: { id: testCartId } });
      expect(cart?.status).toBe('active');
    });
  });

  describe('GET /api/orders/:id', () => {
    beforeEach(async () => {
      // Create an order first
      const response = await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });
      testOrderId = response.body.id;
    });

    it('should return existing order', async () => {
      const response = await request(testApp)
        .get(`/api/orders/${testOrderId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testOrderId);
      expect(response.body.order_number).toBeDefined();
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should return 404 for nonexistent order', async () => {
      const response = await request(testApp)
        .get('/api/orders/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Order not found');
    });

    it('should reject invalid order UUID', async () => {
      const response = await request(testApp)
        .get('/api/orders/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid order ID format');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create an order first
      await request(testApp)
        .post('/api/orders')
        .send({
          cart_id: testCartId,
          customer_id: testCustomerId,
        });
    });

    it('should return customer orders', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({ customer_id: testCustomerId });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.pages).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          page: 1,
          limit: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it('should reject missing customer_id', async () => {
      const response = await request(testApp)
        .get('/api/orders');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('customer_id is required');
    });

    it('should reject invalid customer_id UUID', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({ customer_id: 'not-a-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid customer_id format');
    });

    it('should reject invalid page (0)', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          page: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Page');
    });

    it('should reject negative page', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          page: -1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Page');
    });

    it('should reject non-integer page', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          page: 'abc',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Page');
    });

    it('should reject invalid limit (0)', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          limit: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Limit');
    });

    it('should reject negative limit', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          limit: -1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Limit');
    });

    it('should reject non-integer limit', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          limit: 'abc',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Limit');
    });

    it('should reject limit above maximum', async () => {
      const response = await request(testApp)
        .get('/api/orders')
        .query({
          customer_id: testCustomerId,
          limit: 1000,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Limit');
    });
  });
});
