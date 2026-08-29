  # M8 Merchant Intelligence — Codebase Audit Report

**Date:** August 27, 2026  
**Status:** ✅ AUDIT COMPLETE — Implementation Plan Ready  
**Scope:** Complete codebase analysis across PHASE 0.1–0.8

---

## Executive Summary

All M1–M7 infrastructure is production-ready and architecturally sound for M8 integration. **No breaking changes required.** M8 can be implemented as a layer on top of existing services using established patterns.

### Key Findings

✅ **Data Available:** AnalyticsService provides comprehensive transactional queries for failed payments, abandoned carts, recovery performance, products, and inventory.

✅ **AI Integration Established:** RecommendationService demonstrates proven Groq API pattern (deterministic prompts → JSON → validation → DB storage).

✅ **Guard Rails Partial:** MerchantConfig has 10 fields covering max_recovery_attempts, max_discount_percent, allowed_channels, customer_opt_outs. M8 extends this only where necessary.

✅ **Scheduler Ready:** SchedulerService uses node-cron with proven pattern. Can add daily MerchantAgent job without modifying existing jobs.

✅ **Auth Pattern Consistent:** All merchant routes can use requireMerchant() middleware. No auth changes needed.

✅ **Frontend Ready:** MerchantDashboard component structure supports new InsightsFeed and ConfigUI sections.

✅ **Tests Established:** 181 tests passing with clear Jest + TypeORM patterns. M8 follows same structure.

---

## PHASE 0.1 — AnalyticsService & Transactional Data

### Existing Methods

```
✓ getDashboardMetrics()          — total revenue, at-risk, recovered, failure counts, recovery rate
✓ getRecoveryFunnel()            — status breakdown (open|in_progress|resolved|abandoned|customer_declined)
✓ getCustomerResponseBreakdown() — intent breakdown (accepted|refused|promised|unclear)
✓ getPaymentFailureReasons()     — reasons with count, amount, recovery rate
✓ getRevenueTimeline()           — daily data (revenue, orders, failures, recovered)
```

### Transactional Tables Available for M8

| Table | Key Fields | Usage in M8 |
|---|---|---|
| `orders` | id, total_cents, status, created_at, items | Revenue analysis, product analysis |
| `payments` | id, amount_cents, status, razorpay_payment_id | Recovery analysis |
| `payment_failures` | id, reason, failure_count, error_message, error_context | Failure pattern analysis |
| `recovery_cases` | id, status, recovery_attempts, created_at | Recovery performance |
| `customer_interactions` | id, intent, created_at | Customer response patterns |
| `promise_to_pay` | id, promised_deadline, customer_id | Promise fulfillment tracking |
| `carts` | id, items, subtotal_cents, status | Abandoned cart analysis |
| `cart_items` | product_id, quantity, line_total_cents | Product abandonment patterns |
| `products` | id, name, price_cents, category, inventory | Product bundle, discount recommendations |
| `inventory` | product_id, quantity_available | Inventory optimization |
| `recommendations` | recommendation_type, recommended_products, metadata | Product affinity data |

### M8 Analytics Reuse

- **Failed Payment Patterns:** Query PaymentFailure + RecoveryCase + Order
- **Abandoned Cart Patterns:** Query Cart + CartItem + Product  
- **Recovery Success:** Query RecoveryCase + RecoveryAction + CustomerInteraction
- **Product Bundles:** Query Order + OrderItem frequency
- **Inventory:** Query Inventory + Order patterns
- **Customer Segments:** Query RecoveryCase + Customer + CustomerInteraction

**No new analytics tables required.** Reuse AnalyticsService queries as building blocks.

---

## PHASE 0.2 — Claude Integration Pattern

### Existing Implementation (RecommendationService)

```typescript
// Pattern 1: Deterministic Prompt Construction
private buildProductRecommendationPrompt(product, catalog, limit): string
  → Catalog data is serialized deterministically
  → Same data always produces same prompt

// Pattern 2: Groq API Call
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  model: 'llama3-70b-8192',
  temperature: 0.3,           // Deterministic
  max_tokens: 1000,
  response_format: { type: 'json_object' }
})

// Pattern 3: JSON Response Validation
const parsed = JSON.parse(response.choices[0].message.content)
// Validate: product_id exists, score 0-1, reason present

// Pattern 4: Safe Storage & Fallback
// If JSON invalid → use deterministic fallback
// If API fails → throw error (gracefully handled upstream)
```

