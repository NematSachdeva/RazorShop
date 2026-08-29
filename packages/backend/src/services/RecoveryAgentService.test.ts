/**
 * M5 RecoveryAgentService Tests
 * Tests AI-driven recovery decisions and guard rail enforcement
 */

import { RecoveryAgentService } from './RecoveryAgentService.js';
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

describe('RecoveryAgentService', () => {
  let agentService: RecoveryAgentService;
  let failureService: PaymentFailureService;
  let orderService: OrderService;
  let testCustomerId: string;
  let testMerchantId: string;
  let testProductId: string;
  let testOrderId: string;
  let testPaymentId: string;
  let testRecoveryCaseId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    agentService = new RecoveryAgentService(TestDataSource);
    failureService = new PaymentFailureService(TestDataSource);
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
      description: 'Test product for recovery',
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

    // Create order
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

    // Create recovery case
    const recoveryCase = await failureService.handlePaymentFailure(
      testPaymentId,
      'card_declined',
      undefined,
      testMerchantId
    );
    testRecoveryCaseId = recoveryCase!.id;
  });

  describe('analyzeFailureAndDecide', () => {
    it('creates an agent decision for a recovery case', async () => {
      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      expect(decision).toBeDefined();
      expect(decision.recovery_case_id).toBe(testRecoveryCaseId);
      expect(decision.decision).toBeDefined();
      expect(decision.decision).toMatch(/retry_payment|offer_discount|escalate|abandon|contact_customer/);
      expect(decision.explanation).toBeDefined();
      expect(decision.guard_rails_enforced).toBeDefined();
      expect(decision.made_at).toBeDefined();
    });

    it('respects guard rail constraints', async () => {
      // Set restrictive guard rails
      await failureService.updateMerchantConfig(testMerchantId, {
        max_recovery_attempts: 0, // No attempts allowed
        max_discount_percent: 0, // No discounts
      });

      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // With restrictive guard rails, should either abandon or escalate
      expect(decision.decision).toMatch(/escalate|abandon|contact_customer/);
    });

    it('includes context in decision', async () => {
      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      expect(decision.context).toBeDefined();
      expect(decision.parameters).toBeDefined();
    });
  });

  describe('guard rail enforcement', () => {
    it('enforces max discount percent', async () => {
      await failureService.updateMerchantConfig(testMerchantId, {
        max_discount_percent: 5, // Very low discount limit
      });

      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // If discount is offered, it should respect the limit
      if (decision.decision === 'offer_discount' && decision.parameters?.discount_percent) {
        expect(decision.parameters.discount_percent).toBeLessThanOrEqual(5);
      }
    });

    it('respects max recovery attempts', async () => {
      await failureService.updateMerchantConfig(testMerchantId, {
        max_recovery_attempts: 1,
      });

      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // Guard rails should be enforced
      expect(decision.guard_rails_enforced).toBe(true);
    });

    it('respects allowed channels', async () => {
      await failureService.updateMerchantConfig(testMerchantId, {
        allowed_channels: ['email'], // Only email allowed
      });

      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // If action specifies a channel, it should be in allowed_channels
      if (decision.parameters?.channel) {
        expect(['email']).toContain(decision.parameters.channel);
      }
    });

    it('respects customer opt-out', async () => {
      // Opt out customer
      await failureService.optOutCustomer(testMerchantId, testCustomerId);

      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // With customer opted out, decision should be abandon or escalate
      expect(decision.decision).toMatch(/escalate|abandon/);
    });
  });

  describe('decision logging and audit trail', () => {
    it('logs all agent decisions to database', async () => {
      const decision1 = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      // Retrieve recovery case to check decisions
      const recoveryCase = await failureService.getRecoveryCase(testRecoveryCaseId);
      expect(recoveryCase?.agent_decisions).toBeDefined();
      expect(recoveryCase?.agent_decisions?.length).toBeGreaterThan(0);

      // Should contain the decision we just made
      const lastDecision = recoveryCase?.agent_decisions?.[0];
      expect(lastDecision?.id).toBe(decision1.id);
    });

    it('includes explanation with each decision', async () => {
      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      expect(decision.explanation).toBeDefined();
      expect(decision.explanation.length).toBeGreaterThan(0);
    });

    it('stores confidence score', async () => {
      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      expect(decision.confidence_score).toBeDefined();
      if (decision.confidence_score !== null) {
        expect(decision.confidence_score).toBeGreaterThanOrEqual(0);
        expect(decision.confidence_score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('AI analysis', () => {
    it('generates AI analysis without throwing errors', async () => {
      // This test ensures AI analysis completes even if Groq is unavailable
      const decision = await agentService.analyzeFailureAndDecide(testRecoveryCaseId, testMerchantId);

      expect(decision).toBeDefined();
      expect(decision.recovery_case_id).toBe(testRecoveryCaseId);
    });
  });
});
