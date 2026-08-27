# M3 — Orders & Razorpay Payment: Implementation Plan

**Status:** Planning Phase (No Implementation)  
**Date:** August 26, 2026  
**Scope:** Orders, payments, Razorpay integration, webhook handling

---

## 1. Current Architecture Relevant to M3

### Existing Foundation (M1/M2)

**Database Layer**
- ORM: TypeORM with PostgreSQL
- Pattern: Migration-based schema versioning (timestamp prefix: 1703000000000, 1703000000001)
- Entities: Customer, Product, Inventory, Cart, CartItem
- Key pricing convention: All monetary values as `bigint` (integer paise/cents)
- Existing relationships:
  - Customer (1) ↔ (M) Cart
  - Cart (1) ↔ (M) CartItem
  - CartItem → Product, Inventory (via product_id)
- Cart.converted_to_order_id field already exists (prepared for M3)
- Inventory tracks: quantity_on_hand, reserved (for future deductions)

**Service Layer**
- Pattern: Dependency injection (services accept DataSource parameter)
- CartService demonstrates full CRUD and total calculation
- ProductService shows filtering, search, pagination patterns
- Error handling: Custom errors propagated to middleware

**API Layer**
- Framework: Express.js
- Middleware: requestLogger, errorHandler (with asyncHandler wrapper)
- Routes: /api/health, /api/products, /api/carts
- CORS: Configured with FRONTEND_URL from env
- Response pattern: JSON with error codes

**Frontend Layer**
- Framework: React + Vite
- State management: React hooks (useState, useEffect)
- API communication: getApiUrl() helper with query params
- Shared types: @razor/shared package (TypeScript DTOs)

**Test Infrastructure**
- Framework: Jest with ts-jest
- Execution: NODE_OPTIONS=--experimental-vm-modules
- Pattern: Services tested with TestDataSource injection
- Test database: Separate config (database.test.ts) avoids migrations

**Environment Configuration**
- Tool: dotenv with validation
- Pattern: Lazy getter via Proxy (getEnv() function)
- Already includes: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

---

## 2. Existing Files That Can Be Reused

### Models (as templates)
- **Cart.ts** → Reference for Order model (similar fields, relationships)
- **CartItem.ts** → Reference for OrderItem model (same pattern)
- **Customer.ts** → Already required for Order ownership
- **Product.ts** → Already required for order items (price snapshot)

### Services (extend/refactor)
- **CartService.ts** 
  - Dependency injection pattern established
  - Can add: `markCartConverted(cartId, orderId)` method
  - Cart-to-Order conversion logic needed
- **ProductService.ts** → Can query products for order restoration

### Database Configuration
- **database.ts** → Add Order, OrderItem, PaymentAttempt, Payment entities
- **database.test.ts** → Add same entities for test database

### Routes Framework
- **app.ts** → Use existing route registration pattern
- **errorHandler.ts** → Existing asyncHandler wrapper

### Frontend Infrastructure
- **App.tsx** → Reference for component structure, API calls
- **getApiUrl()** → Reuse for payment endpoints

### Test Setup
- **jest.config.js** → Already configured with VM modules
- **CartService.test.ts** → Reference for service test pattern

### Migrations Pattern
- **1703000000000-InitialSchema.ts** → Reference for structure
- **1703000000001-AddCartTables.ts** → Reference for naming convention

---

## 3. Files That Need to Be Created

### Models (4 files)
**src/models/Order.ts**
- Fields: id (uuid), customer_id (uuid FK), order_number (unique varchar), status (enum), subtotal_cents (bigint), tax_cents (bigint), total_cents (bigint), created_at, updated_at
- Relationships: ManyToOne(Customer), OneToMany(OrderItem, cascade), OneToOne(Payment optional)
- Status values: 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'

**src/models/OrderItem.ts**
- Fields: id (uuid), order_id (uuid FK), product_id (uuid FK), quantity (int), price_cents (bigint snapshot), line_total_cents (bigint), created_at
- Relationships: ManyToOne(Order cascade), ManyToOne(Product reference-only)
- Unique constraint: (order_id, product_id)

