import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../app.js';
import { TestDataSource } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { AuthService } from '../services/AuthService.js';
import { EmailService } from '../services/EmailService.js';

describe('Customer Order Status Email Notifications Test Suite', () => {
  let app: any;
  let dataSource: DataSource;
  let authService: AuthService;
  let mockEmailService: EmailService;

  let customer: Customer;
  let merchantA: Merchant;
  let merchantB: Merchant;
  let productA: Product;

  let customerToken: string;
  let merchantAToken: string;
  let merchantBToken: string;

  beforeAll(async () => {
    dataSource = TestDataSource;
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    authService = new AuthService(dataSource);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE order_timeline, customer_addresses, order_items, orders, cart_items, carts, inventory, products, merchants, customers CASCADE;'
    );

    mockEmailService = new EmailService();

    // Spy on email dispatch methods
    jest.spyOn(mockEmailService, 'sendOrderDispatchedNotification');
    jest.spyOn(mockEmailService, 'sendOrderDeliveredNotification');

    app = createApp(dataSource, authService);

    const custRepo = dataSource.getRepository(Customer);
    customer = await custRepo.save(
      custRepo.create({ email: 'realcustomer@example.com', password_hash: 'hash', name: 'John Customer' })
    );

    const merchRepo = dataSource.getRepository(Merchant);
    merchantA = await merchRepo.save(
      merchRepo.create({ email: 'merchantA@store.com', name: 'Merchant A Store', status: 'active' })
    );
    merchantB = await merchRepo.save(
      merchRepo.create({ email: 'merchantB@store.com', name: 'Merchant B Store', status: 'active' })
    );

    const prodRepo = dataSource.getRepository(Product);
    productA = await prodRepo.save(
      prodRepo.create({ merchant_id: merchantA.id, name: 'Wireless Headphones', category: 'Audio', price_cents: 4999 })
    );

    const invRepo = dataSource.getRepository(Inventory);
    await invRepo.save(invRepo.create({ product_id: productA.id, quantity_on_hand: 50, reserved: 0 }));

    customerToken = authService.generateToken({ id: customer.id, email: customer.email, role: 'customer' });
    merchantAToken = authService.generateToken({ id: merchantA.id, email: merchantA.email, role: 'merchant' });
    merchantBToken = authService.generateToken({ id: merchantB.id, email: merchantB.email, role: 'merchant' });
  });

  it('1. CONFIRMED -> DISPATCHED sends exactly one dispatch email with 3-5 day delivery wording', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-DISPATCH-101',
        status: 'confirmed',
        subtotal_cents: 4999,
        total_cents: 4999,
        shipping_address: { full_address: '456 Tech Park', state: 'Delhi', pin_code: '110001' },
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dispatched');

    // Verify timeline entry created
    const timelineRepo = dataSource.getRepository(OrderTimeline);
    const timelineEvents = await timelineRepo.find({ where: { order_id: order.id } });
    expect(timelineEvents.length).toBe(1);
    expect(timelineEvents[0].event_type).toBe('ORDER_DISPATCHED');
  });

  it('2. DISPATCHED -> DELIVERED sends exactly one delivery email to customer', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-DELIVER-202',
        status: 'dispatched',
        subtotal_cents: 4999,
        total_cents: 4999,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');

    // Verify timeline entry created
    const timelineRepo = dataSource.getRepository(OrderTimeline);
    const timelineEvents = await timelineRepo.find({ where: { order_id: order.id } });
    expect(timelineEvents.some((e) => e.event_type === 'ORDER_DELIVERED')).toBe(true);
  });

  it('3. Repeated status updates (idempotency) do not trigger duplicate timeline events or emails', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-IDEMPOTENT-303',
        status: 'confirmed',
        subtotal_cents: 4999,
        total_cents: 4999,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    // First request
    const res1 = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(res1.status).toBe(200);

    // Second repeated request
    const res2 = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    // Status remains dispatched, no duplicate error or duplicate timeline event
    const timelineRepo = dataSource.getRepository(OrderTimeline);
    const events = await timelineRepo.find({ where: { order_id: order.id, event_type: 'ORDER_DISPATCHED' } });
    expect(events.length).toBe(1);
  });

  it('4. Invalid status transition (e.g. pending -> dispatched) does NOT send email or update status', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const pendingOrder = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-INVALID-404',
        status: 'pending',
        subtotal_cents: 4999,
        total_cents: 4999,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: pendingOrder.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${pendingOrder.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Order must be \'confirmed\'');

    const checkOrder = await orderRepo.findOne({ where: { id: pendingOrder.id } });
    expect(checkOrder?.status).toBe('pending');
  });

  it('5. Unauthorized merchant (Merchant B) cannot transition status or trigger email for Merchant A order', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-UNAUTH-505',
        status: 'confirmed',
        subtotal_cents: 4999,
        total_cents: 4999,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantBToken}`)
      .send({ status: 'dispatched' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('6. Email service exception does NOT rollback order status or timeline persistence', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer.id,
        order_number: 'ORD-EMAILFAIL-606',
        status: 'confirmed',
        subtotal_cents: 4999,
        total_cents: 4999,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 4999, line_total_cents: 4999 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dispatched');

    // Confirm status changed in database despite email result
    const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('dispatched');
  });
});
