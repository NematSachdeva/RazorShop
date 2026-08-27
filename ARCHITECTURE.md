# AI Revenue Recovery & Growth Manager — Technical Architecture (Revised)

## Technology Stack

**Frontend:** React 18 + TypeScript + Vite + TailwindCSS
**Backend:** Node.js (Express) + TypeScript
**Database:** PostgreSQL (single source of truth for all transactional data)
**AI/LLM:** Claude API (via Anthropic SDK)
**Payment:** Razorpay Test Mode API
**Authentication:** JWT + session management
**Scheduler:** node-cron (in-process) + potential migration to external scheduler later
**Deployment:** Docker + Docker Compose (provider-agnostic, ready for cloud)

**Explicitly NOT included initially:** Redis, message queues, external job runners (keep extensible)

---

## Directory Structure

```
/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database.ts        (TypeORM + PostgreSQL)
│   │   │   │   ├── razorpay.ts        (Razorpay SDK config)
│   │   │   │   ├── llm.ts             (Claude API config)
│   │   │   │   └── env.ts             (validated env vars)
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   ├── logging.ts
│   │   │   │   └── validation.ts
│   │   │   │
│   │   │   ├── models/                (TypeORM entities)
│   │   │   │   ├── Customer.ts
│   │   │   │   ├── Product.ts
│   │   │   │   ├── Inventory.ts
│   │   │   │   ├── Cart.ts
│   │   │   │   ├── CartItem.ts
│   │   │   │   ├── Order.ts
│   │   │   │   ├── OrderItem.ts
│   │   │   │   ├── PaymentAttempt.ts
│   │   │   │   ├── Payment.ts
│   │   │   │   ├── PaymentFailure.ts
│   │   │   │   ├── RecoveryCase.ts
│   │   │   │   ├── RecoveryAction.ts
│   │   │   │   ├── CustomerInteraction.ts
│   │   │   │   ├── PromiseToPay.ts
│   │   │   │   ├── Recommendation.ts
│   │   │   │   ├── RecommendationEvent.ts
│   │   │   │   ├── AuditLog.ts
│   │   │   │   └── MerchantConfig.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── ProductService.ts
│   │   │   │   ├── CartService.ts
│   │   │   │   ├── OrderService.ts
│   │   │   │   ├── InventoryService.ts
│   │   │   │   ├── PaymentService.ts
│   │   │   │   ├── RecommendationService.ts (calls Claude)
│   │   │   │   ├── RecoveryService.ts
│   │   │   │   ├── CustomerInteractionService.ts
│   │   │   │   ├── AuditService.ts
│   │   │   │   ├── MerchantConfigService.ts
│   │   │   │   └── AnalyticsService.ts (queries transactional tables)
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── RecoveryAgent.ts    (core recovery workflow)
│   │   │   │   ├── MerchantAgent.ts    (insights + recommendations)
│   │   │   │   ├── AgentTools.ts       (tool definitions)
│   │   │   │   ├── AgentGuardRails.ts  (enforcement of limits)
│   │   │   │   └── AgentDecision.ts    (decision logging)
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── products.ts
│   │   │   │   ├── carts.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── recovery.ts
│   │   │   │   ├── customer-interactions.ts
│   │   │   │   ├── recommendations.ts
│   │   │   │   ├── merchant.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   └── audit.ts
│   │   │   │
│   │   │   ├── webhooks/
│   │   │   │   ├── razorpay.ts         (payment status)
│   │   │   │   └── webhook-handler.ts
│   │   │   │
│   │   │   ├── jobs/
│   │   │   │   ├── PromiseToPayFollowUp.ts
│   │   │   │   ├── RecoveryRetry.ts
│   │   │   │   └── Scheduler.ts        (cron-based for now)
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── razorpay-helper.ts
│   │   │   │   ├── demo-simulator.ts   (deterministic failure injection)
│   │   │   │   └── validators.ts
│   │   │   │
│   │   │   ├── seeds/
│   │   │   │   ├── products.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── merchant-config.ts
│   │   │   │   └── demo-data.ts
│   │   │   │
│   │   │   ├── migrations/             (TypeORM)
│   │   │   ├── app.ts                  (Express setup)
│   │   │   └── index.ts                (server entry)
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── PaymentService.test.ts
│   │   │   │   ├── RecoveryService.test.ts
│   │   │   │   ├── OrderService.test.ts
│   │   │   │   ├── AgentGuardRails.test.ts
│   │   │   │   └── RecommendationService.test.ts
│   │   │   │
│   │   │   ├── integration/
│   │   │   │   ├── payment-flow.test.ts
│   │   │   │   ├── recovery-workflow.test.ts
│   │   │   │   ├── webhook-handling.test.ts
│   │   │   │   └── promise-to-pay.test.ts
│   │   │   │
│   │   │   └── fixtures/
│   │   │       ├── test-data.ts
│   │   │       └── mock-razorpay.ts
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── jest.config.js
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ProductBrowser.tsx
│   │   │   │   ├── ProductDetail.tsx
│   │   │   │   ├── Cart.tsx
│   │   │   │   ├── Checkout.tsx
│   │   │   │   ├── PaymentStatus.tsx
│   │   │   │   ├── RecoveryPrompt.tsx
│   │   │   │   ├── MerchantDashboard.tsx
│   │   │   │   └── Analytics/
│   │   │   │       ├── RecoveryFunnel.tsx
│   │   │   │       ├── RevenueMetrics.tsx
│   │   │   │       └── InsightsFeed.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useProduct.ts
│   │   │   │   ├── useCart.ts
│   │   │   │   ├── useOrder.ts
│   │   │   │   ├── useMerchant.ts
│   │   │   │   └── useAnalytics.ts
│   │   │   │
│   │   │   ├── api/
│   │   │   │   └── client.ts
│   │   │   │
│   │   │   ├── pages/
│   │   │   │   ├── CustomerShop.tsx
│   │   │   │   ├── PaymentCallback.tsx
│   │   │   │   └── MerchantDash.tsx
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   │
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── Customer.ts
│       │   │   ├── Product.ts
│       │   │   ├── Cart.ts
│       │   │   ├── Order.ts
│       │   │   ├── Payment.ts
│       │   │   ├── Recovery.ts
│       │   │   ├── Interaction.ts
│       │   │   ├── Recommendation.ts
│       │   │   ├── Merchant.ts
│       │   │   └── Api.ts
│       │   │
│       │   └── constants/
│       │       ├── limits.ts          (guard rail defaults)
│       │       ├── channels.ts        (interaction channels)
│       │       └── errors.ts
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
├── ARCHITECTURE.md
├── MILESTONES.md
└── package.json (root workspace)
```

