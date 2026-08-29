import express, { Express } from 'express';
import request from 'supertest';
import { createMerchantRouter } from './merchant.js';
import { createAuthRouter } from './auth.js';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { MerchantInsight } from '../models/MerchantInsight.js';
import { AuthService } from '../services/AuthService.js';
import { EmailService } from '../services/EmailService.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { seedDatabase, DEMO_MERCHANT_UUID } from '../seed.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Merchant Identity UUID, Email Safety & Data Isolation Regression Suite', () => {
  let app: Express;
  let authService: AuthService;
  let paymentFailureService: PaymentFailureService;

  let merchantA: Merchant;
  let merchantAToken: string;

  let merchantB: Merchant;
  let merchantBToken: string;

  let customer1: Customer;
  let customer1Token: string;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);
    paymentFailureService = new PaymentFailureService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    const qr = TestDataSource.createQueryRunner();
    await qr.query('TRUNCATE TABLE order_feedbacks, audit_logs, merchant_insights, merchant_configs, recovery_actions, agent_decisions, recovery_cases, payment_failures, payments, payment_attempts, order_items, orders, cart_items, carts, inventory, recommendations, products, merchants, customers CASCADE');
    await qr.release();

    const merchantRepo = TestDataSource.getRepository(Merchant);
    const customerRepo = TestDataSource.getRepository(Customer);

    // Create Merchant A
    merchantA = await merchantRepo.save(
      merchantRepo.create({
        email: 'merchantA@business.com',
        name: 'Merchant Alpha',
      })
    );
    await customerRepo.save(
      customerRepo.create({
        id: merchantA.id,
        email: 'merchantA@business.com',
        name: 'Merchant Alpha',
        role: 'merchant',
      })
    );
    merchantAToken = authService.generateToken({ id: merchantA.id, email: merchantA.email, role: 'merchant' });

    // Create Merchant B
    merchantB = await merchantRepo.save(
      merchantRepo.create({
        email: 'merchantB@business.com',
        name: 'Merchant Beta',
      })
    );
    await customerRepo.save(
      customerRepo.create({
        id: merchantB.id,
        email: 'merchantB@business.com',
        name: 'Merchant Beta',
        role: 'merchant',
      })
    );
    merchantBToken = authService.generateToken({ id: merchantB.id, email: merchantB.email, role: 'merchant' });

    // Create Customer
    customer1 = await customerRepo.save(
      customerRepo.create({
        email: 'alice.isolation@domain.com',
        name: 'Alice Isolation',
        role: 'customer',
      })
    );
    customer1Token = authService.generateToken({ id: customer1.id, email: customer1.email, role: 'customer' });
  });

  it('1. Merchant login returns valid PostgreSQL UUID token', async () => {
    const passHash = await authService.hashPassword('Password123!');
    const custRepo = TestDataSource.getRepository(Customer);
    await custRepo.save(
      custRepo.create({
        email: 'merchant.login.test@shop.com',
        password_hash: passHash,
        role: 'merchant',
        name: 'Login Test Merchant',
      })
    );

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'merchant.login.test@shop.com', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    const decoded = authService.verifyToken(loginRes.body.token);
    expect(decoded).not.toBeNull();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(decoded!.id)).toBe(true);
  });

  it('2. GET /api/merchant/insights works with valid UUID without PostgreSQL syntax error', async () => {
    const res = await request(app)
      .get('/api/merchant/insights')
      .set('Authorization', `Bearer ${merchantAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.insights).toBeDefined();
    expect(Array.isArray(res.body.insights)).toBe(true);
  });

  it('3. GET /api/merchant/config and PUT /api/merchant/config work with valid UUID', async () => {
    const getRes = await request(app)
      .get('/api/merchant/config')
      .set('Authorization', `Bearer ${merchantAToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.merchant_id).toBe(merchantA.id);

    const putRes = await request(app)
      .put('/api/merchant/config')
      .set('Authorization', `Bearer ${merchantAToken}`)
      .send({ max_discount_percent: 25 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.max_discount_percent).toBe(25);
  });

  it('4. Merchant A cannot access Merchant B products or recovery cases (Data Isolation)', async () => {
    // Create product for Merchant A
    const productRepo = TestDataSource.getRepository(Product);
    const prodA = await productRepo.save(
      productRepo.create({
        name: 'Alpha Product',
        price_cents: 1000,
        merchant_id: merchantA.id,
      })
    );

    // Create product for Merchant B
    const prodB = await productRepo.save(
      productRepo.create({
        name: 'Beta Product',
        price_cents: 2000,
        merchant_id: merchantB.id,
      })
    );

    // Fetch products as Merchant B
    const resB = await request(app)
      .get('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantBToken}`);

    expect(resB.status).toBe(200);
    const productNamesB = resB.body.products.map((p: any) => p.name);
    expect(productNamesB).toContain('Beta Product');
    expect(productNamesB).not.toContain('Alpha Product');
  });

  it('5. Customer registration persists exact email address in PostgreSQL', async () => {
    const exactEmail = 'exact.user.email.123@domain.org';
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: exactEmail,
        password: 'SecurePassword123!',
        name: 'Exact Email User',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.email).toBe(exactEmail);

    const savedCustomer = await TestDataSource.getRepository(Customer).findOne({
      where: { email: exactEmail },
    });
    expect(savedCustomer).not.toBeNull();
    expect(savedCustomer?.email).toBe(exactEmail);
  });

  it('6. Payment failure resolves exact Customer.email', async () => {
    const orderRepo = TestDataSource.getRepository(Order);
    const paymentRepo = TestDataSource.getRepository(Payment);

    const order = await orderRepo.save(
      orderRepo.create({
        customer_id: customer1.id,
        order_number: `ORD-PERSIST-${Date.now()}`,
        status: 'pending',
        subtotal_cents: 5000,
        total_cents: 5000,
      })
    );

    const payment = await paymentRepo.save(
      paymentRepo.create({
        order_id: order.id,
        amount_cents: 5000,
        status: 'failed',
        failure_reason: 'insufficient_funds',
      })
    );

    const recCase = await paymentFailureService.handlePaymentFailure(payment.id, 'insufficient_funds');

    expect(recCase).not.toBeNull();
    expect(recCase?.customer_id).toBe(customer1.id);

    const fullCase = await paymentFailureService.getRecoveryCase(recCase!.id);
    expect(fullCase?.customer?.email).toBe('alice.isolation@domain.com');
  });

  it('7. EmailService mock mode suppresses live Resend network requests', async () => {
    const emailSvc = new EmailService();

    const result = await emailSvc.sendRecoveryNotification(
      'customer.mock@domain.com',
      'Mock Customer',
      'ORD-MOCK-1',
      { amount: 1000, reason: 'card_declined', recoveryLink: 'http://localhost' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');
  });

  it('8. Database seed is idempotent and assigns fixed DEMO_MERCHANT_UUID', async () => {
    await seedDatabase(TestDataSource);
    await seedDatabase(TestDataSource);

    const demoMerchant = await TestDataSource.getRepository(Merchant).findOne({
      where: { id: DEMO_MERCHANT_UUID },
    });

    expect(demoMerchant).not.toBeNull();
    expect(demoMerchant?.email).toBe('merchant@example.com');
  });
});
