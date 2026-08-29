# Development Milestones

## M1 — Foundation
**Objective:** Set up monorepo, database, basic backend structure, and seeds.

**Deliverables:**
- Monorepo setup (yarn/npm workspaces)
- TypeORM + PostgreSQL configured
- Database migrations infrastructure
- Express server with basic middleware (logging, error handling, auth)
- Customer model + migrations
- Product model + migrations
- Inventory model + migrations
- Seed script for products + inventory
- Environment validation
- Health check endpoint (`GET /health`)
- Application is runnable and connects to database

**Definition of Done:**
- `npm run dev` starts backend
- Database is seeded with test products
- Health check returns 200

---

## M2 — Product Catalog & Cart
**Objective:** Implement product browsing and shopping cart with abandonment tracking.

**Deliverables:**cha
- Cart model + migrations
- CartItem model + migrations
- Product listing API (`GET /api/products` with pagination)
- Product detail API (`GET /api/products/:id`)
- Cart CRUD APIs
- Cart item add/remove endpoints
- Cart abandonment detection (status: active → abandoned after X hours)
- Inventory checks on cart add (sufficient stock)
- Frontend: ProductBrowser component
- Frontend: ProductDetail component
- Frontend: Cart component
- Seed script: demo carts (some active, some abandoned)
- Tests: cart operations, inventory checks

**Definition of Done:**
- Can browse products
- Can add/remove items to cart
- Abandoned cart detection works
- Cart state persists to database

---

## M3 — Orders & Razorpay Payment
**Objective:** Implement order creation and payment flow with real Razorpay Test Mode.

**Deliverables:**
- Order model + migrations
- OrderItem model + migrations
- PaymentAttempt model + migrations
- Payment model + migrations
- Order creation from cart (converts cart, creates order + order items)
- Order number generation (unique)
- Razorpay SDK configured
- Payment creation API (`POST /api/payments/create-order`)
- Razorpay order ID stored in PaymentAttempt
- Payment verification API (`POST /api/payments/verify`)
- Webhook endpoint (`POST /api/webhooks/razorpay`)
- Webhook signature verification
- Payment status update workflow (Razorpay webhook → Payment record)
- Idempotency: duplicate webhooks ignored
- Frontend: Checkout component
- Frontend: PaymentStatus component
- Frontend: Payment callback page
- Seed script: demo orders (some successful, some pending)
- Tests: order creation, payment verification, webhook idempotency, state transitions

**Definition of Done:**
- Can create order from cart
- Can initiate Razorpay payment
- Webhook updates payment status
- Duplicate webhooks ignored
- Payment success/failure reflected in database

---

## M4 — AI Recommendations
**Objective:** Add AI-powered recommendations and tracking.

**Deliverables:**
- Recommendation model + migrations
- RecommendationEvent model + migrations
- Claude API client configured
- Product page recommendations (Claude analyzes product, suggests related items)
- Cart cross-sell recommendations (Claude analyzes cart, suggests bundles)
- Bundle detection (Claude identifies product combinations)
- Recommendation API (`GET /api/products/:id/recommendations`)
- Cart recommendations API (`GET /api/carts/:id/recommendations`)
- Recommendation shown event tracked
- Recommendation clicked event tracked
- Recommendation added-to-cart event tracked
- Recommendation purchased event tracked
- Frontend: Recommendation UI (product page)
- Frontend: Bundle recommendation UI (cart)
- Tests: recommendation tracking, event attribution

**Definition of Done:**
- AI recommendations appear on product page
- AI bundle recommendations appear in cart
- All recommendation events logged
- Can calculate: shown count, click rate, conversion rate

---

## M5 — Payment Failure & Recovery Engine
**Objective:** Implement automatic payment failure detection and AI-driven recovery initiation.