---

## Database Schema (PostgreSQL)

### Core Commerce

```sql
-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  name VARCHAR,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  price_cents BIGINT NOT NULL,        -- in cents to avoid float issues
  category VARCHAR,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Inventory
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id),
  quantity_on_hand INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT now()
);

-- Carts (abandoned cart tracking separate from orders)
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status VARCHAR NOT NULL DEFAULT 'active', -- active|abandoned|converted
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  converted_to_order_id UUID  -- null until checkout
);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  price_cents BIGINT NOT NULL,       -- snapshot at time of add
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

-- Orders (independent of payments; exist before payment)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  cart_id UUID REFERENCES carts(id),  -- source cart reference
  order_number VARCHAR UNIQUE NOT NULL,
  subtotal_cents BIGINT NOT NULL,
  discount_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL,
  currency VARCHAR DEFAULT 'INR',
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending|confirmed|shipped|cancelled
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT total_check CHECK (total_cents = subtotal_cents - discount_cents)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  discount_cents BIGINT NOT NULL DEFAULT 0,
  final_price_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT final_price_check CHECK (final_price_cents = (unit_price_cents * quantity) - discount_cents)
);

-- Payments & Payment Attempts
CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  razorpay_order_id VARCHAR,  -- external identifier
  attempt_number INT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'initiated', -- initiated|authorized|captured|failed|refunded
  amount_cents BIGINT NOT NULL,
  currency VARCHAR DEFAULT 'INR',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(order_id, attempt_number)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id UUID NOT NULL UNIQUE REFERENCES payment_attempts(id),
  razorpay_payment_id VARCHAR UNIQUE,
  razorpay_signature VARCHAR,
  status VARCHAR NOT NULL, -- created|authorized|captured|failed|refunded
  amount_cents BIGINT NOT NULL,
  currency VARCHAR DEFAULT 'INR',
  failure_reason VARCHAR,  -- code from Razorpay or custom
  metadata JSONB,          -- arbitrary Razorpay metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Recovery & Interactions

```sql
-- Payment Failures (explicit failure tracking)
CREATE TABLE payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id),
  detected_at TIMESTAMP DEFAULT now(),
  failure_code VARCHAR,
  failure_message TEXT,
  ai_diagnosis TEXT,       -- concise AI explanation (not full chain-of-thought)
  is_retryable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Recovery Cases (top-level recovery workflow)
