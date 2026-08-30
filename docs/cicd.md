# CI/CD Pipeline & Deployment Architecture

This document describes the repository automation, CI/CD pipeline structure, and deployment procedures for the **Razor** application.

---

## Pipeline Overview

```
                      [ Git Push to master / Dispatch ]
                                     │
                                     ▼
                      +------------------------------+
                      |  GitHub Actions: 'ci' Job    |
                      |  - npm ci                    |
                      |  - backend typecheck         |
                      |  - frontend typecheck        |
                      |  - backend test suite        |
                      |  - npm run build             |
                      +--------------+---------------+
                                     │ (Success)
                                     ▼
                      +------------------------------+
                      |  GitHub Actions: 'deploy'    |
                      |  - Environment: production   |
                      |  - AWS OIDC Authentication   |
                      |  - AWS SSM Send-Command      |
                      +--------------+---------------+
                                     │ (SSM Execution)
                                     ▼
                      +------------------------------+
                      |  EC2 Production Instance     |
                      |  - scripts/deploy-production |
                      |  - Sync frontend (/var/www)  |
                      |  - PM2 restart razor-backend |
                      |  - Health verification       |
                      +------------------------------+
```

---

## Repository Automation Components

### 1. GitHub Workflow (`.github/workflows/ci-cd.yml`)
- **Triggers**: Automated execution on `push` to the `master` branch and manual trigger via `workflow_dispatch`.
- **Job 1: `ci`**
  - Runs in an isolated `ubuntu-latest` container.
  - Installs dependencies using `npm ci`.
  - Runs backend (`npm run typecheck --workspace=packages/backend`) and frontend (`npm run typecheck --workspace=packages/frontend`) type checks.
  - Executes unit and integration test suites via Jest (`npm run test --workspace=packages/backend`).
  - Verifies production builds (`npm run build`).
- **Job 2: `deploy`**
  - Blocked until `ci` passes (`needs: ci`).
  - Scoped to GitHub Deployment Environment `production`.
  - Authenticates with AWS via OpenID Connect (OIDC) without hardcoded keys.
  - Issues an AWS Systems Manager (SSM) command to run `bash /home/ubuntu/razor/scripts/deploy-production.sh` on the target EC2 instance.

### 2. EC2 Deployment Script (`scripts/deploy-production.sh`)
- Executed on the EC2 server under `/home/ubuntu/razor`.
- **Key Guarantee**: Strictly preserves local `/home/ubuntu/razor/.env` configuration.
- Fetches and hard-resets working tree to `origin/master`.
- Installs dependencies (`npm ci`) and builds workspace assets (`npm run build`).
- **Bundle Safety Verification**: Ensures `packages/frontend/dist` contains zero hardcoded `localhost` or port `7070` references.
- **Frontend Assets**: Atomically syncs `packages/frontend/dist` to `/var/www/razorshop`.
- **Backend Process**: Reloads the existing PM2 process named `razor-backend` without spawning duplicate processes.
- **Health Check**: Validates internal API health (`http://127.0.0.1:7070/health`) and public HTTPS endpoint (`https://razorshop.app/api/health`).

---

## Required GitHub Inputs & Secrets

The GitHub Actions workflow requires the following configuration values to be set in your GitHub Repository Settings (**Settings > Secrets and variables > Actions** & **Settings > Environments > production**):

| Configuration Key | Type | Description / Expected Value |
| :--- | :--- | :--- |
| `AWS_ROLE_TO_ASSUME` | Secret | ARN of the AWS IAM Role configured with GitHub OIDC trust policy (e.g. `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`) |
| `AWS_REGION` | Secret / Variable | AWS Region where the EC2 instance and SSM service are hosted (e.g. `ap-south-1`) |
| `AWS_EC2_INSTANCE_ID` | Secret / Variable | AWS EC2 Instance ID of the production server (e.g. `i-0123456789abcdef0`) |

> **Security Note:** Do not commit actual AWS secret keys, access keys, or private SSH keys into repository files or environment definitions. OIDC authentication eliminates the need for long-lived credentials.

---

## External Infrastructure Setup (Manual Steps)

The following infrastructure tasks must be completed separately in your AWS Console / CLI:

1. **AWS IAM OIDC Identity Provider**:
   - Create an IAM OIDC Identity Provider for `https://token.actions.githubusercontent.com` with audience `sts.amazonaws.com`.
2. **AWS IAM Deployment Role**:
   - Create an IAM role with a Trust Policy allowing `repo:NematSachdeva/FINT:environment:production` to assume the role.
   - Attach permissions to grant `ssm:SendCommand`, `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations` for the target EC2 instance.
3. **AWS Systems Manager (SSM) Agent on EC2**:
   - Ensure `amazon-ssm-agent` is running on the Ubuntu EC2 instance.
   - Attach an IAM Instance Profile to the EC2 instance with policy `AmazonSSMManagedInstanceCore`.
4. **Permissions on Web Root**:
   - Ensure the `ubuntu` user has permissions to write/rsync to `/var/www/razorshop`.
5. **GitHub Environment `production`**:
   - Create an environment named `production` under GitHub Repository Settings > Environments.
   - Configure secrets (`AWS_ROLE_TO_ASSUME`, `AWS_REGION`, `AWS_EC2_INSTANCE_ID`).
