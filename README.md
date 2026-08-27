# AI Revenue Recovery & Growth Manager

A full-stack application for Razorpay-focused AI hackathon demonstrating AI-driven revenue recovery and merchant intelligence.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **AI/LLM:** Claude API (Anthropic)
- **Payment:** Razorpay Test Mode

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL 14+ (or use Docker)

## Environment Setup

### 1. Clone & Install

```bash
git clone <repository>
cd Razor
npm install
```

### 2. Environment Variables

```bash
# Copy example to local .env (already done in this setup)
cp .env.example .env

# Edit .env with your credentials (minimal for M1)
```

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

Verify connection:
```bash
docker-compose logs postgres
```

### 4. Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed
```

### 5. Start Backend

```bash
npm run dev --workspace=packages/backend
```

Expected output:
```
✓ Server running on http://localhost:3000
```

### 6. Verify Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 7. Start Frontend

In a new terminal:

```bash
npm run dev --workspace=packages/frontend
```

Expected output:
```
VITE v5.0.8  ready in 234 ms

➜  Local:   http://localhost:5173/
```

### 8. Access Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/health

## Available Commands

### Root Level

```bash
npm install                # Install all dependencies
npm run dev              # Start all dev servers (backend + frontend)
npm run build            # Build all packages
npm run typecheck        # TypeScript type checking
npm run lint             # Run linter
npm run test             # Run tests
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed demo data
npm run db:reset         # Migrate + seed
```

### Backend Only

```bash
cd packages/backend
npm run dev              # Start Express server
npm run build            # Build TypeScript
npm run typecheck        # Check types
npm run test             # Run tests
npm run db:migrate       # Migrations
npm run db:seed          # Seed data
```

### Frontend Only

```bash
cd packages/frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run typecheck        # Check types
npm run preview          # Preview production build
```

## Project Structure

```
Razor/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/          # Configuration (env, database)
│   │   │   ├── middleware/      # Express middleware
│   │   │   ├── models/          # TypeORM entities
│   │   │   ├── routes/          # API routes
│   │   │   ├── migrations/      # Database migrations
│   │   │   ├── seed.ts          # Seed data
│   │   │   ├── app.ts           # Express app
│   │   │   └── index.ts         # Server entry point
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── config/          # Client configuration
│   │   │   ├── App.tsx          # Main component
│   │   │   ├── main.tsx         # React entry point
│   │   │   └── index.css        # Global styles
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   └── types/           # Shared TypeScript types
│       └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## M1 Deliverables

### Completed

- ✓ Monorepo setup (npm workspaces)
- ✓ Express + TypeScript backend
- ✓ React + Vite frontend
- ✓ TypeORM + PostgreSQL
- ✓ Customer model + migrations
- ✓ Product model (258 demo products seeded)
- ✓ Inventory model with stock tracking
- ✓ Environment configuration & validation
- ✓ CORS + request logging
- ✓ Error handling middleware
- ✓ Health endpoint (`GET /health`)
- ✓ Database connection status checks
- ✓ Graceful shutdown handling
- ✓ Seed script (deterministic demo data)
- ✓ Docker Compose for PostgreSQL
- ✓ Basic tests (models, env validation, health check)

## M2 Deliverables

### Completed

- ✓ Product listing API with pagination & filtering (`GET /products`)
- ✓ Product categories endpoint (`GET /products/categories`)
- ✓ Search by product name/description
- ✓ Cart model with inventory reservation
- ✓ Cart CRUD endpoints
- ✓ Cart item management
- ✓ Frontend product browsing UI (category filter, search, pagination)
- ✓ Shopping cart drawer UI
- ✓ Add to cart functionality
- ✓ 258 seeded products across multiple categories
- ✓ Comprehensive tests (66+ tests, 9 test suites)

## M3 Deliverables

### Completed

**Backend:**
- ✓ Order model with inventory deduction
- ✓ Payment model for tracking payment attempts
- ✓ WebhookEvent model for idempotent webhook processing
- ✓ POST `/api/orders` — Create order from cart
- ✓ GET `/api/orders/:id` — Get order details
- ✓ GET `/api/orders?customer_id=...` — List orders with pagination
- ✓ POST `/api/payments/create` — Initiate payment attempt
- ✓ POST `/api/payments/verify` — Verify payment signature (Razorpay test mode)
- ✓ GET `/api/payments/:orderId` — Get payment status
- ✓ POST `/api/webhooks/razorpay` — Webhook handler with HMAC-SHA256 signature verification
- ✓ Webhook idempotency (unique webhook_id prevents duplicates)
- ✓ Handles payment.captured, payment.failed, payment.authorized events
- ✓ OrderService with SERIALIZABLE transaction isolation
- ✓ Pessimistic locking for inventory reservation during order creation
- ✓ PaymentService with idempotent verification & status tracking
- ✓ 119 comprehensive tests (10 test suites)

