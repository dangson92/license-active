# Chuyển dữ liệu từ VPS sang cPanel

Hướng dẫn mang database, file upload, RSA key và `.env` từ VPS đang chạy sang hosting cPanel. Đọc kèm [CPANEL_DEPLOY.md](CPANEL_DEPLOY.md): tài liệu này thay cho **bước 2** và **bước 4** ở đó.

Quy ước trong hướng dẫn:

| Ký hiệu | Ý nghĩa |
|---|---|
| `VPS` | Địa chỉ SSH của VPS, ví dụ `root@1.2.3.4` |
| `~/apps/license-active` | Thư mục app trên VPS (mặc định của `ops/vps.sh`) |
| `~/backups/license-active` | Nơi `ops/vps.sh` lưu backup |
| `USER` | Tài khoản cPanel |
| `keymaster-api` | Thư mục Node.js App trên cPanel |

---

## Tổng quan

Làm theo **2 vòng**:

1. **Tập dượt:** sao chép dữ liệu sang cPanel trong khi VPS vẫn chạy bình thường. Kiểm tra cPanel chạy ổn. Người dùng không bị ảnh hưởng.
2. **Chuyển thật:** dừng VPS, dump lại lần cuối, import, rồi trỏ DNS sang cPanel. Mất khoảng 10–20 phút gián đoạn.

Phải làm 2 vòng vì app desktop check-in liên tục, nên database trên VPS thay đổi từng phút. Bản dump của vòng tập dượt sẽ cũ ngay sau đó, chỉ dùng để thử nghiệm.

---

## Bước 1. Backup trên VPS

SSH vào VPS và dùng các tác vụ có sẵn:

```bash
ssh VPS
cd ~/apps/license-active
bash ops/vps.sh 34   # dump database  -> ~/backups/license-active/db-<tên>-<ngày>.sql.gz
bash ops/vps.sh 44   # nén uploads/   -> ~/backups/license-active/uploads-<ngày>.tar.gz
bash ops/vps.sh 64   # liệt kê backup để lấy đúng tên file
```

Tác vụ `34` dùng `--single-transaction` nên dump được ngay khi app đang chạy, không khóa bảng.

Kiểm tra phiên bản MySQL của VPS để biết có cần xử lý collation ở bước 3 không:

```bash
mysql --version
```

---

## Bước 2. Mang file sang cPanel

Có 2 cách. **Cách A** nhanh hơn nhưng cần cPanel bật SSH. **Cách B** chỉ dùng trình duyệt.

### Cách A: Chép thẳng VPS → cPanel bằng SSH

Bật SSH trong cPanel (**SSH Access**, hoặc nhờ hosting bật), rồi chạy **trên VPS**:

```bash
cd ~/backups/license-active
# Cổng SSH của cPanel thường là 22; nhiều hosting dùng cổng khác (ví dụ 2222) → thêm -P <cổng>
scp db-*.sql.gz uploads-*.tar.gz USER@<host-cpanel>:~/
scp ~/apps/license-active/keys/private.pem ~/apps/license-active/keys/public.pem USER@<host-cpanel>:~/keymaster-api/keys/
scp ~/apps/license-active/.env USER@<host-cpanel>:~/keymaster-api/.env.vps
```

> `scp db-*.sql.gz` sẽ chép **mọi** bản backup. Nếu có nhiều bản, ghi rõ tên file mới nhất (xem từ tác vụ `64`).

### Cách B: Qua máy tính của bạn

Chạy **trên máy Windows** (PowerShell hoặc Git Bash):

```bash
mkdir vps-backup
scp VPS:~/backups/license-active/db-<tên>-<ngày>.sql.gz vps-backup/
scp VPS:~/backups/license-active/uploads-<ngày>.tar.gz vps-backup/
scp VPS:~/apps/license-active/keys/private.pem VPS:~/apps/license-active/keys/public.pem vps-backup/
scp VPS:~/apps/license-active/.env vps-backup/env-vps.txt
```

Sau đó upload các file này lên cPanel bằng **File Manager**:

| File | Upload vào |
|---|---|
| `uploads-….tar.gz` | `keymaster-api/`, rồi **Extract** (sẽ tạo thư mục `uploads/`) |
| `private.pem`, `public.pem` | `keymaster-api/keys/` |
| `env-vps.txt` | Không cần upload. Mở bằng Notepad để copy giá trị khi tạo `.env` |
| `db-….sql.gz` | Import ở bước 3 |

> ⚠️ `private.pem` và `.env` chứa bí mật. Sau khi xong, **xóa** thư mục `vps-backup` trên máy và file `.env.vps` trên cPanel. Không gửi các file này qua Zalo, email hay Google Drive.

---

## Bước 3. Import database vào cPanel

Tạo database và user trên cPanel trước (bước 4 của [CPANEL_DEPLOY.md](CPANEL_DEPLOY.md)), ví dụ `USER_keymaster`.

### Bằng phpMyAdmin (file nhỏ hơn giới hạn upload, thường 50–500 MB)

phpMyAdmin → chọn database `USER_keymaster` → tab **Import** → chọn file `.sql.gz` (phpMyAdmin tự giải nén) → **Import**.

### Bằng Terminal (file lớn, hoặc phpMyAdmin bị timeout)

Mở cPanel → **Terminal**, hoặc SSH vào:

```bash
cd ~
gunzip -c db-<tên>-<ngày>.sql.gz | mysql -u USER_keymaster -p USER_keymaster
```

### Nếu báo `Unknown collation: 'utf8mb4_0900_ai_ci'`

Lỗi này xảy ra khi VPS dùng MySQL 8 còn cPanel dùng MariaDB. Đổi collation rồi import lại:

```bash
gunzip -c db-<tên>-<ngày>.sql.gz \
  | sed 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' \
  | mysql -u USER_keymaster -p USER_keymaster
```

Không có Terminal thì làm trên máy (Git Bash), rồi upload file `db-fixed.sql.gz` lên phpMyAdmin:

```bash
gunzip -c db-<tên>-<ngày>.sql.gz | sed 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g' | gzip > db-fixed.sql.gz
```

### Kiểm tra sau khi import

Trong phpMyAdmin → tab **SQL**, chạy câu dưới đây rồi so với cùng câu đó chạy trên VPS (`bash ops/vps.sh 36` để mở MySQL shell). Số dòng phải bằng nhau:

```sql
SELECT 'users' t, COUNT(*) FROM users
UNION ALL SELECT 'licenses', COUNT(*) FROM licenses
UNION ALL SELECT 'apps', COUNT(*) FROM apps
UNION ALL SELECT 'app_versions', COUNT(*) FROM app_versions;
```

---

## Bước 4. Tạo `.env` trên cPanel

Tạo `keymaster-api/.env` từ `.env` của VPS. **Giữ nguyên** `JWT_SECRET`, `DEVICE_SALT` và các biến `R2_*` / `IDRIVE_E2_*`. Chỉ sửa:

```ini
# XÓA dòng PORT
DB_HOST=localhost
DB_USER=USER_keymaster
DB_PASS=<mật khẩu MySQL trên cPanel>
DB_NAME=USER_keymaster
PRIVATE_KEY_PATH=./keys/private.pem
PUBLIC_KEY_PATH=./keys/public.pem
FRONTEND_URL=https://app.phanmemauto.com
DISABLE_INTERNAL_SCHEDULERS=1
```

Có thể làm nhanh trên Terminal của cPanel nếu đã dùng **Cách A**:

```bash
cd ~/keymaster-api
cp .env.vps .env && rm .env.vps
nano .env   # sửa các dòng ở trên
```

Sau đó **Restart** app trong **Setup Node.js App**.

---

## Bước 5. Tập dượt: kiểm tra cPanel trước khi chuyển

Lúc này DNS vẫn trỏ về VPS. Để mở bản trên cPanel, sửa file `hosts` trên máy mình. Notepad chạy bằng quyền Administrator → mở `C:\Windows\System32\drivers\etc\hosts` → thêm:

```
<IP-cPanel>  app.phanmemauto.com
<IP-cPanel>  api.phanmemauto.com
```

Rồi kiểm tra:

- [ ] `https://api.phanmemauto.com/health` trả về `{"ok":true}`
- [ ] Đăng nhập bằng tài khoản thật. Danh sách license và app giống trên VPS
- [ ] Icon app hiển thị được (thư mục `uploads/` đã chép đủ)
- [ ] App desktop trên máy này kích hoạt và check-in được (RSA key đúng)

Xong thì **xóa 2 dòng vừa thêm** trong `hosts`.

> Dữ liệu tạo ra trong lúc tập dượt (đăng nhập, check-in) sẽ bị ghi đè ở bước 6. Đây là điều mong muốn.

---

## Bước 6. Chuyển thật

Chọn giờ ít người dùng. Nếu DNS ở Cloudflare, việc đổi IP gần như có hiệu lực ngay. Nếu DNS ở nơi khác, hạ TTL xuống 300 giây **trước 1 ngày**.

**Trên VPS:**

```bash
cd ~/apps/license-active
bash ops/vps.sh 27   # dừng backend → không còn ghi vào DB
bash ops/vps.sh 34   # dump lần cuối
bash ops/vps.sh 44   # nén uploads lần cuối (nếu có upload mới từ lúc tập dượt)
```

**Sang cPanel:**

1. Chép 2 file mới theo **bước 2**. Key và `.env` không đổi nên không cần chép lại.
2. Import đè database: phpMyAdmin → chọn `USER_keymaster` → **Check all** → **Drop** toàn bộ bảng → **Import** file mới. Có thể làm bằng Terminal như bước 3.
3. Giải nén `uploads` mới vào `keymaster-api/` và chọn ghi đè.
4. **Restart** app.
5. Đổi DNS của `app`, `api`, `upload` sang IP của cPanel.
6. Chạy lại checklist ở **bước 5** (lần này không cần sửa `hosts`).

---

## Quay lại VPS nếu có sự cố

Dữ liệu trên VPS vẫn còn nguyên tại thời điểm dừng:

1. Trỏ DNS về IP VPS.
2. `bash ops/vps.sh 26` để start lại backend.

Dữ liệu phát sinh trên cPanel trong lúc chạy thử sẽ không có trên VPS. Muốn giữ dữ liệu đó, dump từ cPanel (phpMyAdmin → **Export**) rồi phục hồi trên VPS bằng `bash ops/vps.sh 35`.

Nên giữ VPS ít nhất 1–2 tuần sau khi chuyển rồi mới hủy.
