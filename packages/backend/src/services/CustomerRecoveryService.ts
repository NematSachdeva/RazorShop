import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { CustomerInteraction, CustomerIntentType } from '../models/CustomerInteraction.js';
import { PromiseToPay, PromiseStatus } from '../models/PromiseToPay.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { AuditLog } from '../models/AuditLog.js';
import { PaymentFailureService } from './PaymentFailureService.js';

export interface RecordInteractionParams {
  recovery_case_id: string;
  customer_id: string;
  channel: 'email' | 'in_app' | 'whatsapp' | 'sms';
  intent: CustomerIntentType;
  message?: string;
}

export interface CreatePromiseParams {
  recovery_case_id: string;
  customer_id: string;
  customer_interaction_id: string;
  promised_amount_cents: number;
  promised_deadline: Date;
  merchantIdOverride?: string;
}

export interface HandleResponseParams {
  recovery_case_id: string;
  customer_id: string;
  intent: CustomerIntentType;
  channel: 'email' | 'in_app' | 'whatsapp' | 'sms';
  merchantIdOverride?: string;
}

/**
 * Customer Recovery Service
 * Handles customer interactions, promise-to-pay workflow, and response processing
 * Integrates with M5 recovery case management and guard rails
 */
export class CustomerRecoveryService {
  private dataSource: DataSource;
  private paymentFailureService: PaymentFailureService;
  private static readonly MAX_PROMISE_DAYS = 30;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
    this.paymentFailureService = new PaymentFailureService(dataSource);
  }

  private getCustomerInteractionRepository() {
    return this.dataSource.getRepository(CustomerInteraction);
  }

  private getPromiseToPayRepository() {
    return this.dataSource.getRepository(PromiseToPay);
  }

  private getRecoveryCaseRepository() {
    return this.dataSource.getRepository(RecoveryCase);
  }

  private getAuditLogRepository() {
    return this.dataSource.getRepository(AuditLog);
  }

  /**
   * Record a customer interaction (response to recovery email/SMS)
   */
  async recordCustomerInteraction(
    params: RecordInteractionParams
  ): Promise<CustomerInteraction> {
    // Verify recovery case exists
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: params.recovery_case_id },
    });

    if (!recoveryCase) {
      throw new Error('Recovery case not found');
    }

    // Create customer interaction record
    const interaction = this.getCustomerInteractionRepository().create({
      recovery_case_id: params.recovery_case_id,
      customer_id: params.customer_id,
      channel: params.channel,
      intent: params.intent,
      message: params.message,
      metadata: {
        source: 'recovery_workflow',
        timestamp: new Date().toISOString(),
      },
    });

    const savedInteraction = await this.getCustomerInteractionRepository().save(
      interaction
    );

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'customer_responded',
      entity_type: 'customer_interaction',
      entity_id: savedInteraction.id,
      description: `Customer responded to recovery: ${params.intent}`,
      details: {
        recovery_case_id: params.recovery_case_id,
        customer_id: params.customer_id,
        intent: params.intent,
        channel: params.channel,
      },
    });

    return savedInteraction;
  }

  /**
   * Create a promise-to-pay agreement
   */
  async createPromiseToPay(params: CreatePromiseParams): Promise<PromiseToPay> {
    // Validate deadline
    const now = new Date();
    if (params.promised_deadline <= now) {
      throw new Error('Promise deadline must be in the future');
    }

    // Calculate days between now and deadline
    const daysUntilDeadline = Math.ceil(
      (params.promised_deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDeadline > CustomerRecoveryService.MAX_PROMISE_DAYS) {
      throw new Error(
        `Promise deadline cannot exceed ${CustomerRecoveryService.MAX_PROMISE_DAYS} days`
      );
    }

    // Verify recovery case and customer interaction exist
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: params.recovery_case_id },
    });

    if (!recoveryCase) {
      throw new Error('Recovery case not found');
    }

    const interaction = await this.getCustomerInteractionRepository().findOne({
      where: { id: params.customer_interaction_id },
    });

    if (!interaction) {
      throw new Error('Customer interaction not found');
    }

    // Create promise-to-pay record
    const promise = this.getPromiseToPayRepository().create({
      recovery_case_id: params.recovery_case_id,
      customer_id: params.customer_id,
      customer_interaction_id: params.customer_interaction_id,
      status: 'pending' as PromiseStatus,
      promised_amount_cents: params.promised_amount_cents,
      promised_deadline: params.promised_deadline,
      promise_notes: `Promise created for $${(params.promised_amount_cents / 100).toFixed(
        2
      )} by ${params.promised_deadline.toLocaleDateString()}`,
    });

    const savedPromise = await this.getPromiseToPayRepository().save(promise);

    // Update recovery case status to 'in_progress'
    recoveryCase.status = 'in_progress';
    await this.getRecoveryCaseRepository().save(recoveryCase);

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'promise_to_pay_created',
      entity_type: 'promise_to_pay',
      entity_id: savedPromise.id,
      description: `Promise-to-pay created for $${(params.promised_amount_cents / 100).toFixed(
        2
      )} by ${params.promised_deadline.toLocaleDateString()}`,
      details: {
        recovery_case_id: params.recovery_case_id,
        customer_id: params.customer_id,
        promised_amount_cents: params.promised_amount_cents,
        promised_deadline: params.promised_deadline.toISOString(),
      },
    });

    return savedPromise;
  }

  /**
   * Handle customer response and update recovery case status accordingly
   */
  async handleCustomerResponse(params: HandleResponseParams): Promise<void> {
    // Record the interaction
    const interaction = await this.recordCustomerInteraction({
      recovery_case_id: params.recovery_case_id,
      customer_id: params.customer_id,
      channel: params.channel,
      intent: params.intent,
    });

    // Update recovery case based on intent
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: params.recovery_case_id },
    });

    if (!recoveryCase) {
      throw new Error('Recovery case not found');
    }

    switch (params.intent) {
      case 'accepted':
        // Customer accepts recovery attempt
        recoveryCase.status = 'in_progress';
        break;

      case 'refused':
        // Customer refuses - treat as opted out
        recoveryCase.status = 'customer_declined';
        // Add to opt-out list
        if (params.merchantIdOverride) {
          await this.paymentFailureService.optOutCustomer(
            params.merchantIdOverride,
            params.customer_id
          );
        }
        break;

      case 'promised':
        // Will be handled separately when promise deadline is provided
        recoveryCase.status = 'in_progress';
        break;

      case 'unclear':
        // Keep case open for manual review
        // Status remains unchanged
        break;
    }

    await this.getRecoveryCaseRepository().save(recoveryCase);

    // Log response handling
    await this.getAuditLogRepository().save({
      event_type: 'customer_response_processed',
      entity_type: 'recovery_case',
      entity_id: params.recovery_case_id,
      description: `Customer response processed: ${params.intent}`,
      details: {
        previous_status: recoveryCase.status,
        intent: params.intent,
        interaction_id: interaction.id,
      },
    });
  }

  /**
   * Get active promises approaching their deadline
   * Used by scheduler to send follow-up emails
   */
  async getPromisesApproachingDeadline(
    hoursUntilDeadline: number = 24
  ): Promise<PromiseToPay[]> {
    const now = new Date();
    const checkTime = new Date(now.getTime() + hoursUntilDeadline * 60 * 60 * 1000);

    return await this.getPromiseToPayRepository()
      .createQueryBuilder('promise')
      .where('promise.status = :status', { status: 'pending' })
      .andWhere('promise.promised_deadline <= :checkTime', { checkTime })
      .leftJoinAndSelect('promise.customer', 'customer')
      .leftJoinAndSelect('promise.recovery_case', 'recovery_case')
      .getMany();
  }

  /**
   * Get promises that have passed their deadline
   * Used by scheduler to mark as missed
   */
  async getExpiredPromises(): Promise<PromiseToPay[]> {
    const now = new Date();

    return await this.getPromiseToPayRepository()
      .createQueryBuilder('promise')
      .where('promise.status = :status', { status: 'pending' })
      .andWhere('promise.promised_deadline < :now', { now })
      .leftJoinAndSelect('promise.customer', 'customer')
      .leftJoinAndSelect('promise.recovery_case', 'recovery_case')
      .getMany();
  }

  /**
   * Mark promise as missed and update recovery case
   */
  async markPromiseAsMissed(promiseId: string): Promise<PromiseToPay> {
    const promise = await this.getPromiseToPayRepository().findOne({
      where: { id: promiseId },
      relations: ['recovery_case'],
    });

    if (!promise) {
      throw new Error('Promise-to-pay not found');
    }

    promise.status = 'missed' as PromiseStatus;
    promise.missed_at = new Date();
    promise.outcome_notes = 'Promise deadline passed without payment';

    const updatedPromise = await this.getPromiseToPayRepository().save(promise);

    // Update recovery case status
    if (promise.recovery_case) {
      promise.recovery_case.status = 'abandoned';
      promise.recovery_case.recovery_notes = 'Promise-to-pay deadline missed';
      await this.getRecoveryCaseRepository().save(promise.recovery_case);
    }

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'promise_deadline_missed',
      entity_type: 'promise_to_pay',
      entity_id: promiseId,
      description: 'Promise-to-pay deadline passed without payment',
      details: {
        promised_deadline: promise.promised_deadline.toISOString(),
        recovery_case_id: promise.recovery_case?.id,
      },
    });

    return updatedPromise;
  }

  /**
   * Mark promise as fulfilled (payment received)
   */
  async markPromiseFulfilled(promiseId: string): Promise<PromiseToPay> {
    const promise = await this.getPromiseToPayRepository().findOne({
      where: { id: promiseId },
      relations: ['recovery_case'],
    });

    if (!promise) {
      throw new Error('Promise-to-pay not found');
    }

    promise.status = 'fulfilled' as PromiseStatus;
    promise.fulfilled_at = new Date();
    promise.outcome_notes = 'Payment received as promised';

    const updatedPromise = await this.getPromiseToPayRepository().save(promise);

    // Update recovery case status
    if (promise.recovery_case) {
      promise.recovery_case.status = 'resolved';
      promise.recovery_case.recovery_notes = 'Payment received via promise-to-pay';
      promise.recovery_case.resolved_at = new Date();
      await this.getRecoveryCaseRepository().save(promise.recovery_case);
    }

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'promise_fulfilled',
      entity_type: 'promise_to_pay',
      entity_id: promiseId,
      description: 'Promise-to-pay fulfilled - payment received',
      details: {
        promised_deadline: promise.promised_deadline.toISOString(),
        recovery_case_id: promise.recovery_case?.id,
      },
    });

    return updatedPromise;
  }

  /**
   * Get customer interaction history for a recovery case
   */
  async getInteractionHistory(
    recovery_case_id: string
  ): Promise<CustomerInteraction[]> {
    return await this.getCustomerInteractionRepository().find({
      where: { recovery_case_id },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get promise details for a recovery case
   */
  async getPromiseForCase(recovery_case_id: string): Promise<PromiseToPay | null> {
    return await this.getPromiseToPayRepository().findOne({
      where: { recovery_case_id },
      relations: ['customer', 'customer_interaction'],
    });
  }
}
