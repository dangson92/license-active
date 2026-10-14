# Triển khai lên cPanel

Hướng dẫn chạy KeyMaster (phanmemauto.com) trên hosting cPanel có **Setup Node.js App** (CloudLinux + Passenger).

Mô hình triển khai:

| Subdomain | Vai trò | Nội dung |
|---|---|---|
| `app.phanmemauto.com` | Frontend (React) | File tĩnh, build sẵn ở máy |
| `api.phanmemauto.com` | Backend (Express + Socket.IO) | Node.js App, startup file `app.cjs` |
| `upload.phanmemauto.com` | Giữ link tải cũ | Chỉ có `.htaccess` chuyển hướng sang `api.` |

> Trong hướng dẫn, `USER` là tên tài khoản cPanel, `license-active` là thư mục app. Đổi lại theo thực tế.

---

## 0. Hỏi nhà cung cấp hosting trước

1. Có **Setup Node.js App** với **Node 20 hoặc 22** không?
2. Có cho **kết nối SMTP ra ngoài** (cổng 465/587) không? Nếu không, email xác minh và báo cáo tuần sẽ không gửi được.
3. Passenger có hỗ trợ **WebSocket** không, và app chạy **tối đa mấy process**? Thông báo realtime cần **đúng 1 process**.
4. Giới hạn RAM và số kết nối đồng thời (EP) là bao nhiêu?

---

## 1. Đóng gói ở máy local

```bash
cp .env.cpanel.example .env.cpanel   # sửa domain nếu khác
npm run package:cpanel
```

Kết quả nằm trong `deploy/cpanel/`:

- `frontend.zip`: frontend đã build và có sẵn `.htaccess` cho React Router.
- `backend.zip`: thư mục `server/`, `app.cjs`, `package.json` chỉ chứa thư viện backend, các thư mục `uploads/` và `keys/` rỗng.
- `upload-redirect/.htaccess`: dùng cho `upload.phanmemauto.com`.

---

## 2. Chuẩn bị dữ liệu từ VPS cũ (bắt buộc nếu đang chạy thật)

> Các bước chi tiết (backup bằng `ops/vps.sh`, chép sang cPanel, import, tập dượt và chuyển DNS) nằm trong [CPANEL_MIGRATE_DB.md](CPANEL_MIGRATE_DB.md).

Trên VPS, lấy về 4 thứ sau:

| Lấy gì | Vì sao |
|---|---|
| `keys/private.pem`, `keys/public.pem` | **Phải giữ đúng cặp key cũ.** Key mới sẽ làm mọi app desktop đã kích hoạt bị lỗi xác thực token. |
| File `.env` | **Giữ nguyên `JWT_SECRET` và `DEVICE_SALT`.** Đổi hai giá trị này sẽ làm user bị đăng xuất và thiết bị đã kích hoạt không nhận ra license. |
| Bản dump database | `mysqldump -u <user> -p <db_name> > keymaster.sql` |
| Thư mục `uploads/` | Icon app, ảnh biên lai, file đính kèm cũ |

Nếu đây là cài mới hoàn toàn, bỏ qua bước này. Khi đó tạo key mới theo hướng dẫn trong `.env.example` và import `server/sql/schema.sql`, rồi chạy lần lượt các file trong `server/sql/migrations/` theo thứ tự số.

---

## 3. Tạo subdomain và SSL

1. cPanel → **Domains**: tạo `app.phanmemauto.com`, `api.phanmemauto.com`, `upload.phanmemauto.com`. Mỗi subdomain dùng một document root riêng.
2. Nếu DNS đang ở Cloudflare: trỏ 3 bản ghi A về IP của hosting.
3. cPanel → **SSL/TLS Status** → **Run AutoSSL**. Nếu bật proxy Cloudflare, đặt SSL mode là *Full (strict)*.

---

## 4. Database

