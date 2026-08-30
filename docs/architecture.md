# Technical Architecture & Deployment Guide

## System Overview

**Razor** is an AI-driven e-commerce revenue recovery and growth manager application. It provides:
- Seamless customer checkout with Razorpay integration
- Intelligent product & cart recommendations powered by AI (Groq API / LLM)
- Automated payment failure detection & customer recovery workflows
- Merchant dashboard with real-time analytics, revenue metrics, and inventory management

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js (Express) + TypeScript + TypeORM
- **Database**: PostgreSQL (AWS RDS in production)
- **Deployment**: AWS EC2 + PM2 + Nginx (HTTPS via Certbot / SSL)
- **External Services**: Razorpay Payment Gateway, Groq AI API, Resend Email API

---

## Production Deployment Topology

```
                       [ HTTPS Client ]
                              │
                              ▼
                     [ Nginx Web Server ]
                     (SSL Terminated, Port 443)
                      /              \
         Static Assets               /api Proxy
              │                          │
              ▼                          ▼
      [ Vite Production ]       [ Express Backend ]
        (Frontend Build)         (PM2 / Port 7070)
                                         │
                                         ▼
                                  [ AWS RDS PostgreSQL ]
```

### 1. Nginx Reverse Proxy
- Serves pre-built static frontend assets (`dist/`).
- Proxies `/api/*` requests to the internal Express backend running on `http://127.0.0.1:7070`.
- Manages SSL certificates (HTTPS) for `https://razorshop.app`.

### 2. Backend Process (PM2)
- Node.js Express server listening internally on port 7070.
- Executed under PM2 process manager for auto-restart, logging, and daemon management.
- Handles API endpoints, database transactions via TypeORM, background schedulers, and payment/recovery agents.

### 3. Database Layer (AWS RDS PostgreSQL)
- Production PostgreSQL database instance managed on AWS RDS.
- Synchronized through TypeORM migrations (`packages/backend/src/migrations`).

---

## Workspace Directory Structure

```
/
├── packages/
│   ├── backend/          # Express API server, TypeORM entities, services, migrations
│   ├── frontend/         # React SPA frontend (Vite)
│   └── shared/           # Shared TypeScript types and utilities
├── docs/                 # System documentation & project history
│   ├── architecture.md   # System architecture and deployment topology (this file)
│   └── project-history.md# Consolidated project milestone history (M1-M8)
├── .env.example          # Template environment variable configurations
├── docker-compose.yml    # Local PostgreSQL service helper
└── README.md             # Project overview & local setup guide
```

---

## Environment Variables Configuration

| Variable | Description | Default / Production Setup |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` / `development` |
| `PORT` | Backend listening port | `7070` (production internal) / `3000` (dev) |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@rds-host:5432/razor` |
| `FRONTEND_URL` | Frontend origin for CORS | `https://razorshop.app` |
| `VITE_API_URL` | Optional frontend API URL override | Omit in prod (uses `/api` same-origin) |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | Key ID from Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret Key | Key Secret from Razorpay Dashboard |
| `GROQ_API_KEY` | Groq AI API Key | API Key for AI recommendation engine |
| `JWT_SECRET` | Secret key for signing JWT tokens | Random secure string |
| `EMAIL_DELIVERY_MODE` | Email service mode | `mock` or `live` |
| `RESEND_API_KEY` | Resend email API key | API key if live email delivery enabled |
| `SCHEDULER_ENABLED` | In-process background scheduler | `true` in prod / `false` in dev/test |

---

## Build & Local Development Commands

### Development Setup
```bash
# Install dependencies
npm install

# Start local PostgreSQL database via Docker (optional)
docker-compose up -d

# Run database migrations
npm run db:migrate

# Start development servers (frontend + backend)
npm run dev
```

### Production Build & Verification
```bash
# Typecheck backend and frontend workspaces
npm run typecheck --workspace=packages/backend
npm run typecheck --workspace=packages/frontend

# Build production bundles
npm run build

# Run unit and integration tests
npm run test --workspace=packages/backend
```
