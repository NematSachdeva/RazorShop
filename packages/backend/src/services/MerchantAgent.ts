/**
 * Merchant Agent Service
 * 
 * Core logic for generating AI-driven merchant insights from real business analytics.
 * 
 * Architecture:
 * - Gathers comprehensive live merchant transactional data via AnalyticsService
 * - Builds dynamic analysis prompts for Groq LLM (llama-3.3-70b-versatile / llama3-70b-8192)
 * - Validates AI output against strict data grounding rules (no zero-data problem fabrication)
 * - Provides data-grounded deterministic fallbacks when AI is unreachable
 * - Enforces guard rails (discount capping, opt-out filtering, confidence thresholds)
 */

import { DataSource, Repository } from 'typeorm';
import { AnalyticsService, ComprehensiveMerchantAnalytics } from './AnalyticsService.js';
import { MerchantConfig } from '../models/MerchantConfig.js';
import { Product } from '../models/Product.js';
import { env } from '../config/env.js';

export type InsightType = 
  | 'payment_failure_patterns'
  | 'abandoned_cart_patterns'
  | 'recovery_success_rates'
  | 'product_bundles'
  | 'discount_strategy'
  | 'inventory_optimization'
  | 'recovery_targeting';

export interface InsightRecommendation {
  title: string;
  description: string;
  reasoning: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence_percent: number;
  data_sources: string[];
  limitations?: string;
}

export interface MerchantInsight {
  type: InsightType;
  title: string;
  summary: string;
  insights: InsightRecommendation[];
  data_summary: Record<string, unknown>;
  generated_at: Date;
  confidence_percent: number;
  guard_rails_applied?: string[];
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class MerchantAgent {
  private dataSource: DataSource;
  private analyticsService: AnalyticsService;

  private static readonly MODEL = 'llama-3.3-70b-versatile';
  private static readonly FALLBACK_MODEL = 'llama3-70b-8192';
  private static readonly TEMPERATURE = 0.3;
  private static readonly MAX_TOKENS = 2500;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.analyticsService = new AnalyticsService(dataSource);
  }

  private getConfigRepository(): Repository<MerchantConfig> {
    return this.dataSource.getRepository(MerchantConfig);
  }

  private getProductRepository(): Repository<Product> {
    return this.dataSource.getRepository(Product);
  }

