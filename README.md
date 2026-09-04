# RazorShop — AI Revenue Recovery & Growth Manager

**RazorShop** is an enterprise-grade e-commerce platform and AI-powered revenue recovery manager designed for modern online merchants. It combines a high-converting customer storefront, an embedded Razorpay checkout pipeline, automated payment failure recovery workflows, order cancellation & return logistics management, voice-enabled AI merchant assistance, and comprehensive analytics.

- **Production Site**: [https://razorshop.app](https://razorshop.app)
- **GitHub Repository**: [https://github.com/NematSachdeva/RazorShop](https://github.com/NematSachdeva/RazorShop)

---

## Overview

E-commerce businesses lose a significant portion of their revenue due to transient payment failures, abandoned checkout carts, manual return/refund friction, and operational delays in seller workflows. 

RazorShop addresses these challenges by uniting a full-featured online marketplace with intelligent automation:
1. **High-Converting Customer Storefront**: A responsive, fast, and accessible customer portal with product discovery, category filtering, cart management, and seamless Razorpay checkout.
2. **Automated Revenue Recovery Engine**: Real-time detection of failed payment attempts and abandoned carts, generating AI-driven recovery cases, personalized communication, and customer promise-to-pay tracking.
3. **Multi-Modal AI Merchant Helper**: A natural language AI assistant supporting text and voice commands (via Groq Whisper V3 Speech-to-Text and Sarvam AI Bulbul V3 Text-to-Speech) for catalog updates, stock adjustments, deal creation, order cancellations, and refunds.
4. **End-to-End Fulfillment & Return Logistics**: Full order status tracking from placement to delivery, including a 5-stage return logistics pipeline with automatic stock restoration upon return completion.
5. **Multi-Tenant Merchant & Admin Portals**: Dedicated seller workspaces for inventory and order operations, alongside an administrator portal for merchant application review, approval provisioning, and audit trails.

---

## Key Features

### Customer Features
- **Storefront & Catalog Browsing**: Dynamic grid view with deal badges (`POPULAR`, `ONLY X LEFT`), original vs. discounted pricing, ratings, and stock status.
- **Search & Filtering**: Real-time search across product names and descriptions, category selection, price range (`Min`/`Max`), and `In Stock Only` filters.
- **Sorting & Pagination**: Sort by Newest/Recommended, Price (Low to High / High to Low), and Name (A–Z / Z–A) with server-side pagination.
- **Product Details & Recommendations**: Rich modal view with high-resolution imagery, inventory checks, product overview, and AI-driven cross-sell recommendations.
- **Sliding Cart Drawer**: Real-time cart drawer with quantity controls, item removal, bundle offer banners, and dynamic total calculations.
- **Delivery Address Book**: Multi-address management allowing default selection, creation, editing, and deletion.
- **Razorpay Checkout**: Seamless payment modal integration supporting card, UPI, and net banking options.
- **Customer Order Tracking**: Dedicated order history page with interactive 4-stage delivery timeline (`Pending` → `Confirmed` → `Dispatched` → `Shipped` → `Delivered`), order receipts, and return status tracking.
- **Order Cancellation & Return Requests**: Self-service cancellation before dispatch and structured return requests.
- **Order Feedback**: Post-delivery rating (1–5 stars) and category feedback submission.
- **Light / Dark Mode**: Theme switcher with persistent preferences stored in `localStorage`.

### Merchant Features
- **Real-Time Dashboard & Analytics**: Live tracking of Total Revenue, Revenue at Risk, Recovered Revenue, Failed Payments Count, Abandoned Carts Count, and Cancellation/Return metrics.
- **Catalog & Inventory Management**: Interactive catalog manager supporting product creation, catalog editing, deal creation (discount percentage and expiration timer), image uploads, and soft-deletion/archiving.
- **Stock Inventory Adjustment**: Inline stock editor supporting `Add Stock`, `Remove Stock`, and `Set Exact` operations on hand and available quantities.
- **Order Fulfillment & Shipping Controls**: Filterable order tables with status transition actions (`Dispatch`, `Ship`, `Deliver`).
- **Cancellation & Return Logistics Management**:
  - Review and approve/reject customer return requests.
  - Track 5-stage return logistics: `Pickup Scheduled` → `Picked Up` → `In Transit` → `Returned to Seller` → `Refund Initiated`.
  - Automated stock restoration triggered strictly upon return arrival to seller (`Returned to Seller`).
  - Manual merchant refund initiation with payment verification audit trail.
- **Recovery Cases Hub**: Table of active recovery cases filtered by status (`Open`, `In Progress`, `Resolved`, `Abandoned`, `Customer Declined`), manual recovery email triggers, and timeline histories.
- **Merchant Helper (AI Assistant)**: Text and voice interaction interface for executing stock updates, deal creation, order queries, and return approvals.
- **Merchant Guardrails Configuration**: Editable business parameters including max recovery attempts, max discount percentages, allowed communication channels, promise-to-pay limits, and AI feature toggles.
- **Merchant Application Status View**: Real-time status tracker for onboarding applications (`pending`, `approved`, `rejected`).

### Admin Features
- **Merchant Onboarding Applications**: Portal for inspecting seller registration requests.
- **Application Review Workflow**: Approve applications (automatically provisioning seller credentials and upgrading user roles) or Reject applications with mandatory feedback.
- **Application Metrics & Audit Trail**: Overview of total, pending, approved, and rejected applications alongside detailed timeline audit logs.

### Platform & Backend Features
- **RESTful API**: Clean Express route structure for auth, catalog, cart, checkout, payments, orders, merchant operations, admin workflows, and recovery.
- **TypeORM Entity Layer**: Strongly typed PostgreSQL database models and migrations.
- **Idempotent Webhook Processing**: Secure Razorpay webhook handler with raw body HMAC-SHA256 signature verification.
- **Background Scheduler**: Automated background cron runner for recovering abandoned carts, checking payment timeouts, and expiring active deals.
- **Multi-Tenant Isolation**: Merchant routes scoped strictly to seller-owned products, orders, and configuration.

### AI & Automation Features
- **AI Cart & Product Recommendations**: Groq LLM-driven recommendation engine suggesting complementary products and bundle discounts.
- **AI Recovery Email Generator**: Groq LLM-generated personalized recovery emails tailored to failure reasons.
- **Voice Transcription (STT)**: Groq Whisper Large v3 voice-to-text with auto-script verification and targeted Hindi retry logic.
- **Text-to-Speech (TTS)**: Sarvam AI Bulbul v3 TTS speech synthesis (`speaker: shubh`) for audio voice responses.

---

## Platform Architecture

```
                                [ Client Web Browser ]
                                          │
                                          ▼
                                 [ Nginx Reverse Proxy ]
                              (Port 443 / SSL Terminated)
                               /                       \
                  Static Assets                         /api Proxy
                       │                                    │
                       ▼                                    ▼
             [ React / Vite Frontend ]            [ Express Node.js Backend ]
            (Dist Assets in /var/www)               (PM2 Daemon / Port 7070)
                                                   /           │          \
                                                  /            │           \
                                                 ▼             ▼            ▼
                                          [ AWS RDS ]     [ Razorpay ]  [ Groq AI ]
                                         (PostgreSQL)      (Payments)   (LLM & STT)
```

---

## User Roles

| Role | Access Level & Responsibilities |
| :--- | :--- |
| `customer` | Default public/registered user role. Can browse catalog, manage cart, save shipping addresses, place orders, complete payments, track delivery timelines, submit feedback, and initiate cancellations/returns. |
| `merchant` | Approved seller role. Grants access to the Merchant Portal for managing product catalog, inventory stock, order fulfillment, return logistics, recovery cases, merchant configuration guardrails, and AI Merchant Helper. |
| `admin` | System administrator role. Access restricted to Admin Portal routes (`/api/admin/*`) for reviewing merchant applications, approving/rejecting seller onboarding, and inspecting audit trails. |

---

## Customer Portal

The Customer Portal provides a modern, fast shopping experience:
- **Navigation & Routing**: HTML5 History API routing supporting `/`, `/orders`, `/privacy`, `/terms`, `/support`, `/status`.
- **Search & Filter Bar**: Real-time text search, price sliders, in-stock filters, category chips, and sort selectors.
- **Product Details & Recommendations**: Interactive product detail dialog featuring stock badges, full descriptions, pricing, and AI recommendations.
- **Sliding Cart Drawer**: Right-side drawer for quick cart adjustments, bundle discount triggers, and checkout initiation.
- **Delivery Address Management**: Customer address modal to create, edit, select default, or delete delivery addresses.
- **Checkout Modal**: Summarizes selected shipping address, cart line items, discounts, and total payable amount before launching payment.
- **Payment Page Modal**: Intermediate payment gateway loading screen handling Razorpay Checkout modal launch and payment verification.
- **Order Tracking Page**: Displays customer order history with real-time status badges, line items, breakdown, address details, and cancellation/return request triggers.

---

## Merchant Portal

The Merchant Portal equips store owners with operational tools:
- **Overview Dashboard**: High-level KPI summary cards and daily revenue performance charts.
- **Products & Stock Tab**: Data table listing all merchant products, stock counts (On Hand, Reserved, Available, Sold), quick inline stock editor, product creator/editor modal, and archiving controls.
- **Orders & Fulfillment Tab**: Filterable order manager for changing fulfillment status (`Dispatched`, `Shipped`, `Delivered`) and processing return requests through 5 logistics stages.
- **Recovery Cases Tab**: Management table for open and in-progress recovery cases with manual email dispatch options and case decision logs.
- **Merchant Helper**: Interactive text/voice AI chat drawer for natural-language store management.
- **Merchant Configuration Modal**: Control guardrail limits for discounts, recovery attempts, communication channels, and promise-to-pay rules.

---

## Admin Portal

The Admin Portal handles platform governance:
- **Application Queue**: Overview of pending, approved, and rejected seller applications.
- **Application Review Modal**: Detailed inspection of seller application metadata (business name, tax ID, store description, contact info).
- **Approval & Provisioning**: Approving an application automatically provisions a `Merchant` database entity and upgrades the applicant's user account role to `merchant`.
- **Rejection Workflow**: Rejecting an application records a mandatory rejection reason and updates timeline logs.
- **Audit Logs**: Full timeline history of administrator actions and status changes.

---

## Authentication & Authorization

- **JWT Tokens**: Authentication uses JSON Web Tokens signed with `JWT_SECRET` (7-day validity). Tokens are stored in `localStorage` and passed in the `Authorization: Bearer <token>` HTTP header.
- **Password Protection**: User passwords are encrypted using `bcryptjs` with salt rounds of 10.
- **Role-Based Access Control (RBAC)**: Middleware functions enforce strict authorization:
  - `createAuthenticate`: Decodes JWT token and attaches user payload to `req.user`.
  - `requireCustomer`: Restricts route to authenticated customers.
  - `requireMerchant`: Restricts route to authenticated merchants.
  - `createRequireApprovedMerchant`: Ensures merchant's application status is `approved`.
  - `requireAdmin`: Restricts route to system administrators.

---

## Product & Inventory Management

### Product Schema (`products` table)
- `id` (UUID primary key)
- `name`, `category`, `description`, `image_url`
- `price_cents` (BigInt in cents, e.g. `299900` = ₹2,999.00)
- `original_price_cents`, `discount_percent`
- `deal_active` (Boolean), `deal_expires_at` (Timestamp)
- `merchant_id` (Foreign key linking product to seller)

### Inventory Schema (`inventory` table)
- `quantity_on_hand`: Physical stock quantity present in warehouse.
- `reserved`: Quantity currently held in active customer carts/orders.
- `available`: Calculated as `max(0, quantity_on_hand - reserved)`.

### Inventory Lifecycle Logic
1. **Item Added to Cart**: Increments `reserved` count by item quantity.
2. **Item Removed / Cart Expired**: Decrements `reserved` count by item quantity.
3. **Order Confirmed**: Deducts item quantity from `quantity_on_hand` and clears `reserved`.
4. **Order Cancelled / Returned**: Restores `quantity_on_hand` upon cancellation or when return arrives back to seller (`Returned to Seller`).

---

## Order & Fulfillment Lifecycle

```
Customer Checkout ──► Order Created ('pending')
                            │
                            ├── Payment Successful ──► Order Confirmed ('confirmed')
                            │                               │
                            │                               ├── Merchant Dispatches ──► 'dispatched'
                            │                               │                               │
                            │                               │                               ▼
                            │                               │                          'shipped'
                            │                               │                               │
                            │                               │                               ▼
                            │                               │                          'delivered'
                            │                               │                               │
                            │                               │                               ▼
                            │                               │                     Return Requested ('return_requested')
                            │                               │                               │
                            │                               │                               ├── Return Approved ('return_approved')
                            │                               │                               │           │
                            │                               │                               │           ▼
                            │                               │                               │    'pickup_scheduled' ──► 'order_picked_up'
                            │                               │                               │                                │
                            │                               │                               │                                ▼
                            │                               │                               │                      'return_in_transit'
                            │                               │                               │                                │
                            │                               │                               │                                ▼
                            │                               │                               │                   'order_returned_to_seller'
                            │                               │                               │                     (Stock Restored)
                            │                               │                               │                                │
                            │                               │                               │                                ▼
                            │                               │                               │                     'refund_initiated'
                            │                               │                               │
                            │                               │                               └── Return Rejected ('return_rejected')
                            │                               │
                            │                               └── Pre-Dispatch Cancel ──► Order Cancelled ('cancelled')
                            │
                            └── Payment Failed ──► Trigger Payment Failure & Recovery Engine
```

---

## Payment Integration

RazorShop uses **Razorpay Payment Gateway** for customer transactions:
1. **Payment Creation**: Frontend calls `POST /api/payments/create` with `order_id`. Backend creates a Razorpay Order via Razorpay API and records a `PaymentAttempt` row.
2. **Razorpay Modal**: Frontend launches Razorpay Checkout dialog using the generated `razorpay_order_id` and public `RAZORPAY_KEY_ID`.
3. **Payment Verification**: Upon completion, frontend sends `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to `POST /api/payments/verify`. Backend verifies the HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
4. **Webhook Handling**: `POST /api/webhooks/razorpay` receives raw webhook payloads, verifies HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`, and processes payment events asynchronously.

---

## Revenue Recovery

### Trigger Events
- **Payment Failure**: When a payment attempt fails or errors out, backend registers a `PaymentFailure` entry and initializes a `RecoveryCase`.
- **Abandoned Cart**: Background scheduler identifies active carts untouched past threshold windows and initializes recovery workflows.

### Recovery Workflow
1. **Case Creation**: A `RecoveryCase` is created in `open` status.
2. **AI Failure Diagnosis**: `GroqEmailGenerator` analyzes failure context (e.g. card decline, timeout, insufficient funds) and generates personalized recovery emails.
3. **Communication Dispatch**: `EmailService` sends recovery emails containing single-click payment recovery URLs (`EMAIL_DELIVERY_MODE` supports `mock` or `live` via Resend API).
4. **Customer Response Tracking**: Customers can accept recovery, promise to pay later (`PromiseToPay` entry), or opt out (`customer_declined`).
5. **Resolution**: Successful recovery updates `RecoveryCase` status to `resolved` and tracks recovered revenue metrics.

---

## Merchant Helper / AI

The Merchant Helper is a multi-modal AI copilot:
- **Capabilities**: Query store analytics, update stock levels, create promotional deals, process refunds, approve returns, and cancel orders.
- **Groq LLM Integration**: Uses Groq API for natural language understanding, intent extraction, and response generation.
- **Voice Input (STT)**: Transcribes recorded user audio (`webm`, `wav`, `m4a`) using Groq Whisper Large v3 with fallback script validation.
- **Voice Output (TTS)**: Converts text responses into spoken audio using Sarvam AI Bulbul v3 (`speaker: shubh`).
- **Interactive Action Confirmations**: High-impact actions (price modifications, stock changes, refunds, cancellations) return structured action proposal cards requiring explicit merchant confirmation before execution.

---

## Analytics

The Merchant Analytics engine calculates real-time metrics:
- **Total Revenue**: Sum of all confirmed/delivered order amounts.
- **Revenue at Risk**: Total value of open recovery cases and abandoned carts.
- **Recovered Revenue**: Total value of orders successfully converted via recovery workflows.
- **Payment Failure Reasons**: Categorized breakdown of card failures, network timeouts, authentication issues, and user cancellations.
- **Daily Revenue Timeline**: Chronological time-series of sales revenue and recovered amounts.
- **Customer Response Breakdown**: Distribution of customer recovery responses (Accepted, Promised, Opted Out, No Response).

---

## API Documentation

### Health
- `GET /api/health` - Server and database health check status.

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Customer account registration.
- `POST /api/auth/login` - Customer account login.
- `GET /api/auth/me` - Retrieve current authenticated user profile.
- `POST /api/auth/merchant/register` - Submit merchant onboarding application.
- `POST /api/auth/merchant/login` - Merchant account login.
- `POST /api/auth/admin/login` - Administrator login.

### Products (`/api/products`)
- `GET /api/products` - List products with category, search, price range, in-stock filter, sorting, and pagination.
- `GET /api/products/categories` - List active product categories.
- `GET /api/products/:id` - Retrieve single product details.

### Carts (`/api/carts`)
- `GET /api/carts` - Retrieve active cart for current user.
- `POST /api/carts` - Create or retrieve cart.
- `POST /api/carts/items` - Add item to cart.
- `PUT /api/carts/items/:id` - Update cart item quantity.
- `DELETE /api/carts/items/:id` - Remove item from cart.
- `POST /api/carts/apply-bundle` - Apply promotional bundle discount.

### Shipping Addresses (`/api/addresses`)
- `GET /api/addresses` - List customer saved addresses.
- `POST /api/addresses` - Add new delivery address.
- `PUT /api/addresses/:id` - Edit saved address.
- `DELETE /api/addresses/:id` - Remove saved address.
- `PUT /api/addresses/:id/default` - Set default delivery address.

### Recommendations (`/api/recommendations`)
- `GET /api/recommendations/product/:id` - Get AI recommendations for product detail page.
- `GET /api/recommendations/cart/:id` - Get AI cross-sell recommendations for cart drawer.

### Orders (`/api/orders`)
- `POST /api/orders` - Create order from cart items.
- `GET /api/orders` - List customer orders.
- `GET /api/orders/:id` - Retrieve order details and delivery timeline.
- `POST /api/orders/:id/cancel` - Request order cancellation before dispatch.
- `POST /api/orders/:id/return` - Request order return after delivery.

### Payments (`/api/payments`)
- `POST /api/payments/create` - Create Razorpay order attempt.
- `POST /api/payments/verify` - Verify Razorpay payment HMAC signature.
- `POST /api/payments/fail` - Record payment failure details.

### Recovery (`/api/recovery`)
- `GET /api/recovery/cases` - List recovery cases.
- `GET /api/recovery/cases/:id` - Get recovery case details.
- `POST /api/recovery/cases/:id/send-email` - Manually trigger recovery email.

### Merchant (`/api/merchant`)
- `GET /api/merchant/dashboard` - Retrieve merchant dashboard KPIs.
- `GET /api/merchant/analytics` - Retrieve analytics metrics & timelines.
- `GET /api/merchant/products` - List seller catalog products.
- `POST /api/merchant/products` - Create new catalog product.
- `PUT /api/merchant/products/:id` - Update catalog product details.
- `DELETE /api/merchant/products/:id` - Archive seller product.
- `PUT /api/merchant/products/:id/inventory` - Adjust product inventory stock.
- `GET /api/merchant/orders` - List seller orders with status filters.
- `PUT /api/merchant/orders/:id/status` - Update order status / return logistics state.
- `POST /api/merchant/upload-image` - Upload product image asset.
- `POST /api/merchant/helper/query` - Send query to AI Merchant Helper.
- `POST /api/merchant/helper/transcribe` - Transcribe voice audio to text (Groq Whisper).
- `POST /api/merchant/helper/tts` - Synthesize text response to audio (Sarvam AI).

### Admin (`/api/admin`)
- `GET /api/admin/applications` - List merchant onboarding applications.
- `POST /api/admin/applications/:id/approve` - Approve application & provision merchant.
- `POST /api/admin/applications/:id/reject` - Reject application with feedback.
- `GET /api/admin/audit-logs` - Retrieve system audit trail logs.

### Webhooks (`/api/webhooks`)
- `POST /api/webhooks/razorpay` - Receive and process Razorpay webhooks.

---

## Database

RazorShop uses **PostgreSQL** configured via **TypeORM**.

### Core Entities & Relationships

```mermaid
erDiagram
    Customer ||--o{ Cart : owns
    Customer ||--o{ CustomerAddress : has
    Customer ||--o{ Order : places
    Merchant ||--o{ Product : owns
    Merchant ||--o{ MerchantConfig : configures
    Merchant ||--o{ MerchantApplication : submits
    Product ||--|| Inventory : has
    Cart ||--o{ CartItem : contains
    Product ||--o{ CartItem : included_in
    Order ||--o{ OrderItem : contains
    Product ||--o{ OrderItem : included_in
    Order ||--o{ OrderTimeline : tracks
    Order ||--o{ Payment : has
    Payment ||--o{ PaymentFailure : logs
    PaymentFailure ||--o| RecoveryCase : triggers
    RecoveryCase ||--o{ RecoveryAction : logs
```

### Key Tables
- `users` / `customers`: Store authentication credentials, names, emails, roles (`customer`, `merchant`, `admin`).
- `merchants`: Merchant profiles linked to user accounts.
- `merchant_applications`: Seller onboarding applications reviewed by admins.
- `products`: Catalog items with prices, categories, and deal statuses.
- `inventory`: Warehouse stock counts (`quantity_on_hand`, `reserved`).
- `carts` & `cart_items`: Active customer shopping carts.
- `orders` & `order_items`: Customer orders, line totals, and delivery statuses.
- `order_timelines`: Audit trail of order status transitions.
- `customer_addresses`: Saved delivery addresses.
- `payments` & `payment_failures`: Payment records and failure logs.
- `recovery_cases` & `recovery_actions`: Recovery pipeline cases and campaign logs.
- `merchant_configs`: Seller-defined recovery guardrails.

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS tokens (`index.css`) + TailwindCSS
- **Icons**: Custom SVG component library (`Icons.tsx`)
- **HTTP Client**: Native `fetch` API

### Backend
- **Runtime**: Node.js 20 (ES Modules)
- **Framework**: Express.js
- **ORM / Database Driver**: TypeORM + `pg` (PostgreSQL driver)
- **Authentication**: `jsonwebtoken` (JWT) + `bcryptjs`
- **Validation & Parsing**: Custom middleware + TypeORM validation

### AI & Speech Services
- **Groq API**: Groq LLaMA 3 / Mixtral for recommendations, recovery emails, and Merchant Helper chat queries.
- **Groq Whisper Large v3**: Base64 audio speech-to-text transcription.
- **Sarvam AI Bulbul v3**: Text-to-speech audio synthesis (`speaker: shubh`).

### Payment Gateway
- **Razorpay Node SDK** & **Razorpay Checkout JS**: Order creation, HMAC-SHA256 signature verification, and webhook handling.

### Infrastructure & Deployment
- **Cloud Provider**: Amazon Web Services (AWS)
- **Compute**: AWS EC2 Instance (Ubuntu 22.04 LTS)
- **Database**: AWS RDS PostgreSQL
- **Process Manager**: PM2
- **Web Server / Reverse Proxy**: Nginx (SSL/TLS via Certbot / Let's Encrypt)
- **CI/CD Pipeline**: GitHub Actions with AWS OIDC authentication & AWS SSM (Systems Manager) deployment execution script (`scripts/deploy-production.sh`)
- **Local Dev Database**: Docker & Docker Compose (`postgres:16-alpine`)

---

## Project Structure

```
RazorShop/
├── .github/
│   └── workflows/
│       └── ci-cd.yml             # GitHub Actions CI/CD workflow definition
├── docs/
│   ├── architecture.md           # System deployment topology and architecture guide
│   └── cicd.md                   # Production CI/CD pipeline, SSM, and rollback guide
├── packages/
│   ├── backend/                  # Node.js / Express API application
│   │   ├── src/
│   │   │   ├── config/           # Database, environment, and app configuration
│   │   │   ├── middleware/       # Auth, error handling, and logger middleware
│   │   │   ├── migrations/       # TypeORM database migration files
│   │   │   ├── models/           # TypeORM database entities
│   │   │   ├── routes/           # Express API route definitions
│   │   │   ├── services/         # Core business logic services
│   │   │   ├── app.ts            # Express application factory
│   │   │   ├── index.ts          # Server entry point
│   │   │   └── seed.ts           # Database seeding script
│   │   └── package.json
│   ├── frontend/                 # React / Vite SPA application
│   │   ├── src/
│   │   │   ├── components/       # UI components (Storefront, Portals, Modals)
│   │   │   │   ├── analytics/    # Analytics charts & breakdown widgets
│   │   │   │   ├── common/       # Shared UI elements (Address modals, Icons, Popover)
│   │   │   │   ├── info/         # Static policy & status pages
│   │   │   │   └── merchant/     # Merchant catalog, inventory, order, helper views
│   │   │   ├── config/           # API configuration
│   │   │   ├── services/         # Auth & Address frontend services
│   │   │   ├── App.tsx           # Main Application component & router
│   │   │   ├── index.css         # Design system CSS variables & tokens
│   │   │   └── main.tsx          # React application root entry
│   │   └── package.json
│   └── shared/                   # Shared TypeScript DTOs & API contract interfaces
│       └── src/
│           └── types/
│               └── index.ts      # DTOs, interfaces, and status types
├── scripts/
│   └── deploy-production.sh      # Production deployment & automated rollback script
├── .env.example                  # Template environment variables
├── docker-compose.yml            # Local PostgreSQL Docker configuration
├── package.json                  # Workspace root npm package configuration
└── README.md                     # Project documentation
```

---

## Environment Variables

Copy `.env.example` to `.env` in the root directory before running the application:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/razor

# Razorpay Payment Gateway (Test Credentials)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Groq AI API
GROQ_API_KEY=your_groq_api_key
AI_MODE=mock # 'mock' for local development without API keys, 'live' for real Groq API calls

# Authentication
JWT_SECRET=your_jwt_secret

# Email Service (Resend)
EMAIL_DELIVERY_MODE=mock # 'mock' suppresses external network calls, 'live' uses Resend API
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=nemat@razorshop.app

# Background Scheduler Control
SCHEDULER_ENABLED=false # Set to 'true' in production or background processing test environments
```

> **Security Note**: Never commit actual secret keys or credentials to repository tracking. Always manage production environment secrets securely on AWS server instances or GitHub Environment Secrets.

---

## Local Development Setup

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Docker & Docker Compose** (Optional, for running local PostgreSQL)

### Step-by-Step Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/NematSachdeva/RazorShop.git
   cd RazorShop
   ```

2. **Install workspace dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start Local PostgreSQL Database**:
   ```bash
   docker-compose up -d
   ```

5. **Execute Database Migrations & Seed Data**:
   ```bash
   # Run TypeORM schema migrations
   npm run db:migrate

   # Seed database with demo products, merchants, and categories
   npm run db:seed
   ```

6. **Start Development Application**:
   ```bash
   npm run dev
   ```
   - **Frontend URL**: `http://localhost:5173`
   - **Backend API URL**: `http://localhost:3000/api`

---

## Running / Building

### Workspace Build Commands

```bash
# Typecheck backend & frontend packages
npm run typecheck

# Build production workspace bundles (shared -> backend -> frontend)
npm run build

# Reset local database
npm run db:reset
```

### Production Execution

To run the production backend server locally:
```bash
cd packages/backend
npm run start
```

---

## Testing

RazorShop includes unit, integration, and flow regression test suites in `packages/backend/src`:

```bash
# Execute backend test suite
npm run test --workspace=packages/backend

# Execute isolated unit tests (bypassing pre-migration hooks)
npm run test:unit --workspace=packages/backend
```

The test suites validate:
- Authentication & JWT token security
- Catalog search, category filtering, and AI recommendations
- Cart items, bundle calculations, and inventory reservations
- Order creation, Razorpay checkout verification, and payment failures
- Cancellation workflows & 5-stage return logistics
- Merchant onboarding application lifecycle
- Merchant Helper AI query parsing, transcription fallback, and TTS formatting

---

## AWS Deployment

RazorShop is deployed in production on **Amazon Web Services (AWS)** at [https://razorshop.app](https://razorshop.app).

### Production Deployment Topology
- **AWS EC2**: Hosted on an Ubuntu 22.04 LTS EC2 instance.
- **AWS RDS**: Production database managed on AWS RDS PostgreSQL.
- **Nginx Reverse Proxy**: Listens on port 443 with SSL/TLS termination via Certbot/Let's Encrypt. Serves static frontend assets from `/var/www/razorshop` and proxies `/api/*` requests to port `7070`.
- **PM2 Daemon**: Manages the Node.js Express backend process (`razor-backend`) on internal port `7070` with automatic restarts and log rotation.

### Continuous Deployment (CI/CD Pipeline)
1. **GitHub Actions CI**: On push to `master`, GitHub Actions validates backend/frontend typechecking, executes unit tests, builds production bundles, and verifies zero hardcoded local endpoints (`localhost:3000`, `127.0.0.1:7070`) in `dist/`.
2. **AWS OIDC Authentication**: Authenticates securely with AWS using OpenID Connect (`aws-actions/configure-aws-credentials@v4`) without static AWS access keys.
3. **AWS Systems Manager (SSM)**: Triggers deployment script `scripts/deploy-production.sh` remotely on the target EC2 instance.
4. **Production Script Execution**:
   - Fetches target commit cleanly.
   - Preserves EC2 instance `/home/ubuntu/razor/.env` file.
   - Executes database migrations against AWS RDS (`npm run db:migrate`).
   - Syncs static frontend assets to `/var/www/razorshop`.
   - Restarts `razor-backend` under PM2.
   - Conducts health checks against local (`http://127.0.0.1:7070/health`) and public (`https://razorshop.app/api/health`) endpoints.
5. **Automated Rollback**: If asset compilation, PM2 restart, or health verification fails, `deploy-production.sh` automatically restores code to the previous Git commit (`PREV_COMMIT`), rebuilds assets, restarts PM2, and reports failure to GitHub Actions.

---

## Security Considerations

- **OIDC Authentication for CI/CD**: GitHub Actions deployment authenticates via AWS IAM OIDC roles, eliminating hardcoded long-lived cloud credentials.
- **JWT Authentication & RBAC**: API endpoints enforce role checks (`customer`, `merchant`, `admin`), preventing unauthorized access to seller or administrator routes.
- **HMAC Signature Verification**: Razorpay payment completions and webhooks are validated using HMAC-SHA256 signatures (`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`) to prevent payment spoofing.
- **Password Hashing**: Passwords encrypted using `bcryptjs` with salt factor of 10.
- **Raw Body Webhook Parsing**: Express captures raw unparsed buffers for Razorpay webhooks to guarantee cryptographically accurate HMAC verification.
- **Environment Secret Isolation**: Production database credentials and secret keys are stored exclusively in `/home/ubuntu/razor/.env` on the EC2 instance.

---

## Error Handling & Reliability

- **Global Express Error Middleware**: Centralized error handler returning structured JSON error objects with appropriate HTTP status codes.
- **Database Transaction Safety**: TypeORM query runner transactions ensure atomic updates during checkout, inventory reservation, order cancellations, and refunds.
- **AI Fallback & Mock Modes**: Supports `AI_MODE=mock` and `EMAIL_DELIVERY_MODE=mock` for testing environments without external network dependencies.
- **Automated Deployment Rollback**: Server-side deployment scripts automatically roll back application code and restart PM2 processes if deployment health checks fail.

---

## UI/UX Design System

- **Dual Theme Support**: Full Light Mode and Dark Mode support implemented across Customer, Merchant, and Admin Portals using unified CSS variable tokens (`var(--c-surface)`, `var(--c-bg)`, `var(--c-text)`, `var(--c-gold)`, `var(--c-border)`).
- **Responsive Layout**: Designed for mobile, tablet, and desktop viewports with responsive navigation headers, sliding drawers, and fluid product grids.
- **Micro-Animations**: Smooth CSS keyframe transitions (`animate-fadeIn`, `animate-fadeUp`, `animate-scrollBounce`), scroll-reveal observers (`.reveal.in-view`), and interactive hover states.

---

## Important Business Workflows

### Customer Workflow
`Browse Catalog` ──► `Select Product` ──► `Add to Cart / View Bundle` ──► `Select Shipping Address` ──► `Checkout & Pay via Razorpay` ──► `Order Confirmation` ──► `Track Delivery Timeline` ──► `Submit Review / Request Return`

### Merchant Workflow
`Login / Register Application` ──► `Admin Approval` ──► `Access Merchant Dashboard` ──► `Manage Products & Stock` ──► `Fulfill Orders (Dispatch/Ship/Deliver)` ──► `Process Return Logistics & Refunds` ──► `Inspect Recovery Cases` ──► `Use AI Merchant Helper`

### Admin Workflow
`Login to Admin Portal` ──► `View Pending Merchant Applications` ──► `Inspect Business Application Metadata` ──► `Approve / Reject Application` ──► `Review Audit Trail Logs`

---

## License

This project is proprietary and maintained for **RazorShop**. All rights reserved.
