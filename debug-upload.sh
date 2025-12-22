#!/bin/bash
# Debug script for upload issue

echo "=== 1. Check uploads folder exists and permissions ==="
ls -la /root/apps/license-active/uploads/
ls -la /root/apps/license-active/uploads/releases/ 2>/dev/null || echo "❌ releases folder does not exist"

echo ""
echo "=== 2. Check backend is running ==="
pm2 list | grep license-api
curl -s http://localhost:3000/health || echo "❌ Backend not responding on localhost:3000"

echo ""
echo "=== 3. Check nginx config for proxy ==="
sudo nginx -T 2>/dev/null | grep -A 20 "server_name license.dangthanhson.com"

echo ""
echo "=== 4. Test backend upload endpoint directly (needs auth token) ==="
echo "You need to run this manually with a valid token:"
echo 'curl -X POST http://localhost:3000/admin/app-versions/upload \'
echo '  -H "Authorization: Bearer YOUR_TOKEN" \'
echo '  -F "appCode=test" \'
echo '  -F "version=1.0.0" \'
echo '  -F "file=@/path/to/test.zip"'

echo ""
echo "=== 5. Check recent backend logs ==="
pm2 logs license-api --lines 30 --nostream

echo ""
echo "=== 6. Check nginx error logs ==="
sudo tail -n 30 /var/log/nginx/license-frontend-error.log

echo ""
echo "=== 7. Check if port 3000 is listening ==="
sudo netstat -tlnp | grep :3000 || ss -tlnp | grep :3000
