#!/usr/bin/env bash
#
# KeyMaster AI — Bảng điều khiển quản trị VPS
# Chạy TRÊN VPS (Ubuntu + Nginx + PM2 + MySQL).
#
# Cách dùng:
#   bash ops/vps.sh              # mở menu tương tác
#   bash ops/vps.sh 24           # chạy thẳng một tác vụ theo số
#   bash ops/vps.sh restart      # hoặc theo tên ngắn
#   bash ops/vps.sh --help       # xem toàn bộ tác vụ
#
# Cấu hình: sửa ops/vps.conf (copy từ ops/vps.conf.example), hoặc set biến
# môi trường khi gọi:
#   PM2_NAME=license-active bash ops/vps.sh 21
#
# LƯU Ý: cố ý KHÔNG dùng `set -e`. Đây là công cụ tương tác — một tác vụ lỗi
# phải quay lại menu chứ không được thoát cả script.

set -uo pipefail

# ───────────────────────────── Đường dẫn & cấu hình ─────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Nạp file cấu hình riêng của server nếu có (không commit — xem .gitignore)
CONF_FILE="$SCRIPT_DIR/vps.conf"
# shellcheck source=/dev/null
[ -f "$CONF_FILE" ] && source "$CONF_FILE"

APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"                       # repo trên server
BRANCH="${BRANCH:-main}"                                     # nhánh deploy
PM2_NAME="${PM2_NAME:-license-active}"                       # tên process PM2
WEB_ROOT="${WEB_ROOT:-/var/www/license-app}"                 # nơi Nginx serve SPA
VITE_API_URL="${VITE_API_URL:-https://api.phanmemauto.com}"  # API base nhúng vào FE
HEALTH_URL="${HEALTH_URL:-${VITE_API_URL%/}/health}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/license-active}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"                             # số bản backup giữ lại
NGINX_ERROR_LOG="${NGINX_ERROR_LOG:-/var/log/nginx/error.log}"
NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-$APP_DIR/scripts/deploy.sh}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$APP_DIR/server/sql/migrations}"

# ───────────────────────────────── Tiện ích ─────────────────────────────────

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_CYAN=$'\033[1;36m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''; C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''
fi

