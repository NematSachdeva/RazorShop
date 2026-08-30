# Razor — AI Revenue Recovery & Growth Manager

**Razor** is an intelligent e-commerce revenue recovery and growth platform for high-converting online stores. It combines a modern React storefront and checkout experience with automated payment failure recovery workflows, AI-powered product recommendations, and real-time merchant analytics.

- **Production URL**: [https://razorshop.app](https://razorshop.app)
- **GitHub Repository**: [https://github.com/NematSachdeva/RazorShop](https://github.com/NematSachdeva/RazorShop)

---

## 1. Project Overview

Razor solves the critical e-commerce challenge of lost revenue from failed transactions and abandoned carts. When a customer's payment fails or an order is incomplete, Razor automatically captures the attempt, classifies the failure reason, and triggers personalized recovery communications. In addition, Razor provides AI-driven product recommendations and insights to maximize merchant conversion.

---

## 2. Key Capabilities

- **Customer Storefront & Checkout**: High-converting catalog, search, category filters, sliding cart drawer, product modals, and embedded Razorpay payment checkout.
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
│   │   │   ├── services/      # Business logic (Payment, Email, Recs, Agent)
│   │   │   ├── index.ts       # Express server entry point
│   │   │   ├── migration.ts   # Database migration runner
│   │   │   └── seed.ts        # Database seeder
│   │   └── package.json
│   ├── frontend/              # React 18 / Vite SPA storefront
│   │   ├── src/
│   │   │   ├── components/    # Cart, Checkout, Merchant Hub, Recs UI
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
- **AI Integration**: Groq API (`llama3-70b-8192`) with catalog fallback
- **Payment Gateway**: Razorpay Payment Gateway (Test & Live modes)
- **Email Delivery**: Resend API (`razorshop.app` domain) with mock fallback mode

---

## 6. Application Functionality

### Storefront & Catalog
- Search products by title or description.
- Filter products by category (Technology, Electronics, Audio, Home & Kitchen, etc.).
- Product detail modals with real-time inventory checks.
- Sliding cart drawer with dynamic quantity adjustments and bundle offers.

### Cart & Recommendations
- Cart state persistence and session management.
- Dynamic complementary product recommendations based on items in cart.
- Bundle discounts applied automatically when recommended item pairs are added.

### Merchant Hub
- Merchant authentication and protected dashboard routes.
- Overview of total store revenue, order volume, and active cart metrics.
- Recovery case management table showing customer status, failure reasons, and recovery attempts.
- Interactive product catalog editor for inventory and pricing adjustments.
- Daily AI-generated merchant insights and action items.

---

## 7. Authentication and Authorization

- **JWT Authentication**: JsonWebToken-based authentication for customers and merchants.
- **Bcrypt Password Hashing**: Passwords stored using `bcryptjs` with salt rounds = 10.
- **Role Isolation**: Strict role checking (`customer` vs `merchant`) enforcing data isolation.
- **Token Verification**: Auth middleware validates tokens and verifies user existence in PostgreSQL before permitting protected operations.

---

## 8. Payments

- **Razorpay Integration**: `PaymentService` manages Razorpay order creation and signature verification.
- **Payment Lifecycle**: `created` → `attempted` → `captured` / `failed`.
- **Payment Attempts & Idempotency**: Payment attempt tracking per order with unique attempt numbers and razorpay order IDs.
- **Signature Verification**: HMAC-SHA256 timing-safe verification for client payment success callbacks and webhooks.
- **CI Safety Mode**: Automatic mock order generation in CI/test environments to prevent live API authentication errors during automated testing.

---

## 9. Recovery Workflows

- **Automatic Failure Capture**: Immediate logging of payment failure cause (insufficient funds, authentication failure, limit exceeded, network drop).
- **Recovery Case Creation**: Tracks customer recovery status (`pending`, `contacted`, `recovered`, `abandoned`).
- **Notification Campaigns**: Automated email dispatch with tailored recovery links and support instructions.
- **Promise-to-Pay Scheduler**: Merchant option to record customer promises to pay and schedule automated follow-ups.

---

## 10. AI / Agent Functionality

- **Recommendation Engine (`RecommendationService`)**: Uses Groq LLM to generate intelligent complementary product recommendations based on cart contents.
- **Merchant Agent (`MerchantAgent`)**: Analyzes daily store sales, stock levels, and recovery cases to output prioritized actionable insights for store owners.
- **Graceful Fallbacks**: If AI API is unavailable or rate-limited, the recommendation engine falls back gracefully to popular catalog products without interrupting customer checkout.

---

## 11. Email Architecture

- **Delivery Modes (`EmailService`)**:
  - `application` / `resend`: Dispatches real emails via Resend API from `razorshop.app`.
  - `test` / `mock`: Suppresses external API calls and logs email payloads locally during testing.
- **Supported Email Types**: Order confirmations, payment failure recovery notifications, and merchant alerts.

---

## 12. Database and Migrations

- **ORM**: TypeORM with PostgreSQL driver (`pg`).
- **Models**: `Customer`, `Merchant`, `Product`, `Inventory`, `Cart`, `Order`, `Payment`, `PaymentFailureCase`, `MerchantConfig`.
- **Migration Strategy**: Forward-only schema migrations executed via `npm run db:migrate --workspace=packages/backend`.

---

## 13. Production Infrastructure

- **Domain**: `https://razorshop.app`
- **Server**: AWS EC2 Instance (`ubuntu@13.205.250.214`, ap-south-1)
- **Database**: AWS RDS PostgreSQL
- **Web Server & SSL**: Nginx with Let's Encrypt TLS certificate.
- **Backend Process**: Node.js managed by PM2 (`razor-backend`) listening internally on `http://127.0.0.1:7070`.
- **Frontend Root**: Static files served from `/var/www/razorshop`.
- **API Routing**: Nginx reverse-proxies `/api/*` to `http://127.0.0.1:7070`.

---

## 14. CI/CD Pipeline

```
GitHub Push (master)
       │
       ▼
GitHub Actions CI
 ├── npm ci
 ├── backend typecheck
 ├── frontend typecheck
 ├── isolated PostgreSQL container
 ├── backend test suite
 ├── npm run build (NODE_ENV=production)
 └── frontend bundle audit (0 localhost URLs)
       │
       ▼
GitHub Actions CD
 ├── AWS OIDC Auth (IAM Role)
 ├── AWS SSM Send-Command (exact github.sha)
 └── EC2 execution (scripts/deploy-production.sh)
```

- **CI Pipeline**: Runs on every push to `master`. Runs tests against an isolated PostgreSQL container.
- **CD Deployment**: Triggered via AWS Systems Manager (SSM) using OpenID Connect (OIDC) authentication. Deploys the exact Git commit SHA (`github.sha`).
- **Rollback Semantics**: Reverts application code, compiled bundles, and PM2 process state to the previous commit if deployment or health checks fail. Database schema changes on AWS RDS are **forward-only** and are not automatically rolled back.

---

## 15. Environment Configuration

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

> **Security Note**: Production environment variables are maintained directly on the EC2 server (`/home/ubuntu/razor/.env`) and are never committed to Git or exposed in GitHub Actions.

---

## 16. Local Development

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

## 17. Testing

Razor features a full unit and integration test suite (Jest + Supertest):

```bash
# Run all backend unit tests
npm run test:unit --workspace=packages/backend

# Typecheck workspace TypeScript packages
npm run typecheck
```

### Verified Test Status
- **Test Suites**: 33 passed, 33 total
- **Tests**: 292 passed, 292 total
- **Backend Typecheck**: Passed
- **Frontend Typecheck**: Passed
- **Production Build**: Passed
- **Bundle URL Safety Audit**: Passed (0 `localhost` references in `dist/`)

---

## 18. Production Deployment

Deployments are automated via GitHub Actions on push to `master`.

To manually trigger a deployment check:
```bash
# Verify build locally
npm run build

# Audit generated frontend bundle for local URLs
grep -rn "localhost" packages/frontend/dist
```

---

## 19. Security / Secret Handling

- **No Committed Secrets**: `.env` and credential files are excluded via `.gitignore`.
- **AWS OIDC**: Deployment uses short-lived OIDC tokens instead of static AWS credentials.
- **Frontend URL Isolation**: Frontend builds resolve API requests to same-origin relative `/api` paths.
- **Strict HTTPS**: Public production endpoints require valid SSL/TLS certificates.

---

## 20. Operational Notes

- **Production Domain**: `https://razorshop.app`
- **Backend Internal Port**: `7070`
- **Nginx Config**: `/etc/nginx/sites-available/razorshop`
- **PM2 Process**: `razor-backend`
- **EC2 Working Directory**: `/home/ubuntu/razor`
- **Web Root**: `/var/www/razorshop`
