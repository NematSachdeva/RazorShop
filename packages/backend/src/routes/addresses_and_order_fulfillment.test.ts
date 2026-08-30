import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../app.js';
import { TestDataSource } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { AuthService } from '../services/AuthService.js';

describe('Customer Addresses, Merchant Orders & Order Fulfillment Timeline', () => {
  let app: any;
  let dataSource: DataSource;
  let authService: AuthService;

  let customerA: Customer;
  let customerB: Customer;
  let merchantA: Merchant;
  let merchantB: Merchant;
  let productA: Product;
  let productB: Product;

  let customerAToken: string;
  let customerBToken: string;
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
      custRepo.create({ email: 'customerA@example.com', password_hash: 'hashA', name: 'Customer A' })
    );
    customerB = await custRepo.save(
      custRepo.create({ email: 'customerB@example.com', password_hash: 'hashB', name: 'Customer B' })
    );

    const merchRepo = dataSource.getRepository(Merchant);
    merchantA = await merchRepo.save(
      merchRepo.create({ email: 'merchantA@example.com', name: 'Merchant A Store', status: 'active' })
    );
    merchantB = await merchRepo.save(
      merchRepo.create({ email: 'merchantB@example.com', name: 'Merchant B Store', status: 'active' })
    );

    const prodRepo = dataSource.getRepository(Product);
    productA = await prodRepo.save(
      prodRepo.create({ merchant_id: merchantA.id, name: 'Product A', category: 'Tech', price_cents: 2000 })
    );
    productB = await prodRepo.save(
      prodRepo.create({ merchant_id: merchantB.id, name: 'Product B', category: 'Home', price_cents: 3000 })
    );

    const invRepo = dataSource.getRepository(Inventory);
    await invRepo.save(invRepo.create({ product_id: productA.id, quantity_on_hand: 50, reserved: 0 }));
    await invRepo.save(invRepo.create({ product_id: productB.id, quantity_on_hand: 50, reserved: 0 }));

    customerAToken = authService.generateToken({ id: customerA.id, email: customerA.email, role: 'customer' });
    customerBToken = authService.generateToken({ id: customerB.id, email: customerB.email, role: 'customer' });
    merchantAToken = authService.generateToken({ id: merchantA.id, email: merchantA.email, role: 'merchant' });
    merchantBToken = authService.generateToken({ id: merchantB.id, email: merchantB.email, role: 'merchant' });
  });

  describe('Feature 1 & 2: Customer Address Management', () => {
    it('creates first address as default automatically', async () => {
      const res = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          full_address: '123 Marine Drive',
          state: 'Maharashtra',
          pin_code: '400001',
          phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.full_address).toBe('123 Marine Drive');
      expect(res.body.is_default).toBe(true);
    });

    it('setting second address as default unsets first address', async () => {
      const addr1 = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ full_address: 'Address 1', state: 'State 1', pin_code: '100001' });

      const addr2 = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ full_address: 'Address 2', state: 'State 2', pin_code: '100002', is_default: true });

      expect(addr2.body.is_default).toBe(true);

      const listRes = await request(app)
        .get('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`);

      const first = listRes.body.find((a: any) => a.id === addr1.body.id);
      const second = listRes.body.find((a: any) => a.id === addr2.body.id);
      expect(first.is_default).toBe(false);
      expect(second.is_default).toBe(true);
    });

    it('customer B cannot access customer A addresses', async () => {
      const addrA = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ full_address: 'Address A', state: 'State A', pin_code: '100001' });

      const resGet = await request(app)
        .get(`/api/addresses/${addrA.body.id}`)
        .set('Authorization', `Bearer ${customerBToken}`);

      expect(resGet.status).toBe(404);
    });
  });

  describe('Feature 3 & 4: Cart Address Selection & Immutable Snapshotting', () => {
    it('creates an order with shipping address snapshot and maintains immutability when profile address is updated', async () => {
      const addrRes = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ full_address: 'Original Address 100', state: 'Delhi', pin_code: '110001', phone: '9999999999' });

      const cartRepo = dataSource.getRepository(Cart);
      const cart = await cartRepo.save(cartRepo.create({ customer_id: customerA.id, status: 'active' }));

      const cartItemRepo = dataSource.getRepository(CartItem);
      await cartItemRepo.save(cartItemRepo.create({ cart_id: cart.id, product_id: productA.id, quantity: 2, price_cents: 2000 }));

      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          cart_id: cart.id,
          customer_id: customerA.id,
          shipping_address: {
            full_address: addrRes.body.full_address,
            state: addrRes.body.state,
            pin_code: addrRes.body.pin_code,
            phone: addrRes.body.phone,
          },
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.shipping_address).toBeDefined();
      expect(orderRes.body.shipping_address.full_address).toBe('Original Address 100');

      await request(app)
        .put(`/api/addresses/${addrRes.body.id}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ full_address: 'NEW Modified Address 555' });

      const fetchedOrder = await request(app)
        .get(`/api/orders/${orderRes.body.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(fetchedOrder.body.shipping_address.full_address).toBe('Original Address 100');
    });
  });

  describe('Feature 5, 6 & 7: Merchant Order Management & Fulfillment Timeline State Machine', () => {
    it('isolates merchant orders and enforces valid status transitions', async () => {
      const orderRepo = dataSource.getRepository(Order);
      const order = await orderRepo.save(
        orderRepo.create({
          customer_id: customerA.id,
          order_number: 'ORD-TEST-001',
          status: 'confirmed',
          subtotal_cents: 5000,
          total_cents: 5000,
          shipping_address: { full_address: '123 Palm Street', state: 'Goa', pin_code: '403001' },
        })
      );

      const orderItemRepo = dataSource.getRepository(OrderItem);
      await orderItemRepo.save(
        orderItemRepo.create({ order_id: order.id, product_id: productA.id, quantity: 1, price_cents: 2000, line_total_cents: 2000 })
      );
      await orderItemRepo.save(
        orderItemRepo.create({ order_id: order.id, product_id: productB.id, quantity: 1, price_cents: 3000, line_total_cents: 3000 })
      );

      const merchAOrders = await request(app)
        .get('/api/merchant/orders')
        .set('Authorization', `Bearer ${merchantAToken}`);

      expect(merchAOrders.status).toBe(200);
      expect(merchAOrders.body.data.length).toBe(1);
      expect(merchAOrders.body.data[0].merchant_items.length).toBe(1);
      expect(merchAOrders.body.data[0].merchant_items[0].product_id).toBe(productA.id);

      const invalidRes = await request(app)
        .patch(`/api/merchant/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({ status: 'invalid_status' });

      expect(invalidRes.status).toBe(400);

      const dispatchRes = await request(app)
        .patch(`/api/merchant/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({ status: 'dispatched' });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.status).toBe('dispatched');

      const timelineRes = await request(app)
        .get(`/api/orders/${order.id}/timeline`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(timelineRes.status).toBe(200);
      const events = timelineRes.body.map((e: any) => e.event_type);
      expect(events).toContain('ORDER_DISPATCHED');

      const deliverRes = await request(app)
        .patch(`/api/merchant/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({ status: 'delivered' });

      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe('delivered');

      const finalTimeline = await request(app)
        .get(`/api/orders/${order.id}/timeline`)
        .set('Authorization', `Bearer ${customerAToken}`);

      const finalEvents = finalTimeline.body.map((e: any) => e.event_type);
      expect(finalEvents).toContain('ORDER_DELIVERED');
    });
  });
});