### Claude Configuration

- **API Key:** `env.GROQ_API_KEY` (server-side only)
- **Model:** `llama3-70b-8192` (consistent with M4/M5)
- **Temperature:** 0.3 (deterministic, not random)
- **Max Tokens:** 1000 (reasonable for merchant insights)
- **Response Format:** `{ type: 'json_object' }` (structured output)

### M8 Reuse

M8 MerchantAgent will use identical pattern:
1. Gather merchant transactional data via AnalyticsService
2. Build deterministic prompt with data context
3. Call Groq API with same temperature/format
4. Parse JSON response, validate against schema
5. Enforce guard rails in application code (not AI prompt)
6. Store insights in MerchantInsight table

---

## PHASE 0.3 — MerchantConfig & Guard Rails

### Existing Fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `max_recovery_attempts` | int | 3 | Max times to attempt recovery |
| `max_discount_percent` | int | 30 | Max discount merchant can offer |
| `allowed_channels` | array | ["email","sms"] | Contact channels for recovery |
| `allow_partial_refund` | bool | false | Allow partial refund recovery action |
| `max_refund_percent` | int | 50 | Max refund as % of order value |
| `customer_opt_outs` | array | [] | Customer IDs opted out of recovery |
| `auto_retry_enabled` | bool | true | Auto-retry failed payments |
| `retry_delay_hours` | int | 24 | Hours between retry attempts |
| `ai_diagnosis_enabled` | bool | true | Enable AI diagnosis (M6) |
| `max_promise_days` | int | 30 | Max days for promise-to-pay |

### M8 Additions

M8 will ADD these fields (not modify existing):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `ai_insights_enabled` | bool | true | Enable M8 daily merchant insights |
| `bundle_recommendations_enabled` | bool | true | Allow AI bundle recommendations |
| `discount_strategy_enabled` | bool | true | Allow AI discount suggestions |
| `inventory_opt_enabled` | bool | true | Allow AI inventory insights |
| `recovery_targeting_enabled` | bool | true | Allow AI recovery targeting |
| `min_confidence_score` | int | 70 | Min confidence % for recommendations (0-100) |

### Guard Rail Enforcement (Critical)

**All M8 recommendations must be validated in application code:**

```typescript
// Example: Discount recommendation must respect max_discount_percent
if (aiRecommendation.discount_percent > config.max_discount_percent) {
  aiRecommendation.discount_percent = config.max_discount_percent;  // Clamp
  aiRecommendation.guard_rail_applied = true;
}

// Example: Must not target opted-out customers
const canTarget = !config.customer_opt_outs.includes(customerId);
if (!canTarget) {
  // Exclude from targeting
  targetedSegment = targetedSegment.filter(c => c.id !== customerId);
}

// Example: Only suggest allowed channels
aiRecommendation.channels = aiRecommendation.channels.filter(
  ch => config.allowed_channels.includes(ch)
);
```

---

## PHASE 0.4 — Models: RecoveryCase, PaymentFailure, AgentDecision

### RecoveryCase

```typescript
@Entity('recovery_cases')
export class RecoveryCase {
  id: uuid                    // Primary key
  payment_failure_id: uuid    // FK to PaymentFailure
  order_id: uuid              // FK to Order
  customer_id: uuid           // FK to Customer
  status: 'open' | 'in_progress' | 'resolved' | 'abandoned' | 'customer_declined'
  recovery_attempts: int      // Current attempt count
  max_recovery_attempts: int  // From MerchantConfig
  recovery_notes?: string     // Human-readable notes
  created_at: timestamp
  updated_at: timestamp
  resolved_at?: timestamp
  recovery_actions?: RecoveryAction[]   // Cascade
  agent_decisions?: AgentDecision[]     // Cascade
}
```

**M8 Use:** Query for status distribution, attempt patterns, outcome analysis.

### PaymentFailure

```typescript
@Entity('payment_failures')
export class PaymentFailure {
  id: uuid
  payment_id: uuid            // FK to Payment
  reason: 'insufficient_funds' | 'card_declined' | 'expired_card' | 
          'network_error' | 'gateway_error' | 'timeout' | 
          'authentication_failed' | 'unknown'
  error_message?: string
  error_context?: JSONB       // { code?, message?, gateway_response?, ... }
  failure_count: int          // Number of times this reason occurred
  last_failure_at?: timestamp
  detected_at: timestamp
  recovery_cases?: RecoveryCase[]  // Cascade
}
```

