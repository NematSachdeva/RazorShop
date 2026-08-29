import express, { Express } from 'express';
import request from 'supertest';
import { createPaymentsRouter } from './payments.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentService, RazorpayClient } from '../services/PaymentService.js';
import { OrderService } from '../services/OrderService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import crypto from 'crypto';

describe('Payment Routes', () => {
  let testApp: Express;
  let paymentService: PaymentService;
  let mockRazorpayClient: RazorpayClient;
  let testCustomerId: string;
  let testProductId: string;
  let testCartId: string;
  let testOrderId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    // Create mock Razorpay client
    mockRazorpayClient = new RazorpayClient('rzp_test_mock', 'test_secret_mock');

    // Mock the Razorpay SDK for testing (prevent real API calls)
    let orderCounter = 0;
    (mockRazorpayClient as any).razorpayInstance = {
      orders: {
        create: async (params: any) => ({
          id: `order_test_${++orderCounter}_${Date.now()}`,
        }),
      },
    };

    // Create PaymentService with TestDataSource
    paymentService = new PaymentService(TestDataSource, mockRazorpayClient);

    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/payments', createPaymentsRouter(paymentService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `payment-route-test-${Date.now()}@test.com`,
      name: 'Payment Route Test',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create test product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      price_cents: 50000,
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

    // Create order
    const orderService = new OrderService(TestDataSource);
    const order = await orderService.createOrderFromCart(testCartId, testCustomerId);
    testOrderId = order.id;
  });

  describe('POST /api/payments/create', () => {
    it('should create payment attempt successfully', async () => {
      // Create a fresh order for this test
      const orderService = new OrderService(TestDataSource);
      const freshCartId = await createFreshCart();
      const order = await orderService.createOrderFromCart(freshCartId, testCustomerId);

      const response = await request(testApp)
        .post('/api/payments/create')
        .send({ order_id: order.id });

      expect(response.status).toBe(200);
      expect(response.body.razorpay_order_id).toBeDefined();
      expect(response.body.razorpay_key_id).toBeDefined();
      expect(Number(response.body.amount_cents)).toBe(100000);
      expect(response.body.currency).toBe('INR');

      // Verify payment was created
      const payment = await paymentService.getPaymentByOrderId(order.id);
      expect(payment?.status).toBe('pending');
    });

    it('should reject missing order_id', async () => {
      const response = await request(testApp)
        .post('/api/payments/create')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('order_id');
    });

    it('should reject invalid order_id UUID', async () => {
      const response = await request(testApp)
        .post('/api/payments/create')
        .send({ order_id: 'not-a-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid order_id format');
    });

    it('should return 404 for nonexistent order', async () => {
      const response = await request(testApp)
        .post('/api/payments/create')
        .send({ order_id: '00000000-0000-0000-0000-000000000000' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Order not found');
    });

    it('should return 409 if order not pending', async () => {
      // Create a fresh order for this test
      const orderService = new OrderService(TestDataSource);
      const freshCartId = await createFreshCart();
      const order = await orderService.createOrderFromCart(freshCartId, testCustomerId);

      // Mark order as confirmed
      const orderRepo = TestDataSource.getRepository(Order);
      const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
      if (updatedOrder) {
        updatedOrder.status = 'confirmed';
        await orderRepo.save(updatedOrder);
      }

      const response = await request(testApp)
        .post('/api/payments/create')
        .send({ order_id: order.id });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('not in pending state');
    });
  });

  describe('POST /api/payments/verify', () => {
    it('should verify payment successfully', async () => {
      // Create a fresh order and payment
      const orderService = new OrderService(TestDataSource);
      const freshCartId = await createFreshCart();
      const order = await orderService.createOrderFromCart(freshCartId, testCustomerId);
      const paymentAttempt = await paymentService.createPaymentAttempt(order.id);

      const paymentId = 'pay_test_123';
      // Sign using the Razorpay order ID from PaymentAttempt
      const signature = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${paymentAttempt.razorpay_order_id}|${paymentId}`)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: order.id,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('captured');
      expect(response.body.razorpay_payment_id).toBe(paymentId);

      // Verify order status is updated
      const updatedOrder = await TestDataSource.getRepository(Order).findOne({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe('confirmed');
    });

    it('should reject missing order_id', async () => {
      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'sig',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('order_id');
    });

    it('should reject missing razorpay_payment_id', async () => {
      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: testOrderId,
          razorpay_signature: 'sig',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('razorpay_payment_id');
    });

    it('should reject missing razorpay_signature', async () => {
      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: testOrderId,
          razorpay_payment_id: 'pay_123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('razorpay_signature');
    });

    it('should reject invalid order_id UUID', async () => {
      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: 'not-a-uuid',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'sig',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid order_id format');
    });

    it('should reject invalid signature', async () => {
      // Create a fresh order and payment
      const orderService = new OrderService(TestDataSource);
      const freshCartId = await createFreshCart();
      const order = await orderService.createOrderFromCart(freshCartId, testCustomerId);
      await paymentService.createPaymentAttempt(order.id);

      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: order.id,
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'invalid_signature',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid payment signature');
    });

    it('should return 404 if payment not found', async () => {
      // For a nonexistent payment attempt, we can't get a real Razorpay order ID
      // The endpoint should fail with 404 when no payment is found
      const fakeRazorpayOrderId = 'order_fake_12345';
      const paymentId = 'pay_test_123';
      const signature = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${fakeRazorpayOrderId}|${paymentId}`)
        .digest('hex');

      const response = await request(testApp)
        .post('/api/payments/verify')
        .send({
          order_id: '00000000-0000-0000-0000-000000000000',
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/payments/:orderId', () => {
    it('should return payment for order', async () => {
      // Create a fresh order and payment
      const orderService = new OrderService(TestDataSource);
      const freshCartId = await createFreshCart();
      const order = await orderService.createOrderFromCart(freshCartId, testCustomerId);
      const paymentAttempt = await paymentService.createPaymentAttempt(order.id);
      
      const paymentId = 'pay_test_123';
      const signature = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${paymentAttempt.razorpay_order_id}|${paymentId}`)
        .digest('hex');

      await paymentService.verifyPayment({
        order_id: order.id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      const response = await request(testApp)
        .get(`/api/payments/${order.id}`);

      expect(response.status).toBe(200);
      expect(response.body.order_id).toBe(order.id);
      expect(response.body.status).toBe('captured');
      expect(Number(response.body.amount_cents)).toBe(100000);
    });

    it('should reject invalid order_id UUID', async () => {
      const response = await request(testApp)
        .get('/api/payments/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid order ID format');
    });

    it('should return 404 for nonexistent payment', async () => {
      const response = await request(testApp)
        .get('/api/payments/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Payment not found');
    });
  });

  // Helper function to create a fresh cart with product
  async function createFreshCart(): Promise<string> {
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({
      customer_id: testCustomerId,
      status: 'active',
    });
    const savedCart = await cartRepo.save(cart);

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    const cartItem = cartItemRepo.create({
      cart_id: savedCart.id,
      product_id: testProductId,
      quantity: 2,
      price_cents: 50000,
    });
    await cartItemRepo.save(cartItem);

    return savedCart.id;
  }
});