**src/models/PaymentAttempt.ts**
- Fields: id (uuid), order_id (uuid FK), razorpay_order_id (varchar), attempt_number (int default 1), created_at, updated_at
- Relationships: ManyToOne(Order)
- Prepared for M5 retry logic

**src/models/Payment.ts**
- Fields: id (uuid), order_id (uuid FK unique), razorpay_payment_id (varchar nullable), razorpay_signature (varchar nullable), status (enum), amount_cents (bigint), created_at, updated_at
- Relationships: OneToOne(Order)
- Status values: 'initiated', 'pending', 'captured', 'failed', 'refunded'

### Migrations (2-3 files)
**src/migrations/1703000000002-AddOrderTables.ts**
- Create orders table with customer_id FK, order_number unique index, status index
- Create order_items table with order_id/product_id FKs, unique(order_id, product_id), cascade delete

**src/migrations/1703000000003-AddPaymentTables.ts**
- Create payment_attempts table with order_id FK, razorpay_order_id index
- Create payments table with order_id unique FK, status index, razorpay_payment_id index

### Services (2 files)
**src/services/OrderService.ts**
- Method: `createOrderFromCart(cartId: string, customerId: string): Promise<Order>`
- Method: `getOrderById(orderId: string): Promise<OrderDTO | null>`
- Method: `getOrderByNumber(orderNumber: string): Promise<OrderDTO | null>`
- Method: `listOrdersByCustomer(customerId: string, page?: number, limit?: number): Promise<...>`
- Helper: `generateUniqueOrderNumber(): Promise<string>` (format: ORD-YYYYMMDD-NNNNN)
- Helper: `convertCartItemsToOrderItems(cartId, orderId): Promise<OrderItem[]>`
- Dependency injection pattern for DataSource

**src/services/PaymentService.ts**
- Method: `initiatePayment(orderId: string, amount_cents: number): Promise<RazorpayOrderResponse>`
- Method: `verifyPaymentSignature(paymentId: string, orderId: string, signature: string): Promise<boolean>`
- Method: `updatePaymentStatus(orderId: string, paymentStatus: string): Promise<Payment>`
- Method: `handleWebhookEvent(webhookPayload: any): Promise<Payment>`
- Helper: `validateWebhookSignature(body: string, signature: string): Promise<boolean>`
- Dependency on Razorpay SDK client
- Dependency injection pattern for DataSource

### Routes (3 files)
**src/routes/orders.ts**
- POST /api/orders → Create order from cart (request: {cart_id, customer_id})
- GET /api/orders/:id → Get order details
- GET /api/orders → List orders for customer (paginated)

**src/routes/payments.ts**
- POST /api/payments/create-order → Initiate Razorpay payment (request: {order_id})
- POST /api/payments/verify → Verify payment signature and update status

**src/routes/webhooks.ts**
- POST /api/webhooks/razorpay → Receive and process Razorpay webhook
- Signature verification, idempotency check, payment status update

### Frontend Components (3 files)
**packages/frontend/src/components/Checkout.tsx**
- Convert cart to order
- Display order summary (items, total in ₹)
- Call POST /api/payments/create-order
- Initiate Razorpay checkout

**packages/frontend/src/components/PaymentStatus.tsx**
- Load Razorpay SDK
- Handle payment response (success/failure)
- Show processing state
- Call POST /api/payments/verify on success

**packages/frontend/src/components/PaymentCallback.tsx**
- Display payment result (success/failure/pending)
- Show order confirmation if successful
- Link to retry or continue shopping

### Tests (2 files)
**src/services/OrderService.test.ts**
- Test: Order creation from cart (items, pricing, order_number)
- Test: Order number uniqueness
- Test: Order number format (ORD-YYYYMMDD-NNNNN)
- Test: Cart marked as converted
- Test: OrderItem price snapshot
- Test: Error cases (empty cart, nonexistent cart)