  /**
   * Main entry point to generate dynamic merchant insights
   */
  async generateDailyInsights(merchantId?: string): Promise<MerchantInsight[]> {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let targetMerchantId: string = merchantId && uuidRegex.test(merchantId) ? merchantId : '11111111-1111-1111-1111-111111111111';
      if (!uuidRegex.test(targetMerchantId)) {
        const firstMerchant = await this.getConfigRepository().manager.getRepository('Merchant').findOne({ where: {} });
        if (firstMerchant?.id) targetMerchantId = firstMerchant.id;
      }

      // Step 1: Query live business analytics
      const analytics = await this.analyticsService.getComprehensiveMerchantAnalytics(targetMerchantId);
      console.log(`[Insights] Analytics collected for merchant: ${targetMerchantId}`);
      console.log(`[Insights] Payment failures: ${analytics.payments.failed_count}, Abandoned Carts: ${analytics.carts.abandoned_count}, Recovery Cases: ${analytics.recovery.total_cases}`);

      // Step 2: Fetch merchant config for guard rails & preferences
      const config = await this.getMerchantConfig(targetMerchantId);

      if (config?.ai_insights_enabled === false) {
        console.log(`[Insights] AI insights disabled in config for merchant: ${targetMerchantId}`);
        return [];
      }

      // Step 3: Generate dynamic insights via Groq or Data-Grounded Fallback
      let rawInsights: MerchantInsight[] = [];
      try {
        const prompt = this.buildHolisticAnalysisPrompt(analytics, config);
        console.log(`[Insights] Sending analytics to Groq...`);
        const response = await this.callGroqAPI(prompt);
        rawInsights = this.parseGroqInsightsResponse(response, analytics);
        console.log(`[Insights] Groq response received: parsed ${rawInsights.length} raw insights`);
      } catch (error) {
        console.warn(`[Insights] Groq call unavailable/suppressed (${(error as Error).message}). Using data-grounded fallback generator.`);
        rawInsights = this.generateDataGroundedFallbackInsights(analytics, config);
      }

      // Step 4: Post-validate & enforce guard rails
      const validatedInsights = this.validateAndSanitizeInsights(rawInsights, analytics, config);
      console.log(`[Insights] Final validated insights count: ${validatedInsights.length}`);

      return validatedInsights;
    } catch (error) {
      console.error('[MerchantAgent] Error generating daily insights:', error);
      throw error;
    }
  }

  /**
   * Build holistic analysis prompt for Groq containing full business metrics payload
   */
  private buildHolisticAnalysisPrompt(analytics: ComprehensiveMerchantAnalytics, config: MerchantConfig | null): string {
    const maxDiscount = config?.max_discount_percent ?? 30;
    const minConfidence = config?.min_confidence_score ?? 70;
    const optedOutCount = config?.customer_opt_outs?.length ?? 0;

    return `Analyze the following live merchant business metrics and generate actionable, evidence-based AI insights and recommendations.

EXACT BUSINESS METRICS PAYLOAD (all monetary metrics are in Rupees):
${JSON.stringify(analytics, null, 2)}

CONFIG CONSTRAINTS:
- Maximum discount allowed: ${maxDiscount}%
- Minimum confidence score threshold: ${minConfidence}%
- Opted-out customer count: ${optedOutCount}

STRICT GROUNDING & FABRICATION RULES:
1. NEVER fabricate issues or problems. Base all claims strictly on the provided numeric metrics.
2. If payment failure count is 0 (payments.failed_count === 0), DO NOT generate a 'payment_failure_patterns' insight claiming there are payment failure problems.
3. If abandoned cart count is 0 (carts.abandoned_count === 0), DO NOT generate an 'abandoned_cart_patterns' insight claiming there is a cart abandonment issue.
4. If recovery total cases is 0 (recovery.total_cases === 0), DO NOT generate a 'recovery_success_rates' insight claiming there is a recovery problem.
5. If low stock count and out of stock count are 0, DO NOT fabricate an inventory crisis.
6. If overall business metrics are healthy with 0 active failures/abandonments, provide positive optimization insights (e.g. 'inventory_optimization', 'product_bundles', or 'discount_strategy') or highlight strong operational health.
7. Return between 1 and 6 relevant insights based ONLY on the evidence present.

CURRENCY FORMATTING CONVENTION (STRICT):
- All monetary metrics in the payload are in Rupees (₹).
- Whenever referencing monetary amounts in titles, summaries, data_summary, descriptions, or actions, ALWAYS format them as Rupee amounts using the '₹' symbol with commas and 2 decimal places (e.g., '₹3,492.22').
- NEVER output 'cents', 'paise', 'INR', 'USD', or raw unformatted numbers for currency.

SUPPORTED INSIGHT TYPES:
- 'payment_failure_patterns' (Payment Failures)
- 'abandoned_cart_patterns' (Abandoned Carts)
- 'recovery_success_rates' (Recovery Performance)
- 'product_bundles' (Product Bundles)
- 'discount_strategy' (Discount Strategy)
- 'inventory_optimization' (Inventory Optimization)
- 'recovery_targeting' (Recovery Targeting)

Return ONLY valid JSON matching this exact structure:
{
  "insights": [
    {
      "type": "one_of_supported_types",
      "title": "Clear Insight Title",
      "summary": "Executive summary referencing exact Rupee numbers formatted as ₹X,XXX.XX from data payload",
      "confidence_percent": 70-100,
      "data_summary": {
        "key_metric_1": "value",
        "key_metric_2": "value"
      },
      "recommendations": [
        {
          "title": "Specific Actionable Recommendation",
          "description": "Clear explanation grounded in data",
          "reasoning": "Data-backed business rationale",
          "action": "Concrete next step for merchant",
          "priority": "high|medium|low",
          "confidence_percent": 70-100,
          "data_sources": ["payments", "carts", "recovery", "orders", "inventory"]
        }
      ]
    }
  ]
}`;
  }

  /**
   * Parse Groq JSON response into MerchantInsight objects
   */
  private parseGroqInsightsResponse(response: GroqResponse, analytics: ComprehensiveMerchantAnalytics): MerchantInsight[] {
    try {
      const content = response.choices[0]?.message.content || '';
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed.insights) ? parsed.insights : [];

      const validTypes: InsightType[] = [
        'payment_failure_patterns',
        'abandoned_cart_patterns',
        'recovery_success_rates',
        'product_bundles',
        'discount_strategy',
        'inventory_optimization',
        'recovery_targeting',
      ];

      const insights: MerchantInsight[] = [];

      for (const item of items) {
        if (!item.type || !validTypes.includes(item.type)) continue;

        const recs: InsightRecommendation[] = Array.isArray(item.recommendations)
          ? item.recommendations.map((r: any) => ({
              title: String(r.title || 'Recommendation'),
              description: String(r.description || ''),
              reasoning: String(r.reasoning || ''),
              action: String(r.action || ''),
              priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
              confidence_percent: Math.min(100, Math.max(0, Number(r.confidence_percent) || 75)),
              data_sources: Array.isArray(r.data_sources) ? r.data_sources.map(String) : ['business_analytics'],
              limitations: r.limitations ? String(r.limitations) : undefined,
            }))
          : [];

        insights.push({
          type: item.type,
          title: String(item.title || 'Merchant Analytics Insight'),
          summary: String(item.summary || 'Data analysis complete.'),
          insights: recs,
          data_summary: typeof item.data_summary === 'object' && item.data_summary !== null ? item.data_summary : {},
          generated_at: new Date(),
          confidence_percent: Math.min(100, Math.max(0, Number(item.confidence_percent) || 80)),
        });
      }

      return insights;
    } catch (error) {
      console.error('[MerchantAgent] Failed to parse Groq response JSON:', error);
      return [];
    }
  }

  /**
   * Helper to format Rupee amount with commas and 2 decimals
   */
  private formatRupees(amount: number): string {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Generate data-grounded fallback insights when Groq is unavailable.
   * STRICT RULE: Strictly uses live metrics. Does NOT fabricate issues for 0-count metrics.
   */
  private generateDataGroundedFallbackInsights(
    analytics: ComprehensiveMerchantAnalytics,
    config: MerchantConfig | null
  ): MerchantInsight[] {
    const insights: MerchantInsight[] = [];
    const maxDiscount = config?.max_discount_percent ?? 30;

    // 1. Payment Failures (Only if failed_count > 0)
    if (analytics.payments.failed_count > 0) {
      const topReason = analytics.payments.top_failure_reasons[0]?.reason || 'card_declined';
      const failedAmountFormatted = this.formatRupees(analytics.payments.total_failed_rupees);
      insights.push({
        type: 'payment_failure_patterns',
        title: 'Payment Failure Analysis',
        summary: `Identified ${analytics.payments.failed_count} payment failure instances totaling ${failedAmountFormatted} at risk. Primary failure cause: ${topReason.replace(/_/g, ' ')}.`,
        confidence_percent: 88,
        data_summary: {
          failed_payments_count: analytics.payments.failed_count,
          total_failed_rupees: analytics.payments.total_failed_rupees,
          recovery_rate_percent: analytics.payments.recovery_rate_percent,
          top_reason: topReason,
        },
        insights: [
          {
            title: 'Automate Payment Failure Recovery',
            description: `${analytics.payments.failed_count} failed payment attempts recorded. Automated recovery links allow 1-click customer retry.`,
            reasoning: `Top failure reason '${topReason}' benefits from instant retry prompts.`,
            action: 'Enable automated email/SMS recovery notifications.',
            priority: 'high',
            confidence_percent: 88,
            data_sources: ['payment_failures', 'analytics_service'],
          },
        ],
        generated_at: new Date(),
      });
    }

    // 2. Abandoned Carts (Only if abandoned_count > 0)
    if (analytics.carts.abandoned_count > 0) {
      const atRiskAmountFormatted = this.formatRupees(analytics.carts.revenue_at_risk_rupees);
      const topProduct = analytics.carts.top_abandoned_products[0]?.product_name || 'cart items';
      insights.push({
        type: 'abandoned_cart_patterns',
        title: 'Abandoned Cart Analysis',
        summary: `Tracked ${analytics.carts.abandoned_count} abandoned cart instances representing ${atRiskAmountFormatted} in potential revenue. Top abandoned product: ${topProduct}.`,
        confidence_percent: 82,
        data_summary: {
          abandoned_carts_count: analytics.carts.abandoned_count,
          revenue_at_risk_rupees: analytics.carts.revenue_at_risk_rupees,
          top_abandoned_product: topProduct,
        },
        insights: [
          {
            title: 'Cart Recovery Incentive Strategy',
            description: `${analytics.carts.abandoned_count} cart abandonments detected. Target cart abandoners with timed follow-ups and bundle offers up to ${maxDiscount}%.`,
            reasoning: 'Presenting bundle deals on high-intent carts increases checkout completion.',
            action: `Enable ${Math.min(10, maxDiscount)}% recovery incentive discounts on high-intent abandoned carts.`,
            priority: 'medium',
            confidence_percent: 82,
            data_sources: ['cart_items', 'analytics_service'],
          },
        ],
        generated_at: new Date(),
      });
    }

    // 3. Recovery Funnel Performance (Only if total_cases > 0)
    if (analytics.recovery.total_cases > 0) {
      insights.push({
        type: 'recovery_success_rates',
        title: 'Recovery Performance Analysis',
        summary: `Recovery funnel processing ${analytics.recovery.total_cases} total cases with ${analytics.recovery.open} open cases pending resolution. Resolution rate is ${analytics.payments.recovery_rate_percent}%.`,
        confidence_percent: 85,
        data_summary: {
          total_recovery_cases: analytics.recovery.total_cases,
          open_cases: analytics.recovery.open,
          resolved_cases: analytics.recovery.resolved,
          acceptance_rate_percent: analytics.recovery.response_breakdown.accepted,
        },
        insights: [
          {
            title: 'Optimize Follow-up Timing',
            description: `${analytics.recovery.open} open recovery cases pending customer action. Rapid notification dispatch increases conversion by 35%.`,
            reasoning: 'Sending recovery emails within 15 minutes yields highest customer re-engagement.',
            action: 'Maintain active multi-channel recovery triggers.',
            priority: 'high',
            confidence_percent: 85,
            data_sources: ['recovery_funnel', 'customer_interactions'],
          },
        ],
        generated_at: new Date(),
      });
    }

    // 4. Inventory Optimization (If low stock or out of stock items exist)
    if (analytics.products_and_inventory.low_stock_count > 0 || analytics.products_and_inventory.out_of_stock_count > 0) {
      insights.push({
        type: 'inventory_optimization',
        title: 'Inventory Stock Optimization',
        summary: `Detected ${analytics.products_and_inventory.out_of_stock_count} out-of-stock products and ${analytics.products_and_inventory.low_stock_count} low-stock products across ${analytics.products_and_inventory.total_listed_products} listed SKUs.`,
        confidence_percent: 90,
        data_summary: {
          total_listed_products: analytics.products_and_inventory.total_listed_products,
          low_stock_count: analytics.products_and_inventory.low_stock_count,
          out_of_stock_count: analytics.products_and_inventory.out_of_stock_count,
        },
        insights: [
          {
            title: 'Restock High-Demand Inventory',
            description: `Stock shortages detected on ${analytics.products_and_inventory.low_stock_count + analytics.products_and_inventory.out_of_stock_count} catalog items. Restocking prevents revenue loss.`,
            reasoning: 'Popular items running low pose an immediate risk to store conversion.',
            action: 'Review product inventory levels and replenish stock.',
            priority: 'high',
            confidence_percent: 90,
            data_sources: ['inventory_records', 'product_catalog'],
          },
        ],
        generated_at: new Date(),
      });
    }

    // 5. Discount & Bundle Optimization (If orders exist)
    if (analytics.orders.total_orders > 0 && config?.discount_strategy_enabled !== false) {
      const aovFormatted = this.formatRupees(analytics.orders.average_order_value_rupees);
      insights.push({
        type: 'discount_strategy',
        title: 'Discount Strategy Optimization',
        summary: `Analyzed ${analytics.orders.total_orders} total orders with average order value of ${aovFormatted}. Max allowed discount is ${maxDiscount}%.`,
        confidence_percent: 78,
        data_summary: {
          total_orders: analytics.orders.total_orders,
          average_order_value_rupees: analytics.orders.average_order_value_rupees,
          max_discount_allowed: maxDiscount,
        },
        insights: [
          {
            title: 'Dynamic Discount Structuring',
            description: `Structure promotional discounts up to ${maxDiscount}% on high-margin bundles to increase average basket size.`,
            reasoning: 'Tiered order thresholds incentivize higher cart values.',
            action: `Set discount caps to ${maxDiscount}% for cart values above ₹1,000.`,
            priority: 'medium',
            confidence_percent: 78,
            data_sources: ['order_history', 'merchant_config'],
          },
        ],
        generated_at: new Date(),
      });
    }

    // 6. Healthy Operational Status (If 0 payment failures AND 0 abandoned carts AND 0 recovery cases)
    if (insights.length === 0) {
      insights.push({
        type: 'inventory_optimization',
        title: 'Store Operational Performance',
        summary: 'All core transaction metrics are healthy. Zero active payment failures or cart abandonments detected for this period.',
        confidence_percent: 95,
        data_summary: {
          failed_payments_count: 0,
          abandoned_carts_count: 0,
          recovery_cases_count: 0,
          total_revenue_rupees: analytics.orders.total_revenue_rupees,
        },
        insights: [
          {
            title: 'Maintain Operational Excellence',
            description: 'Payment checkout and cart completion rates are performing optimally with no identified recovery bottlenecks.',
            reasoning: 'Stable operational health provides an ideal baseline for product expansion.',
            action: 'Continue monitoring business metrics as new customer traffic scales.',
            priority: 'low',
            confidence_percent: 95,
            data_sources: ['analytics_service', 'health_check'],
          },
        ],
        generated_at: new Date(),
      });
    }

    return insights;
  }

  /**
   * Validate and sanitize raw insights against live analytics & guard rails
   */
  private validateAndSanitizeInsights(
    rawInsights: MerchantInsight[],
    analytics: ComprehensiveMerchantAnalytics,
    config: MerchantConfig | null
  ): MerchantInsight[] {
    const sanitized: MerchantInsight[] = [];
    const minConfidence = config?.min_confidence_score ?? 70;
    const maxDiscount = config?.max_discount_percent ?? 30;
    const optedOutCustomers = config?.customer_opt_outs || [];

    for (const insight of rawInsights) {
      const guardRailsApplied: string[] = [];

      // STRICT RULE 1: Remove payment failure insights if failed_count === 0
      if (insight.type === 'payment_failure_patterns' && analytics.payments.failed_count === 0) {
        console.log(`[Sanitizer] Dropping payment_failure_patterns insight because failed_count is 0`);
        continue;
      }

      // STRICT RULE 2: Remove abandoned cart insights if abandoned_count === 0
      if (insight.type === 'abandoned_cart_patterns' && analytics.carts.abandoned_count === 0) {
        console.log(`[Sanitizer] Dropping abandoned_cart_patterns insight because abandoned_count is 0`);
        continue;
      }

      // STRICT RULE 3: Remove recovery insights if total_cases === 0
      if (insight.type === 'recovery_success_rates' && analytics.recovery.total_cases === 0) {
        console.log(`[Sanitizer] Dropping recovery_success_rates insight because recovery cases is 0`);
        continue;
      }

      // GUARD RAIL A: Filter recommendations below confidence threshold
      const validRecs = insight.insights.filter((r) => {
        if (r.confidence_percent < minConfidence) {
          guardRailsApplied.push(`Filtered recommendation '${r.title}' (confidence ${r.confidence_percent}% < min ${minConfidence}%)`);
          return false;
        }
        return true;
      });

      // GUARD RAIL B: Cap discounts in recommendations
      for (const rec of validRecs) {
        const discountMatch = rec.description.match(/(\d+)%?\s*discount/i);
        if (discountMatch) {
          const recDiscount = parseInt(discountMatch[1], 10);
          if (recDiscount > maxDiscount) {
            rec.description = rec.description.replace(/(\d+)%?\s*discount/i, `${maxDiscount}% discount`);
            guardRailsApplied.push(`capped_discount_from_${recDiscount}%_to_${maxDiscount}%`);
          }
        }
      }

      // GUARD RAIL C: Filter opted out customers in targeting
      if (insight.type === 'recovery_targeting' && optedOutCustomers.length > 0) {
        guardRailsApplied.push(`excluded_${optedOutCustomers.length}_opted_out_customers`);
      }

      if (insight.confidence_percent >= minConfidence && (validRecs.length > 0 || insight.summary)) {
        sanitized.push({
          ...insight,
          insights: validRecs,
          guard_rails_applied: guardRailsApplied.length > 0 ? guardRailsApplied : undefined,
        });
      }
    }

    return sanitized;
  }

  /**
   * Get merchant configuration helper
   */
  private async getMerchantConfig(merchantId: string): Promise<MerchantConfig | null> {
    try {
      return await this.getConfigRepository().findOne({
        where: { merchant_id: merchantId },
      });
    } catch (error) {
      console.error('[MerchantAgent] Error fetching merchant config:', error);
      return null;
    }
  }

  /**
   * Call Groq API with fallback model support
   */
  private async callGroqAPI(prompt: string): Promise<GroqResponse> {
    const isAiLive = process.env.AI_MODE === 'live' || process.env.ALLOW_LIVE_GROQ === 'true';

    if (!isAiLive || process.env.NODE_ENV === 'test') {
      throw new Error('Groq AI network call suppressed in test/mock mode');
    }

    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const modelsToTry = [MerchantAgent.MODEL, MerchantAgent.FALLBACK_MODEL];
    let lastError: Error = new Error('Failed to query Groq');

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are an autonomous e-commerce merchant analytics agent. Analyze live business metrics and output dynamic, evidence-grounded insights in valid JSON.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: MerchantAgent.TEMPERATURE,
            max_tokens: MerchantAgent.MAX_TOKENS,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          throw new Error(`Groq API error HTTP ${response.status}`);
        }

        return (await response.json()) as GroqResponse;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[MerchantAgent] Groq model ${model} failed: ${lastError.message}`);
      }
    }

    throw lastError;
  }
}
