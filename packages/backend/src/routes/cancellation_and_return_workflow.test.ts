import express, { Express } from 'express';
import request from 'supertest';
import { createOrdersRouter } from './orders.js';
import { createMerchantRouter } from './merchant.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { OrderService } from '../services/OrderService.js';
import { AuthService } from '../services/AuthService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Order Cancellation + Return/Refund Workflow Integration Tests', () => {
  let testApp: Express;
  let testOrderService: OrderService;
  let testAuthService: AuthService;
  let analyticsService: AnalyticsService;

  let customerId: string;
  let customerEmail: string;
  let merchantId: string;
  let merchantEmail: string;
  let productId: string;
  let customerToken: string;
  let merchantToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    testOrderService = new OrderService(TestDataSource);
    testAuthService = new AuthService(TestDataSource);
    analyticsService = new AnalyticsService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/orders', createOrdersRouter(testOrderService, testAuthService));
    testApp.use('/api/merchant', createMerchantRouter(TestDataSource, testAuthService, undefined, testOrderService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clear tables with CASCADE
    await TestDataSource.query('TRUNCATE TABLE order_timeline, order_items, orders, inventory, products, merchants, customers CASCADE;');

    const timestamp = Date.now();
    merchantEmail = `merchant-${timestamp}@test.com`;
    customerEmail = `customer-${timestamp}@test.com`;

    const merchantRepo = TestDataSource.getRepository(Merchant);
    const merchant = merchantRepo.create({
      name: 'Test Merchant Store',
      email: merchantEmail,
      status: 'active',
    });
    const savedMerchant = await merchantRepo.save(merchant);
    merchantId = savedMerchant.id;
    merchantToken = testAuthService.generateToken({ id: merchantId, email: merchantEmail, role: 'merchant' });

    const customerRepo = TestDataSource.getRepository(Customer);
    const customer = customerRepo.create({
      name: 'Test Customer',
      email: customerEmail,
    });
    const savedCustomer = await customerRepo.save(customer);
    customerId = savedCustomer.id;
    customerToken = testAuthService.generateToken({ id: customerId, email: customerEmail, role: 'customer' });

    const productRepo = TestDataSource.getRepository(Product);
    const product = productRepo.create({
      name: 'Premium Leather Shoes',
      description: 'Handcrafted leather shoes',
      price_cents: 299900,
      merchant_id: merchantId,
      category: 'footwear',
    });
    const savedProduct = await productRepo.save(product);
    productId = savedProduct.id;

    const inventoryRepo = TestDataSource.getRepository(Inventory);
    const inventory = inventoryRepo.create({
      product_id: productId,
      quantity_on_hand: 50,
      reserved: 0,
    });
    await inventoryRepo.save(inventory);
  });

  async function createTestOrder(status: any = 'confirmed', quantity: number = 1): Promise<Order> {
    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    const timelineRepo = TestDataSource.getRepository(OrderTimeline);

    const unitPrice = 299900;
    const totalCents = unitPrice * quantity;

    const order = orderRepo.create({
      customer_id: customerId,
      order_number: `ORD-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status,
      subtotal_cents: totalCents,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: totalCents,
      shipping_address: {
        full_address: '123 Main St, Tech City',
        state: 'Karnataka',
        pin_code: '560001',
        phone: '9876543210',
        name: 'Test Customer',
      },
    });
    const savedOrder = await orderRepo.save(order);

    const item = orderItemRepo.create({
      order_id: savedOrder.id,
      product_id: productId,
      quantity,
      price_cents: unitPrice,
      line_total_cents: totalCents,
    });
    await orderItemRepo.save(item);

    const initialEvent = timelineRepo.create({
      order_id: savedOrder.id,
      event_type: 'ORDER_CONFIRMED',
      actor_role: 'system',
      description: 'Order confirmed and payment processed',
    });
    await timelineRepo.save(initialEvent);

    return savedOrder;
  }

  describe('Feature 1: Customer Order Cancellation', () => {
    it('1 & 2. Confirmed order can be cancelled and requires a reason', async () => {
      const order = await createTestOrder('confirmed');

      // Attempt without reason -> error
      const emptyReasonRes = await request(testApp)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: '   ', customer_id: customerId });

      expect(emptyReasonRes.status).toBe(400);
      expect(emptyReasonRes.body.error).toMatch(/Cancellation reason is required/i);

      // Valid cancellation
      const res = await request(testApp)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Found a better price elsewhere', customer_id: customerId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancellation_reason).toBe('Found a better price elsewhere');
      expect(res.body.cancelled_by).toBe('customer');
      expect(res.body.refund_amount_cents).toBe(299900);
    });

    it('4 & 5. Customer & Backend reject cancellation after dispatch', async () => {
      const order = await createTestOrder('dispatched');

      const res = await request(testApp)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Want to cancel now', customer_id: customerId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Order cannot be cancelled after dispatch/i);
    });

    it('7 & 8. Merchant sees cancelled order in merchant orders API with reason and actor', async () => {
      const order = await createTestOrder('confirmed');
      await testOrderService.cancelOrder(order.id, customerId, 'Ordered by mistake');

      const res = await request(testApp)
        .get('/api/merchant/orders')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.status).toBe(200);
      const merchantOrder = res.body.data.find((o: any) => o.id === order.id);
      expect(merchantOrder).toBeDefined();
      expect(merchantOrder.status).toBe('cancelled');
      expect(merchantOrder.cancellation_reason).toBe('Ordered by mistake');
      expect(merchantOrder.cancelled_by).toBe('customer');
    });

    it('27. Customer cannot cancel another customer order', async () => {
      const otherCustomerRepo = TestDataSource.getRepository(Customer);
      const otherCust = await otherCustomerRepo.save(
        otherCustomerRepo.create({ name: 'Other User', email: `other-${Date.now()}@test.com` })
      );
      const otherToken = testAuthService.generateToken({ id: otherCust.id, email: otherCust.email, role: 'customer' });

      const order = await createTestOrder('confirmed');

      const res = await request(testApp)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ reason: 'Cancel invalid', customer_id: otherCust.id });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Feature 2: Return After Delivery', () => {
    it('10. Customer cannot request return before delivery', async () => {
      const order = await createTestOrder('confirmed');

      const res = await request(testApp)
        .post(`/api/orders/${order.id}/return`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Defective item', customer_id: customerId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Return can only be requested for delivered orders/i);
    });

    it('11-15. Customer requests return on delivered order, persists status and updates timeline', async () => {
      const order = await createTestOrder('delivered');

      const res = await request(testApp)
        .post(`/api/orders/${order.id}/return`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Size is too small', customer_id: customerId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('return_requested');
      expect(res.body.return_status).toBe('return_requested');
      expect(res.body.return_reason).toBe('Size is too small');

      // Verify timeline
      const timeline = await testOrderService.getOrderTimeline(order.id);
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline.some((e) => e.event_type === 'RETURN_REQUESTED')).toBe(true);
    });

    it('16. Merchant approves return request', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Damaged product');

      const res = await request(testApp)
        .post(`/api/merchant/orders/${order.id}/approve-return`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('return_approved');
      expect(res.body.return_status).toBe('return_approved');

      const timeline = await testOrderService.getOrderTimeline(order.id);
      expect(timeline.some((e) => e.event_type === 'RETURN_APPROVED')).toBe(true);
    });

    it('17 & 18. Merchant rejects return request and rejected return cannot proceed to pickup', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Item not liked');

      const rejectRes = await request(testApp)
        .post(`/api/merchant/orders/${order.id}/reject-return`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ reason: 'Out of policy return period' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.status).toBe('return_rejected');
      expect(rejectRes.body.return_status).toBe('return_rejected');
      expect(rejectRes.body.return_rejection_reason).toBe('Out of policy return period');

      // Attempt to schedule pickup on rejected return -> MUST fail
      const pickupRes = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'pickup_scheduled' });

      expect(pickupRes.status).toBe(400);
      expect(pickupRes.body.error).toMatch(/Cannot schedule pickup before return approval/i);
    });
  });

  describe('Feature 3: Return Logistics Sequential Timeline', () => {
    it('19-23. Progressive sequential return logistics workflow', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Defective zipper');
      await testOrderService.approveReturn(order.id, merchantId);

      // 1. Schedule Pickup
      const step1 = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'pickup_scheduled', pickup_notes: 'Courier arriving 3 PM' });

      expect(step1.status).toBe(200);
      expect(step1.body.return_status).toBe('pickup_scheduled');
      expect(step1.body.pickup_notes).toBe('Courier arriving 3 PM');

      // 2. Mark Picked Up
      const step2 = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'order_picked_up' });

      expect(step2.status).toBe(200);
      expect(step2.body.return_status).toBe('order_picked_up');

      // 3. Mark Return In Transit
      const step3 = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'return_in_transit' });

      expect(step3.status).toBe(200);
      expect(step3.body.return_status).toBe('return_in_transit');

      // 4. Mark Returned to Seller
      const step4 = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'order_returned_to_seller' });

      expect(step4.status).toBe(200);
      expect(step4.body.return_status).toBe('order_returned_to_seller');

      // Verify complete timeline history
      const timeline = await testOrderService.getOrderTimeline(order.id);
      const eventTypes = timeline.map((e) => e.event_type);
      expect(eventTypes).toContain('RETURN_REQUESTED');
      expect(eventTypes).toContain('RETURN_APPROVED');
      expect(eventTypes).toContain('PICKUP_SCHEDULED');
      expect(eventTypes).toContain('ORDER_PICKED_UP');
      expect(eventTypes).toContain('RETURN_IN_TRANSIT');
      expect(eventTypes).toContain('ORDER_RETURNED_TO_SELLER');
    });

    it('26. Invalid out-of-order state transitions are rejected by backend', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Test order');

      // Try skipping approval straight to picked up
      const res = await request(testApp)
        .patch(`/api/merchant/orders/${order.id}/return-logistics`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'order_picked_up' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot mark picked up before pickup is scheduled/i);
    });
  });

  describe('Feature 4: Initiate Refund Final Return Step & Groq Email Generation', () => {
    it('Initiate refund is blocked before order reaches returned_to_seller', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Item defect');
      await testOrderService.approveReturn(order.id, merchantId);

      const res = await request(testApp)
        .post(`/api/merchant/orders/${order.id}/initiate-refund`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot initiate refund before order is returned to seller/i);
    });

    it('Initiate refund succeeds after returned_to_seller, updates timeline and prevents double initiation', async () => {
      const order = await createTestOrder('delivered');
      await testOrderService.requestReturn(order.id, customerId, 'Item defect');
      await testOrderService.approveReturn(order.id, merchantId);
      await testOrderService.updateReturnLogistics(order.id, merchantId, 'pickup_scheduled');
      await testOrderService.updateReturnLogistics(order.id, merchantId, 'order_picked_up');
      await testOrderService.updateReturnLogistics(order.id, merchantId, 'return_in_transit');
      await testOrderService.updateReturnLogistics(order.id, merchantId, 'order_returned_to_seller');

      // First initiation
      const res = await request(testApp)
        .post(`/api/merchant/orders/${order.id}/initiate-refund`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.return_status).toBe('refund_initiated');
      expect(res.body.refund_status).toBe('initiated');
      expect(res.body.refund_initiated_at).toBeDefined();

      const timeline = await testOrderService.getOrderTimeline(order.id);
      expect(timeline.some((e) => e.event_type === 'REFUND_INITIATED')).toBe(true);

      // Double initiation -> MUST fail
      const doubleRes = await request(testApp)
        .post(`/api/merchant/orders/${order.id}/initiate-refund`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send();

      expect(doubleRes.status).toBe(400);
      expect(doubleRes.body.error).toMatch(/Refund has already been initiated/i);
    });
  });

  describe('Analytics Integration', () => {
    it('29-32. Analytics dynamically computes cancelled and returned orders counts strictly when returned to seller', async () => {
      const o1 = await createTestOrder('confirmed');
      await testOrderService.cancelOrder(o1.id, customerId, 'Changed mind');

      const o2 = await createTestOrder('delivered');
      await testOrderService.requestReturn(o2.id, customerId, 'Size wrong');

      // Return requested -> returned count MUST still be 0
      let metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(0);

      // Advance return to order_returned_to_seller
      await testOrderService.approveReturn(o2.id, merchantId);
      await testOrderService.updateReturnLogistics(o2.id, merchantId, 'pickup_scheduled');
      await testOrderService.updateReturnLogistics(o2.id, merchantId, 'order_picked_up');
      await testOrderService.updateReturnLogistics(o2.id, merchantId, 'return_in_transit');
      await testOrderService.updateReturnLogistics(o2.id, merchantId, 'order_returned_to_seller');

      // Now returned count MUST be 1
      metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(1);
    });

    it('Requirement 16 Exact End-to-End Scenario: Order A cancellation + Order B return lifecycle with stock & units_sold consistency', async () => {
      const inventoryRepo = TestDataSource.getRepository(Inventory);

      // Reset stock of productId to 10
      let inv = await inventoryRepo.findOne({ where: { product_id: productId } });
      if (inv) {
        inv.quantity_on_hand = 10;
        inv.reserved = 0;
        await inventoryRepo.save(inv);
      }

      // ORDER A: Customer buys quantity 2
      const orderA = await createTestOrder('confirmed', 2);
      inv = await inventoryRepo.findOne({ where: { product_id: productId } });
      if (inv) {
        inv.quantity_on_hand = 8;
        await inventoryRepo.save(inv);
      }

      // Customer cancels Order A before dispatch
      await testOrderService.cancelOrder(orderA.id, customerId, 'Cancellation test');

      inv = await inventoryRepo.findOne({ where: { product_id: productId } });
      expect(inv?.quantity_on_hand).toBe(10); // Stock restored to 10

      let metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(0);

      // ORDER B: Customer buys quantity 2
      const orderB = await createTestOrder('confirmed', 2);
      inv = await inventoryRepo.findOne({ where: { product_id: productId } });
      if (inv) {
        inv.quantity_on_hand = 8;
        await inventoryRepo.save(inv);
      }

      // Merchant dispatches & delivers Order B
      orderB.status = 'delivered';
      await TestDataSource.getRepository(Order).save(orderB);

      // Customer requests return
      await testOrderService.requestReturn(orderB.id, customerId, 'Return test');
      metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(0);

      // Merchant approves return
      await testOrderService.approveReturn(orderB.id, merchantId);

      // Logistics: Pickup Scheduled -> Picked Up -> In Transit -> Returned to Seller
      await testOrderService.updateReturnLogistics(orderB.id, merchantId, 'pickup_scheduled');
      await testOrderService.updateReturnLogistics(orderB.id, merchantId, 'order_picked_up');
      await testOrderService.updateReturnLogistics(orderB.id, merchantId, 'return_in_transit');
      await testOrderService.updateReturnLogistics(orderB.id, merchantId, 'order_returned_to_seller');

      inv = await inventoryRepo.findOne({ where: { product_id: productId } });
      expect(inv?.quantity_on_hand).toBe(10); // Stock restored to 10 at Returned to Seller

      metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(1);

      // Initiate refund
      const refundedOrder = await testOrderService.initiateRefund(orderB.id, merchantId);
      expect(refundedOrder.return_status).toBe('refund_initiated');

      // Final analytics check: Cancelled = 1, Returned = 1
      metrics = await analyticsService.getDashboardMetrics(merchantId);
      expect(metrics.orders_cancelled_count).toBe(1);
      expect(metrics.orders_returned_count).toBe(1);
    });
  });
});