**src/services/PaymentService.test.ts**
- Test: Razorpay SDK initialization and .orders.create() call
- Test: Signature verification (valid + tampered signatures)
- Test: Webhook processing (payment captured/failed)
- Test: Webhook idempotency (duplicate webhook ignored)
- Test: Payment status transitions
- Test: Invalid signature rejection

### Seed Data (updated)
**src/seed.ts** — extend existing
- Create 5-10 demo orders in various states (pending, confirmed, failed)
- Create corresponding payment records
- Link carts to orders
- Store sample Razorpay order IDs for testing

---

## 4. Files That Need Modification

### Backend Configuration
**src/config/database.ts**
- Add: Order, OrderItem, PaymentAttempt, Payment to entities array

**src/config/database.test.ts**
- Add: Order, OrderItem, PaymentAttempt, Payment to TestDataSource entities

### Backend App Setup
**src/app.ts**
- Import: ordersRoutes, paymentsRoutes, webhooksRoutes
- Register: app.use('/api/orders', ordersRoutes)
- Register: app.use('/api/payments', paymentsRoutes)
- Register: app.use('/api/webhooks', webhooksRoutes)

### Backend Services
**src/services/CartService.ts**
- Add method: `markCartConverted(cartId: string, orderId: string): Promise<void>`
  - Updates Cart.status = 'converted'
  - Updates Cart.converted_to_order_id = orderId

### Shared Types
**packages/shared/src/types/index.ts**
- Add: OrderDTO (id, order_number, customer_id, status, items[], total_cents)
- Add: OrderItemDTO (id, product_id, product, quantity, price_cents, line_total_cents)
- Add: PaymentDTO (id, order_id, razorpay_payment_id, status, amount_cents)
- Add: PaymentStatusDTO (status: 'initiated'|'pending'|'captured'|'failed'|'refunded')
- Add: Order status union type
- Add: Payment status union type

### Frontend Routing
**packages/frontend/src/App.tsx**
- Add: Route /checkout → Checkout component
- Add: Route /payment → PaymentStatus component
- Add: Route /payment-callback → PaymentCallback component
- Maintain: Existing product browsing routes

### Dependencies
**packages/backend/package.json**
- Add: "razorpay": "^2.9.x" (or latest stable)

---

## 5. Proposed Database Schema and Relationships

### Entity Relationship Diagram (Text)

```
Customer (1)
    ↓
    ├─→ Cart (M)
    │    └─→ CartItem (M)
    │         └─→ Product (ref)
    │
    └─→ Order (M) [created from Cart]
         ├─→ OrderItem (M)
         │    └─→ Product (ref, price snapshot)
         │
         ├─→ Payment (1)
         │    └─→ PaymentAttempt (M)
         │         └─→ Razorpay Order ID (stored)
         │
         └─→ order_number (unique)
```

### SQL Tables

**orders**
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_number varchar(50) UNIQUE NOT NULL,
  status varchar DEFAULT 'pending',
  subtotal_cents bigint NOT NULL,
  tax_cents bigint DEFAULT 0,
  total_cents bigint NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
```

**order_items**
```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL,
  price_cents bigint NOT NULL,
  line_total_cents bigint NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE UNIQUE INDEX idx_order_items_unique ON order_items(order_id, product_id);
```

**payment_attempts**
```sql
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  razorpay_order_id varchar,
  attempt_number integer DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_payment_attempts_order ON payment_attempts(order_id);
CREATE INDEX idx_payment_attempts_razorpay ON payment_attempts(razorpay_order_id);
```

**payments**
```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  razorpay_payment_id varchar,
  razorpay_signature varchar,
  status varchar DEFAULT 'initiated',
  amount_cents bigint NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_payment_id);
```

### Key Constraints
- Cart.converted_to_order_id → Order.id (soft reference, nullable)
- Order.customer_id → Customer.id (FK)
- OrderItem.order_id → Order.id (FK, cascade delete)
- OrderItem.product_id → Product.id (FK, no cascade)
- PaymentAttempt.order_id → Order.id (FK)
- Payment.order_id → Order.id (FK, unique 1:1)
- order_number: UNIQUE globally
- razorpay_payment_id: UNIQUE (nullable until confirmed)

---

## 6. Proposed Order/Payment State Machines

### Order Status Flow

```
Initial: pending
    ↓
    └─→ confirmed (when Payment.status becomes 'captured')
         ↓
         └─→ shipped (manual, not M3)
              ↓
              └─→ delivered (manual, not M3)

