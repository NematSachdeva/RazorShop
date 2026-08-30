# Real Production CI/CD Pipeline & Deployment Guide

This document describes the production CI/CD architecture, stage separation, database migration flow, and automated rollback strategy for **Razor** (`https://razorshop.app`).

---

## Architecture Overview

```
                      [ Git Push to master / Dispatch ]
                                     │
                                     ▼
                      +------------------------------+
                      |  GitHub Actions: 'ci' Job    |
                      |  - npm ci                    |
                      |  - backend typecheck         |
                      |  - frontend typecheck        |
                      |  - backend unit tests        |
                      |    (Isolated Test Env)       |
                      |  - npm run build             |
                      |  - dist bundle URL check     |
                      +--------------+---------------+
                                     │ (Success)
                                     ▼
                      +------------------------------+
                      |  GitHub Actions: 'deploy'    |
                      |  - Environment: production   |
                      |  - AWS OIDC Authentication   |
                      |  - AWS SSM Send-Command      |
                      +--------------+---------------+
                                     │ (SSM Command Execution)
                                     ▼
                      +------------------------------+
                      |  EC2 Server (/home/ubuntu)   |
                      |  - Record PREV_COMMIT        |
                      |  - git fetch & reset master  |
                      |  - Preserve EC2 .env         |
                      |  - npm ci                    |
                      |  - npm run db:migrate (RDS)  |
                      |  - npm run build             |
                      |  - Sync /var/www/razorshop   |
                      |  - pm2 restart razor-backend |
                      |  - Health checks             |
                      |  - Rollback on failure       |
                      +------------------------------+
```

---

## 1. CI Validation (Continuous Integration)

The CI job runs on every push to `master` to validate code quality and build integrity **before** any code reaches production.

### Key Rules
- **No Production Secrets in CI**: CI uses isolated, non-production placeholder environment variables (`NODE_ENV=test`, dummy key formats).
- **No Production RDS Connection**: CI never connects to or modifies the production AWS RDS PostgreSQL database.
- **Isolated Test Command**: CI runs Jest unit tests via `npm run test:unit --workspace=packages/backend` (`NODE_OPTIONS=--experimental-vm-modules jest`) directly, bypassing local developer database migration pre-hooks.

### Executed Steps
1. Checkout source code (`actions/checkout@v4`).
2. Setup Node.js 20 with npm caching (`actions/setup-node@v4`).
3. Install dependencies (`npm ci`).
4. Typecheck backend (`npm run typecheck --workspace=packages/backend`).
5. Typecheck frontend (`npm run typecheck --workspace=packages/frontend`).
6. Run unit tests (`npm run test:unit --workspace=packages/backend`).
7. Build production workspace bundles (`npm run build`).
8. Verify frontend bundle safety (confirms zero `localhost:3000`, `localhost:7070`, or `127.0.0.1:7070` references in `dist/`).

---

## 2. CD Deployment & Production RDS Migrations

The CD job executes **only** after CI succeeds (`needs: ci`) and is scoped to GitHub Deployment Environment `production`.

### Key Rules
- **AWS OIDC Authentication**: Authenticates with AWS using OpenID Connect (`aws-actions/configure-aws-credentials@v4`) without hardcoded access keys.
- **AWS Systems Manager (SSM)**: Triggers `/home/ubuntu/razor/scripts/deploy-production.sh` remotely on the EC2 instance.
- **Production .env Preservation**: The deployment script never overwrites `/home/ubuntu/razor/.env`, which remains the source of truth for production database credentials and API secrets.
- **Production RDS Database Migrations**: Pending migrations are executed directly against the production AWS RDS PostgreSQL instance using:
  ```bash
  npm run db:migrate --workspace=packages/backend
  ```
- **Atomic Frontend Asset Deployment**: Builds static frontend assets and syncs them to `/var/www/razorshop`.
- **PM2 Service Reload**: Restarts the existing daemon process `razor-backend` without spawning duplicate PM2 instances.

---

## 3. Automated Rollback Strategy

If database migration, asset compilation, file copying, PM2 restart, or health verification fails during deployment on EC2:

1. **Trap Handler Activated**: `trap rollback ERR` catches any failed exit code.
2. **Git Commit Restore**: Reverts the repository to the previously recorded Git commit (`git reset --hard $PREV_COMMIT`).
3. **Re-Install & Rebuild**: Runs `npm ci` and `npm run build` on the previous commit code.
4. **Restore Web Root**: Re-syncs the previous static frontend bundle to `/var/www/razorshop`.
5. **Restart PM2**: Restarts the `razor-backend` process with the previous working code.
6. **Re-Verify Health**: Checks backend health (`http://127.0.0.1:7070/health`).
7. **Signal Failure**: Exits with non-zero status `1`, causing the GitHub Actions deployment job to report failure cleanly.

---

## 4. Required GitHub Inputs & Infrastructure Setup

### GitHub Environment Secrets (`production`)

| Key | Description |
| :--- | :--- |
| `AWS_ROLE_TO_ASSUME` | IAM Role ARN configured for GitHub OIDC (e.g. `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`) |
| `AWS_REGION` | AWS Region of the EC2 instance and SSM service (e.g. `ap-south-1`) |
| `AWS_EC2_INSTANCE_ID` | EC2 Instance ID of the production server (e.g. `i-0123456789abcdef0`) |

### Manual Infrastructure Configuration
1. **AWS IAM OIDC Trust**: Create an OIDC provider for `https://token.actions.githubusercontent.com` and an IAM role allowing `repo:NematSachdeva/RazorShop:environment:production` to assume it.
2. **IAM SSM Permissions**: Attach `AmazonSSMManagedInstanceCore` to the EC2 instance profile and grant `ssm:SendCommand` to the OIDC deployment role.
3. **EC2 Production `.env`**: Maintain `/home/ubuntu/razor/.env` on the EC2 server containing valid `DATABASE_URL` (AWS RDS), `RAZORPAY_*`, `GROQ_API_KEY`, `JWT_SECRET`, and `RESEND_API_KEY`.
