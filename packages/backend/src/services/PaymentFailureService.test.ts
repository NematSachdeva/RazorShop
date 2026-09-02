/**
 * M5 PaymentFailureService Tests
 * Tests payment failure detection, recovery case creation, and guard rail configuration
 */

import { PaymentFailureService } from './PaymentFailureService.js';
import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Payment } from '../models/Payment.js';
import { OrderService } from './OrderService.js';
import { RecoveryEmailGenerator } from './RecoveryEmailGenerator.js';

describe('PaymentFailureService', () => {
  let service: PaymentFailureService;
  let orderService: OrderService;
  let testCustomerId: string;
  let testMerchantId: string;
  let testProductId: string;
  let testOrderId: string;
  let testPaymentId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    jest.spyOn(RecoveryEmailGenerator.prototype, 'generateEmailContent').mockResolvedValue({
      subject: 'Payment Failure',
      greeting: 'Hi Customer',
      body: 'Your payment has failed.',
      call_to_action: 'Complete Payment',
      tone: 'helpful',
    });
    service = new PaymentFailureService(TestDataSource);
    orderService = new OrderService(TestDataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Create merchant
    const merchantRepo = TestDataSource.getRepository(Merchant);
    const merchant = merchantRepo.create({
      name: 'Test Merchant',
      email: `merchant-${Date.now()}@example.com`,
    });
    const savedMerchant = await merchantRepo.save(merchant);
    testMerchantId = (savedMerchant as any).id;

    // Create customer
    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      email: `customer-${Date.now()}@example.com`,
      name: 'Test Customer',
    } as any);
    const savedCustomer = await customerRepo.save(customer);
    testCustomerId = (savedCustomer as any).id;

    // Create product
    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Test Product',
      description: 'Test product for payment failure',
      price_cents: 100_000,
    } as any);
    const savedProduct = await productRepo.save(product);
    testProductId = (savedProduct as any).id;

    // Create inventory
    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: testProductId,
      quantity_on_hand: 100,
      reserved: 0,
    } as any);
    await inventoryRepo.save(inventory);

    // Create cart and items
    const cartRepo = TestDataSource.getRepository(Cart);
    const cart = cartRepo.create({ customer_id: testCustomerId, status: 'active' } as any);
    const savedCart = await cartRepo.save(cart);

    const cartItemRepo = TestDataSource.getRepository(CartItem);
    await cartItemRepo.save(
      cartItemRepo.create({
        cart_id: (savedCart as any).id,
        product_id: testProductId,
        quantity: 1,
        price_cents: 100_000,
      } as any)
    );

    // Create order from cart
    const orderDTO = await orderService.createOrderFromCart((savedCart as any).id, testCustomerId);
    testOrderId = orderDTO.id;

    // Create payment for the order
    const paymentRepo = TestDataSource.getRepository(Payment);
    const payment = paymentRepo.create({
      order_id: testOrderId,
      amount_cents: orderDTO.total_cents,
      status: 'initiated',
    } as any);
    const savedPayment = await paymentRepo.save(payment);
    testPaymentId = (savedPayment as any).id;
  });

  describe('handlePaymentFailure', () => {
    it('creates a payment failure and recovery case', async () => {
      const recoveryCase = await service.handlePaymentFailure(
        testPaymentId,
        'card_declined',
        { message: 'Card was declined' },
        testMerchantId
      );

      expect(recoveryCase).toBeDefined();
      expect(recoveryCase?.status).toBe('open');
      expect(recoveryCase?.customer_id).toBe(testCustomerId);
      expect(recoveryCase?.order_id).toBe(testOrderId);
      expect(recoveryCase?.recovery_attempts).toBe(0);
      expect(recoveryCase?.max_recovery_attempts).toBeGreaterThan(0);
    });

    it('increments failure_count on subsequent failures', async () => {
      // First failure
      const case1 = await service.handlePaymentFailure(
        testPaymentId,
        'card_declined',
        { message: 'First decline' },
        testMerchantId
      );
      expect(case1).toBeDefined();

      // Get payment failure
      let failure = await service.getPaymentFailure(testPaymentId);
      expect(failure?.failure_count).toBe(1);

      // Second failure
      const case2 = await service.handlePaymentFailure(
        testPaymentId,
        'insufficient_funds',
        { message: 'Insufficient funds' },
        testMerchantId
      );

      // Should return same recovery case
      expect(case2?.id).toBe(case1?.id);

      // Failure count should be incremented
      failure = await service.getPaymentFailure(testPaymentId);
      expect(failure?.failure_count).toBe(2);
    });
  });

  describe('getPaymentFailure', () => {
    it('retrieves payment failure by payment ID', async () => {
      await service.handlePaymentFailure(testPaymentId, 'card_declined', undefined, testMerchantId);

      const failure = await service.getPaymentFailure(testPaymentId);
      expect(failure).toBeDefined();
      expect(failure?.payment_id).toBe(testPaymentId);
      expect(failure?.reason).toBe('card_declined');
    });

    it('returns null for non-existent payment', async () => {
      const failure = await service.getPaymentFailure('00000000-0000-0000-0000-000000000000');
      expect(failure).toBeNull();
    });
  });

  describe('getRecoveryCase', () => {
    it('retrieves recovery case by ID', async () => {
      const createdCase = await service.handlePaymentFailure(
        testPaymentId,
        'card_declined',
        undefined,
        testMerchantId
      );
      expect(createdCase).toBeDefined();

      const retrievedCase = await service.getRecoveryCase(createdCase!.id);
      expect(retrievedCase).toBeDefined();
      expect(retrievedCase?.id).toBe(createdCase?.id);
      expect(retrievedCase?.status).toBe('open');
    });

    it('returns null for non-existent case', async () => {
      const recoveryCase = await service.getRecoveryCase('00000000-0000-0000-0000-000000000000');
      expect(recoveryCase).toBeNull();
    });
  });

  describe('merchant configuration', () => {
    it('creates default merchant config if not exists', async () => {
      const config = await service.getMerchantConfig(testMerchantId);

      expect(config).toBeDefined();
      expect(config.merchant_id).toBe(testMerchantId);
      expect(config.max_recovery_attempts).toBe(3);
      expect(config.max_discount_percent).toBe(30);
      expect(config.allowed_channels).toContain('email');
      expect(config.allowed_channels).toContain('sms');
    });

    it('updates merchant config', async () => {
      await service.updateMerchantConfig(testMerchantId, {
        max_discount_percent: 50,
        max_recovery_attempts: 5,
      });

      const updated = await service.getMerchantConfig(testMerchantId);
      expect(updated.max_discount_percent).toBe(50);
      expect(updated.max_recovery_attempts).toBe(5);
    });

    it('handles customer opt-out', async () => {
      await service.optOutCustomer(testMerchantId, testCustomerId);

      const isOptedOut = await service.isCustomerOptedOut(testMerchantId, testCustomerId);
      expect(isOptedOut).toBe(true);
    });

    it('does not add duplicate opt-outs', async () => {
      await service.optOutCustomer(testMerchantId, testCustomerId);
      const config1 = await service.getMerchantConfig(testMerchantId);
      const count1 = config1.customer_opt_outs?.length || 0;

      await service.optOutCustomer(testMerchantId, testCustomerId);
      const config2 = await service.getMerchantConfig(testMerchantId);
      const count2 = config2.customer_opt_outs?.length || 0;

      expect(count1).toBe(count2);
    });
  });

  describe('triggerRecoveryEmail', () => {
    it('gracefully handles missing customer email without crashing', async () => {
      // Set customer email to invalid string
      const customerRepo = TestDataSource.getRepository(Customer);
      await customerRepo.update(testCustomerId, { email: `invalid-email-${Date.now()}` });

      const recoveryCase = await service.handlePaymentFailure(
        testPaymentId,
        'card_declined',
        undefined,
        testMerchantId
      );

      expect(recoveryCase).toBeDefined();
      const success = await service.triggerRecoveryEmail(recoveryCase!.id);
      expect(success).toBe(false);
    });
  });
});
