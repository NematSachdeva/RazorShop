#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Starting Razor Production Deployment"
echo "Timestamp: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "=================================================="

APP_DIR="/home/ubuntu/razor"
FRONTEND_WEB_ROOT="/var/www/razorshop"
PM2_PROCESS_NAME="razor-backend"
BACKEND_HEALTH_URL="http://127.0.0.1:7070/health"
PUBLIC_API_HEALTH_URL="https://razorshop.app/api/health"

# 1. Navigate to application directory
echo "[1/7] Navigating to application directory ($APP_DIR)..."
cd "$APP_DIR" || { echo "ERROR: Application directory $APP_DIR does not exist."; exit 1; }

# 2. Update code from master (preserving local .env)
echo "[2/7] Fetching latest changes from origin/master..."
git fetch origin master
git reset --hard origin/master

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: Production .env file missing in $APP_DIR! Deployment aborted."
  exit 1
fi
echo "Verified: Local .env file preserved."

# 3. Install dependencies
echo "[3/7] Installing production dependencies..."
npm ci

# 4. Build application
echo "[4/7] Building production bundles..."
npm run build

# 5. Verify frontend production bundle safety
echo "[5/7] Verifying frontend production bundle safety..."
if grep -rn "localhost" packages/frontend/dist > /dev/null; then
  echo "ERROR: Localhost reference detected in packages/frontend/dist!"
  grep -rn "localhost" packages/frontend/dist
  exit 1
fi

if grep -rn "7070" packages/frontend/dist > /dev/null; then
  echo "ERROR: Hardcoded port 7070 reference detected in packages/frontend/dist!"
  grep -rn "7070" packages/frontend/dist
  exit 1
fi
echo "Verified: Frontend bundle is clean and uses same-origin /api."

# 6. Deploy frontend static assets
echo "[6/7] Deploying static assets to web root ($FRONTEND_WEB_ROOT)..."
if [ ! -d "$FRONTEND_WEB_ROOT" ]; then
  echo "Creating web root directory $FRONTEND_WEB_ROOT..."
  sudo mkdir -p "$FRONTEND_WEB_ROOT"
fi

sudo rsync -a --delete packages/frontend/dist/ "$FRONTEND_WEB_ROOT/"
sudo chmod -R 755 "$FRONTEND_WEB_ROOT"

# 7. Restart existing PM2 backend process
echo "[7/7] Restarting backend PM2 process ($PM2_PROCESS_NAME)..."
if pm2 list | grep -q "$PM2_PROCESS_NAME"; then
  pm2 restart "$PM2_PROCESS_NAME"
else
  echo "ERROR: PM2 process '$PM2_PROCESS_NAME' is not running!"
  echo "Please start the existing process first to prevent duplicate process creation."
  exit 1
fi

# 8. Health Verification
echo "=================================================="
echo "Performing Deployment Health Verification"
echo "=================================================="

echo "Checking internal backend health ($BACKEND_HEALTH_URL)..."
for i in {1..10}; do
  if curl -s -f "$BACKEND_HEALTH_URL" > /dev/null; then
    echo "✓ Internal backend health check passed."
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "ERROR: Internal backend health check failed after 10 attempts."
    exit 1
  fi
  echo "Waiting for backend to initialize (attempt $i/10)..."
  sleep 2
done

echo "Checking public HTTPS API health ($PUBLIC_API_HEALTH_URL)..."
for i in {1..5}; do
  if curl -s -f -k "$PUBLIC_API_HEALTH_URL" > /dev/null; then
    echo "✓ Public HTTPS API health check passed."
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "WARNING: Public HTTPS API health check returned non-200. Check Nginx/DNS status."
    # Non-fatal if DNS/SSL is managed externally, but fail if internal backend failed
  fi
  sleep 2
done

echo "=================================================="
echo "Razor Production Deployment Successfully Completed!"
echo "=================================================="
