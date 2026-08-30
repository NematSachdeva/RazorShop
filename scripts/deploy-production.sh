#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Starting Razor Production Deployment & Migration"
echo "Timestamp: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "=================================================="

APP_DIR="/home/ubuntu/razor"
FRONTEND_WEB_ROOT="/var/www/razorshop"
PM2_PROCESS_NAME="razor-backend"
BACKEND_HEALTH_URL="http://127.0.0.1:7070/health"
PUBLIC_API_HEALTH_URL="https://razorshop.app/api/health"
PUBLIC_SITE_URL="https://razorshop.app"

# 1. Navigate to application directory
echo "[1/8] Navigating to application directory ($APP_DIR)..."
cd "$APP_DIR" || { echo "ERROR: Application directory $APP_DIR does not exist."; exit 1; }

# Record previous Git commit hash for rollback capability
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
echo "Current deployed commit before update: ${PREV_COMMIT:-unknown}"

# Define automated rollback error handler
rollback() {
  echo "=================================================="
  echo "DEPLOYMENT FAILED! INITIATING AUTOMATED ROLLBACK"
  echo "=================================================="
  if [ -n "${PREV_COMMIT:-}" ]; then
    echo "[Rollback] Restoring code to previous commit ($PREV_COMMIT)..."
    git reset --hard "$PREV_COMMIT" || true
    
    echo "[Rollback] Re-installing dependencies..."
    npm ci || true
    
    echo "[Rollback] Rebuilding production assets..."
    npm run build || true
    
    echo "[Rollback] Restoring frontend static assets to $FRONTEND_WEB_ROOT..."
    sudo rsync -a --delete packages/frontend/dist/ "$FRONTEND_WEB_ROOT/" || true
    
    echo "[Rollback] Restarting PM2 process ($PM2_PROCESS_NAME)..."
    pm2 restart "$PM2_PROCESS_NAME" || true
    
    echo "[Rollback] Checking backend health post-rollback..."
    curl -s -f "$BACKEND_HEALTH_URL" || true
  else
    echo "[Rollback] No previous commit hash recorded; skipping Git rollback."
  fi
  echo "=================================================="
  echo "Rollback completed. Exiting with error status 1."
  echo "=================================================="
  exit 1
}

# Trap any unexpected failure to invoke rollback
trap rollback ERR

# 2. Fetch and update source code from master
echo "[2/8] Fetching and updating code to origin/master..."
git fetch origin master
git checkout master
git reset --hard origin/master

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: Production .env file missing at $APP_DIR/.env!"
  exit 1
fi
echo "Verified: Local production .env file preserved."

# 3. Install production dependencies
echo "[3/8] Installing production workspace dependencies..."
npm ci

# 4. Execute production database migrations against AWS RDS
echo "[4/8] Running production database migrations on AWS RDS..."
npm run db:migrate --workspace=packages/backend

# 5. Build production frontend and backend bundles
echo "[5/8] Building workspace production bundles..."
npm run build

# 6. Verify frontend production bundle safety
echo "[6/8] Auditing frontend production bundle for prohibited endpoints..."
if grep -rn "localhost:3000" packages/frontend/dist > /dev/null; then
  echo "ERROR: Found hardcoded 'localhost:3000' in production build!"
  exit 1
fi

if grep -rn "localhost:7070" packages/frontend/dist > /dev/null; then
  echo "ERROR: Found hardcoded 'localhost:7070' in production build!"
  exit 1
fi

if grep -rn "127.0.0.1:7070" packages/frontend/dist > /dev/null; then
  echo "ERROR: Found hardcoded '127.0.0.1:7070' in production build!"
  exit 1
fi
echo "✓ Verified: Production bundle contains no local API URLs."

# 7. Atomic update of frontend static assets
echo "[7/8] Deploying frontend build assets to $FRONTEND_WEB_ROOT..."
if [ ! -d "$FRONTEND_WEB_ROOT" ]; then
  echo "Creating web root $FRONTEND_WEB_ROOT..."
  sudo mkdir -p "$FRONTEND_WEB_ROOT"
fi

# Ensure build output index.html exists before syncing
if [ ! -f "packages/frontend/dist/index.html" ]; then
  echo "ERROR: Production build output packages/frontend/dist/index.html is missing!"
  exit 1
fi

sudo rsync -a --delete packages/frontend/dist/ "$FRONTEND_WEB_ROOT/"
sudo chmod -R 755 "$FRONTEND_WEB_ROOT"

# 8. Restart existing PM2 backend process
echo "[8/8] Restarting backend PM2 process ($PM2_PROCESS_NAME)..."
if pm2 list | grep -q "$PM2_PROCESS_NAME"; then
  pm2 restart "$PM2_PROCESS_NAME"
else
  echo "ERROR: PM2 process '$PM2_PROCESS_NAME' is not running!"
  echo "Cannot restart unmanaged PM2 process. Deployment aborted."
  exit 1
fi

# 9. Health Verification
echo "=================================================="
echo "Performing Production Health & Endpoint Checks"
echo "=================================================="

# Check PM2 status
echo "Checking PM2 process status..."
pm2 status "$PM2_PROCESS_NAME"

# Check local internal Express backend health (port 7070)
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
  echo "Waiting for backend service to respond (attempt $i/10)..."
  sleep 2
done

# Check public HTTPS API health
echo "Checking public HTTPS API health ($PUBLIC_API_HEALTH_URL)..."
for i in {1..5}; do
  if curl -s -f -k "$PUBLIC_API_HEALTH_URL" > /dev/null; then
    echo "✓ Public HTTPS API health check passed."
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo "WARNING: Public HTTPS API health check returned non-200 status."
  fi
  sleep 2
done

# Check public HTTPS site root headers
echo "Checking public site HTTP headers ($PUBLIC_SITE_URL)..."
if curl -fsSI "$PUBLIC_SITE_URL" > /dev/null; then
  echo "✓ Public website ($PUBLIC_SITE_URL) returned HTTP 200 OK."
else
  echo "WARNING: Public site check returned error status."
fi

# Disable error trap upon successful completion
trap - ERR

echo "=================================================="
echo "Razor Production Deployment & Migration Completed!"
echo "Timestamp: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "=================================================="