CREATE TABLE recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_failure_id UUID NOT NULL UNIQUE REFERENCES payment_failures(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status VARCHAR NOT NULL DEFAULT 'open', -- open|in_progress|resolved|escalated|refused|completed
  recovery_reason TEXT,
  customer_opted_out BOOLEAN DEFAULT false,
  opened_at TIMESTAMP DEFAULT now(),
  closed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now()
);

-- Recovery Actions (what the agent did)
CREATE TABLE recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_case_id UUID NOT NULL REFERENCES recovery_cases(id),
  action_type VARCHAR NOT NULL, -- retry_payment|send_email|send_whatsapp|schedule_followup|create_promise_to_pay|escalate_to_merchant
  decision VARCHAR NOT NULL,    -- concise description of what was decided
  explanation TEXT NOT NULL,   -- concise reasoning (e.g. "First attempt failed, retrying is allowed...")
  relevant_context JSONB,       -- compact contextual summary (e.g. {attempt_number: 1, is_customer_opted_out: false})
  parameters JSONB,             -- action-specific params
  outcome JSONB,                -- result of action
  executed_at TIMESTAMP DEFAULT now(),
  execution_time_ms INT,
  created_at TIMESTAMP DEFAULT now()
);

-- Customer Interactions (all communication channels)
CREATE TABLE customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_case_id UUID REFERENCES recovery_cases(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  channel VARCHAR NOT NULL, -- email|whatsapp|voice|in_app
  direction VARCHAR NOT NULL, -- outbound|inbound
  content_summary TEXT NOT NULL, -- not full message, just summary
  customer_intent VARCHAR, -- accepted|refused|promised|unclear|escalated|other
  provider_message_id VARCHAR, -- external identifier from email/WhatsApp service
  delivery_status VARCHAR DEFAULT 'pending', -- pending|sent|delivered|failed|read
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Promise-to-Pay (explicit tracking)
CREATE TABLE promise_to_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_case_id UUID NOT NULL UNIQUE REFERENCES recovery_cases(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  promised_deadline TIMESTAMP NOT NULL,
  promised_amount_cents BIGINT NOT NULL,
  promised_at TIMESTAMP DEFAULT now(),
  fulfilled_at TIMESTAMP,
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending|fulfilled|missed|cancelled
  follow_up_completed BOOLEAN DEFAULT false,
  outcome TEXT, -- e.g. "successful_payment" | "customer_refusal" | "missed_deadline"
  updated_at TIMESTAMP DEFAULT now()
);

-- Audit Log (immutable record of decisions)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR NOT NULL, -- recovery_case|recovery_action|promise_to_pay|customer_interaction
  entity_id UUID NOT NULL,
  action VARCHAR NOT NULL, -- created|updated|decision_made|outcome_recorded
  actor VARCHAR NOT NULL, -- agent|customer|merchant|system
  decision_summary TEXT,   -- what was decided
  explanation TEXT,        -- why it was decided
  context_snapshot JSONB,  -- relevant data at time of decision
  outcome_summary TEXT,    -- what happened
  created_at TIMESTAMP DEFAULT now(),
  INDEX(entity_type, entity_id),
  INDEX(created_at)
);
```

### Recommendations

```sql
-- Recommendations (what the AI recommends)
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  recommendation_type VARCHAR NOT NULL, -- product_page|cart_cross_sell|bundle|campaign
  context_type VARCHAR, -- product_page|cart|order
  context_id UUID, -- product_id|cart_id|order_id
  reasoning TEXT,
  price_shown_cents BIGINT,
  discount_shown_cents BIGINT DEFAULT 0,
  shown_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Recommendation Events (customer interactions with recommendations)
CREATE TABLE recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  event_type VARCHAR NOT NULL, -- shown|clicked|added_to_cart|purchased
  event_at TIMESTAMP DEFAULT now(),
  context JSONB,
  created_at TIMESTAMP DEFAULT now(),
  INDEX(recommendation_id, event_type),
  INDEX(created_at)
);

-- Metrics calculated from recommendation_events + order_items
-- (no separate table; query on demand or cache daily)
```

### Merchant Configuration & Administration

```sql
-- Merchant Config (guardrails + preferences)
CREATE TABLE merchant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE, -- for future multi-merchant
  max_payment_retries INT DEFAULT 3,
  max_recovery_attempts INT DEFAULT 5,
  max_discount_percentage NUMERIC(5, 2) DEFAULT 20.00,
  allowed_channels VARCHAR ARRAY DEFAULT ARRAY['email', 'in_app'],
  quiet_hours_start TIME,           -- nullable
  quiet_hours_end TIME,             -- nullable
  max_promise_to_pay_days INT DEFAULT 30,
  min_order_value_for_voice_cents BIGINT DEFAULT 10000, -- voice escalation threshold
  auto_escalate_after_attempts INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## API Structure

