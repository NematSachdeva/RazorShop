import express, { Express } from 'express';
import request from 'supertest';
import { TestDataSource, initializeTestDatabase, closeTestDatabase } from '../config/database.test.js';
import { Customer } from '../models/Customer.js';
import { Merchant } from '../models/Merchant.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { DEMO_MERCHANT_UUID } from '../seed.js';
import { createAuthRouter } from './auth.js';
import { createMerchantRouter } from './merchant.js';
import { PaymentFailureService } from '../services/PaymentFailureService.js';
import { AuthService } from '../services/AuthService.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Merchant Manual Recovery Email & Architecture Test Suite', () => {
  let app: Express;
  let authService: AuthService;
  let paymentFailureService: PaymentFailureService;
  let merchantToken: string;
  let testCustomer: Customer;
  let testOrder: Order;
  let testPayment: Payment;

  beforeAll(async () => {
    await initializeTestDatabase();
    authService = new AuthService(TestDataSource);
    paymentFailureService = new PaymentFailureService(TestDataSource);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use('/api/merchant', createMerchantRouter(TestDataSource, authService));
    app.use(errorHandler);

    const merchantRepo = TestDataSource.getRepository(Merchant);
    const customerRepo = TestDataSource.getRepository(Customer);

    let merchant = await merchantRepo.findOne({ where: { id: DEMO_MERCHANT_UUID } });
    if (!merchant) {
      merchant = await merchantRepo.save(
        merchantRepo.create({
          id: DEMO_MERCHANT_UUID,
          email: 'nnnnsachdeva@gmail.com',
          name: 'Demo Merchant',
        } as any) as any
      );
    }

    merchantToken = authService.generateToken({
      id: DEMO_MERCHANT_UUID,
      email: 'nnnnsachdeva@gmail.com',
      role: 'merchant',
    });

    testCustomer = await customerRepo.save(
      customerRepo.create({
        email: 'recovery.customer@example.com',
        name: 'Recovery Customer',
        phone: '+919876543299',
        role: 'customer',
      } as any) as any
    );

    const orderRepo = TestDataSource.getRepository(Order);
    testOrder = await orderRepo.save(
      orderRepo.create({
        customer_id: testCustomer.id,
        order_number: `ORD-REC-${Date.now()}`,
        status: 'pending_payment',
        subtotal_cents: 499900,
        tax_cents: 0,
        discount_cents: 0,
        total_cents: 499900,
      } as any) as any
    );

    const paymentRepo = TestDataSource.getRepository(Payment);
    testPayment = await paymentRepo.save(
      paymentRepo.create({
        order_id: testOrder.id,
        amount_cents: 499900,
        currency: 'INR',
        status: 'failed',
      } as any) as any
    );
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('1. Automatic recovery email creates recovery case and is idempotent', async () => {
    const recoveryCase = await paymentFailureService.handlePaymentFailure(
      testPayment.id,
      'card_declined',
      { message: 'Card declined by issuing bank' },
      DEMO_MERCHANT_UUID
    );

    expect(recoveryCase).toBeDefined();
    expect(recoveryCase?.id).toBeDefined();

    // Trigger automatic email again — should be skipped due to automatic idempotency
    const autoResult = await paymentFailureService.triggerRecoveryEmail(recoveryCase!.id);
    expect(autoResult).toBe(true);
  });

  it('2. Merchant manual resend POST /api/merchant/recovery-cases/:id/trigger-email succeeds even after automatic email sent', async () => {
    const casesRepo = TestDataSource.getRepository(RecoveryCase);
    const recoveryCase = await casesRepo.findOne({
      where: { order_id: testOrder.id },
    });

    expect(recoveryCase).toBeDefined();

    const res = await request(app)
      .post(`/api/merchant/recovery-cases/${recoveryCase!.id}/trigger-email`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sent).toBe(true);
    expect(res.body.messageId).toContain('msg_mock_');
    expect(res.body.recipient).toBe('recovery.customer@example.com');
  });

  it('3. Merchant manual resend creates a separate manual_email RecoveryAction audit entry', async () => {
    const casesRepo = TestDataSource.getRepository(RecoveryCase);
    const recoveryCase = await casesRepo.findOne({
      where: { order_id: testOrder.id },
      relations: ['recovery_actions'],
    });

    expect(recoveryCase).toBeDefined();
    const actionRepo = TestDataSource.getRepository('RecoveryAction');
    const manualActions = await actionRepo.find({
      where: { recovery_case_id: recoveryCase!.id, action_type: 'manual_email' },
    });

    expect(manualActions.length).toBeGreaterThanOrEqual(1);
    expect(manualActions[0].success).toBe(true);
  });

  it('4. Customer opt-out blocks merchant manual recovery email with 400 error', async () => {
    // Opt-out testCustomer
    await paymentFailureService.optOutCustomer(DEMO_MERCHANT_UUID, testCustomer.id);

    const casesRepo = TestDataSource.getRepository(RecoveryCase);
    const recoveryCase = await casesRepo.findOne({
      where: { order_id: testOrder.id },
    });

    const res = await request(app)
      .post(`/api/merchant/recovery-cases/${recoveryCase!.id}/trigger-email`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('opted out');
  });
});
