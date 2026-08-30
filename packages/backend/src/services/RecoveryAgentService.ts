import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { env } from '../config/env.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { AgentDecision } from '../models/AgentDecision.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { AuditLog } from '../models/AuditLog.js';
import { Order } from '../models/Order.js';
import { PaymentFailure } from '../models/PaymentFailure.js';
import { PaymentFailureService } from './PaymentFailureService.js';

interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

interface AIAnalysis {
  recommended_action: 'retry_payment' | 'offer_discount' | 'escalate' | 'abandon' | 'contact_customer';
  confidence: number;
  reasoning: string;
  suggested_discount?: number;
  retry_count?: number;
}

export class RecoveryAgentService {
  private dataSource: DataSource;
  private paymentFailureService: PaymentFailureService;
  private static readonly MODEL = 'llama3-70b-8192';

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
    this.paymentFailureService = new PaymentFailureService(dataSource);
  }

  private getRecoveryCaseRepository() {
    return this.dataSource.getRepository(RecoveryCase);
  }

  private getAgentDecisionRepository() {
    return this.dataSource.getRepository(AgentDecision);
  }

  private getMerchantConfigRepository() {
    return this.dataSource.getRepository(MerchantConfig);
  }

  private getAuditLogRepository() {
    return this.dataSource.getRepository(AuditLog);
  }

  private getPaymentFailureRepository() {
    return this.dataSource.getRepository(PaymentFailure);
  }

  private getOrderRepository() {
    return this.dataSource.getRepository(Order);
  }

  /**
   * Analyze payment failure and make recovery decision
   */
  async analyzeFailureAndDecide(recoveryCaseId: string, merchantIdOverride?: string): Promise<AgentDecision> {
    const recoveryCase = await this.getRecoveryCaseRepository().findOne({
      where: { id: recoveryCaseId },
      relations: ['payment_failure', 'order', 'customer'],
    });

    if (!recoveryCase) {
      throw new Error('Recovery case not found');
    }

    const targetMerchantId = merchantIdOverride || (recoveryCase.order as any)?.merchant_id || '11111111-1111-1111-1111-111111111111';

    let merchantConfig = await this.getMerchantConfigRepository().findOne({
      where: { merchant_id: targetMerchantId },
    });

    if (!merchantConfig) {
      const merchantRepo = this.dataSource.getRepository('Merchant');
      let merchant: any = await merchantRepo.findOne({ where: { id: targetMerchantId } });
      if (!merchant) {
        merchant = await merchantRepo.save(
          merchantRepo.create({
            id: targetMerchantId,
            name: 'Default Store',
            email: `store-${targetMerchantId}@example.com`,
          })
        );
      }
      merchantConfig = this.getMerchantConfigRepository().create({
        merchant_id: targetMerchantId,
      });
      merchantConfig = await this.getMerchantConfigRepository().save(merchantConfig);
    }

    // Check if customer has opted out
    const isOptedOut = await this.paymentFailureService.isCustomerOptedOut(
      targetMerchantId,
      recoveryCase.customer_id
    );

    if (isOptedOut) {
      // Customer opted out - must abandon or escalate
      const agentDecision = this.getAgentDecisionRepository().create({
        recovery_case_id: recoveryCaseId,
        decision: 'abandon',
        explanation: 'Customer has opted out of recovery',
        confidence_score: 100,
        context: {
          failure_reason: recoveryCase.payment_failure.reason,
          failure_count: recoveryCase.payment_failure.failure_count,
          recovery_attempts: recoveryCase.recovery_attempts,
          order_amount: recoveryCase.order.total_cents / 100,
        },
        guard_rails_enforced: true,
        guard_rail_violations: 'customer_opted_out',
      });

      const savedDecision = await this.getAgentDecisionRepository().save(agentDecision);
      return savedDecision;
    }
    const context = {
      failure_reason: recoveryCase.payment_failure.reason,
      order_amount: recoveryCase.order.total_cents / 100,
      failure_count: recoveryCase.payment_failure.failure_count,
      recovery_attempts: recoveryCase.recovery_attempts,
      max_attempts: merchantConfig.max_recovery_attempts,
    };

    // Get AI analysis (if enabled)
    let aiAnalysis: AIAnalysis | null = null;
    if (merchantConfig.ai_diagnosis_enabled) {
      try {
        aiAnalysis = await this.getAIAnalysis(recoveryCase, merchantConfig, context);
      } catch (error) {
        console.warn('AI diagnosis failed, using default strategy', error);
      }
    }

    // Make decision based on AI analysis and guard rails
    const decision = this.makeDecision(
      recoveryCase,
      merchantConfig,
      aiAnalysis,
      context
    );

    // Check guard rails
    const guardRailViolations = this.checkGuardRails(decision, merchantConfig);

    // Create agent decision record
    const agentDecision = this.getAgentDecisionRepository().create({
      recovery_case_id: recoveryCaseId,
      decision: decision.type,
      explanation: decision.explanation,
      confidence_score: decision.confidence,
      context: {
        failure_reason: recoveryCase.payment_failure.reason,
        failure_count: recoveryCase.payment_failure.failure_count,
        recovery_attempts: recoveryCase.recovery_attempts,
        order_amount: recoveryCase.order.total_cents / 100,
      },
      parameters: {
        ...(decision.discount_percent && { discount_percent: decision.discount_percent }),
        ...(decision.retry_count && { retry_count: decision.retry_count }),
      },
      guard_rails_enforced: true,
      guard_rail_violations: guardRailViolations?.length > 0 ? guardRailViolations.join('; ') : undefined,
    });

    const savedDecision = await this.getAgentDecisionRepository().save(agentDecision);

    // Log audit event
    await this.getAuditLogRepository().save({
      event_type: 'agent_decision_made',
      entity_type: 'agent_decision',
      entity_id: savedDecision.id,
      actor_id: undefined,
      description: `Recovery decision made: ${decision.type}`,
      details: {
        recovery_case_id: recoveryCaseId,
        decision: decision.type,
        confidence: decision.confidence,
        guard_rail_violations: guardRailViolations,
      },
    });

    return savedDecision;
  }

  /**
   * Get AI analysis via Groq
   */
  private async getAIAnalysis(
    recoveryCase: RecoveryCase,
    merchantConfig: MerchantConfig,
    context: any
  ): Promise<AIAnalysis> {
    if (!env.GROQ_API_KEY) {
      throw new Error('Groq API key not configured');
    }

    const prompt = `You are a payment recovery expert. Analyze this failed payment situation and recommend a recovery strategy.

Payment Failure Context:
- Failure Reason: ${context.failure_reason}
- Order Amount: $${context.order_amount}
- Total Failures: ${context.failure_count}
- Recovery Attempts So Far: ${context.recovery_attempts}
- Max Allowed Attempts: ${context.max_attempts}

Guard Rail Constraints:
- Max Discount Allowed: ${merchantConfig.max_discount_percent}%
- Max Recovery Attempts: ${merchantConfig.max_recovery_attempts}
- Allowed Channels: ${merchantConfig.allowed_channels.join(', ')}

Based on this context, recommend ONE of these actions:
1. "retry_payment" - Automatically retry the payment
2. "offer_discount" - Offer a discount to encourage retry
3. "contact_customer" - Contact customer for assistance
4. "escalate" - Escalate to merchant for manual handling
5. "abandon" - Close the recovery case

Respond with a JSON object containing:
{
  "recommended_action": "one of the above",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "suggested_discount": optional number 1-${merchantConfig.max_discount_percent},
  "retry_count": optional number
}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: RecoveryAgentService.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at payment recovery decisions. Respond only with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = (await response.json()) as GroqResponse;
      const content = data.choices[0]?.message?.content || '';
      const analysis = JSON.parse(content) as AIAnalysis;

      return analysis;
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Make recovery decision with AI input and guard rails
   */
  private makeDecision(
    recoveryCase: RecoveryCase,
    merchantConfig: MerchantConfig,
    aiAnalysis: AIAnalysis | null,
    context: any
  ): {
    type: 'retry_payment' | 'offer_discount' | 'escalate' | 'abandon' | 'contact_customer';
    explanation: string;
    confidence: number;
    discount_percent?: number;
    retry_count?: number;
  } {
    // If max attempts reached, abandon
    if (recoveryCase.recovery_attempts >= merchantConfig.max_recovery_attempts) {
      return {
        type: 'abandon',
        explanation: 'Max recovery attempts reached',
        confidence: 100,
      };
    }

    // Use AI recommendation if available
    if (aiAnalysis) {
      return {
        type: aiAnalysis.recommended_action,
        explanation: aiAnalysis.reasoning,
        confidence: aiAnalysis.confidence,
        discount_percent: aiAnalysis.suggested_discount,
        retry_count: aiAnalysis.retry_count,
      };
    }

    // Default strategy: retry once, then offer discount
    if (recoveryCase.recovery_attempts === 0) {
      return {
        type: 'retry_payment',
        explanation: 'First recovery attempt: automatic retry',
        confidence: 80,
        retry_count: 1,
      };
    } else if (recoveryCase.recovery_attempts === 1) {
      return {
        type: 'offer_discount',
        explanation: 'Second attempt: offer discount incentive',
        confidence: 75,
        discount_percent: Math.min(15, merchantConfig.max_discount_percent),
      };
    }

    // Final attempt: escalate
    return {
      type: 'escalate',
      explanation: 'Final recovery attempt: escalate to merchant',
      confidence: 70,
    };
  }

  /**
   * Check if decision violates guard rails
   */
  private checkGuardRails(
    decision: any,
    merchantConfig: MerchantConfig
  ): string[] {
    const violations: string[] = [];

    if (decision.discount_percent && decision.discount_percent > merchantConfig.max_discount_percent) {
      violations.push(`Discount ${decision.discount_percent}% exceeds max ${merchantConfig.max_discount_percent}%`);
    }

    return violations;
  }
}

export const recoveryAgentService = new RecoveryAgentService();