**Frontend:**
- ✓ Checkout modal (order summary from cart)
- ✓ Payment page with test simulation buttons
- ✓ Payment status indicator component
- ✓ Order confirmation modal
- ✓ State machine flow: browse → checkout → payment → confirmation
- ✓ Error handling and retry logic
- ✓ Builds successfully with TypeScript strict mode

**Database:**
- ✓ 0 pending migrations
- ✓ All M1/M2/M3 models migrated

### M3 Payment Flow

```
1. Customer adds products to cart (M2)
2. Customer clicks "Proceed to Checkout"
3. Checkout modal shows order summary (from CartDTO)
4. Customer confirms → POST /api/orders (creates Order with status: pending)
5. Order created → frontend calls POST /api/payments/create
6. Payment attempt recorded (status: initiated)
7. Payment page shows test buttons ("Simulate Success/Failure")
   - In production, would show Razorpay hosted checkout
8. Customer clicks "Simulate Success"
9. Frontend calls POST /api/payments/verify with mock signature
   - In production, this receives real Razorpay payment_id + signature
10. Payment verified → Order status updated to confirmed
11. Optional: Webhook receives payment.captured event
    - POST /api/webhooks/razorpay (with X-Razorpay-Signature header)
    - Signature verified using RAZORPAY_WEBHOOK_SECRET
    - Webhook processed idempotently (webhook_id checked)
    - Payment and Order statuses finalized
12. Frontend shows OrderConfirmation with order details
13. Customer can continue shopping (cart cleared)
```

### Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/razor

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_TUg86oRiFKtxoD
RAZORPAY_KEY_SECRET=<test_secret>
RAZORPAY_WEBHOOK_SECRET=<test_webhook_secret>

# AI (optional for M4+)
ANTHROPIC_API_KEY=sk-ant-...
```

### M1 Models in Database

**customers**
- id (UUID)
- email (unique)
- phone, name
- created_at, updated_at

**products**
- id (UUID)
- name, description
- price_cents (integer, not float)
- category
- created_at, updated_at

**inventory**
- id (UUID)
- product_id (unique foreign key)
- quantity_on_hand, reserved
- last_updated

**carts** (M2)
- id (UUID)
- customer_id (FK)
- items (one-to-many)
- subtotal_cents, total_cents
- status (active/converted)

**orders** (M3)
- id (UUID)
- customer_id (FK)
- order_number
- status (pending/confirmed/shipped/delivered/cancelled)
- items (one-to-many)
- subtotal_cents, tax_cents, total_cents

**payments** (M3)
- id (UUID)
- order_id (FK, unique)
- razorpay_payment_id
- razorpay_signature
- status (initiated/pending/captured/failed/refunded)
- amount_cents
- failure_reason

**webhook_events** (M3)
- id (UUID)
- webhook_id (unique, for idempotency)
- event_type (string)
- status (processing/processed/failed)
- payload (JSON)
- processed_at

### Demo Data

- 3 demo customers
- 258 diverse products (Technology, Electronics, Clothing, Home, Sports, etc.) in INR pricing
- Inventory for all products

## Test Results

**Backend Test Suites:** 10/10 passing  
**Backend Tests:** 119/119 passing  
**Backend TypeCheck:** ✓ Passing  
**Backend Build:** ✓ Passing  
**Frontend Build:** ✓ Passing  
**Database Migrations:** 0 pending  

## Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running:
```bash
docker-compose up -d postgres
docker-compose ps
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

**Solution:** Change PORT in .env or kill existing process:
```bash
lsof -i :3000
kill -9 <PID>
```

### Missing Dependencies

```bash
npm install
```

### Type Checking Errors

```bash
npm run typecheck
```

## Next Milestone (M4)

M4 — Production Payment Integration will implement:
- Real Razorpay SDK integration (remove test simulation)
- Razorpay Hosted Checkout page
- Order email notifications
- Payment confirmation emails
- Webhook retry logic
- Admin dashboard for payment monitoring
- Refund handling
- Multi-currency support (if needed)

## Testing

Run tests for any package:

```bash
npm run test --workspace=packages/backend
```

Current test coverage:
- Environment validation
- Health endpoint
- Model entity validation
- Database connection

## License

ISC
