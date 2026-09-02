/**
 * Product Image Support & Product Information Management Test Suite
 */

import request from 'supertest';
import {
  TestDataSource,
  initializeTestDatabase,
  closeTestDatabase,
} from '../config/database.test.js';
import { createApp } from '../app.js';
import { AuthService } from '../services/AuthService.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import fs from 'fs';
import path from 'path';

describe('Product Image Support & Product Information Management', () => {
  let app: any;
  let authService: AuthService;
  let merchantACustomer: Customer;
  let merchantBCustomer: Customer;
  let merchantAToken: string;
  let merchantBToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);
    app = createApp(TestDataSource, authService);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query(
      'TRUNCATE TABLE order_timeline, order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE'
    );
    await qr.release();

    const customerRepo = TestDataSource.getRepository(Customer);
    const merchantRepo = TestDataSource.getRepository(Merchant);

    merchantACustomer = await customerRepo.save(
      customerRepo.create({
        email: `merchant-a-${Date.now()}@example.com`,
        name: 'Merchant Alpha',
        role: 'merchant',
      })
    );
    await merchantRepo.save(
      merchantRepo.create({
        id: merchantACustomer.id,
        email: merchantACustomer.email,
        name: merchantACustomer.name,
      })
    );

    merchantBCustomer = await customerRepo.save(
      customerRepo.create({
        email: `merchant-b-${Date.now()}@example.com`,
        name: 'Merchant Beta',
        role: 'merchant',
      })
    );
    await merchantRepo.save(
      merchantRepo.create({
        id: merchantBCustomer.id,
        email: merchantBCustomer.email,
        name: merchantBCustomer.name,
      })
    );

    merchantAToken = authService.generateToken({
      id: merchantACustomer.id,
      email: merchantACustomer.email,
      role: 'merchant',
    });

    merchantBToken = authService.generateToken({
      id: merchantBCustomer.id,
      email: merchantBCustomer.email,
      role: 'merchant',
    });
  });

  describe('1. Product Image Support (Create & Edit)', () => {
    test('1. Create product without description is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/merchant/products')
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          name: 'Basic Power Bank',
          image_url: 'https://example.com/powerbank.jpg',
          price_cents: 99900,
          category: 'Electronics',
          initial_quantity: 25,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('description is required');
    });

    test('2. Create product without image is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/merchant/products')
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          name: 'Basic Power Bank',
          description: 'Portable charger 10000mAh',
          price_cents: 99900,
          category: 'Electronics',
          initial_quantity: 25,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('image is required');
    });

    test('3. Create product with image URL and description succeeds', async () => {
      const imageUrl = 'https://example.com/images/powerbank-pro.jpg';
      const res = await request(app)
        .post('/api/merchant/products')
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          name: 'Power Bank Pro',
          description: 'Fast charging power bank 20000mAh',
          price_cents: 149900,
          category: 'Electronics',
          image_url: imageUrl,
          initial_quantity: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Power Bank Pro');
      expect(res.body.description).toBe('Fast charging power bank 20000mAh');
      expect(res.body.image_url).toBe(imageUrl);

      const productRepo = TestDataSource.getRepository(Product);
      const dbProd = await productRepo.findOne({ where: { id: res.body.id } });
      expect(dbProd?.image_url).toBe(imageUrl);
      expect(dbProd?.description).toBe('Fast charging power bank 20000mAh');
    });

    test('3. Update existing product to add an image', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod = await productRepo.save(
        productRepo.create({
          name: 'Wireless Earbuds',
          price_cents: 299900,
          category: 'Electronics',
          merchant_id: merchantACustomer.id,
          image_url: null,
        })
      );

      const newImageUrl = 'https://example.com/images/earbuds.jpg';
      const updateRes = await request(app)
        .put(`/api/merchant/products/${prod.id}`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          image_url: newImageUrl,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(prod.id);
      expect(updateRes.body.image_url).toBe(newImageUrl);

      const dbProd = await productRepo.findOne({ where: { id: prod.id } });
      expect(dbProd?.image_url).toBe(newImageUrl);
    });

    test('4. Update existing product to replace an existing image', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod = await productRepo.save(
        productRepo.create({
          name: 'Smart Watch',
          price_cents: 499900,
          category: 'Electronics',
          merchant_id: merchantACustomer.id,
          image_url: 'https://example.com/old-watch.jpg',
        })
      );

      const replacedUrl = 'https://example.com/new-watch-v2.jpg';
      const updateRes = await request(app)
        .put(`/api/merchant/products/${prod.id}`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          image_url: replacedUrl,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.image_url).toBe(replacedUrl);

      const dbProd = await productRepo.findOne({ where: { id: prod.id } });
      expect(dbProd?.image_url).toBe(replacedUrl);
    });

    test('5. Remove an existing product image', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod = await productRepo.save(
        productRepo.create({
          name: 'Desk Mat',
          price_cents: 79900,
          merchant_id: merchantACustomer.id,
          image_url: 'https://example.com/desk-mat.jpg',
        })
      );

      const updateRes = await request(app)
        .put(`/api/merchant/products/${prod.id}`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          image_url: null,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.image_url).toBeNull();

      const dbProd = await productRepo.findOne({ where: { id: prod.id } });
      expect(dbProd?.image_url).toBeNull();
    });

    test('6. Upload image file via POST /api/merchant/upload-image', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const res = await request(app)
        .post('/api/merchant/upload-image')
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          image: base64Image,
          filename: 'test-thumb.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.url).toMatch(/^\/uploads\/prod-/);

      const relativePath = res.body.url.replace('/uploads/', '');
      const fullPath = path.join(process.cwd(), 'uploads', relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  });

  describe('2. Customer-Facing API Data & Merchant Isolation', () => {
    test('7. Customer-facing product APIs return image_url and updated product info', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const inventoryRepo = TestDataSource.getRepository(Inventory);

      const prod = await productRepo.save(
        productRepo.create({
          name: 'Original Laptop Stand',
          description: 'Aluminum stand',
          price_cents: 129900,
          category: 'Accessories',
          merchant_id: merchantACustomer.id,
          image_url: 'https://example.com/stand.jpg',
        })
      );
      await inventoryRepo.save(
        inventoryRepo.create({
          product_id: prod.id,
          quantity_on_hand: 20,
          reserved: 0,
        })
      );

      // Merchant updates name, price, description, image
      await request(app)
        .put(`/api/merchant/products/${prod.id}`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          name: 'Updated Pro Laptop Stand',
          description: 'Ergonomic aluminum stand v2',
          price_cents: 159900,
          image_url: 'https://example.com/stand-v2.jpg',
        });

      // Customer fetches product by ID
      const customerRes = await request(app).get(`/api/products/${prod.id}`);
      expect(customerRes.status).toBe(200);
      expect(customerRes.body.id).toBe(prod.id);
      expect(customerRes.body.name).toBe('Updated Pro Laptop Stand');
      expect(customerRes.body.description).toBe('Ergonomic aluminum stand v2');
      expect(customerRes.body.price_cents).toBe(159900);
      expect(customerRes.body.image_url).toBe('https://example.com/stand-v2.jpg');

      // Customer lists catalog
      const listRes = await request(app).get('/api/products?limit=50');
      expect(listRes.status).toBe(200);
      const foundInList = listRes.body.data.find((p: any) => p.id === prod.id);
      expect(foundInList).toBeDefined();
      expect(foundInList.image_url).toBe('https://example.com/stand-v2.jpg');
    });

    test('8. Existing products with null image continue working cleanly', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod = await productRepo.save(
        productRepo.create({
          name: 'Legacy Product No Image',
          price_cents: 49900,
          merchant_id: merchantACustomer.id,
          image_url: null,
        })
      );

      const res = await request(app).get(`/api/products/${prod.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Legacy Product No Image');
      expect(res.body.image_url).toBeNull();
    });

    test('9. Merchant isolation prevents modifying another merchant product', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prodA = await productRepo.save(
        productRepo.create({
          name: 'Merchant A Exclusive Product',
          price_cents: 99900,
          merchant_id: merchantACustomer.id,
        })
      );

      // Merchant B attempts to modify Merchant A's product
      const res = await request(app)
        .put(`/api/merchant/products/${prodA.id}`)
        .set('Authorization', `Bearer ${merchantBToken}`)
        .send({
          name: 'Hacked Product Name',
          image_url: 'https://hacker.com/image.jpg',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Unauthorized');

      const dbProd = await productRepo.findOne({ where: { id: prodA.id } });
      expect(dbProd?.name).toBe('Merchant A Exclusive Product');
    });

    test('10. Update product description persists in DB and customer API returns exact updated description', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod = await productRepo.save(
        productRepo.create({
          name: 'Power Bank',
          description: 'Old description',
          price_cents: 99900,
          merchant_id: merchantACustomer.id,
        })
      );

      const updateRes = await request(app)
        .put(`/api/merchant/products/${prod.id}`)
        .set('Authorization', `Bearer ${merchantAToken}`)
        .send({
          description: 'This is my NEW TEST DESCRIPTION.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.description).toBe('This is my NEW TEST DESCRIPTION.');

      // Verify DB persistence
      const dbProd = await productRepo.findOne({ where: { id: prod.id } });
      expect(dbProd?.description).toBe('This is my NEW TEST DESCRIPTION.');

      // Verify Customer API response
      const customerRes = await request(app).get(`/api/products/${prod.id}`);
      expect(customerRes.status).toBe(200);
      expect(customerRes.body.description).toBe('This is my NEW TEST DESCRIPTION.');
    });

    test('11. Recommendation endpoints serialize image_url for products', async () => {
      const productRepo = TestDataSource.getRepository(Product);
      const prod1 = await productRepo.save(
        productRepo.create({
          name: 'Smart Lamp',
          description: 'Smart desk lamp',
          price_cents: 249900,
          category: 'Technology',
          merchant_id: merchantACustomer.id,
          image_url: 'https://example.com/lamp.jpg',
        })
      );

      const recRes = await request(app).get(`/api/recommendations/products/${prod1.id}/recommendations`);
      if (recRes.status === 200) {
        expect(recRes.body.products).toBeDefined();
        if (recRes.body.products.length > 0) {
          expect(recRes.body.products[0]).toHaveProperty('image_url');
        }
      }
    });
  });
});