**M8 Use:** Analyze failure reasons, identify patterns, determine recovery approach.

### AgentDecision

```typescript
@Entity('agent_decisions')
export class AgentDecision {
  id: uuid
  recovery_case_id: uuid
  decision: 'retry_payment' | 'offer_discount' | 'escalate' | 'abandon' | 'contact_customer'
  explanation: string         // Why this decision was made
  confidence_score?: numeric  // 0-100
  context?: JSONB             // { failure_reason, customer_history, order_details, ai_analysis, ... }
  parameters?: JSONB          // { discount_percent?, retry_count?, ... }
  guard_rails_enforced: bool
  guard_rail_violations?: string  // If any rules were violated
  made_at: timestamp
}
```

**M8 Use:** Store AI-generated insights as AgentDecision records with guard rail enforcement flag.

---

## PHASE 0.5 — SchedulerService & Cron Infrastructure

### Existing Jobs

```typescript
class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask>
  
  async start()               // Called on server startup
  async stop()                // Called on server shutdown
  
  private schedulePromiseFollowUpJob()      // 0 * * * * (hourly)
  private schedulePromiseDeadlineCheckJob() // 0 */6 * * * (6-hourly)
  
  isRunning(): boolean
  getRunningJobs(): string[]
}
```

### M8 Daily Job Pattern

M8 will add a new job following existing pattern:

```typescript
private scheduleDaily MerchantInsightJob(): void {
  const jobName = 'daily_merchant_insights_job';
  
  // Every day at 2 AM (or configurable)
  const task = cron.schedule('0 2 * * *', async () => {
    try {
      console.log(`[SchedulerService] Running ${jobName}...`);
      
      // Gather data
      const data = await this.gatherMerchantData();
      
      // Run MerchantAgent
      const insights = await merchantAgent.generateInsights(data);
      
      // Store insights
      await this.persistInsights(insights);
      
      // Log audit event
      await auditLog.save({
        event_type: 'insights_generated',
        entity_id: merchantId,
        details: { insight_count: insights.length }
      });
    } catch (error) {
      console.error(`Error in ${jobName}:`, error);
      // Never crash scheduler if AI fails
      // Log failure, continue
    }
  });
  
  this.jobs.set(jobName, task);
}
```

### Key Properties

- **Non-blocking:** If Claude fails, log error but don't crash scheduler
- **Idempotent:** Can be safely triggered twice (checks for existing insights)
- **Audited:** Each run logged to AuditLog table
- **Integrated:** Uses existing SchedulerService infrastructure

---

## PHASE 0.6 — Authentication & Authorization

### Merchant Route Protection

Current merchant routes use implicit merchant isolation (hardcoded 'default-merchant'). M8 routes must:

```typescript
// In merchant routes, add requireMerchant middleware
router.get('/insights', 
  authenticate,           // Verify JWT token
  requireMerchant,       // Verify role === 'merchant'
  async (req, res) => {
    const merchantId = 'default-merchant';  // Still hardcoded for demo
    // Fetch insights for this merchant only
  }
);

router.put('/config',
  authenticate,
  requireMerchant,
  async (req, res) => {
    // Update only this merchant's config
  }
);
```

### JWT Payload

```typescript
interface JWTPayload {
  id: string          // User ID
  email: string
  role: 'customer' | 'merchant'  // Role-based access
  iat: number         // Issued at
  exp: number         // Expires at
}
```

**No auth changes needed for M8.** Existing middleware is sufficient.

---

## PHASE 0.7 — MerchantDashboard Frontend

### Current Structure

```
MerchantDashboard (container)
  ├── Date range selector (start_date, end_date)
  ├── View state management (dashboard | recovery-cases | recovery-case-detail)
  │
  ├── [dashboard view]
  │   ├── RevenueMetrics (6 cards: total, at-risk, recovered, failed, abandoned, rate)
  │   ├── RecoveryFunnel (status breakdown)
  │   ├── CustomerResponseBreakdown (intent %)
  │   ├── PaymentFailureReasons (reasons table)
  │   ├── RevenueTimeline (daily table)
  │   └── "View Recovery Cases" button
  │
  ├── [recovery-cases view]
  │   ├── RecoveryCasesList (filtered list + pagination)
  │   └── View button → recovery-case-detail
  │
  └── [recovery-case-detail view]
      └── RecoveryCaseDetail (full case info)
```

