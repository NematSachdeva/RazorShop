import { EmailService } from '../services/EmailService.js';
import { env, resetEnvCache } from '../config/env.js';

describe('Strict Demo-Safe Email Delivery Guardrail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 're_test_key_mock_12345';
    process.env.RESEND_FROM_EMAIL = 'nemat@razorshop.app';
    process.env.EMAIL_DELIVERY_MODE = 'test';
    process.env.EMAIL_TEST_RECIPIENT = 't74209185@gmail.com';
    resetEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
    jest.restoreAllMocks();
  });

  it('1. Given customer email = alice@gmail.com -> Resend receives t74209185@gmail.com in test mode', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendRecoveryNotification(
      'alice@gmail.com',
      'Alice',
      'ORD-101',
      { amount: 1000, reason: 'card_declined', recoveryLink: 'http://locahost/link' },
      undefined,
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
        from: 'nemat@razorshop.app',
      })
    );
  });

  it('2. Given customer email = bob@example.com -> Resend receives t74209185@gmail.com in test mode', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_2' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendRecoveryNotification(
      'bob@example.com',
      'Bob',
      'ORD-102',
      { amount: 2000, reason: 'network_error', recoveryLink: 'http://locahost/link' },
      undefined,
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
      })
    );
  });

  it('3. Given generated email = pay-test-123@example.com -> Resend receives t74209185@gmail.com in test mode', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_3' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendPaymentConfirmationNotification(
      'pay-test-123@example.com',
      'Test User',
      'ORD-103',
      {
        orderId: 'ord_103',
        razorpayPaymentId: 'pay_103',
        orderDate: '2026-08-28',
        items: [],
        subtotalCents: 5000,
        discountCents: 0,
        totalCents: 5000,
        orderLink: 'http://localhost/order',
      },
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
      })
    );
  });

  it('4. Given generated email = explicit_fail_123@realdomain.com -> Resend receives t74209185@gmail.com in test mode', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_4' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendRecoveryNotification(
      'explicit_fail_123@realdomain.com',
      'Fail Customer',
      'ORD-104',
      { amount: 1500, reason: 'insufficient_funds', recoveryLink: 'http://localhost/link' },
      undefined,
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
      })
    );
  });

  it('5. Payment failure email in test mode -> safe demo recipient', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_5' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendRecoveryNotification(
      'random-customer@some-domain.com',
      'Jane',
      'ORD-105',
      { amount: 3500, reason: 'card_declined', recoveryLink: 'http://localhost/recovery' },
      { subject: 'Custom Subject', greeting: 'Hi Jane', body: 'Payment issue', call_to_action: 'Fix' },
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
        subject: 'Custom Subject',
      })
    );
  });

  it('6. Successful payment confirmation email in test mode -> safe demo recipient', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_6' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendPaymentConfirmationNotification(
      'purchaser@differentdomain.com',
      'Purchaser',
      'ORD-106',
      {
        orderId: 'ord_106',
        razorpayPaymentId: 'pay_106',
        orderDate: '2026-08-28',
        items: [{ name: 'Headphones', quantity: 1, unitPriceCents: 499900, lineTotalCents: 499900 }],
        subtotalCents: 499900,
        discountCents: 0,
        totalCents: 499900,
        orderLink: 'http://localhost/order',
      },
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
        subject: expect.stringContaining('Order Confirmed'),
      })
    );
  });

  it('7. Real Customer Mode (source: customer) -> sends directly to real customer email', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_7' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendRecoveryNotification(
      'realcustomer@gmail.com',
      'Real Customer',
      'ORD-107',
      { amount: 4500, reason: 'card_declined', recoveryLink: 'http://localhost/link' },
      undefined,
      { source: 'customer' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'realcustomer@gmail.com',
      })
    );
  });

  it('8. Groq-generated content cannot change recipient', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_8' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    const aiContent = {
      subject: 'AI Generated Recovery',
      greeting: 'Dear Customer',
      body: 'AI body',
      call_to_action: 'Pay Now',
      to: 'attacker@malicious.com',
    };

    await emailService.sendRecoveryNotification(
      'customer@legit.com',
      'Customer',
      'ORD-108',
      { amount: 1200, reason: 'timeout', recoveryLink: 'http://localhost/rec' },
      aiContent as any,
      { source: 'test' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 't74209185@gmail.com',
      })
    );
  });

  it('9. Real customer payment confirmation -> sent directly to real customer email', async () => {
    const emailService = new EmailService();
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg_9' }, error: null });
    (emailService as any).resend = { emails: { send: mockSend } };

    await emailService.sendPaymentConfirmationNotification(
      'alice.real@company.com',
      'Alice Real',
      'ORD-109',
      {
        orderId: 'ord_109',
        razorpayPaymentId: 'pay_109',
        orderDate: '2026-08-28',
        items: [],
        subtotalCents: 2000,
        discountCents: 0,
        totalCents: 2000,
        orderLink: 'http://localhost/order',
      },
      { source: 'customer' }
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice.real@company.com',
      })
    );
  });

  it('10. EMAIL_TEST_RECIPIENT is loaded from configuration and used for test/demo mode', () => {
    process.env.EMAIL_TEST_RECIPIENT = 't74209185@gmail.com';
    resetEnvCache();

    expect(env.EMAIL_TEST_RECIPIENT).toBe('t74209185@gmail.com');

    const emailService = new EmailService();
    const resolvedTest = emailService.resolveRecipient('any-input-user@example.com', { source: 'test' });
    expect(resolvedTest.recipient).toBe('t74209185@gmail.com');
    expect(resolvedTest.source).toBe('test');

    const resolvedCustomer = emailService.resolveRecipient('realuser@domain.com', { source: 'customer' });
    expect(resolvedCustomer.recipient).toBe('realuser@domain.com');
    expect(resolvedCustomer.source).toBe('customer');
  });
});
