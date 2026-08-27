import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { env } from '../config/env.js';
import { Payment } from '../models/Payment.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import { Order } from '../models/Order.js';

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

    // Use provided merchantId override (for tests), otherwise use placeholder
    const merchantId = merchantIdOverride || 'default-merchant';

    let merchantConfig = await this.getMerchantConfigRepository().findOne({
      where: { merchant_id: merchantId },
    });

    // Create default merchant config if doesn't exist
    if (!merchantConfig) {
      merchantConfig = this.getMerchantConfigRepository().create({
        merchant_id: merchantId,  // Use the merchantId variable, not customer.merchant_id
        max_recovery_attempts: 3,
        max_discount_percent: 30,
        allowed_channels: ['email', 'sms'],
        allow_partial_refund: false,
        auto_retry_enabled: true,
        ai_diagnosis_enabled: true,
      });
      merchantConfig = await this.getMerchantConfigRepository().save(merchantConfig);
    }

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

    return recoveryCase;
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
   * Get merchant config or create default
   */
  async getMerchantConfig(merchantId: string): Promise<MerchantConfig> {
    let config = await this.getMerchantConfigRepository().findOne({
      where: { merchant_id: merchantId },
    });

    if (!config) {
      config = this.getMerchantConfigRepository().create({
        merchant_id: merchantId,
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
