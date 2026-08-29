import { EmailService } from '../services/EmailService.js';
import { env, resetEnvCache } from '../config/env.js';

describe('Two-Mode Email Delivery Architecture (Mock vs Live)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 're_test_key_mock_12345';
    process.env.RESEND_FROM_EMAIL = 'nemat@razorshop.app';
    resetEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
    jest.restoreAllMocks();
  });

  it('1. Automated test environment forces mock mode — 0 Resend network calls', async () => {
    // Even if env variable was set to live, test context overrides to mock
    process.env.EMAIL_DELIVERY_MODE = 'live';
    resetEnvCache();

    const emailService = new EmailService();
    const consoleSpy = jest.spyOn(console, 'log');

    const result = await emailService.sendRecoveryNotification(
      'customer.test@domain.com',
      'Test Customer',
      'ORD-MOCK-1',
      { amount: 2500, reason: 'card_declined', recoveryLink: 'http://localhost/order' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');

    // Confirm mock suppression log was emitted
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Email] MOCK: Resend request suppressed')
    );
  });

  it('2. Mock mode preserves exact customer recipient without overriding to t74209185@gmail.com', async () => {
    const emailService = new EmailService();
    const consoleSpy = jest.spyOn(console, 'log');

    const customerEmail = 'customer.exact@domain.com';
    const result = await emailService.sendRecoveryNotification(
      customerEmail,
      'Exact User',
      'ORD-MOCK-2',
      { amount: 5000, reason: 'insufficient_funds', recoveryLink: 'http://localhost/order' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');

    // Confirm customer email is logged as recipient
    expect(consoleSpy).toHaveBeenCalledWith(
      `[Email] mode=test transport=mock source=customer recipient=${customerEmail}`
    );
  });

  it('3. Mock mode exercises payment confirmation email workflow seamlessly', async () => {
    const emailService = new EmailService();

    const result = await emailService.sendPaymentConfirmationNotification(
      'buyer.confirm@domain.com',
      'Buyer User',
      'ORD-MOCK-3',
      {
        orderId: 'ord_123',
        razorpayPaymentId: 'pay_123',
        orderDate: '2026-08-29',
        items: [{ name: 'Item 1', quantity: 1, unitPriceCents: 1000, lineTotalCents: 1000 }],
        subtotalCents: 1000,
        discountCents: 0,
        totalCents: 1000,
        orderLink: 'http://localhost/orders',
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('msg_mock_');
  });

  it('4. Live mode passes actual customer email directly to Resend without override', async () => {
    // Temporarily simulate non-test runtime for unit testing live mode dispatch
    const savedWorker = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DELIVERY_MODE = 'live';
    resetEnvCache();

    const emailService = new EmailService();
    const mockResendSend = jest.fn().mockResolvedValue({ data: { id: 'msg_live_resend_999' }, error: null });
    (emailService as any).resend = { emails: { send: mockResendSend } };

    const customerEmail = 'real.customer@business.com';

    const result = await emailService.sendRecoveryNotification(
      customerEmail,
      'Real Customer',
      'ORD-LIVE-1',
      { amount: 9900, reason: 'timeout', recoveryLink: 'http://localhost/order' }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_live_resend_999');

    // Confirm Resend send() was called with exact customer email
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: customerEmail,
        from: 'nemat@razorshop.app',
      })
    );

    // Confirm t74209185@gmail.com was NOT sent as recipient
    expect(mockResendSend).not.toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
      })
    );

    process.env.JEST_WORKER_ID = savedWorker;
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('5. Missing or invalid customer email is rejected without calling Resend API', async () => {
    const emailService = new EmailService();
    const mockResendSend = jest.fn();
    (emailService as any).resend = { emails: { send: mockResendSend } };

    const result = await emailService.sendRecoveryNotification(
      'invalid-email-address',
      'No Email Customer',
      'ORD-INVALID-1',
      { amount: 1000, reason: 'failed', recoveryLink: 'http://localhost' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing or invalid');
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
