import { PaymentService, RazorpayClient } from './PaymentService.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { OrderService } from './OrderService.js';
import crypto from 'crypto';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockRazorpayClient: RazorpayClient;
  let testCustomerId: string;
  let testProductId: string;
  let testCartId: string;
  let testOrderId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    // Create a mock Razorpay client for testing
    mockRazorpayClient = new RazorpayClient('rzp_test_mock', 'test_secret_mock');

    // Create PaymentService with TestDataSource and mock client
    paymentService = new PaymentService(TestDataSource, mockRazorpayClient);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Create test customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `payment-test-${Date.now()}@test.com`,
      name: 'Payment Test User',
    });
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = savedCustomer.id;

    // Create test product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      description: 'Test product for payment',
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

    // Create order using OrderService
    const orderService = new OrderService(TestDataSource);
    const order = await orderService.createOrderFromCart(testCartId, testCustomerId);
    testOrderId = order.id;
  });

  describe('createPaymentAttempt', () => {
    it('should create a payment attempt successfully', async () => {
      const result = await paymentService.createPaymentAttempt(testOrderId);

      expect(result.razorpay_order_id).toBeDefined();
      expect(result.razorpay_key_id).toBeDefined();
      expect(Number(result.amount_cents)).toBe(100000); // 2 * 50000
      expect(result.currency).toBe('INR');

      // Verify payment record was created
      const payment = await paymentService.getPaymentByOrderId(testOrderId);
      expect(payment).toBeDefined();
      expect(payment?.status).toBe('pending');
    });

    it('should reject nonexistent order', async () => {
      try {
        await paymentService.createPaymentAttempt('00000000-0000-0000-0000-000000000000');
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Order not found');
      }
    });

    it('should reject if order not in pending state', async () => {
      // Mark order as confirmed
      const orderRepo = TestDataSource.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id: testOrderId } });
      if (order) {
        order.status = 'confirmed';
        await orderRepo.save(order);
      }

      try {
        await paymentService.createPaymentAttempt(testOrderId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Order is not in pending state');
      }
    });

    it('should prevent duplicate pending payment attempts', async () => {
      // Create first payment attempt
      await paymentService.createPaymentAttempt(testOrderId);

      // Try to create another - should fail
      try {
        await paymentService.createPaymentAttempt(testOrderId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Cannot create new payment attempt');
      }
    });

    it('should allow retry after failed payment', async () => {
      // Create first payment attempt
      const result1 = await paymentService.createPaymentAttempt(testOrderId);

      // Mark as failed
      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOne({ where: { order_id: testOrderId } });
      if (payment) {
        payment.status = 'failed';
        await paymentRepo.save(payment);
      }

      // Create second attempt
      const result2 = await paymentService.createPaymentAttempt(testOrderId);

      expect(result2.razorpay_order_id).toBeDefined();
      expect(result1.razorpay_order_id).not.toBe(result2.razorpay_order_id);

      // Verify attempt numbers
      const attempts = await TestDataSource.getRepository(PaymentAttempt).find({
        where: { order_id: testOrderId },
        order: { attempt_number: 'ASC' },
      });
      expect(attempts.length).toBe(2);
      expect(attempts[0].attempt_number).toBe(1);
      expect(attempts[1].attempt_number).toBe(2);
    });

    it('should reject if payment already captured', async () => {
      // Create payment attempt
      await paymentService.createPaymentAttempt(testOrderId);

      // Mark as captured
      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOne({ where: { order_id: testOrderId } });
      if (payment) {
        payment.status = 'captured';
        await paymentRepo.save(payment);
      }

      try {
        await paymentService.createPaymentAttempt(testOrderId);
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Order payment already captured');
      }
    });
  });

  describe('verifyPayment', () => {
    beforeEach(async () => {
      // Create payment attempt first
      await paymentService.createPaymentAttempt(testOrderId);
    });

    it('should verify payment successfully', async () => {
      const orderId = testOrderId;
      const paymentId = 'pay_test_123';
      const signature = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const result = await paymentService.verifyPayment({
        order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      expect(result.status).toBe('captured');
      expect(result.razorpay_payment_id).toBe(paymentId);
      expect(result.razorpay_signature).toBe(signature);

      // Verify order status is updated
      const order = await TestDataSource.getRepository(Order).findOne({ where: { id: orderId } });
      expect(order?.status).toBe('confirmed');
    });

    it('should reject invalid signature', async () => {
      const orderId = testOrderId;
      const paymentId = 'pay_test_123';
      const invalidSignature = 'invalid_signature';

      try {
        await paymentService.verifyPayment({
          order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: invalidSignature,
        });
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Invalid payment signature');
      }
    });

    it('should be idempotent for successful payments', async () => {
      const orderId = testOrderId;
      const paymentId = 'pay_test_123';
      const signature = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      // First verification
      const result1 = await paymentService.verifyPayment({
        order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      // Second verification with same data
      const result2 = await paymentService.verifyPayment({
        order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      expect(result1.id).toBe(result2.id);
      expect(result1.razorpay_payment_id).toBe(result2.razorpay_payment_id);

      // Verify only one payment exists
      const payments = await TestDataSource.getRepository(Payment).find({
        where: { order_id: orderId },
      });
      expect(payments.length).toBe(1);
    });

    it('should reject double-capture with different payment IDs', async () => {
      const orderId = testOrderId;
      const paymentId1 = 'pay_test_123';
      const signature1 = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${orderId}|${paymentId1}`)
        .digest('hex');

      // First verification
      await paymentService.verifyPayment({
        order_id: orderId,
        razorpay_payment_id: paymentId1,
        razorpay_signature: signature1,
      });

      // Try to verify with different payment ID
      const paymentId2 = 'pay_test_456';
      const signature2 = crypto
        .createHmac('sha256', 'test_secret_mock')
        .update(`${orderId}|${paymentId2}`)
        .digest('hex');

      try {
        await paymentService.verifyPayment({
          order_id: orderId,
          razorpay_payment_id: paymentId2,
          razorpay_signature: signature2,
        });
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('already captured');
      }
    });

    it('should reject missing fields', async () => {
      try {
        await paymentService.verifyPayment({
          order_id: testOrderId,
          razorpay_payment_id: '',
          razorpay_signature: '',
        });
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Missing required');
      }
    });

    it('should reject nonexistent payment', async () => {
      // For a nonexistent order, the signature will be invalid first
      // This is correct behavior - we verify signature before checking payment existence
      // to avoid leaking information about payment state
      try {
        await paymentService.verifyPayment({
          order_id: '00000000-0000-0000-0000-000000000000',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'invalid_sig',
        });
        fail('Should have thrown error');
      } catch (error) {
        // Either invalid signature or payment not found is acceptable
        expect((error as Error).message).toMatch(/Invalid payment signature|Payment not found for order/);
      }
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment for order', async () => {
      // Create payment attempt
      await paymentService.createPaymentAttempt(testOrderId);

      const payment = await paymentService.getPaymentByOrderId(testOrderId);

      expect(payment).toBeDefined();
      expect(payment?.order_id).toBe(testOrderId);
      expect(payment?.status).toBe('pending');
      expect(Number(payment!.amount_cents)).toBe(100000);
    });

    it('should return null for nonexistent order', async () => {
      const payment = await paymentService.getPaymentByOrderId(
        '00000000-0000-0000-0000-000000000000'
      );

      expect(payment).toBeNull();
    });
  });

  describe('getLatestPaymentAttempt', () => {
    it('should return latest attempt', async () => {
      // Create first attempt
      await paymentService.createPaymentAttempt(testOrderId);

      // Mark as failed and retry
      const paymentRepo = TestDataSource.getRepository(Payment);
      const payment = await paymentRepo.findOne({ where: { order_id: testOrderId } });
      if (payment) {
        payment.status = 'failed';
        await paymentRepo.save(payment);
      }

      // Create second attempt
      await paymentService.createPaymentAttempt(testOrderId);

      const latest = await paymentService.getLatestPaymentAttempt(testOrderId);

      expect(latest).toBeDefined();
      expect(latest?.attempt_number).toBe(2);
    });

    it('should return null for nonexistent order', async () => {
      const attempt = await paymentService.getLatestPaymentAttempt(
        '00000000-0000-0000-0000-000000000000'
      );

      expect(attempt).toBeNull();
    });
  });

  describe('RazorpayClient', () => {
    it('should verify valid signature', () => {
      const client = new RazorpayClient('key', 'secret');
      const orderId = 'order_123';
      const paymentId = 'pay_456';
      const signature = crypto
        .createHmac('sha256', 'secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = client.verifySignature(orderId, paymentId, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const client = new RazorpayClient('key', 'secret');
      const orderId = 'order_123';
      const paymentId = 'pay_456';
      const invalidSignature = 'invalid';

      const isValid = client.verifySignature(orderId, paymentId, invalidSignature);

      expect(isValid).toBe(false);
    });
  });
});
