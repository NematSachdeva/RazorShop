# RazorShop — AI Revenue Recovery & Growth Manager

**RazorShop** is an enterprise-grade e-commerce platform and AI-powered revenue recovery manager designed for modern online merchants. It combines a high-converting customer storefront, an embedded Razorpay checkout pipeline, automated payment failure recovery workflows, order cancellation & return logistics management, voice-enabled AI merchant assistance, and comprehensive analytics.

- **Production URL**: [https://razorshop.app](https://razorshop.app)
- **GitHub Repository**: [https://github.com/NematSachdeva/RazorShop](https://github.com/NematSachdeva/RazorShop)

---

## 1. Project Overview

### Problem Statement
E-commerce businesses lose significant potential revenue to:
1. **Payment Failures**: Transient network drops, card declines, insufficient funds, and authentication timeouts during checkout.
2. **Abandoned Carts**: High-intent shoppers dropping off before payment completion.
3. **Complex Return/Cancellation Workflows**: Friction and lack of visibility when managing customer order returns, inventory restocks, and refund processing.
4. **Merchant Operational Bottlenecks**: Manual effort required to analyze revenue risk, run recovery campaigns, and perform catalog or order management.

### Platform Solution & Purpose
RazorShop resolves these pain points through an end-to-end architecture:
- **Customer Storefront & Checkout**: Seamless browsing, filtering, cart recommendations, and payment processing.
- **Automated Payment Failure & Cart Recovery Engine**: Real-time detection, AI failure diagnosis, automated recovery campaigns, and promise-to-pay tracking.
- **Merchant Helper AI Assistant**: Natural language text and voice interaction for merchant tasks (stock updates, deal creation, order processing, return approvals, and store insights).
- **Comprehensive Merchant Analytics**: Real-time dashboards tracking revenue, revenue at risk, recovered revenue, failure breakdown, and customer response trends.

### User Roles & Portals
1. **Customer Portal**: End-consumer storefront for browsing products, managing cart items, checking out via Razorpay, tracking order status, submitting feedback, and requesting cancellations or returns.
2. **Merchant Portal**: Store owner dashboard for managing products, inventory, orders, returns/refunds, recovery cases, merchant configuration guardrails, and conversing with the AI Merchant Helper.
3. **Admin Portal**: Platform administrator interface for reviewing, approving, or rejecting new merchant applications and viewing system-wide application metrics.

---

## 2. Key Features

### Customer Portal
- **Product Browsing**: Dynamic grid view displaying active product deals, original vs. discounted pricing, ratings, and stock indicators.
- **Category Navigation**: Category tabs and sidebar filter (Archived categories are automatically filtered out from customer view).
- **Price Range Filtering**: Min and max price filters with real-time application.
- **In-Stock Filtering**: Instant toggle to show only items with available inventory.
- **Product Search**: Real-time text search across product names and descriptions.
- **Sorting**: Sort products by Newest, Price (Low to High / High to Low), and Name (A–Z / Z–A).
- **Pagination**: Server-side paginated product lists.
- **Product Details Modal**: Full product details view, image gallery, inventory check, and AI product recommendations.
- **Sliding Cart Drawer**: Interactive cart with quantity controls, item removal, bundle offer banners, and automatic total calculations.
- **Checkout & Payment Flow**: Embedded Razorpay payment gateway integration, shipping address management, and instant order creation.
- **Order Tracking & History**: Customer order history with visual timeline (`Pending` → `Confirmed` → `Dispatched` → `Shipped` → `Delivered`), return/cancellation status tracking, and receipt views.
- **Order Feedback System**: Post-order 1–5 star rating and category feedback submission.
- **Delivery Address Management**: Customer address book supporting multiple addresses, default address setting, creation, editing, and deletion.
- **Light / Dark Mode**: Theme toggle with preference persistence in `localStorage`.
- **UI Animations**: Smooth CSS transitions, dynamic slide-over drawers, and responsive layouts.

### Merchant / Seller Portal
- **Real-Time Dashboard**: Comprehensive metrics for total revenue, revenue at risk, recovered revenue, failed payments, abandoned carts, cancellation/return rates, and daily revenue timeline.
- **Orders & Fulfillment Management**: Filterable order tables with status controls (`Dispatched`, `Shipped`, `Delivered`, `Cancelled`).
- **Cancellation & Return/Refund Lifecycle**:
  - Customer pre-dispatch cancellation processing.
  - Return request management (`Approve Return`, `Reject Return` with mandatory reason).
  - 5-stage return logistics pipeline (`Pickup Scheduled` → `Picked Up` → `In Transit` → `Returned to Seller` → `Refund Initiated`).
  - Idempotent stock restoration executed strictly upon return arrival to seller.
  - Manual merchant refund initiation with payment verification audit trail.
- **Products & Stock Management**: Product catalog management, inline stock editor, deal creation (discount percentage and expiration timer), image uploads, and soft-deletion/archiving.
- **Recovery Cases Management**: Active recovery case table, status filtering (`Open`, `In Progress`, `Resolved`, `Abandoned`, `Customer Declined`), manual email triggers, agent decision history, and opt-out tracking.
- **Merchant Helper (AI Assistant)**:
  - **Text & Voice Commands**: Dual-mode natural language interface.
  - **Voice Transcription**: Groq Whisper Large v3 voice-to-text with auto-script verification and targeted Hindi retry logic.
  - **Text-to-Speech (TTS)**: Sarvam AI Bulbul v3 TTS speech synthesis (speaker: `shubh`) for audio responses.
  - **Interactive Action Proposals**: Structured action proposals requiring merchant confirmation prior to executing deals, price changes, stock adjustments, refunds, or cancellations.
- **Merchant Guardrails Configuration**: Max recovery attempts, max discount percentages, allowed communication channels, promise-to-pay limits, and AI feature toggles.
- **Merchant Application Status View**: Real-time status display and decision timeline for pending/approved/rejected merchant onboarding applications.

### Admin Portal
- **Merchant Application Management**: List and inspect submitted merchant onboarding applications.
- **Application Review Workflow**: Approve applications (automatically provisioning merchant records and updating customer roles) or Reject applications with mandatory feedback.
- **Application Metrics Summary**: Overview of total, pending, approved, and rejected merchant applications.

---

## 3. Authentication & Authorization

### Authentication Architecture
- **JWT (JSON Web Tokens)**: Stateless token-based authentication. Tokens are signed using `JWT_SECRET` with a 7-day expiration.
- **Password Security**: Passwords hashed using `bcryptjs` (salt rounds = 10). Public administrator registration is strictly prohibited.
- **Client Storage**: Tokens and authenticated user objects stored in `localStorage` and sent via `Authorization: Bearer <token>` headers.

### Available Roles
1. `customer`: Default role for store shoppers. Can manage personal cart, delivery addresses, place orders, view order history, submit feedback, and cancel/return orders.
2. `merchant`: Approved seller role. Grants access to the merchant dashboard, product catalog management, order fulfillment, return logistics, recovery cases, and the AI Merchant Helper.
3. `admin`: Platform administrator role. Access restricted to application review and merchant provisioning routes (`/api/admin/*`).

### Protected Routes & Access Control Middleware
- `createAuthenticate`: Validates JWT token and attaches user payload to `req.user`.
- `requireCustomer`: Restricts route to authenticated customers.
- `requireMerchant`: Restricts route to users with merchant credentials.
- `createRequireApprovedMerchant`: Ensures the merchant's application status is `approved` before granting dashboard access.
- `requireAdmin`: Restricts route to system administrators.

---

## 4. Product Management

### Product Data Structure
Products are represented by the `Product` TypeORM entity:
- `id` (UUID), `name`, `description`, `category`, `image_url`
- `price_cents` (BigInt in cents, e.g., 299900 = ₹2,999.00)
- `original_price_cents`, `discount_percent`
- `deal_active` (Boolean), `deal_expires_at` (Timestamp)
- `merchant_id` (UUID foreign key linking product to seller)

### Inventory Architecture
Inventory is maintained in a separate `Inventory` entity:
- `quantity_on_hand`: Physical stock available in warehouse.
- `reserved`: Stock reserved in active customer carts/orders.
- `available`: Calculated as `max(0, quantity_on_hand - reserved)`.

### Pricing & Deals
Merchants or the AI Merchant Helper can activate deals on products or carts. Active deals specify a discount percentage and an expiration timestamp. When a deal expires, prices automatically revert to original values.

### Product Status & Archived Category Behavior
Products can be archived when deleted by a merchant if historical order records exist. Archived products retain category `'archived'` to preserve historical analytics, but the Customer Portal automatically filters out the `'archived'` category from top category tabs and sidebar filter lists.

---

## 5. Cart, Order & Payment Flow

```mermaid
flowchart TD
    A[Customer browses catalog] --> B[Add item to Cart]
    B --> C[Cart Recommendation / Bundle Offer]
    C --> D[Initiate Checkout & Select Address]
    D --> E[Create Order in 'pending' state]
    E --> F[Create Razorpay Payment Attempt]
    F --> G{Payment Status}
    G -- Success --> H[Verify HMAC Signature]
    H --> I[Update Order to 'confirmed']
    I --> J[Merchant Dispatches Order]
    J --> K[Order Delivered]
    G -- Failed --> L[Trigger PaymentFailure & Recovery Pipeline]
    L --> M[Create RecoveryCase & Trigger AI Campaign]
```

1. **Cart Creation**: Customer creates or retrieves an active cart. Items are added with stock verification.
2. **Order Initiation**: Order is created from the cart, converting cart items into `OrderItem` records, setting initial status to `pending`, and calculating subtotal, tax, discount, and total cents.
3. **Payment Initiation**: `PaymentService` creates a `PaymentAttempt` row in PostgreSQL and generates a Razorpay Order ID.
4. **Payment Verification**: When payment completes on client, backend verifies the HMAC-SHA256 signature (`razorpay_payment_id` + `razorpay_order_id`). Upon verification, payment status becomes `captured` and order status updates to `confirmed`.
5. **Payment Failure**: If payment fails or is cancelled, backend records a `PaymentFailure` entry with error context and triggers the recovery pipeline.

---

## 6. Revenue Recovery System

### Concept & Trigger Events
Revenue recovery captures lost sales from:
1. **Failed Payment Transactions**: Card declines, network errors, insufficient funds, 3DS authentication failures.
2. **Abandoned Carts**: High-value active carts that did not convert within threshold windows.

### Recovery Case Lifecycle
```
[Payment Failure / Abandoned Cart]
              │
              ▼
         RecoveryCase ('open')
              │
              ├──► AI Diagnosis & Strategy Selection
              │
              ▼
    RecoveryCase ('in_progress') ◄──► Customer Communication (Email / Direct Link)
              │
              ├── Customer Pays ──────────────► RecoveryCase ('resolved')
              ├── Max Attempts Reached ────────► RecoveryCase ('abandoned')
              └── Customer Opts Out ──────────► RecoveryCase ('customer_declined')
```

### Customer Interaction & Promise-to-Pay (M6)
Customers responding to recovery communications can express intents:
- `accepted`: Customer agrees to retry payment.
- `refused`: Customer declines; case marked `customer_declined`.
- `promised`: Customer commits to pay by a specific date. System creates a `PromiseToPay` record with `promised_deadline` and `promised_amount_cents`.
- `unclear`: System schedules automated follow-up.

### Merchant Guardrails
Merchants configure recovery rules in `MerchantConfig`:
- `max_recovery_attempts` (default: 3)
- `max_discount_percent` (default: 30%)
- `allowed_channels` (`["email", "sms"]`)
- `customer_opt_outs` (List of opted-out customer UUIDs)

---

## 7. Merchant Helper / AI Assistant

### Functionality & Capabilities
The Merchant Helper (`MerchantHelperService`) is a store management assistant supporting text and voice queries:
- **Sales & Performance**: "What were my total sales this week?", "Show revenue breakdown."
- **Inventory Control**: "Update stock for product X to 50", "Which items are low in stock?"
- **Deal Management**: "Give a 15% discount on abandoned cart 2 for 2 hours", "Create a deal on Headphones."
- **Fulfillment & Returns**: "Cancel order #ORD-1002", "Approve return for order #ORD-1005", "Initiate refund for order #ORD-1008".

### Multi-Modal Architecture (Voice & Audio)
- **Voice Transcription (STT)**: Accepts base64 audio recordings (`webm`, `wav`, `m4a`). Transcribes using **Groq Whisper Large V3**. Features automatic script validation to detect improper script output and re-runs transcription forcing Hindi (`hi`) language setting if necessary.
- **Text-to-Speech (TTS)**: Synthesizes audio responses using **Sarvam AI Bulbul v3** (`speaker: shubh`). Cleans visual Markdown tags before voice synthesis and selects appropriate language tags (`hi-IN` or `en-IN`).

### Human-in-the-Loop Confirmation
For actions modifying store state (deals, price edits, stock updates, refunds, cancellations), the assistant generates a structured `proposal`. Execution is paused until the merchant confirms via `POST /api/merchant/helper/action/confirm`.

---

## 8. Analytics & Metrics

| Metric Name | DB Source / Calculation | Description |
| :--- | :--- | :--- |
| **Total Revenue** (`total_revenue_cents`) | Sum of `total_cents` for `confirmed`/`delivered` orders | Overall settled store revenue in period |
| **Revenue at Risk** (`revenue_at_risk_cents`) | Sum of `total_cents` for open/in-progress `RecoveryCase`s & abandoned carts | Revenue linked to uncompleted checkout attempts |
| **Revenue Recovered** (`revenue_recovered_cents`) | Sum of `total_cents` for orders with resolved `RecoveryCase`s | Revenue successfully recaptured by recovery campaigns |
| **Failed Payments Count** (`failed_payments_count`) | Count of `PaymentFailure` records | Total failed checkout attempts |
| **Abandoned Carts Count** (`abandoned_carts_count`) | Count of inactive unconverted `Cart` records | Number of abandoned cart instances |
| **Recovery Rate** (`recovery_rate_percent`) | `(resolved_cases / total_cases) * 100` | Percentage of failed cases successfully recovered |
| **Cancelled Orders** (`orders_cancelled_count`) | Count of orders with status `cancelled` | Total order cancellations |
| **Returned Orders** (`orders_returned_count`) | Count of orders with status `order_returned_to_seller` or `refund_initiated` | Total order returns |

---

## 9. API Documentation

### Health
- `GET /api/health` — Public system health check. Returns database connection status and server timestamp.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register customer or submit merchant application. Body: `{ email, password, name, role, business_name, phone, reason }`.
- `POST /api/auth/login` — Authenticate user. Body: `{ email, password }`. Returns JWT token and user profile.
- `GET /api/auth/me` — [Auth Required] Retrieve current authenticated user session.

### Products (`/api/products`)
- `GET /api/products` — List active catalog products. Query: `page`, `limit`, `category`, `search`, `minPrice`, `maxPrice`, `sort`.
- `GET /api/products/categories` — List distinct product categories.
- `GET /api/products/:id` — Retrieve detailed product information by UUID.

### Delivery Addresses (`/api/addresses`)
- `GET /api/addresses` — [Customer] List customer's saved addresses.
- `GET /api/addresses/default` — [Customer] Get customer's default delivery address.
- `POST /api/addresses` — [Customer] Create delivery address.
- `PUT /api/addresses/:id` — [Customer] Update delivery address.
- `PUT /api/addresses/:id/default` — [Customer] Set address as default.
- `DELETE /api/addresses/:id` — [Customer] Delete delivery address.

### Cart Management (`/api/carts`)
- `POST /api/carts` — [Customer] Create or retrieve active cart.
- `GET /api/carts/:id` — [Customer] Get cart contents by UUID.
- `POST /api/carts/:id/items` — [Customer] Add product to cart. Body: `{ product_id, quantity }`.
- `PUT` / `PATCH /api/carts/:id/items/:productId` — [Customer] Update item quantity.
- `DELETE /api/carts/:id/items/:productId` — [Customer] Remove item from cart.
- `DELETE /api/carts/:id` — [Customer] Clear all cart items.
- `POST /api/carts/:id/bundle` — [Customer] Apply recommended product bundle deal to cart.

### Recommendations (`/api/recommendations`)
- `GET /api/recommendations/products/:id` — Get product-level recommendations and bundle offers.
- `GET /api/recommendations/carts/:id` — Get cross-sell recommendations for active cart.
- `POST /api/recommendations/:id/events` — Track recommendation events (`shown`, `clicked`, `added_to_cart`, `purchased`, `ignored`).
- `POST /api/recommendations/:id/purchase-attribution` — Attribute order purchase to recommendation.
- `GET /api/recommendations/:id/metrics` — View conversion metrics for a recommendation.

### Orders (`/api/orders`)
- `POST /api/orders` — Create order from active cart. Body: `{ cart_id, customer_id, shipping_address }`.
- `GET /api/orders` — List customer orders with pagination. Query: `customer_id`, `page`, `limit`.
- `GET /api/orders/:id` — Get order details by UUID.
- `GET /api/orders/:id/timeline` — View order event timeline history.
- `POST /api/orders/:id/feedback` — [Customer] Submit or update 1–5 star rating and comment feedback.
- `GET /api/orders/:id/feedback` — [Customer] Retrieve feedback for order.
- `POST /api/orders/:id/cancel` — [Customer] Cancel pre-dispatch order. Body: `{ reason, customer_id }`.
- `POST /api/orders/:id/return` — [Customer] Request return for delivered order. Body: `{ reason, customer_id }`.

### Payments (`/api/payments`)
- `POST /api/payments/create` — Initiate Razorpay payment attempt. Query: `?demo=failure_network` (Optional demo failure mode).
- `POST /api/payments/fail` — Record payment failure and trigger recovery pipeline. Body: `{ order_id, reason, error_context }`.
- `POST /api/payments/verify` — Verify Razorpay signature and capture payment. Body: `{ order_id, razorpay_payment_id, razorpay_signature }`.
- `GET /api/payments/:orderId` — Fetch payment records for an order.

### Webhooks (`/api/webhooks`)
- `POST /api/webhooks/razorpay` — Webhook endpoint for Razorpay asynchronous payment events. Header: `X-Razorpay-Signature`.

### Recovery Management (`/api/recovery`)
- `GET /api/recovery/cases/:id` — Get recovery case details.
- `GET /api/recovery/cases/:id/decisions` — Get AI agent decision history for case.
- `POST /api/recovery/cases/:id/analyze` — Manually trigger AI analysis and strategy generation.
- `POST /api/recovery/cases/:id/opt-out` — Opt customer out of recovery communications.
- `GET /api/recovery/config/:merchantId` — Retrieve merchant recovery guardrails.
- `PUT /api/recovery/config/:merchantId` — Update merchant recovery guardrails.
- `POST /api/recovery/respond` — Record customer recovery response (`accepted`, `refused`, `promised`, `unclear`).

### Merchant Operations (`/api/merchant`)
- `GET /api/merchant/application-status` — Get merchant applicant status and review timeline.
- `GET /api/merchant/dashboard` — [Approved Merchant] Comprehensive merchant analytics dashboard.
- `GET /api/merchant/feedback` — [Approved Merchant] Customer feedback list and ratings summary.
- `GET /api/merchant/recovery-cases` — [Approved Merchant] List store recovery cases.
- `GET /api/merchant/recovery-cases/:id` — [Approved Merchant] Get recovery case details.
- `POST /api/merchant/recovery-cases/:id/trigger-email` — [Approved Merchant] Manually send recovery email.
- `GET /api/merchant/insights` — [Approved Merchant] View AI-generated store insights.
- `POST /api/merchant/insights/refresh` — [Approved Merchant] Refresh daily AI insights.
- `GET /api/merchant/config` — [Approved Merchant] Get merchant config.
- `PUT /api/merchant/config` — [Approved Merchant] Update merchant config.
- `GET /api/merchant/products` — [Approved Merchant] List store product catalog.
- `POST /api/merchant/upload-image` — [Approved Merchant] Upload product image.
- `POST /api/merchant/products` — [Approved Merchant] Create new product.
- `PUT /api/merchant/products/:id` — [Approved Merchant] Update product details.
- `PUT /api/merchant/products/:id/inventory` — [Approved Merchant] Update product stock levels.
- `DELETE /api/merchant/products/:id` — [Approved Merchant] Delete/archive product.
- `GET /api/merchant/orders` — [Approved Merchant] List store orders with status filtering.
- `GET /api/merchant/orders/:id` — [Approved Merchant] Get detailed order info.
- `POST /api/merchant/orders/:id/approve-return` — [Approved Merchant] Approve customer return request.
- `POST /api/merchant/orders/:id/reject-return` — [Approved Merchant] Reject customer return request. Body: `{ rejection_reason }`.
- `PATCH /api/merchant/orders/:id/return-logistics` — [Approved Merchant] Advance return logistics stage.
- `POST /api/merchant/orders/:id/initiate-refund` — [Approved Merchant] Mark refund initiated for returned order.
- `PATCH /api/merchant/orders/:id/status` — [Approved Merchant] Update order fulfillment status.
- `POST /api/merchant/helper/chat` — [Approved Merchant] Natural language chat query to AI Helper.
- `POST /api/merchant/helper/action/confirm` — [Approved Merchant] Confirm execution of AI proposal.
- `POST /api/merchant/helper/transcribe` — [Approved Merchant] Transcribe voice audio to text (STT).
- `POST /api/merchant/helper/tts` — [Approved Merchant] Synthesize text response to audio (TTS).

### Admin (`/api/admin`)
- `GET /api/admin/summary` — [Admin] Application summary statistics.
- `GET /api/admin/applications` — [Admin] List merchant onboarding applications.
- `GET /api/admin/applications/:id` — [Admin] View application details and review history.
- `POST /api/admin/applications/:id/approve` — [Admin] Approve merchant application.
- `POST /api/admin/applications/:id/reject` — [Admin] Reject merchant application. Body: `{ rejection_reason }`.

---

## 10. Database / Data Models

### Database Technology
- **Database Engine**: PostgreSQL 16 (AWS RDS PostgreSQL in production).
- **ORM**: TypeORM with TypeScript entity mappings.

### Major Entities & Relationships
```mermaid
erDiagram
    Customer ||--o{ Order : places
    Customer ||--o{ Cart : owns
    Customer ||--o{ CustomerAddress : manages
    Merchant ||--o{ Product : owns
    Merchant ||--o{ MerchantConfig : has
    Product ||--o| Inventory : tracks
    Cart ||--o{ CartItem : contains
    Order ||--o{ OrderItem : contains
    Order ||--o{ Payment : has
    Order ||--o{ OrderTimeline : records
    Payment ||--o{ PaymentFailure : logs
    PaymentFailure ||--o{ RecoveryCase : creates
    RecoveryCase ||--o{ RecoveryAction : logs
    RecoveryCase ||--o{ AgentDecision : records
    RecoveryCase ||--o{ CustomerInteraction : receives
    RecoveryCase ||--o{ PromiseToPay : binds
```

1. **`Customer`**: User credentials (`email`, `password_hash`), phone, name, role (`customer`, `merchant`, `admin`).
2. **`CustomerAddress`**: Saved shipping addresses (`full_address`, `state`, `pin_code`, `is_default`).
3. **`Merchant`**: Business profile (`business_name`, `email`, `phone`, status).
4. **`MerchantApplication`**: Applicant request details and review status (`pending`, `approved`, `rejected`).
5. **`MerchantConfig`**: Operational parameters (`max_recovery_attempts`, `max_discount_percent`, `customer_opt_outs`).
6. **`Product`**: Catalog item details, pricing in cents, active deal flags, and `merchant_id`.
7. **`Inventory`**: Stock tracking (`quantity_on_hand`, `reserved`).
8. **`Cart` & `CartItem`**: Active user carts, item quantities, and deal discounts.
9. **`Order` & `OrderItem`**: Order snapshots, totals, shipping address snapshot, fulfillment status, return/cancellation timestamps.
10. **`Payment` & `PaymentAttempt`**: Payment states (`initiated`, `pending`, `captured`, `failed`, `refunded`) and Razorpay IDs.
11. **`PaymentFailure` & `RecoveryCase`**: Failed payment records, root cause classification, and recovery case tracking.
12. **`CustomerInteraction` & `PromiseToPay`**: Logged customer responses and promised payment deadlines.
13. **`Recommendation` & `RecommendationEvent`**: AI recommendation pairings and impression/click tracking events.

---

## 11. Tech Stack

### Frontend
- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.0.8
- **Language**: TypeScript 5.3.3
- **Styling**: Vanilla CSS with CSS Variables (`var(--c-gold)`, `var(--c-surface)`), Tailwind CSS 3.4.1, PostCSS 8.4.32, Autoprefixer 10.4.17
- **HTTP Client**: Axios 1.6.5 & Native Fetch API

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express 4.18.2
- **Language**: TypeScript 5.3.3 (run via `ts-node` in dev)
- **Database ORM**: TypeORM 0.3.17 & `pg` 8.11.3
- **Authentication**: `jsonwebtoken` 8.5.1, `bcryptjs` 2.4.3
- **Scheduler**: `node-cron` 3.0.2

### External APIs & Integrations
- **Payment Gateway**: Razorpay Node SDK (`razorpay` 2.9.8)
- **Email Delivery**: Resend SDK (`resend` 3.0.0)
- **AI Services**:
  - Groq API (`whisper-large-v3` for STT, `openai/gpt-oss-120b` for emails, `llama3-70b-8192` for recommendations)
  - Sarvam AI API (`bulbul:v3` model for TTS speech synthesis)

### Testing & Infrastructure
- **Test Framework**: Jest 29.7.0, `ts-jest` 29.1.1, Supertest 7.2.2
- **Containerization**: Docker & Docker Compose (`postgres:16-alpine`)
- **Process Management**: PM2 (`razor-backend`)
- **Web Server**: Nginx (Reverse Proxy & SSL termination)

---

## 12. Project Structure

```
Razor/
├── package.json                 # Monorepo root workspace configuration
├── docker-compose.yml           # Local PostgreSQL database container configuration
├── .env.example                 # Template for environment configuration
├── scripts/
│   └── deploy-production.sh     # EC2 deployment and rollback script
├── docs/
│   ├── architecture.md          # Technical infrastructure documentation
│   ├── cicd.md                  # CI/CD pipeline specification
│   └── project-history.md       # Development history and milestone tracking
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # GitHub Actions CI/CD workflow
└── packages/
    ├── shared/                  # Shared TypeScript models and API DTOs
    │   └── src/
    │       └── types/index.ts   # Core interface definitions
    ├── backend/                 # Node.js / Express backend service
    │   ├── src/
    │   │   ├── app.ts           # Express app builder with middleware & routes
    │   │   ├── index.ts         # Server entry point
    │   │   ├── migration.ts     # Migration execution script
    │   │   ├── seed.ts          # Database seed script
    │   │   ├── config/          # Database connection & env validation
    │   │   ├── middleware/      # Authentication, CORS, logging, error handling
    │   │   ├── models/          # 29 TypeORM database entities
    │   │   ├── routes/          # Express API route modules and tests
    │   │   └── services/        # Business services (Order, Payment, AI, Recs)
    │   └── package.json
    └── frontend/                # React 18 / Vite SPA storefront
        ├── src/
        │   ├── main.tsx         # React app entry point
        │   ├── App.tsx          # Storefront SPA router & main component
        │   ├── components/      # UI components (Cart, Merchant, Orders, Modals)
        │   ├── services/        # Client auth & address services
        │   └── config/          # API endpoint URL helper
        └── package.json
```

---

## 13. Setup & Installation

### Prerequisites
- Node.js `v20.x` or higher
- npm `v9.x` or higher
- Docker & Docker Compose (for running local PostgreSQL database)

### Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/NematSachdeva/RazorShop.git
   cd RazorShop
   ```

2. **Install Workspace Dependencies**:
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

5. **Run Database Migrations & Seed Data**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   - Frontend SPA will run at: `http://localhost:5173`
   - Backend API will run at: `http://localhost:3000`

---

## 14. Environment Variables

Below are the configurable environment variables declared in `.env.example`:

| Variable | Description | Example / Default Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Application runtime mode | `development` |
| `PORT` | Internal backend server port | `3000` |
| `FRONTEND_URL` | Allowed CORS frontend URL | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/razor` |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | `rzp_test_your_key_id` |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret | `your_key_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook HMAC Secret | `your_webhook_secret` |
| `GROQ_API_KEY` | Groq AI Platform API Key | `your_groq_api_key` |
| `SARVAM_API_KEY` | Sarvam AI Platform API Key (TTS) | `your_sarvam_api_key` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your_jwt_secret` |
| `EMAIL_DELIVERY_MODE` | Email delivery architecture (`mock` or `live`) | `mock` |
| `RESEND_API_KEY` | Resend Email API Key | `your_resend_api_key` |
| `RESEND_FROM_EMAIL` | Sender email address for Resend API | `nemat@razorshop.app` |
| `AI_MODE` | AI service operating mode (`mock` or `live`) | `mock` |
| `SCHEDULER_ENABLED` | Cron background scheduler toggle (`true`/`false`) | `false` |

> **Security Note**: Never commit actual production credentials or API keys to repository source control.

---

## 15. Deployment Architecture

### Infrastructure Overview
Production infrastructure is hosted on AWS:
- **Web Server & Reverse Proxy**: Nginx running on AWS EC2 listening on port 443 with SSL termination.
- **Frontend SPA**: Static build deployed to `/var/www/razorshop`.
- **Backend Application**: Node.js Express service running under PM2 process manager (`razor-backend`) bound to `127.0.0.1:7070`.
- **Managed Database**: AWS RDS PostgreSQL instance connected via encrypted internal network.

```mermaid
flowchart LR
    User[Client Browser] -->|HTTPS 443| Nginx[Nginx Web Server]
    Nginx -->|Static Files| Static[/var/www/razorshop SPA/]
    Nginx -->|Proxy /api/*| PM2[Node.js Express / PM2 Port 7070]
    PM2 -->|TypeORM| RDS[(AWS RDS PostgreSQL)]
    PM2 -->|API Calls| Groq[Groq AI API]
    PM2 -->|API Calls| Sarvam[Sarvam AI API]
    PM2 -->|API Calls| Razorpay[Razorpay Gateway]
    PM2 -->|API Calls| Resend[Resend Email API]
```

### CI/CD Automated Pipeline
Depoloyments are automated via GitHub Actions (`.github/workflows/ci-cd.yml`):
1. **CI Phase**: Executes TypeScript typechecks for backend/frontend, initializes CI Postgres database schema, runs backend unit tests (`npm run test:unit`), builds production bundles, and verifies no local hardcoded URLs exist in the build output.
2. **CD Phase**: Uses AWS OIDC credentials to trigger AWS Systems Manager (SSM) on the EC2 instance, running `scripts/deploy-production.sh`.
3. **Automated Rollback**: If migration, build, or health-check steps fail, the deployment script automatically reverts Git commits, rebuilds the previous version, restarts PM2, and restores Nginx static files.

---

## 16. Testing

### Test Suite Structure
Razor includes unit and integration tests using Jest and Supertest:
- **Backend Integration Tests**: Located in `packages/backend/src/routes/*.test.ts` and `packages/backend/src/services/*.test.ts`.
- **Coverage Areas**: Auth lifecycle, order cancellation & return workflows, cart bundles, payment failure scenarios, Razorpay webhook signature verification, email delivery modes, merchant helper commands, transcription script validation, and TTS language detection.

### Running Tests

```bash
# Run all backend test suites with automated DB migrations
npm test

# Run isolated unit tests
npm run test:unit --workspace=packages/backend

# Run a specific test suite
npx jest src/routes/cancellation_and_return_workflow.test.ts --workspace=packages/backend
```

---

## 17. Development Scripts

Root `package.json` scripts:
- `npm run dev`: Starts all workspace development servers in parallel (`backend` on `:3000`, `frontend` on `:5173`).
- `npm run build`: Compiles TypeScript across all workspace packages and builds Vite production assets.
- `npm run test`: Executes test suites across workspaces.
- `npm run lint`: Runs ESLint across all workspaces.
- `npm run typecheck`: Runs `tsc --noEmit` to validate TypeScript types across workspaces.
- `npm run db:migrate`: Executes database migrations in `packages/backend`.
- `npm run db:seed`: Populates initial test merchants, customers, products, and inventory.
- `npm run db:reset`: Runs database migrations and seeds fresh data.

---

## 18. UI / UX Design System

- **Design Aesthetic**: Premium dark mode theme by default with gold accents (`--c-gold: #e5c158`, `--c-surface: #141312`), dark glassmorphism modals, polished typography, and clean contrast ratios.
- **Theme Support**: Seamless Light/Dark theme toggling dynamically updating CSS root variables.
- **Responsive Layout**: Mobile-first responsive layouts with sticky navigation headers, slide-out cart drawers, and responsive product grids.
- **Micro-Interactions**: Hover states, active tabs, loading spinners, state transition animations, and toast feedback alerts.

---

## 19. Error Handling & Resilience

- **Express Global Error Middleware**: Centralized `errorHandler` catches unhandled exceptions, logs errors, and returns structured JSON error responses (`ErrorResponse`).
- **Webhook Security**: `verifyWebhookSignature` uses timing-safe HMAC comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **AI Graceful Fallbacks**: If external Groq or Sarvam AI endpoints experience rate limits or downtime, AI recommendations revert to catalog fallbacks and emails log locally without interrupting primary checkout/order flows.
- **Voice Transcription Validation**: If Whisper STT outputs Urdu/Arabic script for spoken Hindi input, `TranscriptionService` automatically triggers a Hindi-forced retry.

---

## 20. End-to-End Business Flow

```
Customer browses catalog & adds items to Cart
                 │
                 ▼
Customer completes Razorpay Payment at Checkout
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[Payment Succeeds]   [Payment Fails]
      │                     │
      ▼                     ▼
Order Confirmed       PaymentFailure logged & RecoveryCase created
      │                     │
      ▼                     ▼
Merchant Dispatches   AI Customer Recovery Campaign sent (Email/Link)
      │                     │
      ▼                     ├─► Customer Pays ──► Order Confirmed
Order Delivered             └─► Customer Promises ──► PromiseToPay tracked
      │
      ▼
Customer requests Return (if applicable)
      │
      ▼
Merchant Approves Return
      │
      ▼
5-Stage Logistics Pipeline (Pickup → Picked Up → In Transit → Returned to Seller)
      │
      ▼
Item returned to seller (Inventory automatically restored) & Merchant Initiates Refund
```

---

## 21. System Architecture Diagram

```mermaid
graph TB
    subgraph Client Layer
        SPA[React 18 / Vite SPA Storefront]
    end

    subgraph API Layer
        Express[Express API Gateway]
        AuthMW[Auth Middleware - JWT]
        LoggerMW[Request Logger]
    end

    subgraph Business Logic Layer
        OrderSvc[Order Service]
        PaySvc[Payment Service]
        RecSvc[Recommendation Service]
        RecovSvc[Recovery Service]
        HelperSvc[Merchant Helper AI Service]
    end

    subgraph Data Layer
        DB[(AWS RDS PostgreSQL)]
    end

    subgraph External Integrations
        Razorpay[Razorpay Gateway]
        Groq[Groq AI Platform]
        Sarvam[Sarvam AI Platform]
        Resend[Resend Email API]
    end

    SPA -->|HTTP / JSON| Express
    Express --> AuthMW --> LoggerMW
    LoggerMW --> OrderSvc & PaySvc & RecSvc & RecovSvc & HelperSvc
    OrderSvc & PaySvc & RecSvc & RecovSvc & HelperSvc --> DB
    PaySvc --> Razorpay
    RecSvc & HelperSvc --> Groq
    HelperSvc --> Sarvam
    RecovSvc & HelperSvc --> Resend
```

---

## 22. Project Status & Limitations

### Implemented Functionality
- Full customer storefront, cart, Razorpay payment verification, order history, addresses, cancellations, returns, and ratings.
- Merchant dashboard, order fulfillment, return logistics pipeline, stock management, and recovery cases.
- AI Merchant Helper with voice (STT & TTS), deal creation, stock updates, refunds, and order cancellations.
- Admin portal for reviewing and approving/rejecting merchant onboarding applications.

### Mock & Demonstration Modes
- `EMAIL_DELIVERY_MODE=mock`: Logs email payloads locally during development/testing without calling external Resend API.
- `AI_MODE=mock`: Returns mock recommendations and transcriptions when external AI API keys are not provided.
- `PaymentSimulator`: Supports injecting demo failure scenarios (`?demo=failure_network`) to test recovery workflows.

---

## 23. Security Practices

- **Password Hashing**: `bcryptjs` hashing with salt rounds = 10.
- **JWT Session Protection**: Signed tokens with 7-day expiration.
- **CORS Configuration**: Restricts origin requests and permits safe HTTP headers.
- **Parameterized SQL Queries**: All database operations execute through TypeORM query builder / repositories, preventing SQL injection vulnerabilities.
- **Timing-Safe HMAC Verification**: Webhook signatures verified using `crypto.timingSafeEqual`.
- **Input Validation**: Robust validation of UUID formats, page/limit parameters, and numeric ranges.

---

## 24. Contributing & Development Guidelines

1. **Code Conventions**: Write TypeScript with strict typing. Ensure all API DTO changes are updated in `packages/shared/src/types/index.ts`.
2. **Database Schema Changes**: Create typeORM migration files in `packages/backend/src/migrations/` rather than modifying raw database tables directly.
3. **Pre-Commit Verification**: Run `npm run typecheck` and `npm test` before pushing changes to ensure zero compilation or test errors.

---

## 25. License

RazorShop is currently an unreleased private repository. All rights reserved. Refer to repository header or contact repository owner for license inquiries.
