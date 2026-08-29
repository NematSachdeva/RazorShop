import express, { Express } from 'express';
import request from 'supertest';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Inventory } from '../models/Inventory.js';
import { DEMO_MERCHANT_UUID } from '../seed.js';
import { createAuthRouter } from './auth.js';
import { createMerchantRouter } from './merchant.js';
import { createProductsRouter } from './products.js';
import { ProductService } from '../services/ProductService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Catalog Consistency, Recovery UX & Merchant Identity Test Suite', () => {
  let app: Express;
  let authService: AuthService;
  let merchantToken: string;
  let activeProductId: string;
  let archivedProductId: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use('/api/products', createProductsRouter(new ProductService(TestDataSource)));
    app.use(errorHandler);

    const merchantRepo = TestDataSource.getRepository(Merchant);
    const customerRepo = TestDataSource.getRepository(Customer);

    let testMerchant = await merchantRepo.findOne({
      where: [{ id: DEMO_MERCHANT_UUID }, { email: 'merchant@example.com' }],
    });
    if (!testMerchant) {
      testMerchant = await merchantRepo.save(
        merchantRepo.create({
          id: DEMO_MERCHANT_UUID,
          email: 'merchant@example.com',
          name: 'Demo Merchant',
        } as any) as any
      );
    }

    let testMerchantCustomer = await customerRepo.findOne({
      where: [{ id: DEMO_MERCHANT_UUID }, { email: 'merchant@example.com' }],
    });
    if (!testMerchantCustomer) {
      testMerchantCustomer = await customerRepo.save(
        customerRepo.create({
          id: DEMO_MERCHANT_UUID,
          email: 'merchant@example.com',
          name: 'Demo Merchant',
          role: 'merchant',
        } as any) as any
      );
    }

    merchantToken = authService.generateToken({
      id: testMerchant!.id,
      email: testMerchant!.email,
      role: 'merchant',
    });

    const productRepo = TestDataSource.getRepository(Product);
    const inventoryRepo = TestDataSource.getRepository(Inventory);

    // Seed Active Product
    const activeProduct = await productRepo.save(
      productRepo.create({
        merchant_id: DEMO_MERCHANT_UUID,
        name: 'Consistency Test Active Product',
        description: 'Active product description',
        price_cents: 299900,
        category: 'Technology',
        sku: `SKU-ACT-${Date.now()}`,
      } as any) as any
    );
    activeProductId = activeProduct.id;

    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: activeProductId,
        quantity_on_hand: 20,
        reserved: 2,
      } as any) as any
    );

    // Seed Archived Product
    const archivedProduct = await productRepo.save(
      productRepo.create({
        merchant_id: DEMO_MERCHANT_UUID,
        name: 'Consistency Test Archived Product',
        description: 'Archived product description',
        price_cents: 199900,
        category: 'archived',
        sku: `SKU-ARC-${Date.now()}`,
      } as any) as any
    );
    archivedProductId = archivedProduct.id;

    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: archivedProductId,
        quantity_on_hand: 0,
        reserved: 0,
      } as any) as any
    );
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('1. GET /api/merchant/dashboard catalog summary matches authoritative products count', async () => {
    const res = await request(app)
      .get('/api/merchant/dashboard')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory_summary).toBeDefined();
    expect(res.body.inventory_summary.total_listed).toBeGreaterThanOrEqual(1);
    expect(res.body.metrics.total_units_in_stock).toBeGreaterThanOrEqual(18); // 20 - 2 = 18
  });

  it('2. GET /api/products excludes archived products from active customer catalog', async () => {
    const res = await request(app).get('/api/products?limit=100');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const foundActive = res.body.data.find((p: any) => p.id === activeProductId);
    expect(foundActive).toBeDefined();
    expect(foundActive.inventory.available).toBe(18);

    const foundArchived = res.body.data.find((p: any) => p.id === archivedProductId);
    expect(foundArchived).toBeUndefined();
  });

  it('3. GET /api/merchant/products lists all active products with available stock', async () => {
    const res = await request(app)
      .get('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : res.body.products;
    expect(Array.isArray(items)).toBe(true);

    const found = items.find((p: any) => p.id === activeProductId);
    expect(found).toBeDefined();
    expect(found.inventory.available).toBe(18);
  });

  it('4. Inventory stock formula: available = Math.max(0, quantity_on_hand - reserved)', async () => {
    const res = await request(app).get(`/api/products/${activeProductId}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory.quantity_on_hand).toBe(20);
    expect(res.body.inventory.reserved).toBe(2);
    expect(res.body.inventory.available).toBe(18);
  });
});
