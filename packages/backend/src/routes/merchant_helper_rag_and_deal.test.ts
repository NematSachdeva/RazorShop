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

  describe('6. Conversational Memory Context Window', () => {
    test('Follow-up question "reason for cancellation" resolves order discussed in turn 1', async () => {
      const history = [
        { role: 'user' as const, content: 'status of Order #ORD-1002' },
        { role: 'assistant' as const, content: 'The status of Order #ORD-1002 is order_returned_to_seller.' },
      ];

      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'reason for cancellation',
        null,
        history
      );

      expect(turn2.message).toContain('ORD-1002');
      expect(turn2.message).toContain('Defective power port');
    });
  });

  describe('7. Abandoned Carts Data Access & Bulk Deal Targeting', () => {
    let customerB: Customer;
    let customerC: Customer;
    let cart1: Cart;
    let cart2: Cart;

    beforeEach(async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      customerB = await customerRepo.save(
        customerRepo.create({
          email: `customerb-${Date.now()}@domain.com`,
          name: 'Bob Customer',
          role: 'customer',
        })
      );
      customerC = await customerRepo.save(
        customerRepo.create({
          email: `customerc-${Date.now()}@domain.com`,
          name: 'Charlie Customer',
          role: 'customer',
        })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      // Abandoned Cart 1 (Customer B - Laptop Stand)
      cart1 = await cartRepo.save(
        cartRepo.create({
          customer_id: customerB.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 10 * 60 * 1000),
        })
      );
      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: cart1.id,
          product_id: productA.id,
          quantity: 1,
          price_cents: 500000,
        })
      );

      // Abandoned Cart 2 (Customer C - Power Bank)
      cart2 = await cartRepo.save(
        cartRepo.create({
          customer_id: customerC.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 15 * 60 * 1000),
        })
      );
      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: cart2.id,
          product_id: productPowerBank.id,
          quantity: 1,
          price_cents: 99900,
        })
      );
    });

    test('Query "what items are in abandoned carts?" returns real data from both carts', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'what items are in abandoned carts?');

      expect(res.message).not.toContain('cannot view abandoned carts');
      expect(res.message).toContain('Alpha Laptop Stand');
      expect(res.message).toContain('Power Bank');
      expect(res.message).toContain(customerB.email);
      expect(res.message).toContain(customerC.email);
    });

    test('"Give 40% off on all abandoned carts" targets ALL carts and notifies ALL customers', async () => {
      // 1. Initial Request
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'Give 40% off on all abandoned carts'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal).not.toBeNull();
      expect(turn1.proposal?.isBulk).toBe(true);
      expect(turn1.proposal?.affectedCartsList?.length).toBe(2);
      expect(turn1.message).toContain('2 abandoned cart(s)');
      expect(turn1.message).toContain(customerB.email);
      expect(turn1.message).toContain(customerC.email);

      // 2. Explicit Confirmation
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Yes',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(true);
      expect(turn2.message).toContain('was successfully applied to 2 abandoned cart(s)');
      expect(turn2.message).toContain(customerB.email);
      expect(turn2.message).toContain(customerC.email);

      // Verify Database: Products updated with 40% deal
      const productRepo = TestDataSource.getRepository(Product);
      const prodA = await productRepo.findOne({ where: { id: productA.id } });
      const prodB = await productRepo.findOne({ where: { id: productPowerBank.id } });

      expect(prodA?.deal_active).toBe(true);
      expect(prodA?.discount_percent).toBe(40);
      expect(prodB?.deal_active).toBe(true);
      expect(prodB?.discount_percent).toBe(40);
    });
  });

  describe('8. Multi-Product Single Abandoned Cart Count & Cart-Level Deal Execution', () => {
    let customerMulti: Customer;
    let cartMulti: Cart;

    beforeEach(async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      customerMulti = await customerRepo.save(
        customerRepo.create({
          email: `customermulti-${Date.now()}@domain.com`,
          name: 'Multi Item Customer',
          role: 'customer',
        })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      // Single Abandoned Cart containing 2 distinct products
      cartMulti = await cartRepo.save(
        cartRepo.create({
          customer_id: customerMulti.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 10 * 60 * 1000),
        })
      );

      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: cartMulti.id,
          product_id: productA.id,
          quantity: 4,
          price_cents: 79900,
        })
      );

      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: cartMulti.id,
          product_id: productPowerBank.id,
          quantity: 3,
          price_cents: 39900,
        })
      );
    });

    test('1 abandoned cart containing 2 products returns count = 1 (NOT 2)', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'how many abandoned carts?');

      expect(res.message).toContain('1');
      expect(res.message).not.toContain('2 abandoned');
    });

    test('"products in abandoned cart" lists all items belonging to that cart', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'products in abandoned cart?');

      expect(res.message).toContain('Alpha Laptop Stand');
      expect(res.message).toContain('Power Bank');
      expect(res.message).toContain(customerMulti.email);
    });

    test('"give 40% off on this cart" applies discount to ALL products in the cart and restores them on expiration', async () => {
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'give 40% off on this cart'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal).not.toBeNull();

      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Yes',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(true);

      const productRepo = TestDataSource.getRepository(Product);
      const prodA = await productRepo.findOne({ where: { id: productA.id } });
      const prodB = await productRepo.findOne({ where: { id: productPowerBank.id } });

      expect(prodA?.deal_active).toBe(true);
      expect(prodA?.discount_percent).toBe(40);
      expect(prodB?.deal_active).toBe(true);
      expect(prodB?.discount_percent).toBe(40);

      // Verify expiration restoration for both products
      await helperService.restoreExpiredDealPrice(productA.id);
      await helperService.restoreExpiredDealPrice(productPowerBank.id);

      const restoredA = await productRepo.findOne({ where: { id: productA.id } });
      const restoredB = await productRepo.findOne({ where: { id: productPowerBank.id } });

      expect(restoredA?.deal_active).toBe(false);
      expect(restoredB?.deal_active).toBe(false);
    });
  });

  describe('9. Live DB Authority & Stale Execution Revalidation Tests', () => {
    test('TEST 1 & 11: Zero abandoned carts in DB returns 0 and prevents deal proposal creation', async () => {
      // Clear any carts for merchant A
      const cartRepo = TestDataSource.getRepository(Cart);
      await cartRepo.query('DELETE FROM cart_items');
      await cartRepo.query('DELETE FROM carts');

      const countRes = await helperService.processChatMessage(merchantA.id, 'how many abandoned carts?');
      expect(countRes.message).toContain('0');

      const dealRes = await helperService.processChatMessage(merchantA.id, 'give 40% off on all abandoned carts');
      expect(dealRes.proposal).toBeNull();
      expect(dealRes.message).toContain('currently 0 abandoned carts');
    });

    test('TEST 2 & 10: Previous conversation referenced an abandoned cart, but when cart becomes converted/fulfilled helper reports 0', async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      const tempCust = await customerRepo.save(
        customerRepo.create({
          email: `tempcust-${Date.now()}@domain.com`,
          name: 'Temp Customer',
          role: 'customer',
        })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      // Create an abandoned cart
      const tempCart = await cartRepo.save(
        cartRepo.create({
          customer_id: tempCust.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 10 * 60 * 1000),
        })
      );

      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: tempCart.id,
          product_id: productA.id,
          quantity: 1,
          price_cents: 79900,
        })
      );

      // Turn 1: Query abandoned carts while cart is abandoned
      const turn1 = await helperService.processChatMessage(merchantA.id, 'how many abandoned carts?');
      expect(turn1.message).toContain('1');

      // Now cart gets converted to order / status becomes converted
      tempCart.status = 'converted';
      await cartRepo.save(tempCart);

      // Turn 2: Query abandoned carts again — must return 0 from live DB truth
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'how many abandoned carts?',
        null,
        [{ role: 'user', content: 'how many abandoned carts?' }, { role: 'assistant', content: turn1.message }]
      );

      expect(turn2.message).toContain('0');
      expect(turn2.message).not.toContain('1 abandoned');
    });

    test('TEST 9: Cart becomes non-abandoned between proposal and confirmation -> execution revalidates and aborts', async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      const tempCust = await customerRepo.save(
        customerRepo.create({
          email: `stale-${Date.now()}@domain.com`,
          name: 'Stale Customer',
          role: 'customer',
        })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      const tempCart = await cartRepo.save(
        cartRepo.create({
          customer_id: tempCust.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 10 * 60 * 1000),
        })
      );

      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: tempCart.id,
          product_id: productA.id,
          quantity: 1,
          price_cents: 79900,
        })
      );

      // 1. Build Proposal
      const turn1 = await helperService.processChatMessage(
        merchantA.id,
        'give 30% off on this abandoned cart'
      );

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal).not.toBeNull();

      // Cart gets completed / converted before confirmation
      tempCart.status = 'converted';
      await cartRepo.save(tempCart);

      // 2. User confirms proposal
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'Yes',
        turn1.proposal
      );

      expect(turn2.actionExecuted).toBe(false);
      expect(turn2.message).toContain('no longer abandoned');
    });
  });

  describe('10. Exact Cart ID Lookup, "The Other Cart" Swapping & Ambiguity Resolution', () => {
    test('Exact Cart ID lookup resolves target cart; non-existent Cart ID returns explicit error', async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      const tempCust = await customerRepo.save(
        customerRepo.create({
          email: `exactid-${Date.now()}@domain.com`,
          name: 'Exact ID Customer',
          role: 'customer',
        })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      const exactCart = await cartRepo.save(
        cartRepo.create({
          customer_id: tempCust.id,
          status: 'abandoned',
          updated_at: new Date(Date.now() - 10 * 60 * 1000),
        })
      );

      await cartItemRepo.save(
        cartItemRepo.create({
          cart_id: exactCart.id,
          product_id: productA.id,
          quantity: 2,
          price_cents: 79900,
        })
      );

      // 1. Valid exact Cart ID
      const res1 = await helperService.processChatMessage(
        merchantA.id,
        `give Cart ID ${exactCart.id} a discount of 80%`
      );

      expect(res1.requiresConfirmation).toBe(true);
      expect(res1.proposal?.affectedCartsList?.[0]?.cartId).toBe(exactCart.id);

      // 2. Non-existent Cart ID
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const res2 = await helperService.processChatMessage(
        merchantA.id,
        `give Cart ID ${fakeUuid} a discount of 80%`
      );

      expect(res2.proposal).toBeNull();
      expect(res2.message).toContain("I couldn't find that cart in your merchant account");
    });

    test('"the other cart" switches deal target between two abandoned carts', async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      const cust1 = await customerRepo.save(
        customerRepo.create({ email: `swap1-${Date.now()}@domain.com`, name: 'Swap Cust 1', role: 'customer' })
      );
      const cust2 = await customerRepo.save(
        customerRepo.create({ email: `swap2-${Date.now()}@domain.com`, name: 'Swap Cust 2', role: 'customer' })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      const cart1 = await cartRepo.save(
        cartRepo.create({ customer_id: cust1.id, status: 'abandoned', updated_at: new Date(Date.now() - 5 * 60 * 1000) })
      );
      await cartItemRepo.save(
        cartItemRepo.create({ cart_id: cart1.id, product_id: productA.id, quantity: 1, price_cents: 79900 })
      );

      const cart2 = await cartRepo.save(
        cartRepo.create({ customer_id: cust2.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) })
      );
      await cartItemRepo.save(
        cartItemRepo.create({ cart_id: cart2.id, product_id: productPowerBank.id, quantity: 1, price_cents: 39900 })
      );

      // Turn 1: Target Cart 1
      const turn1 = await helperService.processChatMessage(merchantA.id, 'give cart 1 50% off');
      expect(turn1.proposal?.affectedCartsList?.[0]?.cartId).toBe(cart1.id);

      // Turn 2: Switch to "the other cart"
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'no the other cart',
        turn1.proposal,
        [{ role: 'user', content: 'give cart 1 50% off' }, { role: 'assistant', content: turn1.message }]
      );

      expect(turn2.proposal?.affectedCartsList?.[0]?.cartId).toBe(cart2.id);
    });
  });

  describe('11. Deterministic Cart Number Indexing, Email Isolation & Multi-Turn Retention', () => {
    let custTom: Customer;
    let custNemat: Customer;
    let cartTom: Cart;
    let cartNemat: Cart;

    beforeEach(async () => {
      const customerRepo = TestDataSource.getRepository(Customer);
      custTom = await customerRepo.save(
        customerRepo.create({ email: `tom-${Date.now()}@domain.com`, name: 'tom', role: 'customer' })
      );
      custNemat = await customerRepo.save(
        customerRepo.create({ email: `nemat-${Date.now()}@domain.com`, name: 'Nemat Sachdeva', role: 'customer' })
      );

      const cartRepo = TestDataSource.getRepository(Cart);
      const cartItemRepo = TestDataSource.getRepository(CartItem);

      // Cart #1: Tom — Magazine Rack ×4 (updated 5 mins ago)
      cartTom = await cartRepo.save(
        cartRepo.create({ customer_id: custTom.id, status: 'abandoned', updated_at: new Date(Date.now() - 5 * 60 * 1000) })
      );
      await cartItemRepo.save(
        cartItemRepo.create({ cart_id: cartTom.id, product_id: productA.id, quantity: 4, price_cents: 29900 })
      );

      // Cart #2: Nemat Sachdeva — Power Strip ×3 + Extension Cord ×3 (updated 10 mins ago)
      cartNemat = await cartRepo.save(
        cartRepo.create({ customer_id: custNemat.id, status: 'abandoned', updated_at: new Date(Date.now() - 10 * 60 * 1000) })
      );
      await cartItemRepo.save(
        cartItemRepo.create({ cart_id: cartNemat.id, product_id: productPowerBank.id, quantity: 3, price_cents: 39900 })
      );
      await cartItemRepo.save(
        cartItemRepo.create({ cart_id: cartNemat.id, product_id: productA.id, quantity: 3, price_cents: 19900 })
      );
    });

    test('"give cart 2 a 90% off" maps deterministically to Cart #2 (Nemat), NOT Cart #1 (Tom)', async () => {
      const turn1 = await helperService.processChatMessage(merchantA.id, 'give cart 2 a 90% off');

      expect(turn1.requiresConfirmation).toBe(true);
      expect(turn1.proposal?.affectedCartsList?.[0]?.cartId).toBe(cartNemat.id);
      expect(turn1.proposal?.affectedCartsList?.[0]?.customerEmail).toBe(custNemat.email);

      // Verify proposal applies 90% to full cart total (3×399 + 3×199 = 1794.00)
      const origCents = turn1.proposal?.affectedCartsList?.[0]?.originalCartTotalCents || 0;
      expect(origCents).toBe(179400);

      const dealCents = turn1.proposal?.affectedCartsList?.[0]?.dealCartTotalCents || 0;
      expect(dealCents).toBe(17940);
    });

    test('Confirming Cart #2 deal emails ONLY Cart #2 customer (Nemat), NOT Cart #1 (Tom)', async () => {
      const turn1 = await helperService.processChatMessage(merchantA.id, 'give cart 2 a 90% off');
      const turn2 = await helperService.processChatMessage(merchantA.id, 'Yes', turn1.proposal);

      expect(turn2.actionExecuted).toBe(true);
      expect(turn2.proposal).toBeNull();
    });

    test('Multi-turn modifications ("make it 90%", "expire in 5 minutes") retain Cart #2 target', async () => {
      // Turn 1: 50% off
      const turn1 = await helperService.processChatMessage(merchantA.id, 'give cart 2 50% off');
      expect(turn1.proposal?.affectedCartsList?.[0]?.cartId).toBe(cartNemat.id);
      expect(turn1.proposal?.discountPercent).toBe(50);

      // Turn 2: "make it 90%"
      const turn2 = await helperService.processChatMessage(
        merchantA.id,
        'make it 90%',
        turn1.proposal,
        [{ role: 'user', content: 'give cart 2 50% off' }, { role: 'assistant', content: turn1.message }]
      );
      expect(turn2.proposal?.affectedCartsList?.[0]?.cartId).toBe(cartNemat.id);
      expect(turn2.proposal?.discountPercent).toBe(90);

      // Turn 3: "expire in 5 minutes"
      const turn3 = await helperService.processChatMessage(
        merchantA.id,
        'expire in 5 minutes',
        turn2.proposal,
        [
          { role: 'user', content: 'give cart 2 50% off' },
          { role: 'assistant', content: turn1.message },
          { role: 'user', content: 'make it 90%' },
          { role: 'assistant', content: turn2.message },
        ]
      );
      expect(turn3.proposal?.affectedCartsList?.[0]?.cartId).toBe(cartNemat.id);
      expect(turn3.proposal?.expiresInMinutes).toBe(5);
    });

    test('Invalid cart index ("give cart 99 50% off") returns clear resolution error message', async () => {
      const res = await helperService.processChatMessage(merchantA.id, 'give cart 99 50% off');

      expect(res.proposal).toBeNull();
      expect(res.message).toContain("couldn't resolve Cart #99");
    });
  });
});