### M8 Frontend Additions

M8 will add two new sections to the dashboard view:

```
├── [dashboard view]
│   ├── ... existing sections ...
│   ├── NEW: InsightsFeed (daily AI insights)
│   │   ├── Loading/error/empty states
│   │   ├── Insight cards (type | title | summary | details | date)
│   │   └── Refresh button
│   │
│   ├── NEW: MerchantConfigUI (guard rail settings)
│   │   ├── Form inputs for each config field
│   │   ├── Validation/range display
│   │   ├── Save button with success/error feedback
│   │   └── Current values display
│   │
│   └── "View Recovery Cases" button
```

---

## PHASE 0.8 — Test Infrastructure & Patterns

### Test Pattern (Jest + TypeORM)

```typescript
describe('SomethingService', () => {
  let service: SomethingService;
  let dataSource: DataSource;
  
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    dataSource = AppDataSource;
    service = new SomethingService(dataSource);
  });
  
  afterAll(async () => {
    // Don't destroy AppDataSource - shared across tests
  });
  
  beforeEach(async () => {
    // Create test data
    const testEntity = repo.create({ /* data */ });
    await repo.save(testEntity);
  });
  
  afterEach(async () => {
    // Clean up test data
    await repo.delete({ /* criteria */ });
  });
  
  test('should do something', async () => {
    const result = await service.doSomething();
    expect(result).toBeDefined();
  });
});
```

### Test Suite Stats

- **Total:** 181 tests across 14 test suites
- **All passing:** ✅ 181/181
- **Coverage Areas:** AnalyticsService, OrderService, RecoveryAgentService, PaymentService, RecommendationService, CartService, ProductService, Config, Webhooks, Routes
- **Database:** Uses test database (configured in .env.test)
- **Pattern:** Established and proven

---

## M8 Architecture Summary

### What Already Exists (DO NOT CHANGE)

✅ AnalyticsService (5 query methods)  
✅ RecommendationService (Claude integration pattern)  
✅ MerchantConfig (10 guard rail fields)  
✅ RecoveryCase, PaymentFailure, AgentDecision models  
✅ SchedulerService (node-cron infrastructure)  
✅ Auth middleware (JWT + role-based)  
✅ MerchantDashboard (React component)  
✅ Test infrastructure (Jest + TypeORM)

### What M8 Must Create

**Backend:**
1. MerchantAgent service (core logic)
2. MerchantInsight model + migration
3. Extend MerchantConfig (6 new fields)
4. Extend SchedulerService (add daily job)
5. 3 new API endpoints: GET /insights, PUT /config, POST /config/validate
6. M8-specific tests

**Frontend:**
1. InsightsFeed component
2. MerchantConfigUI component
3. Integration with MerchantDashboard

### What M8 Must NOT Do

❌ Rewrite AnalyticsService  
❌ Replace RecommendationService/Claude integration  
❌ Create duplicate MerchantConfig  
❌ Create second scheduler  
❌ Add M9/M10 features  
❌ Add unnecessary dependencies  
❌ Modify M1–M7 models/routes/tests unnecessarily

---

## M8 Implementation Roadmap

| Phase | Tasks | Depends On | Est. Complexity |
|---|---|---|---|
| PHASE 1 | MerchantAgent (data gathering, Claude analysis, validation) | Audit complete | Medium |
| PHASE 2 | Claude analyses (failed payments, abandoned carts, recovery success) | PHASE 1 | Medium |
| PHASE 3 | AI recommendations (bundles, discounts, inventory, targeting) | PHASE 2 | High |
| PHASE 4 | MerchantInsight model + migration | None | Low |
| PHASE 5 | Extend SchedulerService (daily job) | PHASE 1 | Low |
| PHASE 6 | API endpoints (insights, config) | PHASE 4, PHASE 1 | Medium |
| PHASE 7 | Extend MerchantConfig (6 new fields) | None | Low |
| PHASE 8 | M8 tests (all components) | All previous | High |
| PHASE 9 | Frontend (InsightsFeed, ConfigUI) | PHASE 6 | Medium |
| PHASE 10 | Verification & regression testing | All previous | Medium |

---

## Critical Implementation Rules

### Guard Rail Enforcement (Non-Negotiable)

