import cron from 'node-cron';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { CustomerRecoveryService } from './CustomerRecoveryService.js';
import { EmailService } from './EmailService.js';
import { MerchantAgent } from './MerchantAgent.js';
import { PromiseToPay } from '../models/PromiseToPay.js';
import { Customer } from '../models/Customer.js';
import { AuditLog } from '../models/AuditLog.js';
import { MerchantInsight } from '../models/MerchantInsight.js';

/**
 * Scheduler Service
 * Manages recurring jobs for promise-to-pay follow-ups and deadline checks
 * Uses node-cron for scheduling
 */
export class SchedulerService {
  private dataSource: DataSource;
  private recoveryService: CustomerRecoveryService;
  private emailService: EmailService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
    this.recoveryService = new CustomerRecoveryService(dataSource);
    this.emailService = new EmailService();
  }

  /**
   * Start all scheduler jobs
   * Should be called on server startup
   */
  async start(): Promise<void> {
    console.log('[SchedulerService] Starting scheduler jobs...');

    // Job 1: Check for promises approaching deadline (every hour)
    this.schedulePromiseFollowUpJob();

    // Job 2: Check for expired promises (every 6 hours)
    this.schedulePromiseDeadlineCheckJob();

    // Job 3: Generate daily merchant insights (M8)
    this.scheduleDailyMerchantInsightJob();

    console.log('[SchedulerService] Scheduler jobs started successfully');
  }

  /**
   * Schedule daily merchant insights job (M8)
   * Runs every day at 2 AM to generate AI insights for merchant
   */
  private scheduleDailyMerchantInsightJob(): void {
    const jobName = 'daily_merchant_insights_job';

    // Every day at 2 AM
    const task = cron.schedule('0 2 * * *', async () => {
      try {
        console.log(`[SchedulerService] Running ${jobName}...`);

        const merchantAgent = new MerchantAgent(this.dataSource);
        const insightRepo = this.dataSource.getRepository(MerchantInsight);
        const auditRepo = this.dataSource.getRepository(AuditLog);

        // Generate insights for default merchant
        const merchantId = 'default-merchant';
        const insights = await merchantAgent.generateDailyInsights(merchantId);

        if (insights.length === 0) {
          console.log(`[SchedulerService] No insights generated for merchant ${merchantId}`);
          return;
        }

        // Check if we already have insights for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingCount = await insightRepo.count({
          where: {
            merchant_id: merchantId,
            created_at: today,
          },
        });

        if (existingCount > 0) {
          console.log(
            `[SchedulerService] Insights already generated today for merchant ${merchantId}, skipping duplicate`
          );
          return;
        }

        // Store insights
        for (const insight of insights) {
          const storedInsight = insightRepo.create({
            merchant_id: merchantId,
            type: insight.type,
            title: insight.title,
            summary: insight.summary,
            insights: insight.insights,
            data_summary: insight.data_summary,
            confidence_percent: insight.confidence_percent,
            guard_rails_applied: insight.guard_rails_applied,
            is_read: false,
          });

          await insightRepo.save(storedInsight);
        }

        console.log(`[SchedulerService] Stored ${insights.length} insights for merchant ${merchantId}`);

        // Log audit event
        await auditRepo.save({
          event_type: 'insights_generated',
          entity_type: 'merchant_insights',
          entity_id: merchantId,
          description: `Generated ${insights.length} daily merchant insights`,
          details: {
            insight_types: insights.map((i) => i.type),
            total_confidence: insights.reduce((sum, i) => sum + i.confidence_percent, 0) /
              insights.length,
          },
        });
      } catch (error) {
        console.error(`[SchedulerService] Error in ${jobName}:`, error);
        // Don't crash scheduler if AI service fails
        // Log failure to audit
        try {
          const auditRepo = this.dataSource.getRepository(AuditLog);
          await auditRepo.save({
            event_type: 'insights_generation_failed',
            entity_type: 'merchant_insights',
            entity_id: 'default-merchant',
            description: `Failed to generate daily merchant insights`,
            details: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
        } catch (auditError) {
          console.error('[SchedulerService] Failed to log audit event:', auditError);
        }
      }
    });

    this.jobs.set(jobName, task);
    console.log(`[SchedulerService] Scheduled ${jobName}: runs daily at 2 AM`);
  }

  /**
   * Stop all scheduler jobs
   * Should be called on server shutdown
   */
  async stop(): Promise<void> {
    console.log('[SchedulerService] Stopping scheduler jobs...');

    for (const [jobName, task] of this.jobs.entries()) {
      task.stop();
      console.log(`[SchedulerService] Stopped job: ${jobName}`);
    }

    this.jobs.clear();
    console.log('[SchedulerService] All scheduler jobs stopped');
  }

  /**
   * Schedule promise follow-up job
   * Runs every hour to find promises approaching their deadline
   * Sends reminder emails 24 hours before deadline
   */
  private schedulePromiseFollowUpJob(): void {
    const jobName = 'promise_followup_job';

    // Every hour at minute 0
    const task = cron.schedule('0 * * * *', async () => {
      try {
        console.log(`[SchedulerService] Running ${jobName}...`);

        // Find promises approaching deadline (within 24 hours)
        const promisesApproaching =
          await this.recoveryService.getPromisesApproachingDeadline(24);

        if (promisesApproaching.length === 0) {
          console.log(`[SchedulerService] No promises approaching deadline`);
          return;
        }

        console.log(
          `[SchedulerService] Found ${promisesApproaching.length} promises approaching deadline`
        );

        // Send follow-up emails
        for (const promise of promisesApproaching) {
          try {
            await this.sendPromiseFollowUpEmail(promise);
          } catch (error) {
            console.error(
              `[SchedulerService] Failed to send follow-up email for promise ${promise.id}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(`[SchedulerService] Error in ${jobName}:`, error);
      }
    });

    this.jobs.set(jobName, task);
    console.log(`[SchedulerService] Scheduled ${jobName}: runs every hour`);
  }

  /**
   * Schedule promise deadline check job
   * Runs every 6 hours to find expired promises
   * Marks them as missed and updates recovery cases
   */
  private schedulePromiseDeadlineCheckJob(): void {
    const jobName = 'promise_deadline_check_job';

    // Every 6 hours (0, 6, 12, 18)
    const task = cron.schedule('0 */6 * * *', async () => {
      try {
        console.log(`[SchedulerService] Running ${jobName}...`);

        // Find expired promises
        const expiredPromises = await this.recoveryService.getExpiredPromises();

        if (expiredPromises.length === 0) {
          console.log(`[SchedulerService] No expired promises found`);
          return;
        }

        console.log(
          `[SchedulerService] Found ${expiredPromises.length} expired promises`
        );

        // Mark them as missed
        for (const promise of expiredPromises) {
          try {
            await this.recoveryService.markPromiseAsMissed(promise.id);
            console.log(
              `[SchedulerService] Marked promise ${promise.id} as missed`
            );

            // Send missed notification email
            await this.sendPromiseMissedEmail(promise);
          } catch (error) {
            console.error(
              `[SchedulerService] Failed to process expired promise ${promise.id}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(`[SchedulerService] Error in ${jobName}:`, error);
      }
    });

    this.jobs.set(jobName, task);
    console.log(
      `[SchedulerService] Scheduled ${jobName}: runs every 6 hours (0, 6, 12, 18)`
    );
  }

  /**
   * Send promise follow-up email
   */
  private async sendPromiseFollowUpEmail(promise: PromiseToPay): Promise<void> {
    // Get customer details
    const customerRepo = this.dataSource.getRepository(Customer);
    const customer = await customerRepo.findOne({
      where: { id: promise.customer_id },
    });

    if (!customer || !customer.email) {
      console.warn(
        `[SchedulerService] Customer ${promise.customer_id} not found or has no email`
      );
      return;
    }

    // Build recovery link (adjust based on frontend URL)
    const recoveryLink = `${process.env.FRONTEND_URL}/recovery/${promise.recovery_case_id}`;

    // Send email
    const result = await this.emailService.sendPromiseFollowUp(
      customer.email,
      customer.name || 'Customer',
      promise.promised_deadline,
      recoveryLink
    );

    if (result.success) {
      console.log(
        `[SchedulerService] Sent follow-up email for promise ${promise.id} to ${customer.email}`
      );

      // Log audit event
      const auditRepo = this.dataSource.getRepository(AuditLog);
      await auditRepo.save({
        event_type: 'email_sent',
        entity_type: 'promise_to_pay',
        entity_id: promise.id,
        description: `Promise follow-up email sent to ${customer.email}`,
        details: {
          email: customer.email,
          customer_id: promise.customer_id,
          recovery_case_id: promise.recovery_case_id,
          message_id: result.messageId,
        },
      });
    } else {
      console.error(
        `[SchedulerService] Failed to send follow-up email for promise ${promise.id}:`,
        result.error
      );

      // Log failure
      const auditRepo = this.dataSource.getRepository(AuditLog);
      await auditRepo.save({
        event_type: 'email_sent',
        entity_type: 'promise_to_pay',
        entity_id: promise.id,
        description: `Failed to send promise follow-up email to ${customer.email}`,
        details: {
          email: customer.email,
          customer_id: promise.customer_id,
          error: result.error,
        },
      });
    }
  }

  /**
   * Send promise missed notification email
   */
  private async sendPromiseMissedEmail(promise: PromiseToPay): Promise<void> {
    // Get customer details
    const customerRepo = this.dataSource.getRepository(Customer);
    const customer = await customerRepo.findOne({
      where: { id: promise.customer_id },
    });

    if (!customer || !customer.email) {
      console.warn(
        `[SchedulerService] Customer ${promise.customer_id} not found or has no email`
      );
      return;
    }

    // Build recovery link
    const recoveryLink = `${process.env.FRONTEND_URL}/recovery/${promise.recovery_case_id}`;

    // Send email
    const result = await this.emailService.sendPromiseMissedNotification(
      customer.email,
      customer.name || 'Customer',
      recoveryLink
    );

    if (result.success) {
      console.log(
        `[SchedulerService] Sent missed notification email for promise ${promise.id} to ${customer.email}`
      );

      // Log audit event
      const auditRepo = this.dataSource.getRepository(AuditLog);
      await auditRepo.save({
        event_type: 'email_sent',
        entity_type: 'promise_to_pay',
        entity_id: promise.id,
        description: `Promise missed notification email sent to ${customer.email}`,
        details: {
          email: customer.email,
          customer_id: promise.customer_id,
          recovery_case_id: promise.recovery_case_id,
          message_id: result.messageId,
        },
      });
    } else {
      console.error(
        `[SchedulerService] Failed to send missed notification for promise ${promise.id}:`,
        result.error
      );

      // Log failure
      const auditRepo = this.dataSource.getRepository(AuditLog);
      await auditRepo.save({
        event_type: 'email_sent',
        entity_type: 'promise_to_pay',
        entity_id: promise.id,
        description: `Failed to send promise missed notification to ${customer.email}`,
        details: {
          email: customer.email,
          customer_id: promise.customer_id,
          error: result.error,
        },
      });
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.jobs.size > 0;
  }

  /**
   * Get list of running jobs
   */
  getRunningJobs(): string[] {
    return Array.from(this.jobs.keys());
  }
}

// Singleton instance
export const schedulerService = new SchedulerService();