Any state → cancelled (manual, not M3)
```

**M3 scope:** pending → confirmed only

### Payment Status Flow

```
Step 1: Order Created
    └─→ Payment.status = 'initiated'

Step 2: POST /api/payments/create-order
    ├─ Create PaymentAttempt with razorpay_order_id
    └─→ Payment.status = 'pending'

Step 3: Razorpay Checkout (Frontend)
    ├─ User completes payment
    └─→ Razorpay webhook or callback

Step 4a: Webhook Flow (POST /api/webhooks/razorpay)
    ├─ Verify signature
    ├─ Check idempotency
    ├─ Update Payment record
    ├─→ Payment.status = 'captured' (success)
    ├─→ Payment.status = 'failed' (failure)
    ├─→ Order.status = 'confirmed' (if captured)
    └─→ Return 200 OK

Step 4b: Callback Verification (POST /api/payments/verify)
    ├─ Frontend sends payment_id, signature
    ├─ Verify signature
    ├─ Query Razorpay (optional)
    ├─→ Payment.status = 'captured'
    ├─→ Order.status = 'confirmed'
    └─→ Return confirmation response

Final states:
- captured: Order.status = confirmed
- failed: Order.status = pending (ready for retry in M5)
- refunded: Payment received refund (M5+)
```

### Idempotency Strategy

```
On webhook received:
1. Extract Razorpay webhook_id or compute hash(payload)
2. Query: Does Payment already exist with this razorpay_payment_id?
3. If yes: Return 200 OK (already processed)
4. If no: Process webhook, create/update Payment, return 200 OK

Result: Duplicate webhooks return 200 without side effects
```

---

## 7. Razorpay Integration Approach

### SDK Setup
- Library: `razorpay` npm package
- Credentials from environment:
  - RAZORPAY_KEY_ID (starts with rzp_test_ in Test Mode)
  - RAZORPAY_KEY_SECRET
  - RAZORPAY_WEBHOOK_SECRET
- Mode: Test Mode only for M3 (Live mode in M9)

### Integration Points

**1. Order Creation (backend)**
```
razorpay.orders.create({
  amount: total_cents,
  currency: "INR",
  receipt: order_number,
  payment_capture: 1, // auto-capture
  notes: { order_id, customer_id }
})
→ returns { id: 'order_...', amount, ... }
```

**2. Signature Verification (backend)**
```
crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(`${payment_id}|${order_id}`)
  .digest('hex')
== provided_signature
```

**3. Webhook Processing (backend)**
```
POST /api/webhooks/razorpay receives:
{
  event: 'payment.captured' | 'payment.failed',
  payload: {
    payment: {
      id, order_id, status, amount, signature, ...
    }
  }
}
```

**4. Frontend Checkout (React)**
```
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>

