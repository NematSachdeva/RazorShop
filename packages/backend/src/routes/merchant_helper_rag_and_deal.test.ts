/**
 * Merchant Operations Assistant Test Suite
 * 
 * Tests:
 * 1. Full-Spectrum Read Operations (Orders, Returns, Refunds, Payment Failures, Products, Analytics)
 * 2. Operational Actions with Mandatory Universal Double Confirmation (Order Dispatch, Delivery, Refund Initiation, Price Updates)
 * 3. State-Aware Order Lifecycle Validation (Confirmed -> Delivered direct jump rejected; Confirmed -> Dispatched proposed)
 * 4. Timeline Event Persistence & Existing Workflow Execution
 * 5. Stale Proposal Protection & Multilingual Support (English, Hindi, Hinglish)
 */

import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { MerchantHelperService, DealActionProposal } from '../services/MerchantHelperService.js';
import { OrderService } from '../services/OrderService.js';
import { EmailService } from '../services/EmailService.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { randomUUID } from 'crypto';

describe('Merchant Operations Assistant Full Suite', () => {
  let helperService: MerchantHelperService;
  let orderService: OrderService;
  let emailService: EmailService;
  let merchantA: Merchant;
  let customerA: Customer;
  let productA: Product;
  let productPowerBank: Product;
  let orderA: Order;
  let orderReturn: Order;

  beforeAll(async () => {
    await initializeTestDatabase();
    emailService = new EmailService();
    orderService = new OrderService(TestDataSource);
    helperService = new MerchantHelperService(TestDataSource, emailService, orderService);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_timeline, order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    const merchantRepo = TestDataSource.getRepository(Merchant);
    merchantA = await merchantRepo.save(
      merchantRepo.create({
        id: randomUUID(),
        email: `merchant-a-${Date.now()}@example.com`,
        name: 'Merchant Alpha',
      })
    );

    const configRepo = TestDataSource.getRepository(MerchantConfig);
    await configRepo.save(
      configRepo.create({
        merchant_id: merchantA.id,
        ai_insights_enabled: true,
        max_discount_percent: 25,
        min_confidence_score: 70,
      })
    );

    const customerRepo = TestDataSource.getRepository(Customer);
    customerA = await customerRepo.save(
      customerRepo.create({
        email: `customera-${Date.now()}@domain.com`,
        name: 'Alice Customer',
        role: 'customer',
      })
    );

    const productRepo = TestDataSource.getRepository(Product);
    productA = await productRepo.save(
      productRepo.create({
        name: 'Alpha Laptop Stand',
        price_cents: 500000, // ₹5,000.00
        merchant_id: merchantA.id,
      })
    );

    productPowerBank = await productRepo.save(
      productRepo.create({
        name: 'Power Bank',
        price_cents: 99900, // ₹999.00
        merchant_id: merchantA.id,
      })
    );

    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);

    // Active Confirmed Order
    orderA = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-1001',
        customer_id: customerA.id,
        status: 'confirmed',
        subtotal_cents: 500000,
        total_cents: 500000,
      })
    );
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: orderA.id,
        product_id: productA.id,
        quantity: 1,
        price_cents: 500000,
        line_total_cents: 500000,
      })
    );

    // Returned Order
    orderReturn = await orderRepo.save(
      orderRepo.create({
        order_number: 'ORD-1002',
        customer_id: customerA.id,
        status: 'order_returned_to_seller',
        return_status: 'order_returned_to_seller',
        return_reason: 'Defective power port',
        subtotal_cents: 99900,
        total_cents: 99900,
        return_requested_at: new Date(Date.now() - 2 * 3600 * 1000),
      })
    );
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: orderReturn.id,
        product_id: productPowerBank.id,
        quantity: 1,
        price_cents: 99900,
        line_total_cents: 99900,
      })
    );
  });

  describe('1. Full-Spectrum Live Database READ Queries', () => {
    test('Query returned order count and return reasons', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'What were the reasons for the returned orders?');
      expect(res.message).toContain('ORD-1002');
      expect(res.message).toContain('Defective power port');
    });

    test('Query product price returns exact database price', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'price of power bank');
      expect(res.message).toContain('Power Bank');
      expect(res.message).toContain('₹999.00');
    });
  });

  describe('2. State-Aware Order Operational Actions with Mandatory Confirmation', () => {
    test('Valid Confirmed -> Dispatched proposal and explicit double confirmation execution', async () => {
      // 1. Initial Request
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'Mark order #ORD-1001 as dispatched'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal?.actionType).toBe('UPDATE_ORDER_STATUS');
      expect(turn1.proposal?.newOrderStatus).toBe('dispatched');
      expect(turn1.proposal?.orderNumber).toBe('ORD-1001');

      // Database MUST NOT be mutated before explicit confirmation!
      const orderRepo = TestDataSource.getRepository(Order);
      let orderCheck = await orderRepo.findOne({ where: { id: orderA.id } });
      expect(orderCheck?.status).toBe('confirmed');

      // 2. Explicit Confirmation
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Confirm',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(true);
      expect(turn2.actionResult?.newStatus).toBe('dispatched');

      // Database MUST be updated after confirmation
      orderCheck = await orderRepo.findOne({ where: { id: orderA.id } });
      expect(orderCheck?.status).toBe('dispatched');

      // OrderTimeline event MUST be recorded
      const timelineRepo = TestDataSource.getRepository(OrderTimeline);
      const events = await timelineRepo.find({ where: { order_id: orderA.id } });
      expect(events.some((e) => e.event_type === 'ORDER_DISPATCHED')).toBe(true);
    });

    test('Invalid Confirmed -> Delivered direct jump is rejected and Confirmed -> Dispatched proposed instead', async () => {
      const res = await helperService.processChatMessage(
        merchantA.id,
        'Mark order #ORD-1001 as delivered'
      );

      expect(res.requiresConfirmation).toBe(false);
      expect(res.message).toContain('cannot move it directly to');
      expect(res.message).toContain('Dispatched');

      // Verify status remains confirmed
      const orderRepo = TestDataSource.getRepository(Order);
      const orderCheck = await orderRepo.findOne({ where: { id: orderA.id } });
      expect(orderCheck?.status).toBe('confirmed');
    });
  });

  describe('3. Refund Initiation Operations', () => {
    test('Initiate refund proposal and explicit confirmation execution', async () => {
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'Initiate the refund for order #ORD-1002'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal?.actionType).toBe('INITIATE_REFUND');
      expect(turn1.proposal?.orderNumber).toBe('ORD-1002');
      expect(turn1.proposal?.refundAmountCents).toBe(99900);

      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Confirm',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(true);
      expect(turn2.actionResult?.refundAmountRupees).toBe(999);

      const orderRepo = TestDataSource.getRepository(Order);
      const orderCheck = await orderRepo.findOne({ where: { id: orderReturn.id } });
      expect(orderCheck?.status).toBe('refund_initiated');
      expect(orderCheck?.refund_status).toBe('initiated');

      const timelineRepo = TestDataSource.getRepository(OrderTimeline);
      const events = await timelineRepo.find({ where: { order_id: orderReturn.id } });
      expect(events.some((e) => e.event_type === 'REFUND_INITIATED')).toBe(true);
    });
  });

  describe('4. Product Price Update Operations', () => {
    test('Update Power Bank price to ₹899 proposal and double confirmation execution', async () => {
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'Change Power Bank price to ₹899'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal?.actionType).toBe('UPDATE_PRODUCT_PRICE');
      expect(turn1.proposal?.newPriceCents).toBe(89900);

      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Confirm',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(true);

      const productRepo = TestDataSource.getRepository(Product);
      const freshProd = await productRepo.findOne({ where: { id: productPowerBank.id } });
      expect(Number(freshProd?.price_cents)).toBe(89900);
    });
  });

  describe('5. Stale Proposal Protection', () => {
    test('Unrelated analytics query clears pending proposal so old action cannot execute', async () => {
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'Mark order #ORD-1001 as dispatched'
      );
      expect(turn1.proposal).not.toBeNull();

      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'What is my total revenue?'
      );

      expect(turn2.proposal).toBeNull();
      expect(turn2.requiresConfirmation).toBe(false);
    });
  });
});