1. cPanel → **MySQL® Databases**: tạo database, tạo user, rồi gán user vào database với **ALL PRIVILEGES**. Tên thật sẽ có tiền tố, ví dụ `USER_keymaster`.
2. cPanel → **phpMyAdmin**: chọn database vừa tạo → **Import** file `keymaster.sql`. File lớn hơn giới hạn upload thì dùng **Terminal**:
   ```bash
   mysql -u USER_keymaster -p USER_keymaster < keymaster.sql
   ```

---

## 5. Backend (Node.js App)

1. cPanel → **Setup Node.js App** → **Create Application**:
   - **Node.js version:** 22 (hoặc 20)
   - **Application mode:** Production
   - **Application root:** `license-active`
   - **Application URL:** `api.phanmemauto.com`
   - **Application startup file:** `app.cjs`
   - Bấm **Create**.
2. **File Manager** → vào `/home/USER/license-active`. Xóa file `app.js` mẫu nếu có, upload `backend.zip` rồi **Extract**.
3. Upload `private.pem` và `public.pem` vào `license-active/keys/`.
4. Upload nội dung thư mục `uploads/` cũ vào `license-active/uploads/`.
5. Tạo file `license-active/.env` từ `.env` của VPS và sửa các dòng sau:
   ```ini
   # XÓA dòng PORT — Passenger tự cấp cổng
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=USER_keymaster
   DB_PASS=<mật khẩu vừa tạo>
   DB_NAME=USER_keymaster
   PRIVATE_KEY_PATH=./keys/private.pem
   PUBLIC_KEY_PATH=./keys/public.pem
   FRONTEND_URL=https://app.phanmemauto.com
   DISABLE_INTERNAL_SCHEDULERS=1
   ```
   Giữ nguyên `JWT_SECRET`, `DEVICE_SALT`, các biến R2/iDrive và `WEEKLY_REPORT_EMAIL` (nếu có).
6. Quay lại **Setup Node.js App** → bấm **Run NPM Install**, chờ xong rồi bấm **Restart**.
7. Kiểm tra: mở `https://api.phanmemauto.com/health`, phải thấy `{"ok":true}`.

> `.env` chứa mật khẩu và secret. Không để file này trong `public_html`. Thư mục `license-active` nằm ngoài `public_html` nên an toàn.

---

## 6. Frontend

1. **File Manager** → document root của `app.phanmemauto.com`.
2. Upload `frontend.zip` → **Extract**. Cần bật **Show Hidden Files** để thấy file `.htaccess`.
3. Mở `https://app.phanmemauto.com`, đăng nhập thử, rồi F5 ở một trang con như `/admin` để chắc chắn không bị 404.

---

## 7. Subdomain upload (giữ link tải cũ)

Upload `upload-redirect/.htaccess` vào document root của `upload.phanmemauto.com`. Link cũ dạng `upload.phanmemauto.com/ten-app.zip` sẽ chuyển sang `api.phanmemauto.com/ten-app.zip`.

---

## 8. Cron Jobs (thay cho scheduler trong process)

Passenger tắt process khi không có request, nên các job hẹn giờ phải chạy bằng cron.

1. Lấy đường dẫn `node` của app: trên trang **Setup Node.js App**, dòng *"Enter to the virtual environment"* có dạng `/home/USER/nodevenv/license-active/22/bin/activate`. Đường dẫn node là `/home/USER/nodevenv/license-active/22/bin/node`.
2. cPanel → **Cron Jobs** → **Add New Cron Job**, chọn **Once Per Hour** (`0 * * * *`):
   ```bash
   cd /home/USER/license-active && /home/USER/nodevenv/license-active/22/bin/node server/cron.js >> /home/USER/license-active/cron.log 2>&1
   ```

Script tự quyết định chạy job nào theo giờ UTC, nên không phụ thuộc múi giờ của server:

| Job | Thời điểm |
|---|---|
| Cảnh báo license sắp hết hạn | 10:00 sáng (UTC+7) hằng ngày |
| Báo cáo tuần | Thứ Hai 08:00 (UTC+7) |