new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  amount: total_cents,
  order_id: razorpay_order_id,
  handler: (response) => {
    POST /api/payments/verify with response
  }
})
```

---

## 8. API Request/Response Designs

### Order Creation
**Request:** `POST /api/orders`
```json
{
  "cart_id": "uuid",
  "customer_id": "uuid"
}
```

**Response:** 201 Created
```json
{
  "id": "order-uuid",
  "order_number": "ORD-20260826-00001",
  "customer_id": "customer-uuid",
  "status": "pending",
  "items": [
    {
      "id": "item-uuid",
      "product_id": "product-uuid",
      "product": { "id", "name", "price_cents" },
      "quantity": 2,
      "price_cents": 99900,
      "line_total_cents": 199800
    }
  ],
  "subtotal_cents": 199800,
  "tax_cents": 0,
  "total_cents": 199800,
  "created_at": "2026-08-26T12:00:00Z"
}
```

**Errors:**
- 400: "cart_id and customer_id required"
- 404: "Cart not found"
- 400: "Cart is empty"

### Payment Initiation
**Request:** `POST /api/payments/create-order`
```json
{
  "order_id": "order-uuid"
}
```

**Response:** 200 OK
```json
{
  "razorpay_order_id": "order_...",
  "razorpay_key_id": "rzp_test_...",
  "amount": 199800,
  "currency": "INR",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Payment Verification
**Request:** `POST /api/payments/verify`
```json
{
  "order_id": "order-uuid",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "..."
}
```

**Response:** 200 OK
```json
{
  "order_id": "order-uuid",
  "payment_id": "payment-uuid",
  "status": "confirmed",
  "razorpay_payment_id": "pay_...",
  "amount_cents": 199800
}
```

**Errors:**
- 400: "Invalid signature"
- 404: "Order not found"

### Webhook Endpoint
**Webhook:** `POST /api/webhooks/razorpay`
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "id": "pay_...",
      "entity_id": "order_...",
      "amount": 199800,
      "status": "captured",
      "signature": "..."
    }
  }
}
```

**Response:** 200 OK (no body)

---

## 9. Test Plan

### Unit Tests: OrderService

```
✓ createOrderFromCart
  - Creates unique order_number
  - Creates OrderItems from CartItems
  - Snapshots product prices
  - Marks cart as converted
  - Sets order status to 'pending'
  - Throws on empty cart
  - Throws on nonexistent cart

✓ generateUniqueOrderNumber
  - Generates format ORD-YYYYMMDD-NNNNN
  - No duplicates across calls
  - Increments counter daily

✓ getOrderById
  - Returns order with items
  - Returns null if not found

✓ getOrderByNumber
  - Finds order by order_number
  - Case-insensitive or strict (define)
```

### Unit Tests: PaymentService

```
✓ initiatePayment
  - Calls razorpay.orders.create()
  - Stores razorpay_order_id in PaymentAttempt
  - Returns Razorpay response
  - Sets Payment.status = 'pending'

✓ verifyPaymentSignature
  - Valid signature returns true
  - Tampered signature returns false
  - Missing signature returns false

✓ handleWebhookEvent
  - payment.captured: Creates Payment, sets status 'captured'
  - Updates Order.status to 'confirmed'
  - Idempotent: duplicate webhook ignored
  - payment.failed: Creates Payment, sets status 'failed'
  - Order remains 'pending'
  - Invalid signature: Throws error

✓ validateWebhookSignature
  - Correct signature: returns true
  - Tampered: returns false
```

### Integration Tests

```
✓ Full payment flow
  1. Create cart, add product
  2. POST /api/orders → create order
  3. POST /api/payments/create-order → get razorpay_order_id
  4. Simulate webhook: payment.captured
  5. Verify Order.status = 'confirmed'
  6. Verify Payment.status = 'captured'

✓ Payment failure flow
  1. Create cart, add product
  2. Create order
  3. Receive payment.failed webhook
  4. Verify Order.status = 'pending'
  5. Verify Payment.status = 'failed'

✓ Prevent cart reuse
  1. Convert cart to order
  2. Try to convert same cart again → error
```

### Idempotency Tests

```
✓ Duplicate webhook processing
  - Call handleWebhookEvent twice with same payload
  - Verify Payment created once
  - Verify both calls return same result
  - Query by razorpay_payment_id returns one record
