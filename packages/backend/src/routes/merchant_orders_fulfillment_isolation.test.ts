import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
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
import { CustomerAddress } from '../models/CustomerAddress.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { AuthService } from '../services/AuthService.js';

describe('Merchant Orders Fulfillment Scoping, Timeline & Address Isolation Suite', () => {
  let app: any;
  let dataSource: DataSource;
  let authService: AuthService;

  let customerA: Customer;
  let merchantA: Merchant;
  let merchantB: Merchant;
  let productA: Product;
  let productB: Product;

  let customerAToken: string;
  let merchantAToken: string;
  let merchantBToken: string;

  beforeAll(async () => {
    dataSource = TestDataSource;
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    authService = new AuthService(dataSource);
    app = createApp(dataSource, authService);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE order_timeline, customer_addresses, order_items, orders, cart_items, carts, inventory, products, merchants, customers CASCADE;');

    const custRepo = dataSource.getRepository(Customer);
    customerA = await custRepo.save(
      custRepo.create({ email: 'customerA@test.com', password_hash: 'hashA', name: 'Customer A' })
    );

    const merchRepo = dataSource.getRepository(Merchant);
    merchantA = await merchRepo.save(
      merchRepo.create({ email: 'merchantA@test.com', name: 'Merchant A Store', status: 'active' })
    );
    merchantB = await merchRepo.save(
      merchRepo.create({ email: 'merchantB@test.com', name: 'Merchant B Store', status: 'active' })
    );

    const prodRepo = dataSource.getRepository(Product);
    productA = await prodRepo.save(
      prodRepo.create({ merchant_id: merchantA.id, name: 'Product A', category: 'Gadgets', price_cents: 1500 })
    );
    productB = await prodRepo.save(
      prodRepo.create({ merchant_id: merchantB.id, name: 'Product B', category: 'Tools', price_cents: 2500 })
    );

    const invRepo = dataSource.getRepository(Inventory);
    await invRepo.save(invRepo.create({ product_id: productA.id, quantity_on_hand: 100, reserved: 0 }));
    await invRepo.save(invRepo.create({ product_id: productB.id, quantity_on_hand: 100, reserved: 0 }));

    customerAToken = authService.generateToken({ id: customerA.id, email: customerA.email, role: 'customer' });
    merchantAToken = authService.generateToken({ id: merchantA.id, email: merchantA.email, role: 'merchant' });
    merchantBToken = authService.generateToken({ id: merchantB.id, email: merchantB.email, role: 'merchant' });
  });

  it('1. Merchant A can retrieve own order details with merchant-scoped items', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customerA.id,
        order_number: 'ORD-ISOLATION-001',
        status: 'confirmed',
        subtotal_cents: 4000,
        total_cents: 4000,
        shipping_address: { full_address: '100 Ocean Drive', state: 'Goa', pin_code: '403002' },
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 1500, line_total_cents: 1500 })
    );
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productB.id, quantity: 1, price_cents: 2500, line_total_cents: 2500 })
    );

    const res = await request(app)
      .get(`/api/merchant/orders/${order.id}`)
      .set('Authorization', `Bearer ${merchantAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.merchant_items).toBeDefined();
    expect(res.body.items).toBeDefined();
    expect(res.body.merchant_items.length).toBe(1);
    expect(res.body.merchant_items[0].product_id).toBe(productA.id);
    expect(res.body.merchant_total_cents).toBe(1500);
  });

  it('2. Merchant B cannot access order details if order has no products for Merchant B', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customerA.id,
        order_number: 'ORD-ONLY-A',
        status: 'confirmed',
        subtotal_cents: 1500,
        total_cents: 1500,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 1500, line_total_cents: 1500 })
    );

    const resB = await request(app)
      .get(`/api/merchant/orders/${order.id}`)
      .set('Authorization', `Bearer ${merchantBToken}`);

    expect(resB.status).toBe(403);
    expect(resB.body.error).toContain('no products for this merchant');
  });

  it('3. Nonexistent order ID returns 404', async () => {
    const res = await request(app)
      .get('/api/merchant/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${merchantAToken}`);

    expect(res.status).toBe(404);
  });

  it('4. Valid transitions CONFIRMED -> DISPATCHED -> DELIVERED update state and persist timeline events', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customerA.id,
        order_number: 'ORD-TRANSITION-01',
        status: 'confirmed',
        subtotal_cents: 1500,
        total_cents: 1500,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 1500, line_total_cents: 1500 })
    );

    // CONFIRMED -> DISPATCHED
    const dispatchRes = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.status).toBe('dispatched');

    // DISPATCHED -> DELIVERED
    const deliverRes = await request(app)
      .patch(`/api/merchant/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'delivered' });

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.status).toBe('delivered');

    // Verify timeline entries in database
    const timelineRepo = dataSource.getRepository(OrderTimeline);
    const events = await timelineRepo.find({ where: { order_id: order.id }, order: { created_at: 'ASC' } });
    const eventTypes = events.map((e) => e.event_type);

    expect(eventTypes).toContain('ORDER_DISPATCHED');
    expect(eventTypes).toContain('ORDER_DELIVERED');
  });

  it('5. Invalid transitions (e.g. pending -> dispatched or invalid state) are rejected', async () => {
    const orderRepo = dataSource.getRepository(Order);
    const pendingOrder = await orderRepo.save(
      orderRepo.create({
        customer_id: customerA.id,
        order_number: 'ORD-PENDING-01',
        status: 'pending',
        subtotal_cents: 1500,
        total_cents: 1500,
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: pendingOrder.id, product_id: productA.id, quantity: 1, price_cents: 1500, line_total_cents: 1500 })
    );

    const res = await request(app)
      .patch(`/api/merchant/orders/${pendingOrder.id}/status`)
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ status: 'dispatched' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Order must be \'confirmed\'');
  });

  it('6. Historical address snapshot is returned and remains unchanged when customer edits profile address', async () => {
    const addrRepo = dataSource.getRepository(CustomerAddress);
    const savedAddr = await addrRepo.save(
      addrRepo.create({
        customer_id: customerA.id,
        full_address: 'Original Address 777',
        state: 'Karnataka',
        pin_code: '560001',
        is_default: true,
      })
    );

    const orderRepo = dataSource.getRepository(Order);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customerA.id,
        order_number: 'ORD-SNAP-99',
        status: 'confirmed',
        subtotal_cents: 1500,
        total_cents: 1500,
        shipping_address: {
          full_address: savedAddr.full_address,
          state: savedAddr.state,
          pin_code: savedAddr.pin_code,
        },
      })
    );

    const orderItemRepo = dataSource.getRepository(OrderItem);
    await orderItemRepo.save(
      orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 1500, line_total_cents: 1500 })
    );

    // Customer updates address in profile
    savedAddr.full_address = 'Modified Customer Profile Address 888';
    await addrRepo.save(savedAddr);

    // Merchant fetches order details
    const res = await request(app)
      .get(`/api/merchant/orders/${order.id}`)
      .set('Authorization', `Bearer ${merchantAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipping_address.full_address).toBe('Original Address 777');
  });
});