### Customer APIs

```
GET    /api/products              (list products, pagination)
GET    /api/products/:id          (detail + recommendations)
GET    /api/products/:id/recommendations

POST   /api/carts                 (create)
GET    /api/carts/:id             (retrieve with bundle recommendations)
POST   /api/carts/:id/items       (add item)
DELETE /api/carts/:id/items/:itemId (remove item)

POST   /api/orders                (create from cart)
GET    /api/orders/:id

POST   /api/payments/create-order (Razorpay order creation)
POST   /api/payments/verify       (signature verification)
GET    /api/payments/status/:orderId

POST   /api/recovery/respond      (customer response: accept|refuse|promise-to-pay)
GET    /api/recovery/status/:recoveryId

GET    /api/recommendations/history (for dashboard)
```

### Merchant APIs

```
GET    /api/merchant/dashboard    (aggregated metrics from transactional tables)
GET    /api/merchant/recovery-cases
GET    /api/merchant/recovery-cases/:id
GET    /api/merchant/analytics/revenue-timeline
GET    /api/merchant/analytics/recovery-funnel
GET    /api/merchant/insights     (AI-generated recommendations)
GET    /api/merchant/config
PUT    /api/merchant/config       (update guardrails)

GET    /api/audit-logs            (compliance audit trail)
```

### Webhooks

```
POST   /api/webhooks/razorpay     (payment status updates)
```

---

## Agent Architecture

### RecoveryAgent

**Flow:**
1. Detect payment failure (webhook or polling)
2. Create PaymentFailure record
3. Call Claude with: order details, payment context, merchant config
4. Claude diagnoses reason (stores in PaymentFailure.ai_diagnosis)
5. Claude selects action (from allowed set, respecting merchant config)
6. RecoveryAction record created with decision + explanation
7. Action executed via guarded tool
8. Await customer response (via interaction channel)
9. Parse customer intent via Claude
10. Evaluate: repeat or terminate based on rules
11. Record outcome in AuditLog

**Guardrails (enforced by backend):**
- Max retries: merchant_config.max_payment_retries
- Max recovery attempts: merchant_config.max_recovery_attempts
- Max discount: merchant_config.max_discount_percentage
- Allowed channels: merchant_config.allowed_channels
- Customer opt-out: stop immediately
- Promise deadline: max merchant_config.max_promise_to_pay_days
- Auto-escalate after: merchant_config.auto_escalate_after_attempts

### MerchantAgent

**Flow:**
1. Daily analysis of: failed payments, abandoned carts, recovery outcomes
2. Query transactional tables (payment_attempts, recovery_cases, order_items, etc.)
3. Call Claude with: data summary + merchant config
4. Claude generates insights: patterns, recommendations
5. Store recommendations as MerchantInsight records (or query result)
6. Merchant reviews dashboard and manually approves actions

---

## Decision & Explanation Storage

**DO NOT store:**
- Full LLM chain-of-thought
- Hidden reasoning chains
- Temperature/sampling params
- Model internal state

**DO store:**
```json
{
  "decision": "retry_payment",
  "action": "initiate_payment_attempt_2",
  "explanation": "Payment failed due to network timeout. Retry is allowed because: (1) this is attempt 1 of 3, (2) customer has not opted out, (3) less than 24 hours since failure.",
  "relevant_context": {
    "attempt_number": 1,
    "max_retries": 3,
    "customer_opted_out": false,
    "failure_reason": "network_timeout",
    "order_age_hours": 2
  },
  "outcome": {
    "status": "initiated",
    "new_attempt_id": "uuid",
    "timestamp": "2026-08-26T14:30:00Z"
  }
}
```

---

## Demo & Simulation

**PaymentSimulator** (opt-in for hackathon):
- Query parameter: `?demo=failure_network`
- Failure types: `network_error`, `insufficient_funds`, `invalid_card`, `timeout`
- Deterministic: same input → same failure
- Used only for demo; real Razorpay Test Mode by default

---

## Deployment Architecture

**Target Structure:**

