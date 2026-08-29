import express, { Express } from 'express';
import request from 'supertest';
import { createCartsRouter } from './carts.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Inventory } from '../models/Inventory.js';
import { CartService } from '../services/CartService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Complementary Product Add To Cart Integration Tests', () => {
  let testApp: Express;
  let cartService: CartService;
  let authService: AuthService;

  let testCustomer: Customer;
  let testCustomerToken: string;
  let productA: Product;
  let productB: Product;

  beforeAll(async () => {
    await initializeTestDatabase();
    cartService = new CartService(TestDataSource);
    authService = new AuthService(TestDataSource);

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/carts', createCartsRouter(cartService, authService));
    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const customerRepo = TestDataSource.getRepository(Customer);
    testCustomer = await customerRepo.save(
      customerRepo.create({
        email: `comp-test-${Date.now()}@test.com`,
        name: 'Comp Tester',
        role: 'customer',
      })
    );
    testCustomerToken = authService.generateToken({
      id: testCustomer.id,
      email: testCustomer.email,
      role: 'customer',
    });

    const productRepo = TestDataSource.getRepository(Product);
    const inventoryRepo = TestDataSource.getRepository(Inventory);

    productA = await productRepo.save(
      productRepo.create({
        name: 'Main Product A ' + Date.now(),
        description: 'Main product in cart',
        price_cents: 200000,
        category: 'Technology',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: productA.id,
        quantity_on_hand: 50,
        reserved: 0,
      })
    );

    productB = await productRepo.save(
      productRepo.create({
        name: 'Complementary Product B ' + Date.now(),
        description: 'Recommended product not in cart',
        price_cents: 100000,
        category: 'Technology',
      })
    );
    await inventoryRepo.save(
      inventoryRepo.create({
        product_id: productB.id,
        quantity_on_hand: 50,
        reserved: 0,
      })
    );
  });

  it('adds recommended product B to cart when not in cart, then increments quantity on second add', async () => {
    // 1. Create cart and add Product A
    const createCartRes = await request(testApp)
      .post('/api/carts')
      .set('Authorization', `Bearer ${testCustomerToken}`);
    expect(createCartRes.status).toBe(201);
    const cartId = createCartRes.body.id;

    const addARes = await request(testApp)
      .post(`/api/carts/${cartId}/items`)
      .set('Authorization', `Bearer ${testCustomerToken}`)
      .send({ product_id: productA.id, quantity: 1 });
    expect(addARes.status).toBe(200);
    expect(addARes.body.items.length).toBe(1);
    expect(addARes.body.items[0].product_id).toBe(productA.id);

    // 2. Add recommended Product B (which is not currently in cart)
    const addBRes1 = await request(testApp)
      .post(`/api/carts/${cartId}/items`)
      .set('Authorization', `Bearer ${testCustomerToken}`)
      .send({ product_id: productB.id, quantity: 1 });
    
    expect(addBRes1.status).toBe(200);
    expect(addBRes1.body.items.length).toBe(2);
    const itemB1 = addBRes1.body.items.find((i: any) => i.product_id === productB.id);
    expect(itemB1).toBeDefined();
    expect(itemB1.quantity).toBe(1);

    // 3. Add recommended Product B again (now already in cart) -> should increment quantity to 2
    const addBRes2 = await request(testApp)
      .post(`/api/carts/${cartId}/items`)
      .set('Authorization', `Bearer ${testCustomerToken}`)
      .send({ product_id: productB.id, quantity: 1 });

    expect(addBRes2.status).toBe(200);
    expect(addBRes2.body.items.length).toBe(2);
    const itemB2 = addBRes2.body.items.find((i: any) => i.product_id === productB.id);
    expect(itemB2).toBeDefined();
    expect(itemB2.quantity).toBe(2);
  });
});
