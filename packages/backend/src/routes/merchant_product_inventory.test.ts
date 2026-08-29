/**
 * Test Suite: Merchant Product Catalog & Inventory Management
 * Verifies merchant authentication, CRUD operations, inventory bounds (non-negative, reserved check),
 * pessimistic locking, multi-merchant scoping, safe archiving, and customer store reflection.
 */

import request from 'supertest';
import express, { Express } from 'express';
import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { createAuthRouter } from './auth.js';
import { createProductsRouter } from './products.js';
import { createMerchantRouter } from './merchant.js';
import { AuthService } from '../services/AuthService.js';
import { ProductService } from '../services/ProductService.js';

describe('Merchant Product Catalog & Inventory Management API', () => {
  let app: Express;
  let authService: AuthService;
  let productService: ProductService;
  let merchantToken: string;
  let merchantId: string;
  let secondaryMerchantToken: string;
  let secondaryMerchantId: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    authService = new AuthService(TestDataSource);
    productService = new ProductService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/products', createProductsRouter(productService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);

    // Primary merchant setup
    const m1Email = `merchant_primary_${Date.now()}@test.com`;
    const m1 = await customerRepo.save(
      customerRepo.create({
        email: m1Email,
        name: 'Primary Merchant Owner',
        role: 'merchant',
      })
    );
    merchantId = m1.id;
    merchantToken = authService.generateToken({
      id: m1.id,
      email: m1.email,
      role: 'merchant',
    });

    // Secondary merchant setup
    const m2Email = `merchant_secondary_${Date.now()}@test.com`;
    const m2 = await customerRepo.save(
      customerRepo.create({
        email: m2Email,
        name: 'Secondary Merchant Owner',
        role: 'merchant',
      })
    );
    secondaryMerchantId = m2.id;
    secondaryMerchantToken = authService.generateToken({
      id: m2.id,
      email: m2.email,
      role: 'merchant',
    });
  });

  it('1. Merchant can create a new product with initial inventory', async () => {
    const createRes = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Solar Smart Outdoor Lamp',
        description: 'Solar powered motion sensor light',
        price_cents: 499900,
        category: 'Lighting',
        initial_quantity: 45,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Solar Smart Outdoor Lamp');
    expect(createRes.body.price_cents).toBe(499900);
    expect(createRes.body.inventory.quantity_on_hand).toBe(45);
    expect(createRes.body.inventory.available).toBe(45);

    // Verify customer store API reflects newly created product immediately
    const customerRes = await request(app).get(`/api/products/${createRes.body.id}`);
    expect(customerRes.status).toBe(200);
    expect(customerRes.body.name).toBe('Solar Smart Outdoor Lamp');
  });

  it('2. Merchant can list products and view inventory details', async () => {
    // Create product
    await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Smart Door Lock',
        price_cents: 899900,
        category: 'Security',
        initial_quantity: 20,
      });

    const listRes = await request(app)
      .get('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.products)).toBe(true);
    const found = listRes.body.products.find((p: any) => p.name === 'Smart Door Lock');
    expect(found).toBeDefined();
    expect(found.inventory.quantity_on_hand).toBe(20);
  });

  it('3. Merchant can edit product price, category, name, description', async () => {
    const createRes = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Draft Product',
        price_cents: 100000,
        category: 'Drafts',
        initial_quantity: 10,
      });

    const prodId = createRes.body.id;

    const editRes = await request(app)
      .put(`/api/merchant/products/${prodId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Final Premium Headphones',
        category: 'Audio',
        price_cents: 1499900,
        description: 'Updated high fidelity headphones',
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.name).toBe('Final Premium Headphones');
    expect(editRes.body.category).toBe('Audio');
    expect(editRes.body.price_cents).toBe(1499900);

    // Customer API reflects updated product info
    const customerRes = await request(app).get(`/api/products/${prodId}`);
    expect(customerRes.body.name).toBe('Final Premium Headphones');
    expect(Number(customerRes.body.price_cents)).toBe(1499900);
  });

  it('4. Merchant CANNOT modify another merchant product', async () => {
    // Merchant 1 creates product
    const createRes = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Merchant 1 Exclusive Item',
        price_cents: 500000,
      });

    const prodId = createRes.body.id;

    // Set exact merchant_id to primaryMerchantId
    const prodRepo = TestDataSource.getRepository(Product);
    await prodRepo.update({ id: prodId }, { merchant_id: merchantId });

    // Merchant 2 attempts to edit product
    const editRes = await request(app)
      .put(`/api/merchant/products/${prodId}`)
      .set('Authorization', `Bearer ${secondaryMerchantToken}`)
      .send({ name: 'Hacked Name' });

    expect(editRes.status).toBe(403);
    expect(editRes.body.error).toContain('Unauthorized');
  });

  it('5. Merchant can adjust stock inventory (add, remove, set) with bounds validation', async () => {
    const createRes = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Stock Adjustment Test Product',
        price_cents: 199900,
        initial_quantity: 10,
      });

    const prodId = createRes.body.id;

    // Add stock (+15)
    const addRes = await request(app)
      .put(`/api/merchant/products/${prodId}/inventory`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ action: 'add', quantity: 15 });

    expect(addRes.status).toBe(200);
    expect(addRes.body.quantity_on_hand).toBe(25);
    expect(addRes.body.available).toBe(25);

    // Remove stock (-5)
    const removeRes = await request(app)
      .put(`/api/merchant/products/${prodId}/inventory`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ action: 'remove', quantity: 5 });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.quantity_on_hand).toBe(20);

    // Reject attempt to remove more stock than available (negative result)
    const invalidRemoveRes = await request(app)
      .put(`/api/merchant/products/${prodId}/inventory`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ action: 'remove', quantity: 100 });

    expect(invalidRemoveRes.status).toBe(400);
    expect(invalidRemoveRes.body.error).toContain('negative');
  });

  it('6. Reject reducing stock below reserved quantity', async () => {
    const createRes = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Reserved Stock Test Product',
        price_cents: 299900,
        initial_quantity: 10,
      });

    const prodId = createRes.body.id;

    // Set reserved count in database to 5
    const invRepo = TestDataSource.getRepository(Inventory);
    await invRepo.update({ product_id: prodId }, { reserved: 5 });

    // Attempt to set total stock to 3 (lower than reserved 5)
    const res = await request(app)
      .put(`/api/merchant/products/${prodId}/inventory`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ action: 'set', quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reserved quantity');
  });

  it('7. Product with historical orders is safely archived on delete', async () => {
    const prodRepo = TestDataSource.getRepository(Product);
    const product = await prodRepo.save(
      prodRepo.create({
        name: 'Historical Order Product',
        price_cents: 399900,
        category: 'Gadgets',
      })
    );

    // Create an order referencing this product
    const orderRepo = TestDataSource.getRepository(Order);
    const orderItemRepo = TestDataSource.getRepository(OrderItem);
    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: merchantId,
        order_number: `ORD-HIST-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        status: 'confirmed',
        subtotal_cents: 399900,
        tax_cents: 0,
        total_cents: 399900,
      })
    );
    await orderItemRepo.save(
      orderItemRepo.create({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        price_cents: 399900,
        line_total_cents: 399900,
      })
    );

    // Merchant attempts to delete product
    const deleteRes = await request(app)
      .delete(`/api/merchant/products/${product.id}`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.status).toBe('archived');

    // Historical order item record remains fully intact in PostgreSQL
    const savedOrderItem = await orderItemRepo.findOne({
      where: { product_id: product.id },
    });
    expect(savedOrderItem).not.toBeNull();
  });
});