```
┌──────────────────────────────────────────────────┐
│ Public Internet                                  │
│ ├─ Customer Frontend (HTTPS)                     │
│ ├─ Backend API (HTTPS)                           │
│ └─ Razorpay Webhook (HTTPS → /webhooks/razorpay) │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ Backend Service (Stateless)                      │
│ ├─ Express server                                │
│ ├─ Recovery Agent (in-process)                   │
│ ├─ Scheduler (node-cron, upgrade to Bull/SQS)    │
│ └─ Claude API client (backend-only)              │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ PostgreSQL Database                              │
│ ├─ Transactional tables (source of truth)        │
│ ├─ Audit trail (immutable)                       │
│ └─ Connection pooling                            │
└──────────────────────────────────────────────────┘
```

**No localhost, no local persistence, no browser secrets.**

**Future extensions (when needed):**
- Redis for caching / session store
- Bull/SQS for distributed job processing
- RabbitMQ for event streaming
- Separate scheduler service (Temporal, etc.)

---

## Milestones (Feature-Based)

**M1 — Foundation**
- Monorepo setup (packages/backend, packages/frontend, packages/shared)
- PostgreSQL + migrations
- TypeORM + seeding
- Express + basic middleware
- Customer + Product models
- Environment config

**M2 — Product Catalog & Cart**
- Product listing + detail
- Inventory management
- Cart CRUD
- Cart abandonment detection
- Seed products + inventory

**M3 — Orders & Razorpay Payment**
- Order creation from cart
- Payment attempt workflow
- Razorpay Test Mode integration
- Webhook handling (payment status updates)
- Payment verification
- Success/failure flows

**M4 — AI Recommendations**
- Recommendation model + events
- Product page recommendations (Claude)
- Cart cross-sell (Claude)
- Bundle detection (Claude)
- Recommendation tracking + metrics

**M5 — Payment Failure & Recovery Engine**
- PaymentFailure detection
- RecoveryCase creation
- RecoveryAgent initialization
- Diagnosis via Claude (deterministic retry logic)
- Guard rail enforcement (max retries, discounts, config)
- First recovery action: email/in-app notification
- Test: retry limits, customer opt-out

**M6 — Customer Interactions & Promise-to-Pay**
- CustomerInteraction model
- Multi-channel response (email, WhatsApp stub, in-app)
- Promise-to-pay workflow
- Deadline tracking
- Follow-up scheduling (cron-based)
- Customer intent classification (Claude)
- Test: promise deadline, follow-up, fulfillment

**M7 — Merchant Dashboard**
- Analytics queries on transactional data
- Recovery funnel visualization
- Recovery case management UI
- Revenue metrics (total, at-risk, recovered)
- Failed payment breakdown
- Customer response timeline
- Promise-to-pay tracker

**M8 — Merchant Intelligence**
- MerchantAgent insights
- Sales trend analysis
- Inventory recommendations
- Bundle recommendations
- Discount strategy
- Payment failure pattern analysis
- Recovery campaign recommendations
- Merchant config UI (guardrails)

**M9 — Deployment**
- Docker + Docker Compose
- Environment config for cloud
- Database migrations automation
- Health checks + monitoring hooks
- Razorpay webhook security
- Audit log export

**M10 — Demo Polish & Testing**
- End-to-end demo scenarios
- Automated tests (payment flow, recovery, limits, webhooks)
- Error handling + validation
- Performance tuning
- Demo script documentation

---

## Testing Strategy

**Unit Tests (critical paths):**
- PaymentService: state transitions, retry logic, verification
- RecoveryService: case creation, action selection, outcome tracking
- OrderService: order creation, inventory reservation
- AgentGuardRails: discount limits, retry limits, opt-out enforcement
- RecommendationService: event tracking, attribution

**Integration Tests:**
- Payment flow: order → attempt → webhook → success/failure
- Recovery workflow: failure → diagnosis → action → customer response → outcome
- Webhook handling: duplicate prevention, idempotency
- Promise-to-pay: deadline → follow-up → fulfillment verification

**Test Fixtures:**
- Mock Razorpay responses
- Test customer + order data
- Demo failure scenarios (deterministic)
- Audit log assertions

**Coverage target:** 80%+ for critical business logic

---

## Key Principles Enforced

1. **AI does not control money** — all payment/retry/discount logic in backend code
2. **AI provides reasoning** — stored concisely, not full chain-of-thought
3. **Every action is auditable** — decision + explanation + context + outcome logged
4. **Merchant controls boundaries** — guardrails in database, not hardcoded
5. **Database is source of truth** — metrics calculated from transactional data
6. **Extensible infrastructure** — no Redis/queues required initially, but designed to add them
7. **Deterministic demo** — payment simulator for reliable hackathon demo
8. **Production-ready structure** — no localhost, no browser secrets, cloud-agnostic deployment
