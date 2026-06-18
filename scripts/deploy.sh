#!/usr/bin/env bash
#
# Quick deploy — chạy TRÊN VPS (Ubuntu + Nginx + PM2).
# Pull code mới → build frontend → đẩy dist sang web root → restart backend (PM2) → health check.
#
# Cách dùng (từ thư mục repo trên server, hoặc bất kỳ đâu):
#   bash scripts/deploy.sh                  # full: pull + build FE + deploy + restart BE
#   bash scripts/deploy.sh --backend-only   # chỉ pull + restart PM2 (khi chỉ sửa server/*.js)
#   bash scripts/deploy.sh --frontend-only  # chỉ build + deploy frontend (không động PM2)
#   bash scripts/deploy.sh --install        # chạy thêm `npm install` (khi đổi dependency)
#   bash scripts/deploy.sh --no-pull        # bỏ qua git pull (deploy state hiện tại)
#
# Có thể override cấu hình bằng biến môi trường, ví dụ:
#   VITE_API_URL=https://api.dangthanhson.com PM2_NAME=license-active bash scripts/deploy.sh
#
set -euo pipefail

# ───────────────────────── CONFIG (sửa cho khớp server của bạn) ─────────────────────────
APP_DIR="${APP_DIR:-$HOME/apps/license-active}"                  # vị trí repo trên server
BRANCH="${BRANCH:-main}"                                         # nhánh git để deploy
PM2_NAME="${PM2_NAME:-license-active}"                           # tên process PM2 của backend
WEB_ROOT="${WEB_ROOT:-/var/www/license-app}"                     # nơi Nginx serve SPA
VITE_API_URL="${VITE_API_URL:-https://api.phanmemauto.com}"      # API base nhúng vào bản build FE
HEALTH_URL="${HEALTH_URL:-${VITE_API_URL%/}/health}"             # endpoint kiểm tra backend
# ────────────────────────────────────────────────────────────────────────────────────────

DO_PULL=1; DO_INSTALL=0; DO_FRONTEND=1; DO_BACKEND=1
for arg in "$@"; do
  case "$arg" in
    --no-pull)       DO_PULL=0 ;;
    --install)       DO_INSTALL=1 ;;
    --backend-only)  DO_FRONTEND=0 ;;
    --frontend-only) DO_BACKEND=0 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "❌ Tham số không hợp lệ: $arg (dùng -h để xem trợ giúp)"; exit 1 ;;
  esac
done

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

cd "$APP_DIR"

if [ "$DO_PULL" = 1 ]; then
  log "Pull code mới ($BRANCH)…"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

if [ "$DO_INSTALL" = 1 ]; then
  log "Cài dependencies (npm install)…"
  npm install
fi

if [ "$DO_FRONTEND" = 1 ]; then
  log "Build frontend (VITE_API_URL=$VITE_API_URL)…"
  VITE_API_URL="$VITE_API_URL" npm run build

  log "Deploy dist → $WEB_ROOT …"
  sudo mkdir -p "$WEB_ROOT"
  sudo rm -rf "${WEB_ROOT:?}/"*
  sudo cp -r dist/* "$WEB_ROOT"/
  sudo chown -R www-data:www-data "$WEB_ROOT"
  sudo chmod -R 755 "$WEB_ROOT"
fi

if [ "$DO_BACKEND" = 1 ]; then
  log "Restart backend (PM2: $PM2_NAME)…"
  if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env
  else
    echo "  (chưa có process — start mới)"
    pm2 start npm --name "$PM2_NAME" -- run backend
  fi
  pm2 save
fi

log "Health check: $HEALTH_URL"
sleep 1
if curl -fsS "$HEALTH_URL" > /dev/null; then
  echo "  ✓ Backend OK"
else
  echo "  ⚠ Health check thất bại — xem log: pm2 logs $PM2_NAME --lines 50"
fi

log "Xong ✅"
