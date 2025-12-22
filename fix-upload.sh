#!/bin/bash
# Fix upload issue - run this on VPS

set -e  # Exit on error

echo "🔧 Fixing upload issue..."

# 1. Create uploads folder
echo ""
echo "📁 Step 1: Creating uploads folder..."
cd /root/apps/license-active
mkdir -p uploads/releases
chmod -R 755 uploads
chown -R $(whoami):$(whoami) uploads
echo "✅ Uploads folder created: /root/apps/license-active/uploads/releases/"
ls -la uploads/

# 2. Pull latest code
echo ""
echo "📥 Step 2: Pulling latest code..."
git pull

# 3. Install dependencies if needed
echo ""
echo "📦 Step 3: Checking dependencies..."
npm install

# 4. Rebuild frontend
echo ""
echo "🏗️  Step 4: Building frontend..."
npm run build

# 5. Deploy frontend
echo ""
echo "🚀 Step 5: Deploying frontend..."
rm -rf /var/www/license-app/*
cp -r dist/* /var/www/license-app/
echo "✅ Frontend deployed to /var/www/license-app/"

# 6. Update nginx config
echo ""
echo "⚙️  Step 6: Updating nginx config..."
echo "Backing up current config..."
sudo cp /etc/nginx/sites-available/license.dangthanhson.com /etc/nginx/sites-available/license.dangthanhson.com.backup

echo "You need to manually update nginx config. Use this file as reference:"
echo "  /root/apps/license-active/nginx-license-frontend.conf"
echo ""
echo "Or copy it directly:"
echo "  sudo cp /root/apps/license-active/nginx-license-frontend.conf /etc/nginx/sites-available/license.dangthanhson.com"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"

# 7. Restart backend
echo ""
echo "🔄 Step 7: Restarting backend..."
pm2 restart license-api
sleep 3
pm2 logs license-api --lines 20 --nostream

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update nginx config (see above)"
echo "2. Test upload at https://license.dangthanhson.com"
echo "3. Check browser console (F12) for errors"
echo "4. Run debug script: bash /root/apps/license-active/debug-upload.sh"