log()  { printf '\n%s▶ %s%s\n' "$C_CYAN" "$*" "$C_RESET"; }
ok()   { printf '%s  ✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf '%s  ⚠ %s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
err()  { printf '%s  ✗ %s%s\n' "$C_RED" "$*" "$C_RESET"; }

# Hỏi xác nhận cho tác vụ nguy hiểm. Trả 0 nếu người dùng đồng ý.
confirm() {
  local prompt="${1:-Tiếp tục?}" reply
  read -r -p "$(printf '%s%s [y/N]: %s' "$C_YELLOW" "$prompt" "$C_RESET")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# Yêu cầu gõ đúng một chuỗi để xác nhận (dùng cho thao tác phá huỷ dữ liệu)
confirm_typed() {
  local expected="$1" reply
  read -r -p "$(printf '%sGõ chính xác "%s" để xác nhận: %s' "$C_RED" "$expected" "$C_RESET")" reply
  [ "$reply" = "$expected" ]
}

need_cmd() {
  if ! command -v "$1" > /dev/null 2>&1; then
    err "Thiếu lệnh '$1' trên server."
    return 1
  fi
}

# Đọc một biến từ .env mà KHÔNG source file (tránh chạy code lạ trong .env)
env_get() {
  local key="$1" line val
  [ -f "$ENV_FILE" ] || return 1
  line=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2> /dev/null | tail -n1)
  [ -n "$line" ] || return 1
  val="${line#*=}"
  val="${val%$'\r'}"                       # bỏ CR nếu file lưu kiểu Windows
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

# Tên biến có phải bí mật không (quyết định che hay hiện giá trị).
# *_PATH và *_URL là đường dẫn/endpoint, không phải secret — luôn hiện.
is_secret_key() {
  case "$1" in
    *_PATH|*_URL) return 1 ;;
  esac
  [[ "$1" =~ (SECRET|PASS|PASSWORD|TOKEN|SALT|ACCESS_KEY|PRIVATE) ]]
}

# Hiển thị giá trị .env: bí mật thì chỉ báo độ dài, còn lại hiện đầy đủ
# (endpoint / bucket / URL hiện nguyên văn mới debug được).
show_env_value() {
  local key="$1" val="$2"
  if [ -z "$val" ]; then
    printf '(trống)'
  elif is_secret_key "$key"; then
    printf 'đã set, %d ký tự' "${#val}"
  else
    printf '%s' "$val"
  fi
}

# Tạo file defaults tạm cho mysql — tránh lộ mật khẩu qua `ps aux`
MYSQL_DEFAULTS=''
mysql_defaults_file() {
  [ -n "$MYSQL_DEFAULTS" ] && { printf '%s' "$MYSQL_DEFAULTS"; return 0; }
  local host port user pass
  host=$(env_get DB_HOST) || { err "Không đọc được DB_HOST từ $ENV_FILE"; return 1; }
  port=$(env_get DB_PORT) || port=3306
  user=$(env_get DB_USER) || { err "Không đọc được DB_USER"; return 1; }
  pass=$(env_get DB_PASS) || pass=''
  MYSQL_DEFAULTS=$(mktemp)
  chmod 600 "$MYSQL_DEFAULTS"
  {
    echo '[client]'
    echo "host=${host}"
    echo "port=${port}"
    echo "user=${user}"
    echo "password=${pass}"
  } > "$MYSQL_DEFAULTS"
  printf '%s' "$MYSQL_DEFAULTS"
}

cleanup() { [ -n "$MYSQL_DEFAULTS" ] && rm -f "$MYSQL_DEFAULTS"; }
trap cleanup EXIT
# Ctrl+C chỉ dừng tác vụ đang chạy (ví dụ `pm2 logs`), không thoát cả script
trap 'printf "\n"' INT

db_name() { env_get DB_NAME; }

# Chạy SQL, đọc mật khẩu từ file defaults
db_query() {
  local dfile db
  dfile=$(mysql_defaults_file) || return 1
  db=$(db_name) || { err "Không đọc được DB_NAME"; return 1; }
  mysql --defaults-extra-file="$dfile" "$db" "$@"
}

# Chạy một đoạn Node trong context project (đã nạp .env qua dotenv)
node_in_app() {
  ( cd "$APP_DIR" && node --input-type=module -e "$1" )
}

require_app_dir() {
  if [ ! -d "$APP_DIR/.git" ]; then
    err "Không thấy repo tại: $APP_DIR"
    echo "  Sửa APP_DIR trong $CONF_FILE hoặc set biến môi trường APP_DIR."
    return 1
  fi
}

# ═══════════════════════════════ TÁC VỤ ═══════════════════════════════

# ── Nhóm 1: Deploy & Git ──────────────────────────────────────────────

task_deploy()          { require_app_dir && bash "$DEPLOY_SCRIPT"; }
task_deploy_backend()  { require_app_dir && bash "$DEPLOY_SCRIPT" --backend-only; }
task_deploy_frontend() { require_app_dir && bash "$DEPLOY_SCRIPT" --frontend-only; }
task_deploy_install()  { require_app_dir && bash "$DEPLOY_SCRIPT" --install; }

task_git_status() {
  require_app_dir || return 1
  log "Commit hiện tại"
  git -C "$APP_DIR" --no-pager log -1 --format='  %h  %ad  %an%n  %s' --date=format:'%Y-%m-%d %H:%M'
  log "Nhánh & trạng thái"
  echo "  Nhánh: $(git -C "$APP_DIR" branch --show-current)"
  local dirty
  dirty=$(git -C "$APP_DIR" status --porcelain)
  if [ -z "$dirty" ]; then ok "Working tree sạch"; else warn "Có thay đổi chưa commit:"; echo "$dirty"; fi
  log "So với origin/$BRANCH"
  git -C "$APP_DIR" fetch origin "$BRANCH" --quiet 2> /dev/null
  local behind
  behind=$(git -C "$APP_DIR" rev-list --count "HEAD..origin/$BRANCH" 2> /dev/null || echo '?')
  if [ "$behind" = "0" ]; then ok "Đang ở bản mới nhất"; else warn "Đang chậm $behind commit so với origin/$BRANCH"; fi
}

task_rollback() {
  require_app_dir || return 1
  log "5 commit gần nhất"
  git -C "$APP_DIR" --no-pager log -5 --format='  %h  %ad  %s' --date=format:'%Y-%m-%d %H:%M'
  echo
  local sha
  read -r -p "Nhập commit hash muốn quay về (Enter để huỷ): " sha
  [ -z "$sha" ] && { warn "Đã huỷ"; return 0; }
  if ! git -C "$APP_DIR" cat-file -e "${sha}^{commit}" 2> /dev/null; then
    err "Commit không tồn tại: $sha"; return 1
  fi
  warn "Sẽ checkout $sha rồi deploy lại (code trên server tách khỏi nhánh $BRANCH)."
  confirm "Chắc chắn rollback?" || { warn "Đã huỷ"; return 0; }
  git -C "$APP_DIR" checkout "$sha" || return 1
  bash "$DEPLOY_SCRIPT" --no-pull
}

# ── Nhóm 2: PM2 / Backend ─────────────────────────────────────────────

task_pm2_status() { need_cmd pm2 || return 1; log "Trạng thái PM2"; pm2 list; }
task_logs()       { need_cmd pm2 || return 1; log "200 dòng log gần nhất"; pm2 logs "$PM2_NAME" --lines 200 --nostream; }
task_logs_error()  { need_cmd pm2 || return 1; log "200 dòng log LỖI gần nhất"; pm2 logs "$PM2_NAME" --lines 200 --nostream --err; }
task_logs_follow() { need_cmd pm2 || return 1; log "Theo dõi log (Ctrl+C để dừng)"; pm2 logs "$PM2_NAME"; }
task_restart()    { need_cmd pm2 || return 1; log "Restart backend"; pm2 restart "$PM2_NAME" --update-env && pm2 save && ok "Đã restart"; }
task_monit()      { need_cmd pm2 || return 1; pm2 monit; }
task_flush_logs() { need_cmd pm2 || return 1; confirm "Xoá toàn bộ log PM2?" || return 0; pm2 flush "$PM2_NAME" && ok "Đã xoá log"; }

task_stop() {
  need_cmd pm2 || return 1
  warn "Dừng backend = API ngừng phục vụ, client không activate/check-in được."
  confirm "Chắc chắn dừng '$PM2_NAME'?" || { warn "Đã huỷ"; return 0; }
  pm2 stop "$PM2_NAME" && pm2 save && ok "Đã dừng"
}

task_start() {
  need_cmd pm2 || return 1
  if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    pm2 start "$PM2_NAME" --update-env
  else
    log "Chưa có process — tạo mới"
    ( cd "$APP_DIR" && pm2 start npm --name "$PM2_NAME" -- run backend )
  fi
  pm2 save && ok "Backend đang chạy"
}

# ── Nhóm 3: Database ──────────────────────────────────────────────────

ensure_migrations_table() {
  db_query -e "CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" 2> /dev/null
}

# In danh sách file migration trên đĩa (đã sắp xếp)
migration_files() { ls -1 "$MIGRATIONS_DIR"/*.sql 2> /dev/null | sort; }

task_migrate_status() {
  need_cmd mysql || return 1
  ensure_migrations_table || { err "Không kết nối được DB"; return 1; }
  local applied
  applied=$(db_query -N -B -e "SELECT filename FROM schema_migrations;" 2> /dev/null)
  log "Trạng thái migration ($MIGRATIONS_DIR)"
  local f base pending=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    base=$(basename "$f")
    if grep -qxF "$base" <<< "$applied"; then
      printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$base"
    else
      printf '  %s○%s %s %s(chưa áp dụng)%s\n' "$C_YELLOW" "$C_RESET" "$base" "$C_DIM" "$C_RESET"
      pending=$((pending + 1))
    fi
  done < <(migration_files)
  echo
  if [ "$pending" -eq 0 ]; then
    ok "Không có migration nào đang chờ"
  else
    warn "$pending migration đang chờ — dùng tác vụ 32 để áp dụng"
    [ -z "$applied" ] && warn "Bảng theo dõi đang rỗng. Nếu DB này đã chạy từ trước, dùng tác vụ 33 (baseline) trước!"
  fi
}

task_migrate_apply() {
  need_cmd mysql || return 1
  ensure_migrations_table || { err "Không kết nối được DB"; return 1; }
  local applied
  applied=$(db_query -N -B -e "SELECT filename FROM schema_migrations;" 2> /dev/null)

  local pending=() f base
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    base=$(basename "$f")
    grep -qxF "$base" <<< "$applied" || pending+=("$f")
  done < <(migration_files)

  if [ "${#pending[@]}" -eq 0 ]; then ok "Không có migration nào đang chờ"; return 0; fi

  log "Sẽ áp dụng ${#pending[@]} migration:"
  for f in "${pending[@]}"; do echo "  • $(basename "$f")"; done
  echo
  warn "Nên backup DB trước (tác vụ 34)."
  confirm "Áp dụng ngay?" || { warn "Đã huỷ"; return 0; }

  for f in "${pending[@]}"; do
    base=$(basename "$f")
    log "Đang chạy: $base"
    if db_query < "$f"; then
      db_query -e "INSERT INTO schema_migrations (filename) VALUES ('$base');"
      ok "$base"
    else
      err "$base thất bại — dừng lại, các migration sau chưa chạy."
      return 1
    fi
  done
  ok "Hoàn tất. Restart backend (tác vụ 24) nếu migration đổi schema đang dùng."
}

task_migrate_baseline() {
  need_cmd mysql || return 1
  ensure_migrations_table || { err "Không kết nối được DB"; return 1; }
  log "Baseline — đánh dấu migration là ĐÃ ÁP DỤNG mà không chạy chúng"
  echo "  Dùng khi DB đã tồn tại từ trước và migration cũ đã chạy bằng tay."
  echo

  local files=() f
  while IFS= read -r f; do [ -n "$f" ] && files+=("$f"); done < <(migration_files)
  if [ "${#files[@]}" -eq 0 ]; then err "Không thấy file .sql nào trong $MIGRATIONS_DIR"; return 1; fi

  local i=1
  for f in "${files[@]}"; do
    printf '  %2d) %s\n' "$i" "$(basename "$f")"
    i=$((i + 1))
  done
  echo
  warn "Chọn file CUỐI CÙNG mà DB đã áp dụng. File sau nó vẫn để nguyên trạng"
  warn "'đang chờ' để tác vụ 32 chạy thật — đừng baseline nhầm migration mới."
  echo

  local cutoff
  read -r -p "Số thứ tự của migration cuối cùng ĐÃ áp dụng (Enter để huỷ): " cutoff
  [ -z "$cutoff" ] && { warn "Đã huỷ"; return 0; }
  if ! [[ "$cutoff" =~ ^[0-9]+$ ]] || [ "$cutoff" -lt 1 ] || [ "$cutoff" -gt "${#files[@]}" ]; then
    err "Lựa chọn không hợp lệ"; return 1
  fi

  echo
  echo "  Sẽ đánh dấu ĐÃ ÁP DỤNG (không chạy):"
  for ((i = 0; i < cutoff; i++)); do echo "    ✓ $(basename "${files[$i]}")"; done
  if [ "$cutoff" -lt "${#files[@]}" ]; then
    echo "  Vẫn để CHỜ CHẠY (dùng tác vụ 32):"
    for ((i = cutoff; i < ${#files[@]}; i++)); do echo "    ○ $(basename "${files[$i]}")"; done
  fi
  echo
  confirm "Đúng chưa?" || { warn "Đã huỷ"; return 0; }

  for ((i = 0; i < cutoff; i++)); do
    db_query -e "INSERT IGNORE INTO schema_migrations (filename) VALUES ('$(basename "${files[$i]}")');"
  done
  ok "Đã baseline $cutoff file. Xem lại bằng tác vụ 31."
}

task_db_backup() {
  need_cmd mysqldump || return 1
  local dfile db out
  dfile=$(mysql_defaults_file) || return 1
  db=$(db_name) || return 1
  mkdir -p "$BACKUP_DIR"
  out="$BACKUP_DIR/db-${db}-$(date +%Y%m%d-%H%M%S).sql.gz"
  log "Đang dump database '$db'…"
  if mysqldump --defaults-extra-file="$dfile" \
       --single-transaction --quick --routines --triggers --events \
       "$db" | gzip > "$out"; then
    ok "Đã lưu: $out ($(du -h "$out" | cut -f1))"
  else
    err "Dump thất bại"; rm -f "$out"; return 1
  fi
}

task_db_restore() {
  need_cmd mysql || return 1
  local db files=() i=1 choice file
  db=$(db_name) || return 1
  while IFS= read -r f; do files+=("$f"); done < <(ls -1t "$BACKUP_DIR"/db-*.sql.gz 2> /dev/null)
  if [ "${#files[@]}" -eq 0 ]; then err "Không có backup nào trong $BACKUP_DIR"; return 1; fi

  log "Chọn bản backup để phục hồi"
  for f in "${files[@]}"; do
    printf '  %2d) %s  %s(%s)%s\n' "$i" "$(basename "$f")" "$C_DIM" "$(du -h "$f" | cut -f1)" "$C_RESET"
    i=$((i + 1))
  done
  echo
  read -r -p "Số thứ tự (Enter để huỷ): " choice
  [ -z "$choice" ] && { warn "Đã huỷ"; return 0; }
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#files[@]}" ]; then
    err "Lựa chọn không hợp lệ"; return 1
  fi
  file="${files[$((choice - 1))]}"

  err "GHI ĐÈ toàn bộ database '$db' bằng $(basename "$file")."
  warn "Dữ liệu hiện tại sẽ MẤT. Nên chạy tác vụ 34 để backup trạng thái hiện tại trước."
  confirm_typed "$db" || { warn "Đã huỷ"; return 0; }

  log "Đang phục hồi…"
  if gunzip -c "$file" | db_query; then
    ok "Đã phục hồi. Restart backend (tác vụ 24)."
  else
    err "Phục hồi thất bại"; return 1
  fi
}

task_db_shell() {
  need_cmd mysql || return 1
  local dfile db
  dfile=$(mysql_defaults_file) || return 1
  db=$(db_name) || return 1
  log "MySQL shell — database '$db' (gõ \\q để thoát)"
  mysql --defaults-extra-file="$dfile" "$db"
}

task_db_check() {
  require_app_dir || return 1
  log "Kiểm tra dữ liệu (scripts/check-db.js)"
  ( cd "$APP_DIR" && node scripts/check-db.js )
}

# ── Nhóm 4: Storage & Uploads ─────────────────────────────────────────

task_storage_status() {
  require_app_dir || return 1
  log "Cấu hình cloud storage"
  node_in_app "
import 'dotenv/config'
const s = await import('./server/services/cloud-storage.js')
const rows = s.listProviders()
for (const r of rows) {
  console.log(\`  \${r.configured ? '✓' : '✗'} \${r.label.padEnd(16)} bucket=\${r.bucket ?? '-'}  public=\${r.publicUrl ?? '-'}\`)
}
console.log('\n  Provider mặc định:', s.getDefaultProvider() ?? '(chưa cấu hình cái nào)')
"
}

task_storage_test() {
  require_app_dir || return 1
  log "Test kết nối tới bucket (HeadBucket)"
  node_in_app "
import 'dotenv/config'
const s = await import('./server/services/cloud-storage.js')
for (const p of s.listProviders()) {
  if (!p.configured) { console.log(\`  ○ \${p.label}: chưa cấu hình, bỏ qua\`); continue }
  const r = await s.testConnection(p.provider)
  console.log(r.ok ? \`  ✓ \${r.label}: OK (bucket \${r.bucket})\` : \`  ✗ \${r.label}: \${r.error}\`)
}
"
}

task_uploads_size() {
  log "Dung lượng thư mục uploads/"
  local base="$APP_DIR/uploads"
  if [ ! -d "$base" ]; then warn "Chưa có $base"; return 0; fi
  local d
  for d in releases attachments icons receipts; do
    [ -d "$base/$d" ] && printf '  %-14s %s\n' "$d" "$(du -sh "$base/$d" 2> /dev/null | cut -f1)"
  done
  printf '  %-14s %s\n' "TỔNG" "$(du -sh "$base" 2> /dev/null | cut -f1)"
  echo
  log "Ổ đĩa"
  df -h "$APP_DIR" | tail -n +1
}

task_uploads_backup() {
  local base="$APP_DIR/uploads" out
  if [ ! -d "$base" ]; then err "Không có $base"; return 1; fi
  mkdir -p "$BACKUP_DIR"
  out="$BACKUP_DIR/uploads-$(date +%Y%m%d-%H%M%S).tar.gz"
  log "Đang nén uploads/ …"
  if tar -czf "$out" -C "$APP_DIR" uploads; then
    ok "Đã lưu: $out ($(du -h "$out" | cut -f1))"
  else
    err "Nén thất bại"; rm -f "$out"; return 1
  fi
}

# ── Nhóm 5: Nginx & SSL ───────────────────────────────────────────────

task_nginx_test()   { need_cmd nginx || return 1; log "Kiểm tra cấu hình Nginx"; sudo nginx -t; }
task_nginx_reload() {
  need_cmd nginx || return 1
  log "Kiểm tra cấu hình trước khi reload"
  sudo nginx -t || { err "Cấu hình sai — KHÔNG reload"; return 1; }
  sudo systemctl reload nginx && ok "Đã reload Nginx"
}
task_nginx_error_log()  { log "Nginx error log (100 dòng cuối)";  sudo tail -n 100 "$NGINX_ERROR_LOG"; }
task_nginx_access_log() { log "Nginx access log (100 dòng cuối)"; sudo tail -n 100 "$NGINX_ACCESS_LOG"; }

task_ssl_status() {
  if ! command -v certbot > /dev/null 2>&1; then warn "Không có certbot trên server"; return 0; fi
  log "Chứng chỉ SSL"
  sudo certbot certificates
}

task_ssl_renew() {
  need_cmd certbot || return 1
  log "Thử gia hạn (dry-run trước)"
  sudo certbot renew --dry-run || { err "Dry-run thất bại — chưa gia hạn thật"; return 1; }
  ok "Dry-run OK"
  confirm "Gia hạn thật bây giờ?" || { warn "Đã huỷ"; return 0; }
  sudo certbot renew && sudo systemctl reload nginx && ok "Đã gia hạn và reload Nginx"
}

# ── Nhóm 6: Hệ thống & Kiểm tra ───────────────────────────────────────

task_sysinfo() {
  log "Tổng quan hệ thống"
  echo "  Uptime : $(uptime -p 2> /dev/null || uptime)"
  echo "  Tải    :$(cut -d' ' -f1-3 /proc/loadavg 2> /dev/null | sed 's/^/ /')"
  echo
  log "Bộ nhớ"; free -h
  echo
  log "Ổ đĩa";  df -h --output=source,size,used,avail,pcent,target 2> /dev/null | grep -vE '^(tmpfs|devtmpfs|udev)' || df -h
  echo
  log "Dịch vụ"
  local svc
  for svc in nginx mysql mariadb; do
    if systemctl list-unit-files "$svc.service" > /dev/null 2>&1 && systemctl cat "$svc" > /dev/null 2>&1; then
      printf '  %-10s %s\n' "$svc" "$(systemctl is-active "$svc" 2> /dev/null)"
    fi
  done
  command -v pm2 > /dev/null 2>&1 && { echo; pm2 list; }
}

task_health() {
  need_cmd curl || return 1
  log "Health check: $HEALTH_URL"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL")
  if [ "$code" = "200" ]; then ok "Backend OK (HTTP 200)"; else err "Backend không phản hồi đúng (HTTP $code)"; fi

  log "Frontend: ${VITE_API_URL%/api*}"
  if [ -d "$WEB_ROOT" ] && [ -f "$WEB_ROOT/index.html" ]; then
    ok "Web root có index.html ($(date -r "$WEB_ROOT/index.html" '+%Y-%m-%d %H:%M'))"
  else
    warn "Không thấy $WEB_ROOT/index.html — frontend chưa deploy?"
  fi
}

task_env_check() {
  log "Kiểm tra $ENV_FILE"
  if [ ! -f "$ENV_FILE" ]; then err "Không có file .env"; return 1; fi

  local required=(PORT DB_HOST DB_USER DB_PASS DB_NAME JWT_SECRET DEVICE_SALT FRONTEND_URL)
  local optional=(PRIVATE_KEY_PATH PUBLIC_KEY_PATH STORAGE_PROVIDER
                  R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_URL
                  IDRIVE_E2_ENDPOINT IDRIVE_E2_ACCESS_KEY IDRIVE_E2_SECRET_KEY IDRIVE_E2_BUCKET IDRIVE_E2_PUBLIC_URL)
  local k v missing=0

  echo
  printf '  %sBắt buộc%s\n' "$C_BOLD" "$C_RESET"
  for k in "${required[@]}"; do
    if v=$(env_get "$k"); then
      printf '    %s✓%s %-22s %s\n' "$C_GREEN" "$C_RESET" "$k" "$(show_env_value "$k" "$v")"
    else
      printf '    %s✗%s %-22s %sTHIẾU%s\n' "$C_RED" "$C_RESET" "$k" "$C_RED" "$C_RESET"
      missing=$((missing + 1))
    fi
  done

  echo
  printf '  %sTuỳ chọn%s\n' "$C_BOLD" "$C_RESET"
  for k in "${optional[@]}"; do
    if v=$(env_get "$k"); then
      printf '    %s✓%s %-22s %s\n' "$C_GREEN" "$C_RESET" "$k" "$(show_env_value "$k" "$v")"
    else
      printf '    %s○%s %-22s %s—%s\n' "$C_DIM" "$C_RESET" "$k" "$C_DIM" "$C_RESET"
    fi
  done

  echo
  log "Khoá RSA"
  local pk
  pk=$(env_get PRIVATE_KEY_PATH) || pk="./keys/private.pem"
  ( cd "$APP_DIR" && [ -f "$pk" ] ) && ok "Có private key: $pk" || err "Không thấy private key: $pk"

  echo
  [ "$missing" -eq 0 ] && ok "Đủ biến bắt buộc" || err "Thiếu $missing biến bắt buộc — backend sẽ lỗi"
}

task_backup_list() {
  log "Backup trong $BACKUP_DIR"
  if [ ! -d "$BACKUP_DIR" ]; then warn "Chưa có thư mục backup"; return 0; fi
  local f found=0
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    printf '  %-8s %s  %s\n' \
      "$(du -h "$f" | cut -f1)" "$(date -r "$f" '+%Y-%m-%d %H:%M')" "$(basename "$f")"
    found=$((found + 1))
  done < <(ls -1t "$BACKUP_DIR"/* 2> /dev/null)
  if [ "$found" -eq 0 ]; then warn "Chưa có backup nào"; return 0; fi
  echo
  echo "  Tổng: $(du -sh "$BACKUP_DIR" 2> /dev/null | cut -f1)"
}

task_backup_clean() {
  log "Dọn backup cũ (giữ lại $BACKUP_KEEP bản mới nhất mỗi loại)"
  if [ ! -d "$BACKUP_DIR" ]; then warn "Chưa có thư mục backup"; return 0; fi
  local prefix old=() f
  for prefix in db uploads; do
    while IFS= read -r f; do old+=("$f"); done \
      < <(ls -1t "$BACKUP_DIR/$prefix"-* 2> /dev/null | tail -n "+$((BACKUP_KEEP + 1))")
  done
  if [ "${#old[@]}" -eq 0 ]; then ok "Không có gì để xoá"; return 0; fi
  echo "  Sẽ xoá ${#old[@]} file:"
  for f in "${old[@]}"; do echo "    • $(basename "$f")"; done
  echo
  confirm "Xoá các file trên?" || { warn "Đã huỷ"; return 0; }
  for f in "${old[@]}"; do rm -f "$f"; done
  ok "Đã xoá ${#old[@]} file"
}

# ═══════════════════════════════ Điều phối ═══════════════════════════════

# id | tên ngắn | mô tả | hàm
TASKS=(
  "11|deploy|Deploy đầy đủ (pull + build FE + restart BE)|task_deploy"
  "12|deploy-be|Deploy chỉ backend (pull + restart PM2)|task_deploy_backend"
  "13|deploy-fe|Deploy chỉ frontend (build + copy dist)|task_deploy_frontend"
  "14|deploy-install|Deploy kèm npm install (khi đổi dependency)|task_deploy_install"
  "15|git|Xem commit hiện tại & so với origin|task_git_status"
  "16|rollback|Quay về commit cũ rồi deploy lại|task_rollback"

  "21|status|Trạng thái PM2|task_pm2_status"
  "22|logs|Log backend (200 dòng cuối)|task_logs"
  "23|logs-err|Chỉ log lỗi (200 dòng cuối)|task_logs_error"
  "24|restart|Restart backend|task_restart"
  "25|logs-f|Theo dõi log realtime|task_logs_follow"
  "26|start|Start backend|task_start"
  "27|stop|Stop backend|task_stop"
  "28|monit|PM2 monit (CPU/RAM realtime)|task_monit"
  "29|flush|Xoá log PM2|task_flush_logs"

  "31|mig-status|Trạng thái migration|task_migrate_status"
  "32|mig-apply|Áp dụng migration đang chờ|task_migrate_apply"
  "33|mig-baseline|Baseline: đánh dấu đã áp dụng|task_migrate_baseline"
  "34|db-backup|Backup database|task_db_backup"
  "35|db-restore|Phục hồi database từ backup|task_db_restore"
  "36|db-shell|Mở MySQL shell|task_db_shell"
  "37|db-check|Kiểm tra dữ liệu (check-db.js)|task_db_check"

  "41|storage|Cấu hình cloud storage (R2 / E2)|task_storage_status"
  "42|storage-test|Test kết nối tới bucket|task_storage_test"
  "43|uploads|Dung lượng uploads/ và ổ đĩa|task_uploads_size"
  "44|uploads-backup|Backup thư mục uploads/|task_uploads_backup"

  "51|nginx-test|Kiểm tra cấu hình Nginx|task_nginx_test"
  "52|nginx-reload|Reload Nginx (test trước)|task_nginx_reload"
  "53|nginx-err|Nginx error log|task_nginx_error_log"
  "54|nginx-acc|Nginx access log|task_nginx_access_log"
  "55|ssl|Trạng thái chứng chỉ SSL|task_ssl_status"
  "56|ssl-renew|Gia hạn SSL (dry-run trước)|task_ssl_renew"

  "61|info|Tổng quan hệ thống|task_sysinfo"
  "62|health|Health check API + frontend|task_health"
  "63|env|Kiểm tra biến môi trường .env|task_env_check"
  "64|backups|Danh sách backup|task_backup_list"
  "65|backups-clean|Dọn backup cũ|task_backup_clean"
)

task_lookup() {
  local want="$1" row id name fn
  for row in "${TASKS[@]}"; do
    IFS='|' read -r id name _ fn <<< "$row"
    if [ "$want" = "$id" ] || [ "$want" = "$name" ]; then printf '%s' "$fn"; return 0; fi
  done
  return 1
}

print_group() {
  local title="$1" prefix="$2" row id name desc
  printf '\n  %s%s%s\n' "$C_BOLD" "$title" "$C_RESET"
  for row in "${TASKS[@]}"; do
    IFS='|' read -r id name desc _ <<< "$row"
    [[ "$id" == "$prefix"* ]] || continue
    printf '    %s%-3s%s %-38s %s%s%s\n' "$C_CYAN" "$id" "$C_RESET" "$desc" "$C_DIM" "$name" "$C_RESET"
  done
}

show_menu() {
  printf '\n%s╔══════════════════════════════════════════════════════════════════╗%s\n' "$C_CYAN" "$C_RESET"
  printf '%s║  KeyMaster AI — Quản trị VPS                                     ║%s\n' "$C_CYAN" "$C_RESET"
  printf '%s╚══════════════════════════════════════════════════════════════════╝%s\n' "$C_CYAN" "$C_RESET"
  printf '  %srepo%s %s   %snhánh%s %s   %spm2%s %s\n' \
    "$C_DIM" "$C_RESET" "$APP_DIR" "$C_DIM" "$C_RESET" "$BRANCH" "$C_DIM" "$C_RESET" "$PM2_NAME"

  print_group "DEPLOY & GIT"      "1"
  print_group "BACKEND (PM2)"     "2"
  print_group "DATABASE"          "3"
  print_group "STORAGE & UPLOADS" "4"
  print_group "NGINX & SSL"       "5"
  print_group "HỆ THỐNG"          "6"
  printf '\n    %s0%s   Thoát\n\n' "$C_CYAN" "$C_RESET"
}

show_help() {
  echo "KeyMaster AI — quản trị VPS"
  echo
  echo "  bash ops/vps.sh            mở menu"
  echo "  bash ops/vps.sh <id|tên>   chạy thẳng một tác vụ"
  echo
  local row id name desc
  for row in "${TASKS[@]}"; do
    IFS='|' read -r id name desc _ <<< "$row"
    printf '  %-3s %-16s %s\n' "$id" "$name" "$desc"
  done
}

run_task() {
  local fn
  if ! fn=$(task_lookup "$1"); then err "Không có tác vụ: $1  (dùng --help để xem danh sách)"; return 127; fi
  "$fn"
}

main() {
  if [ "$#" -gt 0 ]; then
    case "$1" in
      -h|--help|help) show_help; exit 0 ;;
      *) run_task "$1"; exit $? ;;
    esac
  fi

  if [ ! -t 0 ]; then
    err "Không phải terminal tương tác. Gọi kèm tên tác vụ, ví dụ: bash ops/vps.sh 24"
    exit 1
  fi

  local choice
  while true; do
    show_menu
    read -r -p "$(printf '%sChọn tác vụ: %s' "$C_BOLD" "$C_RESET")" choice
    case "$choice" in
      0|q|quit|exit) echo "Tạm biệt 👋"; exit 0 ;;
      '') continue ;;
      *)
        run_task "$choice"
        printf '\n%s'  "$C_DIM"
        read -r -p "── Nhấn Enter để về menu ──" _
        printf '%s' "$C_RESET"
        ;;
    esac
  done
}

main "$@"
