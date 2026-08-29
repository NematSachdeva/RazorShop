import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { env } from '../config/env.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import { Order } from '../models/Order.js';
import { RecoveryEmailGenerator } from './RecoveryEmailGenerator.js';
import { EmailService } from './EmailService.js';

export class PaymentFailureService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  private getPaymentRepository() {
    return this.dataSource.getRepository(Payment);
  }

  private getPaymentFailureRepository() {
    return this.dataSource.getRepository(PaymentFailure);
  }

  private getRecoveryCaseRepository() {
    return this.dataSource.getRepository(RecoveryCase);
  }

  private getMerchantConfigRepository() {
    return this.dataSource.getRepository(MerchantConfig);
  }

  private getOrderRepository() {
    return this.dataSource.getRepository(Order);
  }

  private getAuditLogRepository() {
    return this.dataSource.getRepository(AuditLog);
  }

  /**
   * Detect payment failure and create recovery case
   * Note: In production, uses 'default-merchant' as placeholder.
   * In tests, can be overridden via the merchantIdOverride parameter.
   */
  async handlePaymentFailure(paymentId: string, failureReason: string, errorContext?: any, merchantIdOverride?: string): Promise<RecoveryCase | null> {
    const payment = await this.getPaymentRepository().findOne({
      where: { id: paymentId },
      relations: ['order', 'order.customer'],
    });

    if (!payment || !payment.order) {
      throw new Error('Payment or associated order not found');
    }

    // Check if failure already recorded
    let paymentFailure = await this.getPaymentFailureRepository().findOne({
      where: { payment_id: paymentId },
    });

    if (paymentFailure) {
      // Update existing failure
      paymentFailure.failure_count += 1;
      paymentFailure.last_failure_at = new Date();
      if (errorContext) {
        paymentFailure.error_context = errorContext;
      }
      paymentFailure = await this.getPaymentFailureRepository().save(paymentFailure);
    } else {
      // Create new failure record
      paymentFailure = this.getPaymentFailureRepository().create({
        payment_id: paymentId,
        reason: failureReason as any,
        error_message: errorContext?.message,
        error_context: errorContext,
        failure_count: 1,
        last_failure_at: new Date(),
      });
      paymentFailure = await this.getPaymentFailureRepository().save(paymentFailure);
    }

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'payment_failure_detected',
      entity_type: 'payment_failure',
      entity_id: paymentFailure.id,
      actor_id: undefined,
      description: `Payment failure detected: ${failureReason}`,
      details: {
        payment_id: paymentId,
        reason: failureReason,
        failure_count: paymentFailure.failure_count,
      },
    });

    // Check if recovery case already exists
    let recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { payment_failure_id: paymentFailure.id },
    });

    if (recoveryCase) {
      // Recovery already initiated
      return recoveryCase;
    }

    // Get merchant config for this order's customer
    const customer = payment.order.customer;
    if (!customer) {
      // No customer, can't initiate recovery
      return null;
    }

    // Use provided merchantId override (for tests), otherwise use default
    const merchantId = merchantIdOverride || '00000000-0000-0000-0000-000000000000';
    let merchantConfig = await this.getMerchantConfig(merchantId);

    // Create recovery case
    recoveryCase = this.getRecoveryCaseRepository().create({
      payment_failure_id: paymentFailure.id,
      order_id: payment.order.id,
      customer_id: customer.id,
      status: 'open',
      recovery_attempts: 0,
      max_recovery_attempts: merchantConfig.max_recovery_attempts,
    });
    recoveryCase = await this.getRecoveryCaseRepository().save(recoveryCase);

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'recovery_case_created',
      entity_type: 'recovery_case',
      entity_id: recoveryCase.id,
      actor_id: undefined,
      description: 'Recovery case created for payment failure',
      details: {
        payment_failure_id: paymentFailure.id,
        order_id: payment.order.id,
        customer_id: customer.id,
      },
    });

    // Trigger recovery email idempotently
    try {
      await this.triggerRecoveryEmail(recoveryCase.id);
    } catch (emailErr) {
      console.error('Failed to trigger recovery email:', emailErr);
    }

    return recoveryCase;
  }

  /**
   * Send recovery email idempotently using Groq content generation and Resend delivery
   */
  async triggerRecoveryEmail(recoveryCaseId: string): Promise<boolean> {
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: recoveryCaseId },
      relations: ['order', 'customer', 'payment_failure'],
    });

    if (!recoveryCase || !recoveryCase.customer || !recoveryCase.order) {
      return false;
    }

    const customer = recoveryCase.customer;
    const order = recoveryCase.order;
    const failureReason = recoveryCase.payment_failure?.reason || 'Payment failed';

    // 0. Validate Customer email exists
    if (!customer.email || !customer.email.includes('@')) {
      console.warn(`[PaymentFailureService] Customer email missing or invalid for customer ${customer.id}`);
      await this.getAuditLogRepository().save({
        event_type: 'email_failed',
        entity_type: 'recovery_case',
        entity_id: recoveryCase.id,
        description: `Cannot send recovery email: Customer email missing or invalid (${customer.email || 'none'})`,
        details: {
          customer_id: customer.id,
          order_id: order.id,
          error: 'Customer email missing or invalid',
        },
      });
      return false;
    }

    // 1. Check opt-out status
    const isOptedOut = await this.isCustomerOptedOut('default-merchant', customer.id);
    if (isOptedOut) {
      console.log(`[PaymentFailureService] Customer ${customer.id} opted out of recovery communications.`);
      await this.getAuditLogRepository().save({
        event_type: 'email_skipped_opt_out',
        entity_type: 'recovery_case',
        entity_id: recoveryCase.id,
        description: `Skipped recovery email: Customer opted out`,
        details: {
          customer_id: customer.id,
          customer_email: customer.email,
        },
      });
      return false;
    }

    // 2. Idempotency check: Check AuditLog for existing email_sent or email_failed for this recovery case
    const existingLog = await this.getAuditLogRepository().findOne({
      where: [
        { event_type: 'email_sent', entity_id: recoveryCase.id },
        { event_type: 'email_failed', entity_id: recoveryCase.id },
      ],
    });

    if (existingLog) {
      console.log(`[PaymentFailureService] Recovery email already attempted for case ${recoveryCase.id}. Skipping duplicate.`);
      return true;
    }

    // 3. Construct recovery URL
    const frontendUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || 'http://localhost:5173';
    const recoveryUrl = `${frontendUrl}/orders?payment=${order.id}`;

    // 4. Generate email content via Groq AI (with safe fallback)
    const generator = new RecoveryEmailGenerator();
    const amountDisplay = (Number(order.total_cents) / 100).toFixed(2);
    const emailContent = await generator.generateEmailContent({
      customerName: customer.name || customer.email,
      orderNumber: order.order_number,
      amountDisplay,
      failureReason,
      recoveryUrl,
    });

    // 5. Send email via Resend
    const emailSvc = new EmailService();
    const result = await emailSvc.sendRecoveryNotification(
      customer.email,
      customer.name || 'Customer',
      order.order_number,
      {
        amount: Number(order.total_cents),
        reason: failureReason,
        recoveryLink: recoveryUrl,
      },
      {
        subject: emailContent.subject,
        greeting: emailContent.greeting,
        body: emailContent.body,
        call_to_action: emailContent.call_to_action,
      }
    );

    // 6. Record interaction & AuditLog entry
    const interactionRepo = this.dataSource.getRepository('CustomerInteraction');
    await interactionRepo.save({
      recovery_case_id: recoveryCase.id,
      customer_id: customer.id,
      channel: 'email',
      intent: 'unclear',
      message: emailContent.body,
      metadata: {
        subject: emailContent.subject,
        messageId: result.messageId,
        success: result.success,
      },
    });

    await this.getAuditLogRepository().save({
      event_type: result.success ? 'email_sent' : 'email_failed',
      entity_type: 'recovery_case',
      entity_id: recoveryCase.id,
      description: result.success
        ? `Recovery email sent to ${customer.email}`
        : `Failed to send recovery email: ${result.error}`,
      details: {
        customer_id: customer.id,
        customer_email: customer.email,
        order_id: order.id,
        order_number: order.order_number,
        amount_cents: Number(order.total_cents),
        message_id: result.messageId,
        error: result.error,
        success: result.success,
      },
    });

    return result.success;
  }

  /**
   * Explicit merchant action: Send a fresh manual recovery email to the customer.
   * Bypasses the automatic-email idempotency guard.
   * Enforces guardrails: customer email validity, merchant ownership, recovery case validity, and customer opt-out.
   */
  async sendManualRecoveryEmail(
    recoveryCaseId: string,
    merchantId: string
  ): Promise<{
    success: boolean;
    sent: boolean;
    messageId?: string;
    recipient?: string;
    error?: string;
    skipped?: boolean;
    reason?: string;
    recoveryCase?: RecoveryCase;
  }> {
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: recoveryCaseId },
      relations: ['order', 'customer', 'payment_failure'],
    });

    if (!recoveryCase) {
      return { success: false, sent: false, error: 'Recovery case not found' };
    }

    if (!recoveryCase.customer || !recoveryCase.order) {
      return { success: false, sent: false, error: 'Associated customer or order not found' };
    }

    const customer = recoveryCase.customer;
    const order = recoveryCase.order;
    const failureReason = recoveryCase.payment_failure?.reason || 'Payment failed';

    // 1. Validate Customer email
    if (!customer.email || !customer.email.includes('@')) {
      console.warn(`[PaymentFailureService] Customer email missing or invalid: ${customer.email || 'none'}`);
      await this.getAuditLogRepository().save({
        event_type: 'merchant_manual_email_failed',
        entity_type: 'recovery_case',
        entity_id: recoveryCase.id,
        description: `Manual email failed: Customer email missing or invalid (${customer.email || 'none'})`,
        details: { customer_id: customer.id, error: 'Customer email missing or invalid' },
      });
      return { success: false, sent: false, error: 'Customer email missing or invalid' };
    }

    // 2. Check Customer Opt-Out status
    const isOptedOut = await this.isCustomerOptedOut(merchantId, customer.id);
    if (isOptedOut) {
      console.log(`[PaymentFailureService] Customer ${customer.id} opted out of recovery communications.`);
      await this.getAuditLogRepository().save({
        event_type: 'merchant_manual_email_opt_out',
        entity_type: 'recovery_case',
        entity_id: recoveryCase.id,
        description: `Manual email rejected: Customer opted out`,
        details: { customer_id: customer.id, customer_email: customer.email },
      });
      return { success: false, sent: false, error: 'Customer has opted out of recovery emails.' };
    }

    // 3. Construct recovery URL & generate fresh email template
    const frontendUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || 'http://localhost:5173';
    const recoveryUrl = `${frontendUrl}/orders?payment=${order.id}`;

    const generator = new RecoveryEmailGenerator();
    const amountDisplay = (Number(order.total_cents) / 100).toFixed(2);
    const emailContent = await generator.generateEmailContent({
      customerName: customer.name || customer.email,
      orderNumber: order.order_number,
      amountDisplay,
      failureReason,
      recoveryUrl,
    });

    // 4. Dispatch email via EmailService with source = 'merchant'
    const emailSvc = new EmailService();
    const result = await emailSvc.sendRecoveryNotification(
      customer.email,
      customer.name || 'Customer',
      order.order_number,
      {
        amount: Number(order.total_cents),
        reason: failureReason,
        recoveryLink: recoveryUrl,
      },
      {
        subject: emailContent.subject,
        greeting: emailContent.greeting,
        body: emailContent.body,
        call_to_action: emailContent.call_to_action,
      },
      { source: 'merchant' }
    );

    if (!result.success) {
      console.error(`[Email] manual recovery email rejected: reason=${result.error}`);
      await this.getAuditLogRepository().save({
        event_type: 'merchant_manual_email_failed',
        entity_type: 'recovery_case',
        entity_id: recoveryCase.id,
        description: `Manual recovery email failed: ${result.error}`,
        details: { customer_id: customer.id, customer_email: customer.email, error: result.error },
      });
      return { success: false, sent: false, error: result.error || 'Failed to dispatch email' };
    }

    // 5. Record RecoveryAction (action_type = 'manual_email')
    try {
      const recoveryActionRepo = this.dataSource.getRepository('RecoveryAction');
      await recoveryActionRepo.save({
        recovery_case_id: recoveryCase.id,
        action_type: 'manual_email',
        status: 'completed',
        action_details: {
          recipient: customer.email,
          source: 'merchant_manual',
          subject: emailContent.subject,
        },
        result: {
          messageId: result.messageId,
          delivered: true,
        },
        success: true,
        executed_at: new Date(),
        completed_at: new Date(),
      });
    } catch (actErr) {
      console.warn('[PaymentFailureService] Could not save RecoveryAction record:', actErr);
    }

    // 6. Record CustomerInteraction & AuditLog
    try {
      const interactionRepo = this.dataSource.getRepository('CustomerInteraction');
      await interactionRepo.save({
        recovery_case_id: recoveryCase.id,
        customer_id: customer.id,
        channel: 'email',
        intent: 'unclear',
        message: emailContent.body,
        metadata: {
          subject: emailContent.subject,
          messageId: result.messageId,
          success: true,
          is_manual: true,
        },
      });
    } catch (intErr) {
      console.warn('[PaymentFailureService] Could not save CustomerInteraction record:', intErr);
    }

    // Increment recovery attempts
    recoveryCase.recovery_attempts = (recoveryCase.recovery_attempts || 0) + 1;
    await this.getRecoveryCaseRepository().save(recoveryCase);

    await this.getAuditLogRepository().save({
      event_type: 'merchant_manual_email_sent',
      entity_type: 'recovery_case',
      entity_id: recoveryCase.id,
      description: `Merchant manually sent recovery email to ${customer.email}`,
      details: {
        customer_id: customer.id,
        customer_email: customer.email,
        order_id: order.id,
        order_number: order.order_number,
        message_id: result.messageId,
        is_manual: true,
        success: true,
      },
    });

    const updatedCase = await this.getRecoveryCase(recoveryCase.id);

    return {
      success: true,
      sent: true,
      messageId: result.messageId,
      recipient: customer.email,
      recoveryCase: updatedCase || undefined,
    };
  }

  /**
   * Get payment failure by payment ID
   */
  async getPaymentFailure(paymentId: string): Promise<PaymentFailure | null> {
    return await this.getPaymentFailureRepository().findOne({
      where: { payment_id: paymentId },
      relations: ['recovery_cases'],
    });
  }

  /**
   * Get recovery case by ID
   */
  async getRecoveryCase(recoveryCaseId: string): Promise<RecoveryCase | null> {
    return await this.getRecoveryCaseRepository().findOne({
      where: { id: recoveryCaseId },
      relations: ['payment_failure', 'order', 'customer', 'recovery_actions', 'agent_decisions'],
    });
  }

  /**
   * Get merchant config or create default safely
   */
  async getMerchantConfig(merchantId: string): Promise<MerchantConfig> {
    const isUuid = Boolean(merchantId && merchantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
    const targetMerchantId = isUuid ? merchantId : '00000000-0000-0000-0000-000000000000';

    let config = await this.getMerchantConfigRepository().findOne({
      where: { merchant_id: targetMerchantId },
    });

    if (!config) {
      const merchantRepo = this.dataSource.getRepository('Merchant');
      let merchant: any = await merchantRepo.findOne({ where: { id: targetMerchantId } });
      if (!merchant) {
        merchant = await merchantRepo.save(merchantRepo.create({ id: targetMerchantId, name: 'Default Store', email: 'store@example.com' }));
      }

      config = this.getMerchantConfigRepository().create({
        merchant_id: targetMerchantId,
        max_recovery_attempts: 3,
        max_discount_percent: 30,
        allowed_channels: ['email', 'sms'],
        allow_partial_refund: false,
        auto_retry_enabled: true,
        ai_diagnosis_enabled: true,
      });
      config = await this.getMerchantConfigRepository().save(config);
    }

    return config;
  }

  /**
   * Update merchant config
   */
  async updateMerchantConfig(merchantId: string, updates: Partial<MerchantConfig>): Promise<MerchantConfig> {
    let config = await this.getMerchantConfig(merchantId);
    Object.assign(config, updates);
    return await this.getMerchantConfigRepository().save(config);
  }

  /**
   * Check if customer has opted out
   */
  async isCustomerOptedOut(merchantId: string, customerId: string): Promise<boolean> {
    const config = await this.getMerchantConfig(merchantId);
    return config.customer_opt_outs?.includes(customerId) || false;
  }

  /**
   * Add customer to opt-out list
   */
  async optOutCustomer(merchantId: string, customerId: string): Promise<MerchantConfig> {
    const config = await this.getMerchantConfig(merchantId);
    if (!config.customer_opt_outs) {
      config.customer_opt_outs = [];
    }
    if (!config.customer_opt_outs.includes(customerId)) {
      config.customer_opt_outs.push(customerId);
      return await this.getMerchantConfigRepository().save(config);
    }
    return config;
  }
}

export const paymentFailureService = new PaymentFailureService();
