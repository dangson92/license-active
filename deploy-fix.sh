#!/bin/bash
# Complete deployment script for upload fix

set -e  # Exit on error

echo "🚀 Deploying upload fix to license server..."
echo ""

# 1. Navigate to app directory
echo "📁 Step 1: Navigating to app directory..."
cd /root/apps/license-active

# 2. Pull latest code
echo "📥 Step 2: Pulling latest code..."
git fetch origin
git pull origin main  # Adjust branch name if needed

# 3. Verify trust proxy is in the code
echo "🔍 Step 3: Verifying trust proxy setting..."
if grep -q "app.set('trust proxy', true)" server/index.js; then
    echo "✅ Trust proxy setting found in code"
else
    echo "❌ ERROR: Trust proxy setting NOT found in code!"
    echo "Please merge the PR first or manually add the setting."
    exit 1
fi

# 4. Show current rate limiter config
echo "🔍 Step 4: Checking rate limiter configuration..."
grep -A 4 "const activateLimiter = rateLimit" server/index.js

# 5. Stop PM2 completely
echo "🛑 Step 5: Stopping PM2 process..."
pm2 stop license-api || true
sleep 2

# 6. Delete PM2 process (clear any cached modules)
echo "🧹 Step 6: Deleting PM2 process to clear cache..."
pm2 delete license-api || true
sleep 2

# 7. Start fresh
echo "🚀 Step 7: Starting license-api fresh..."
pm2 start npm --name "license-api" -- run backend
sleep 5

# 8. Save PM2 config
echo "💾 Step 8: Saving PM2 configuration..."
pm2 save

# 9. Check status
echo "📊 Step 9: Checking PM2 status..."
pm2 list | grep license-api

# 10. Test for ValidationError
echo ""
echo "🧪 Step 10: Testing for ValidationError..."
sleep 3
pm2 logs license-api --lines 50 --nostream --err | grep -i "ValidationError" && \
    echo "⚠️  WARNING: ValidationError still present!" || \
    echo "✅ No ValidationError found!"

echo ""
echo "📋 Recent logs (last 20 lines):"
pm2 logs license-api --lines 20 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Test upload at https://license.dangthanhson.com/admin"
echo "2. Monitor logs: pm2 logs license-api"
echo "3. If ValidationError persists, run: bash test-trust-proxy.sh"
