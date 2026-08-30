# Razor — AI Revenue Recovery & Growth Manager

**Razor** is an intelligent e-commerce revenue recovery and growth manager designed for high-converting online stores. It pairs a modern React checkout and catalog experience with automated payment failure recovery workflows, AI-powered product recommendations, and real-time merchant analytics.

---

## Technical Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript, TypeORM
- **Database**: PostgreSQL (AWS RDS in Production)
- **Deployment**: AWS EC2, PM2 Process Manager, Nginx Reverse Proxy (HTTPS)
- **AI Engine**: Groq API (`llama3-70b-8192`)
- **Payment Gateway**: Razorpay Test Mode API
- **Email Delivery**: Resend API (supports live & mock delivery modes)

---

## Architecture Overview

```
                      +-------------------+
                      |   Client Browser  |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      | Nginx Web Server  | (Port 443 HTTPS / Reverse Proxy)
                      +----+---------+----+
                           |         |
          Static Assets    |         | API Requests (/api/*)
          (dist/)          v         v
                     +-------+   +---------------+
                     | Vite  |   | Express API   | (PM2 / Port 7070)
                     | SPA   |   | Backend       |
                     +-------+   +-------+-------+
                                         |
                                         v
                                 +---------------+
                                 |  AWS RDS      | (PostgreSQL Database)
                                 |  PostgreSQL   |
                                 +---------------+
```

For comprehensive details on deployment topology, process management, and infrastructure details, see [docs/architecture.md](file:///Users/nematsachdeva/Downloads/Razor/docs/architecture.md).

For milestone implementation history and audit logs, see [docs/project-history.md](file:///Users/nematsachdeva/Downloads/Razor/docs/project-history.md).

---

## Quick Start (Local Development)

### 1. Requirements
- Node.js (v18+) & npm (v9+)
- Docker & Docker Compose (for local PostgreSQL database)

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/NematSachdeva/RazorShop.git
cd Razor

# Install workspace dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### 3. Database Initialization
```bash
# Start local PostgreSQL database
docker-compose up -d

# Run TypeORM migrations
npm run db:migrate

# Seed sample products, merchant configs, and demo data
npm run db:seed
```

### 4. Run Development Servers
```bash
# Start all workspace dev servers (Frontend on :5173, Backend on :3000)
npm run dev
```

---

## Available Scripts

| Script | Action |
| :--- | :--- |
| `npm run dev` | Starts development servers across all workspaces |
| `npm run build` | Builds TypeScript and Vite production bundles for all workspaces |
| `npm run test` | Executes Jest test suites across all workspaces |
| `npm run typecheck` | Runs TypeScript type checking across all workspaces |
| `npm run db:migrate` | Runs pending database migrations |
| `npm run db:seed` | Seeds database with demo catalog and merchant data |
| `npm run db:reset` | Runs migrations and seeds fresh data |

---

## Key Features

- **Storefront & Checkout**: Full product catalog, modal views, sliding cart drawer, and interactive Razorpay checkout modal.
- **AI Recommendation Engine**: Context-aware cart and product recommendations powered by Groq LLM with automatic bundle discounts.
- **Automated Recovery Agent**: Instant detection of failed payment attempts, reason classification (card decline, authentication error, limit exceeded), and automated email recovery campaigns.
- **Merchant Analytics Hub**: Revenue funnel tracking, failure cause breakdown, active recovery cases, promise-to-pay tracking, and merchant inventory editor.
- **Production Hardened**: Relative `/api` frontend configuration, same-origin CORS scoping, database migrations, and zero-downtime PM2 deployment compatibility.
