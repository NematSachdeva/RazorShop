# RazorShop — AI Revenue Recovery & Growth Manager

**Razor** is an intelligent e-commerce revenue recovery and growth platform for high-converting online stores. It combines a modern React storefront and checkout experience with automated payment failure recovery workflows, order cancellation & return/refund lifecycles, Groq AI-powered customer communications, product recommendations, and real-time merchant analytics.

- **Production URL**: [https://razorshop.app](https://razorshop.app)
- **GitHub Repository**: [https://github.com/NematSachdeva/RazorShop](https://github.com/NematSachdeva/RazorShop)

---

## 1. Project Overview

Razor solves the critical e-commerce challenge of lost revenue from failed transactions, abandoned carts, and complex order return/cancellation workflows. When a customer's payment fails or an order status changes, Razor automatically captures the event, classifies the underlying cause, and triggers personalized recovery communications. In addition, Razor provides AI-driven product recommendations and real-time merchant insights to maximize merchant conversion and operational efficiency.

---

## 2. Key Capabilities

- **Customer Storefront & Checkout**: High-converting catalog, search, category filters, sliding cart drawer, product modals, and embedded Razorpay payment checkout.
- **Order Cancellation & Return/Refund Lifecycle**:
  - Customer cancellation prior to dispatch with required cancellation reason, timestamp, actor tracking, and automatic idempotent inventory restoration.
  - Return workflow after delivery (`RETURN_REQUESTED` → Merchant `RETURN_APPROVED` or `RETURN_REJECTED`).
  - Sequential return logistics pipeline (`Pickup Scheduled` → `Picked Up` → `In Transit` → `Returned to Seller` → `Refund Initiated`).
  - Idempotent stock restoration executed strictly when products are returned to seller. Rejection retains valid sales revenue.
  - Merchant **Initiate Refund** action with source payment confirmation and timeline audit trail.
- **Groq AI Customer Communications**: Natural-language email body generation using Groq API (`openai/gpt-oss-120b`) across all lifecycle notifications while preserving authoritative order facts.
- **Merchant Management Hub**: Real-time analytics, revenue recovery tracking, payment failure breakdown, inventory editor, and promise-to-pay scheduler tracking.
- **Automated Payment Failure Recovery**: Instant webhook-driven capture of failed payment attempts, reason classification (insufficient funds, authentication failure, limit exceeded, network timeout), and automated recovery notifications.
- **AI Recommendation & Agent Engine**: Groq-powered contextual recommendations (`llama3-70b-8192`), complementary product bundling with automatic discounts, and merchant daily insights generation.
- **Multi-Mode Email Architecture**: Transactional and recovery email delivery supporting both Resend API integration and zero-dependency mock testing modes.
- **Production CI/CD Automation**: Zero-downtime GitHub Actions deployment to AWS EC2 via Systems Manager (SSM) with automated application rollback and bundle integrity verification.

---

## 3. Architecture

```
                                Client Browser
                                      │
                                      ▼
                           https://razorshop.app
                                      │
                                      ▼
                              Nginx Web Server
                        (HTTPS / Port 443 / SSL)
                        ┌─────────────┴─────────────┐
                        │                           │
                 Static Frontend              API Requests
                 (/var/www/razorshop)          (/api/*)
                        │                           │
                        ▼                           ▼
                   Vite SPA                 127.0.0.1:7070
                (React 18)                          │
                                                    ▼
                                             Express Backend
                                            (PM2: razor-backend)
                                                    │
                                                    ▼
                                            AWS RDS PostgreSQL
```

---

## 4. Repository Structure

Razor is structured as an npm workspace monorepo:

```
Razor/
├── packages/
│   ├── backend/               # Express API backend & TypeORM models
│   │   ├── src/
│   │   │   ├── config/        # Environment, database, & test configs
│   │   │   ├── middleware/    # Auth, validation, & error handlers
│   │   │   ├── models/        # TypeORM entities (Customer, Order, Product, etc.)
│   │   │   ├── routes/        # API route handlers & integration tests
│   │   │   ├── services/      # Business logic (Order, Payment, Groq Email, Recs, Agent)
│   │   │   ├── index.ts       # Express server entry point
│   │   │   ├── migration.ts   # Database migration runner
│   │   │   └── seed.ts        # Database seeder
│   │   └── package.json
│   ├── frontend/              # React 18 / Vite SPA storefront
│   │   ├── src/
│   │   │   ├── components/    # Cart, Checkout, Merchant Hub, Order Modals, Recs UI
│   │   │   ├── config/        # API endpoint configuration
│   │   │   └── App.tsx        # Main application component
│   │   └── package.json
│   └── shared/                # Shared TypeScript types and utilities
│       └── src/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # CI/CD GitHub Actions pipeline
├── scripts/
│   └── deploy-production.sh   # EC2 deployment & rollback script
├── docs/
│   ├── architecture.md        # Detailed infrastructure architecture
│   ├── cicd.md                # CI/CD pipeline & rollback specification
│   └── project-history.md     # Development history & milestone logs
├── .env.example               # Template for environment variables
├── package.json               # Root workspace manifest
└── README.md
```

---

## 5. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS / Tailwind CSS
- **Backend**: Node.js 20, TypeScript, Express, TypeORM
- **Database**: PostgreSQL (AWS RDS PostgreSQL in production)
- **Deployment**: AWS EC2, PM2 Process Manager (`razor-backend`), Nginx (Reverse Proxy & HTTPS)
- **AI Integration**: Groq API (`openai/gpt-oss-120b` for emails, `llama3-70b-8192` for recommendations)
- **Payment Gateway**: Razorpay Payment Gateway (Test & Live modes)
- **Email Delivery**: Resend API (`razorshop.app` domain) with mock fallback mode

---

## 6. Application Functionality

### Storefront & Catalog
- Search products by title or description.
- Filter products by category (Technology, Electronics, Audio, Home & Kitchen, etc.).
- Product detail modals with real-time inventory checks.
- Sliding cart drawer with dynamic quantity adjustments and bundle offers.

### Customer Order Management
- Order history tracking with visual state timeline (`Confirmed` → `Dispatched` → `Delivered`).
- Customer order cancellation before dispatch with reason prompt and source payment refund notice.
- Return request dialog on delivered orders (`RETURN_REQUESTED`).
- Live tracking of return logistics progress and refund initiation banners.

### Merchant Hub & Fulfillment
- Real-time merchant analytics (Total Revenue, Revenue at Risk, Revenue Recovered, Orders Cancelled, Orders Returned, Failed Payments, Abandoned Carts).
- Order fulfillment tab displaying cancellation reasons, actor source, and return logistics controls (`Approve Return`, `Reject Return`, `Schedule Pickup`, `Mark Picked Up`, `Mark In Transit`, `Mark Returned to Seller`, `Initiate Refund`).
- Portaled modal overlays with clean viewport stacking and dark backdrop.
- Interactive catalog inventory editor.
- Daily AI-generated merchant insights and action items.

---

## 7. Order & Return Status Lifecycle

```
CONFIRMED
   │
   ├── [Customer Cancels Before Dispatch] ──► CANCELLED (Inventory Restored)
   │
   └── DISPATCHED
         │
         └── DELIVERED
               │
               └── RETURN_REQUESTED
                     │
                     ├── [Merchant Rejects] ──► RETURN_REJECTED (Revenue Retained)
                     │
                     └── [Merchant Approves] ──► RETURN_APPROVED
                                                        │
                                                        ▼
                                                  PICKUP_SCHEDULED
                                                        │
                                                        ▼
                                                  ORDER_PICKED_UP
                                                        │
                                                        ▼
                                                  RETURN_IN_TRANSIT
                                                        │
                                                        ▼
                                                  ORDER_RETURNED_TO_SELLER (Inventory Restored)
                                                        │
                                                        ▼
                                                  REFUND_INITIATED
```

---

## 8. Authentication and Authorization

- **JWT Authentication**: JsonWebToken-based authentication for customers and merchants.
- **Bcrypt Password Hashing**: Passwords stored using `bcryptjs` with salt rounds = 10.
- **Role Isolation**: Strict role checking (`customer` vs `merchant`) enforcing data isolation.
- **Token Verification**: Auth middleware validates tokens and verifies user existence in PostgreSQL before permitting protected operations.

---

## 9. Payments

- **Razorpay Integration**: `PaymentService` manages Razorpay order creation and signature verification.
- **Payment Lifecycle**: `created` → `attempted` → `captured` / `failed`.
- **Payment Attempts & Idempotency**: Payment attempt tracking per order with unique attempt numbers and razorpay order IDs.
- **Signature Verification**: HMAC-SHA256 timing-safe verification for client payment success callbacks and webhooks.

---

## 10. Recovery Workflows

- **Automatic Failure Capture**: Immediate logging of payment failure cause (insufficient funds, authentication failure, limit exceeded, network drop).
- **Recovery Case Creation**: Tracks customer recovery status (`pending`, `contacted`, `recovered`, `abandoned`).
- **Notification Campaigns**: Automated email dispatch with tailored recovery links and support instructions.
- **Promise-to-Pay Scheduler**: Merchant option to record customer promises to pay and schedule automated follow-ups.

---

## 11. AI / Agent Functionality

- **Groq Email Generator (`GroqEmailGenerator`)**: Uses Groq LLM to generate natural-language customer emails for cancellation, return approvals/rejections, logistics updates, and refund initiations.
- **Recommendation Engine (`RecommendationService`)**: Uses Groq LLM to generate intelligent complementary product recommendations based on cart contents.
- **Merchant Agent (`MerchantAgent`)**: Analyzes daily store sales, stock levels, and recovery cases to output prioritized actionable insights for store owners.
- **Graceful Fallbacks**: If AI API is unavailable or rate-limited, services fallback gracefully without interrupting customer operations.

---

## 12. Email Architecture

- **Delivery Modes (`EmailService`)**:
  - `application` / `resend`: Dispatches real emails via Resend API from `razorshop.app`.
  - `test` / `mock`: Suppresses external API calls and logs email payloads locally during testing.
- **Supported Email Types**: Order confirmations, order cancellations, return lifecycle updates, refund notifications, and payment failure recovery alerts.

---

## 13. Database and Migrations

- **ORM**: TypeORM with PostgreSQL driver (`pg`).
- **Models**: `Customer`, `Merchant`, `Product`, `Inventory`, `Cart`, `Order`, `OrderItem`, `OrderTimeline`, `Payment`, `PaymentFailureCase`, `MerchantConfig`.
- **Migration Strategy**: Forward-only schema migrations executed via `npm run db:migrate --workspace=packages/backend`.

---

## 14. Environment Configuration

Copy `.env.example` to `.env` for local configuration.

### Environment Variables

| Variable | Description | Local / Test Default | Production Usage |
| :--- | :--- | :--- | :--- |
| `PORT` | Backend internal port | `3000` (or `7070`) | `7070` |
| `NODE_ENV` | Environment mode | `development` / `test` | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/razor` | AWS RDS Database URL |
| `JWT_SECRET` | JWT signing secret | Development placeholder | Strong production secret |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_placeholder` | Live/Test Razorpay Key |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `test_key_secret_placeholder` | Live/Test Razorpay Secret |
| `GROQ_API_KEY` | Groq AI API Key | `gsk_placeholder` | Production Groq API Key |
| `RESEND_API_KEY` | Resend Email API Key | Optional | Production Resend API Key |
| `EMAIL_DELIVERY_MODE` | Email transport mode | `mock` | `resend` (or `mock`) |
| `AI_MODE` | AI service mode | `mock` | `live` |

---

## 15. Local Development

### Prerequisites
- Node.js `v20+` & npm `v9+`
- Docker & Docker Compose (for local PostgreSQL database)

### Setup & Run

1. **Clone & Install**:
   ```bash
   git clone https://github.com/NematSachdeva/RazorShop.git
   cd RazorShop
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start Local Database**:
   ```bash
   docker-compose up -d
   ```

4. **Run Migrations & Seed Data**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Local Development Servers**:
   ```bash
   npm run dev
   ```

---

## 16. Testing

Razor features a full unit and integration test suite (Jest + Supertest):

```bash
# Run backend workflow integration tests
npx jest src/routes/cancellation_and_return_workflow.test.ts --runInBand --workspace=packages/backend

# Typecheck workspace TypeScript packages
npm run typecheck

# Full production build test
npm run build
```

### Verified Test Status
- **Cancellation & Return Integration Suite**: Passed (14/14 test cases)
- **Backend Typecheck**: Passed
- **Frontend Typecheck**: Passed
- **Production Build**: Passed
- **Bundle Safety Audit**: Passed (0 `localhost` references in `dist/`)

---

## 17. Production Deployment

Deployments are automated via GitHub Actions on push to `master`.

To manually trigger a deployment check:
```bash
# Verify build locally
npm run build

# Audit generated frontend bundle for local URLs
grep -rn "localhost" packages/frontend/dist
```

---

## 18. Security / Secret Handling

- **No Committed Secrets**: `.env` and credential files are excluded via `.gitignore`.
- **AWS OIDC**: Deployment uses short-lived OIDC tokens instead of static AWS credentials.
- **Frontend URL Isolation**: Frontend builds resolve API requests to same-origin relative `/api` paths.
- **Strict HTTPS**: Public production endpoints require valid SSL/TLS certificates.
