#!/bin/bash
# Test if trust proxy is working

echo "=== Testing trust proxy configuration ==="
echo ""

# Test với curl và X-Forwarded-For header
echo "1. Testing endpoint with X-Forwarded-For header:"
curl -s http://localhost:3000/health \
  -H "X-Forwarded-For: 1.2.3.4" \
  -v 2>&1 | grep -E "HTTP|health"

echo ""
echo "2. Testing activate endpoint (với rate limiter):"
curl -s http://localhost:3000/activate \
  -H "X-Forwarded-For: 1.2.3.4" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  -v 2>&1 | head -20

echo ""
echo "3. Check PM2 logs cho ValidationError:"
pm2 logs license-api --lines 5 --nostream --err | grep -i "ValidationError" || echo "✅ No ValidationError found"

echo ""
echo "4. Verify trust proxy setting in code:"
grep -n "trust proxy" /root/apps/license-active/server/index.js

echo ""
echo "5. Check if PM2 process was restarted recently:"
pm2 info license-api | grep -E "uptime|restart time"