Các giờ còn lại, log chỉ ghi `no job due this hour`.

Chạy thử ngay bằng **Terminal** trong cPanel:
```bash
cd ~/license-active
~/nodevenv/license-active/22/bin/node server/cron.js weekly-report   # gửi báo cáo tuần thật
~/nodevenv/license-active/22/bin/node server/cron.js license         # quét license sắp hết hạn
```

---

## 9. Kiểm tra sau khi triển khai

- [ ] `https://api.phanmemauto.com/health` trả về `{"ok":true}`
- [ ] Đăng nhập, đăng ký, nhận email xác minh
- [ ] Admin: mở tab khác đăng ký user mới → admin nhận thông báo realtime
- [ ] App desktop: kích hoạt và check-in license thành công (app gọi `api.phanmemauto.com`)
- [ ] Admin: upload version mới qua R2, rồi tải về được
- [ ] Admin → Cài đặt → **Gửi báo cáo tuần ngay** nhận được email
- [ ] `cron.log` có dòng mới mỗi giờ

---

## 10. Cập nhật phiên bản mới

1. Ở máy local: `git pull` → `npm run package:cpanel`.
2. Upload `backend.zip` vào `license-active` → Extract và chọn ghi đè. Việc này **không xóa** `.env`, `keys/` hay `uploads/`.
3. Nếu `package.json` có thư viện mới: bấm **Run NPM Install**.
4. Bấm **Restart**.
5. Frontend: xóa thư mục `assets/` cũ, upload và extract `frontend.zip` mới.
6. Nếu có file migration mới trong `server/sql/migrations/`: chạy file đó trong phpMyAdmin.

---

## 11. Xử lý lỗi thường gặp

Log lỗi của app nằm ở `license-active/stderr.log`. Nếu không có file này, xem *Errors* trong cPanel → **Metrics**.

| Triệu chứng | Nguyên nhân / Cách xử lý |
|---|---|
| `ERR_REQUIRE_ESM` / `require() of ES Module` | Startup file chưa đặt là `app.cjs` |
| 503 / *Incomplete response received from application* | Xem `stderr.log`. Hay gặp nhất: thiếu `keys/*.pem`, sai `DB_*`, hoặc chưa chạy NPM Install |
| `Failed to load private key` | Chưa upload `keys/private.pem` / `keys/public.pem` |
| Trình duyệt báo lỗi CORS | `FRONTEND_URL` trong `.env` phải đúng `https://app.phanmemauto.com`, rồi Restart |
| F5 trang con bị 404 | Thiếu `.htaccess` trong thư mục frontend (bật Show Hidden Files) |
| Console báo `Session ID unknown`, thông báo realtime lúc có lúc không | Passenger chạy nhiều process. Nhờ hosting giới hạn app còn 1 process (`PassengerMaxInstancesPerApp 1`) |
| Không gửi được email | Hosting chặn SMTP ra ngoài. Thử cổng khác hoặc dùng SMTP của chính hosting |
| App desktop báo token không hợp lệ | Key trong `keys/` hoặc `DEVICE_SALT` / `JWT_SECRET` khác với VPS cũ |

---

## Hạn chế so với VPS

- **Khởi động lần đầu chậm:** sau một lúc không có request, Passenger tắt process, nên request đầu tiên mất vài giây.
- **Realtime:** chỉ ổn định khi chạy 1 process. Nếu hosting không hỗ trợ WebSocket, Socket.IO dùng long-polling, chậm hơn và tốn kết nối hơn.
- **Upload file lớn:** phải đi qua R2/iDrive bằng presigned URL. Upload thẳng lên server sẽ bị giới hạn kích thước và timeout của hosting.
- **Rate limit cho `/activate`:** lưu trong bộ nhớ nên bị reset mỗi khi process khởi động lại.
- **Công cụ vận hành:** `ops/vps.sh` và PM2 không dùng được trên cPanel.
