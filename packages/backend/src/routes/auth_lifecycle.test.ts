import express, { Express } from 'express';
import request from 'supertest';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { AuthService } from '../services/AuthService.js';
import { CartService } from '../services/CartService.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { seedDatabase } from '../seed.js';
import { createAuthRouter } from './auth.js';
import { createCartsRouter } from './carts.js';
import { errorHandler } from '../middleware/errorHandler.js';
import jwt from 'jsonwebtoken';

describe('Auth Lifecycle & Cart Persistence Tests', () => {
  let app: Express;
  let authService: AuthService;
  let cartService: CartService;

  beforeAll(async () => {
    await initializeTestDatabase();

    // Ensure database is seeded for test
    await seedDatabase(TestDataSource);

    authService = new AuthService(TestDataSource);
    cartService = new CartService(TestDataSource);

    app = express();
    app.use(express.json());

    // Inject test services into app routers
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/carts', createCartsRouter(cartService, authService));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('A. Seeded customer can log in with password123', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.email).toBe('customer@example.com');
    expect(res.body.role).toBe('customer');

    // Verify customer ID in JWT exists in customers table
    const customer = await TestDataSource.getRepository(Customer).findOne({ where: { id: res.body.id } });
    expect(customer).not.toBeNull();
    expect(customer?.email).toBe('customer@example.com');
  });

  test('B. Seeded merchant can log in with password123', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'merchant@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.email).toBe('merchant@example.com');
    expect(res.body.role).toBe('merchant');

    const customer = await TestDataSource.getRepository(Customer).findOne({ where: { id: res.body.id } });
    expect(customer).not.toBeNull();
    expect(customer?.role).toBe('merchant');
  });

  test('C. Wrong password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  test('D. Nonexistent email returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  test('E. JWT token containing nonexistent customer ID returns 401 instead of PostgreSQL 500 error', async () => {
    const fakeUuid = '00000000-0000-4000-a000-000000000000';
    const fakeToken = authService.generateToken({ id: fakeUuid, email: 'fake@example.com', role: 'customer' });

    const res = await request(app)
      .post('/api/carts')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send();

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('User account no longer exists or session is invalid');
  });

  test('F. Authenticated valid customer can create and fetch active cart', async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'password123' });

    const token = loginRes.body.token;

    // Create cart
    const cartRes = await request(app)
      .post('/api/carts')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(cartRes.status).toBe(201);
    expect(cartRes.body).toHaveProperty('id');
    expect(cartRes.body.customer_id).toBe(loginRes.body.id);
  });

  test('G. Running seedDatabase twice does not duplicate customers or merchants', async () => {
    await seedDatabase(TestDataSource);
    await seedDatabase(TestDataSource);

    const customers = await TestDataSource.getRepository(Customer).find({ where: { email: 'customer@example.com' } });
    expect(customers.length).toBe(1);

    const merchants = await TestDataSource.getRepository(Merchant).find({ where: { email: 'merchant@example.com' } });
    expect(merchants.length).toBe(1);
  });
});