```

---

## 10. Risks and Ambiguities

### Risk 1: Order Number Uniqueness
**Issue:** Generating unique order_number without database sequence
**Mitigation:** Use format `ORD-YYYYMMDD-NNNNN`
- Query MAX(order_number) for today's date, increment counter
- Create UNIQUE index on order_number
- Handle collision with retry logic

**Ambiguity:** Should order_number include customer ID?  
**Assumption:** No; keep simple (global sequence). Customer ID available via Order.customer_id

### Risk 2: Razorpay Test vs Live Keys
**Issue:** Test keys in .env.example
**Mitigation:** 
- Only placeholders in .env.example (rzp_test_xxx)
- Real keys in .env (local) or deployed environment
- Never commit actual .env

**Ambiguity:** Support switching modes?  
**Assumption:** M3 uses Test Mode only. Live mode deferred to M9 (Deployment)

### Risk 3: Webhook Signature Verification
**Issue:** Tampering risk if verification skipped
**Mitigation:**
- Always verify with hmac-sha256 + RAZORPAY_WEBHOOK_SECRET
- Reject if signature invalid (return 400)
- Log failures for audit trail

**Ambiguity:** Should we store webhook payloads?  
**Assumption:** M3 doesn't require storage. M10 can add audit log

### Risk 4: Race Condition on Order Creation
**Issue:** Two simultaneous requests create two orders from same cart
**Mitigation:**
- Transactional order creation (BEGIN/COMMIT)
- Atomically mark cart as converted
- FK constraint prevents duplicate

**Ambiguity:** Allow order recreate from abandoned cart?  
**Assumption:** No. Once converted, cart cannot be used again

### Risk 5: Inventory Reservation
**Issue:** M3 doesn't explicitly deduct inventory
**Mitigation:**
- M3: Check availability only (don't deduct)
- M3: Reserve inventory on order creation (Inventory.reserved++)
- M5+: Deduct on payment confirmation

**Ambiguity:** When does inventory become "reserved"?  
**Assumption:** On order creation; inventory.reserved field updated

### Risk 6: Webhook Timeout/Retry
**Issue:** Razorpay retries if response > timeout
**Mitigation:**
- Return 200 OK immediately
- Process webhook synchronously (simple for M3)
- M5+ can add async queue if needed

**Ambiguity:** Async processing?  
**Assumption:** M3 synchronous; M5+ can optimize

### Risk 7: Frontend State Management
**Issue:** State loss on page refresh during checkout
**Mitigation:**
- Store cart_id/order_id in URL query params
- Order creation idempotent (can retry)
- Query backend for current status

**Ambiguity:** URL structure?  
**Assumption:** Multi-page routes (/checkout, /payment, /payment-callback) with order_id in URL

### Risk 8: Tax Calculation
**Issue:** Schema includes tax_cents but not calculated
**Mitigation:**
- M3: tax_cents = 0 (hardcoded)
- M4+: Add tax logic if needed

**Ambiguity:** Formula for total?  
**Assumption:** total_cents = subtotal_cents + tax_cents

### Risk 9: Cart → Order Quantity Validation
**Issue:** What if inventory drops between cart add and order creation?
**Mitigation:**
- Recheck inventory on order creation
- Reject if insufficient
- Let user update cart and retry

**Ambiguity:** Partial order creation?  
**Assumption:** All-or-nothing; full cart or error

### Risk 10: Payment Retry Handling
**Issue:** Failed payment → customer flow for retry
**Mitigation:**
- M3: Show failure, link to retry (creates new PaymentAttempt)
- M5: Auto-recovery with promised-to-pay
- M5+: Track failure reason from Razorpay

**Ambiguity:** Auto-retry or manual?  
**Assumption:** M3 manual (user clicks retry)

---

## Summary: File Creation/Modification Checklist

**New Files (11):**
- [ ] Order.ts, OrderItem.ts, PaymentAttempt.ts, Payment.ts (models)
- [ ] 1703000000002-AddOrderTables.ts, 1703000000003-AddPaymentTables.ts (migrations)
- [ ] OrderService.ts, PaymentService.ts (services)
- [ ] orders.ts, payments.ts, webhooks.ts (routes)

**New Frontend (3):**
- [ ] Checkout.tsx, PaymentStatus.tsx, PaymentCallback.tsx

**New Tests (2):**
- [ ] OrderService.test.ts, PaymentService.test.ts

**Modified Files (6):**
- [ ] database.ts, database.test.ts, app.ts, CartService.ts
- [ ] types/index.ts, App.tsx
- [ ] seed.ts, package.json

**Total Changes:** 22 files (11 new backend, 3 new frontend, 2 new tests, 6 modified)

---

**Ready for implementation when approved.**