**Deliverables:**
- PaymentFailure model + migrations
- RecoveryCase model + migrations
- RecoveryAction model + migrations
- MerchantConfig model + defaults
- Payment failure detection (webhook or polling)
- AI diagnosis via Claude (calls Claude with payment context)
- RecoveryCase creation (status: open)
- RecoveryAgent core logic (decision loop)
- AgentGuardRails enforcement (max retries, max discount %, allowed channels, customer opt-out)
- AgentDecision logging (decision + explanation + context + outcome)
- AuditLog model + migrations
- First recovery action: create RecoveryAction (decision logged)
- Guard rail tests: retry limits, discount limits, opt-out enforcement
- Demo simulator: `?demo=failure_network` for deterministic failure injection
- PaymentSimulator utility
- Tests: recovery case creation, guard rail enforcement, action logging

**Definition of Done:**
- Payment failure detected automatically
- RecoveryCase created
- RecoveryAgent makes decision
- Decision logged with explanation
- Guard rails enforced (can't exceed limits)
- Demo mode produces deterministic failures

---

## M6 — Customer Interactions & Promise-to-Pay
**Objective:** Implement multi-channel customer communication and promise-to-pay workflow.

**Deliverables:**
- CustomerInteraction model + migrations
- PromiseToPay model + migrations
- Recovery action: send_email (stub or real Email Service)
- Recovery action: send_whatsapp (stub or real WhatsApp API)
- Recovery action: schedule_followup (cron-based)
- Recovery action: create_promise_to_pay (create PromiseToPay record)
- Recovery action: escalate_to_merchant (stop agent, log for merchant review)
- Customer interaction API (`POST /api/recovery/respond`)
- Customer intent classification via Claude (accepted|refused|promised|unclear)
- Response handling: update RecoveryCase status
- Promise deadline tracking (max 30 days, configurable)
- Scheduler: Promise-to-pay follow-up job (check deadline approaching)
- Scheduler: Promise deadline check (fulfilled|missed)
- Frontend: RecoveryPrompt component (accept|refuse|promise)
- Tests: promise-to-pay tracking, deadline follow-up, fulfillment verification, customer opt-out

**Definition of Done:**
- Customer receives recovery notification
- Customer can respond (email, in-app, WhatsApp)
- Promise-to-pay creates deadline
- Scheduler triggers follow-up on deadline
- Recovery case closes with outcome (successful|refused|escalated)

---

## M7 — Merchant Dashboard
**Objective:** Implement merchant analytics UI displaying transactional data and recovery funnel.

**Deliverables:**
- AnalyticsService: queries on transactional tables (not separate aggregate table)
- Merchant dashboard home (`GET /api/merchant/dashboard`)
- Metrics: total revenue, revenue at risk, revenue recovered
- Metrics: failed payments count, abandoned carts count
- Metrics: recovery rate (recovered / failed)
- Recovery case list API (`GET /api/merchant/recovery-cases`)
- Recovery case detail API (`GET /api/merchant/recovery-cases/:id`)
- Recovery funnel data (how many cases moved through stages)
- Customer responses breakdown (accepted|refused|promised|unclear)
- Payment failure reasons breakdown
- Revenue timeline (daily revenue, at-risk, recovered)
- Frontend: MerchantDashboard component
- Frontend: RecoveryFunnel component
- Frontend: RevenueMetrics component
- Frontend: CustomerResponseBreakdown
- Tests: analytics queries, metric calculations

**Definition of Done:**
- Merchant can view recovery funnel
- Merchant can see customer responses
- Merchant can see revenue impact
- Merchant can drill into individual recovery cases

---

## M8 — Merchant Intelligence
**Objective:** Implement AI-driven merchant insights and recommendations.

**Deliverables:**
- MerchantAgent core logic
- Daily insights job (cron-based)
- Claude analysis: failed payment patterns (when, why, which products)
- Claude analysis: abandoned cart patterns (product affinity, price points)
- Claude analysis: recovery success rates (which actions work)
- Claude recommendations: bundle products (complementary items)
- Claude recommendations: discount strategy (max discount while preserving margin)
- Claude recommendations: inventory optimization (slow-moving products)
- Claude recommendations: recovery campaign targeting (high-risk segments)
- MerchantInsight storage (or query-time results)
- Merchant insights API (`GET /api/merchant/insights`)
- MerchantConfig model fully featured (all guard rails)
- Merchant config update API (`PUT /api/merchant/config`)
- Frontend: InsightsFeed component
- Frontend: MerchantConfig UI
- Tests: agent decision-making, merchant insight generation

**Definition of Done:**
- Merchant sees daily insights
- Merchant can update guard rails
- Agent respects merchant config
- Insights are actionable (specific, data-backed)

---

## M9 — Deployment
**Objective:** Package application for production cloud deployment.

**Deliverables:**
- Dockerfile.backend
- Dockerfile.frontend
- docker-compose.yml (local dev with PostgreSQL)
- Environment validation for cloud (no localhost)
- Database migration automation (on startup)
- Health check endpoints
- Logging structured (JSON)
- Error handling comprehensive (no 500 leaks)
- Razorpay webhook secret security (environment variable)
- Claude API key security (environment variable)
- Database connection pooling
- Deployment documentation
- Cloud deployment template (AWS/GCP/Render — choose one)

**Definition of Done:**
- Can run `docker-compose up`
- Backend accessible at `http://localhost:3000`
- Frontend accessible at `http://localhost:5173`
- Database migrations run automatically
- All config comes from `.env`

---

## M10 — Demo Polish & Testing
**Objective:** Finalize application for hackathon demo and comprehensive testing.

**Deliverables:**
- End-to-end demo script (customer journey documented)
- Demo scenario: browse → recommend → cart → bundle → checkout → payment fail → recovery → promise
- Demo scenario: merchant views recovery funnel → understands revenue impact
- Unit tests (critical business logic): 80%+ coverage
- Integration tests: payment flow, recovery workflow, webhooks
- Test fixtures and seeding
- Error handling: all error paths tested
- Validation: all inputs validated
- Demo mode documentation
- Audit log export feature (for compliance review)
- Performance baseline (response times logged)
- Demo data refresh script

**Definition of Done:**
- Can run demo start-to-finish without manual intervention
- All critical paths tested
- All error codes handled gracefully
- Demo is repeatable and reliable

---

## Cross-Cutting Requirements

**Every milestone must:**
1. Leave the application runnable (no broken main branch)
2. Include database migrations
3. Include at least basic tests for critical logic
4. Update seed data if needed
5. Document API changes in code comments
6. Handle errors gracefully (no 500 leaks)

**Audit trail mandatory from M5 onward:**
- Every recovery decision logged
- Every customer response logged
- Every action outcome logged
- Audit logs immutable (append-only)

**Security from M3 onward:**
- Webhook signature verification
- No secrets in logs
- JWT validation if required
- Input validation on all endpoints

**Testing targets:**
- M3: payment flow tested (happy path + failure)
- M5: guard rails tested (cannot exceed limits)
- M6: promise-to-pay tested (deadline + follow-up)
- M10: 80%+ coverage for critical business logic

---

## Success Criteria for Final Demo

**Customer Side:**
- [x] Browse products (M2)
- [x] See AI recommendations (M4)
- [x] Add to cart (M2)
- [x] See bundle recommendations (M4)
- [x] Checkout with Razorpay (M3)
- [x] Experience payment failure (M3 + demo mode)
- [x] Receive recovery contact (M6)
- [x] Respond to recovery (M6)
- [x] Make promise or refuse (M6)
- [x] See recovery outcome (M6)

**Merchant Side:**
- [x] View recovery funnel (M7)
- [x] See failed payments (M7)
- [x] See customer responses (M7)
- [x] Understand revenue impact (M7)
- [x] See AI insights (M8)
- [x] Review audit trail (M10)

**Technical Requirements:**
- [x] Full audit trail (M5+)
- [x] Razorpay Test Mode (M3)
- [x] No hardcoded business rules (M8)
- [x] Guard rails enforced (M5)
- [x] Deterministic demo (M5)
- [x] Production deployment ready (M9)
- [x] Tests passing (M10)