```typescript
// ❌ WRONG: Trust Claude to "respect" the rules
const recommendation = await claude.generate(prompt + "respect max_discount_percent");

// ✅ RIGHT: Validate in application code
const recommendation = await claude.generate(prompt);
if (recommendation.discount > config.max_discount_percent) {
  recommendation.discount = config.max_discount_percent;
  recommendation.enforced_guardrails = ['discount_capped'];
}
```

### AI Output Validation (Critical)

```typescript
// Always validate before storage/display
const insight = await merchantAgent.generate(data);

// Validate against schema
if (!isValidInsight(insight)) {
  throw new Error('Invalid insight structure');
}

// Validate product references
for (const product of insight.products) {
  const dbProduct = await productRepo.findOne(product.id);
  if (!dbProduct) {
    throw new Error(`Product ${product.id} not found`);
  }
}

// Validate customer opt-outs
for (const customer of insight.targets) {
  if (config.customer_opt_outs.includes(customer.id)) {
    throw new Error(`Customer ${customer.id} has opted out`);
  }
}
```

### No Duplicate Services

```typescript
// ❌ DON'T create a second Claude client
class MerchantClaudeClient { /* bad */ }

// ✅ DO use existing RecommendationService pattern
class MerchantAgent {
  private async callGroqAPI(prompt): Promise<GroqResponse> {
    // Same pattern as RecommendationService
  }
}
```

---

## Deliverables for M8 Implementation

### Backend Files

**New:**
- `MerchantAgent.ts` (core service)
- `MerchantInsight.ts` (model)
- `20250827-XXXXXX-CreateMerchantInsight.ts` (migration)
- `services/MerchantAgent.test.ts` (comprehensive tests)

**Modified:**
- `models/MerchantConfig.ts` (add 6 new fields)
- `migrations/*` (one new migration for MerchantConfig extension)
- `routes/merchant.ts` (add GET /insights, PUT /config endpoints)
- `services/SchedulerService.ts` (add daily job)
- `app.ts` (ensure merchant routes have auth middleware)

### Frontend Files

**New:**
- `components/analytics/InsightsFeed.tsx`
- `components/analytics/MerchantConfigUI.tsx`

**Modified:**
- `components/MerchantDashboard.tsx` (integrate new sections)

### Test Files

**New:**
- Multiple test files covering MerchantAgent, insights, config, scheduler

---

## Risk Assessment

| Risk | Probability | Severity | Mitigation |
|---|---|---|---|
| Claude API fails | Medium | Low | Graceful fallback, log error, continue scheduler |
| Guard rail bypass | Low | High | Validate all recommendations in app code, test enforcement |
| Data validation failure | Low | Medium | Schema validation before storage, comprehensive tests |
| Regression in M1–M7 | Low | High | Run full test suite, no changes to existing services |
| Performance degradation | Low | Medium | Reuse AnalyticsService queries, avoid N+1 queries |

---

## Success Criteria for M8

- ✅ All 181 existing tests still pass (no regressions)
- ✅ New M8 tests added (minimum 30 tests)
- ✅ Frontend builds with 0 TypeScript errors
- ✅ Backend builds with 0 TypeScript errors
- ✅ MerchantAgent generates valid insights
- ✅ All guard rails enforced (no Claude bypasses)
- ✅ Daily scheduler job runs successfully
- ✅ GET /api/merchant/insights returns insights
- ✅ PUT /api/merchant/config updates configuration
- ✅ InsightsFeed and ConfigUI render correctly
- ✅ No secrets exposed (API keys in env only)
- ✅ Demo merchant (role='merchant') can view insights and update config

---

## Next Steps

1. **PHASE 1:** Implement MerchantAgent core logic
2. **PHASE 2:** Implement Claude analyses for failed payments, abandoned carts, recovery success
3. **PHASE 3:** Implement AI recommendations for bundles, discounts, inventory, recovery targeting
4. **PHASE 4:** Create MerchantInsight model and migration
5. **PHASE 5:** Extend SchedulerService with daily job
6. **PHASE 6:** Implement API endpoints
7. **PHASE 7:** Extend MerchantConfig guard rails
8. **PHASE 8:** Add comprehensive M8 tests
9. **PHASE 9:** Create frontend components
10. **PHASE 10:** Run full verification and regression testing

---

**Audit Complete. Ready for Implementation.**

Generated: August 27, 2026 | Session: M8 Codebase Audit | Status: ✅ Ready
