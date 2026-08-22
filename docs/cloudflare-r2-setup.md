# Cloudflare R2 — Hướng dẫn cấu hình

Thay thế iDrive E2 (sắp hết hạn). R2 tương thích S3 API nên dùng chung
`@aws-sdk/client-s3` đã có sẵn — **không cần cài thêm package**.

Code dùng chung: [`server/services/cloud-storage.js`](../server/services/cloud-storage.js).
Cả hai provider chạy song song được, chọn nơi lưu ngay trên UI khi upload.

---

## 1. Tạo bucket

1. Cloudflare Dashboard → **R2** → **Create bucket**
2. Đặt tên (ví dụ `keymaster-files`), chọn location gần VN (APAC).
3. Ghi lại **Account ID** (góc phải trang R2, hoặc trong URL dashboard).

## 2. Tạo API Token

**R2** → **Manage R2 API Tokens** → **Create API Token**

- Permission: **Object Read & Write**
- Scope: chỉ bucket vừa tạo (đừng cấp toàn account)
- Sau khi tạo, copy **Access Key ID** và **Secret Access Key** (chỉ hiện 1 lần)

## 3. Bật public access cho bucket

Endpoint S3 (`*.r2.cloudflarestorage.com`) **không public** — client tải file
qua đó sẽ bị 401. Phải chọn một trong hai:

**Cách A — Custom domain (khuyến nghị cho production)**
- Bucket → **Settings** → **Public access** → **Custom Domains** → Connect domain
- Ví dụ `dl.phanmemauto.com` (domain phải nằm trong Cloudflare của bạn)
- `R2_PUBLIC_URL=https://dl.phanmemauto.com`

**Cách B — r2.dev subdomain (dùng để test)**
- Bucket → **Settings** → **Public Development URL** → Enable
- Nhận URL dạng `https://pub-xxxxxxxx.r2.dev`
- `R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev`
- Lưu ý: r2.dev bị Cloudflare rate-limit, không dùng cho production.

## 4. Cấu hình CORS — **bắt buộc**

Admin upload file **trực tiếp từ browser lên R2** bằng presigned URL. Không có
CORS thì browser chặn request PUT, upload luôn fail (thường báo "Network error").

Bucket → **Settings** → **CORS Policy** → Add:

```json
[
  {
    "AllowedOrigins": [
      "https://license.dangthanhson.com",
      "https://app.phanmemauto.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

`AllowedOrigins` phải là **domain hiện trên thanh địa chỉ khi bạn mở trang
admin** — không phải domain của API, cũng không phải `dl.phanmemauto.com`.
Hiện `FRONTEND_URL` đang là `https://license.dangthanhson.com`; nếu bạn còn mở
admin ở subdomain khác thì thêm cả subdomain đó vào. Sai origin thì upload báo
"Network error" dù mọi thứ khác đều đúng.

`http://localhost:5173` chỉ để dev, nên bỏ khi lên production.

## 5. Biến môi trường (`.env` trên VPS)

```bash
# Nơi lưu mặc định khi request không chỉ định: 'r2' | 'idrive-e2'
STORAGE_PROVIDER=r2

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=keymaster-files
R2_PUBLIC_URL=https://dl.phanmemauto.com
```

`R2_ENDPOINT` là tuỳ chọn — bỏ trống thì suy ra từ `R2_ACCOUNT_ID`
(`https://<account_id>.r2.cloudflarestorage.com`).

Giữ nguyên các biến `IDRIVE_E2_*` cho tới khi migrate xong file cũ: các
version/attachment đang trỏ vào E2 vẫn cần credentials để xoá file.

## 6. Migration DB

```bash
mysql -u <user> -p <db> < server/sql/migrations/013_add_r2_storage.sql
```

Chỉ mở rộng ENUM `app_attachments.storage_type` thêm giá trị `'r2'`.
Dữ liệu cũ không đổi.

## 7. Kiểm tra

Cách nhanh nhất là dùng script quản trị trên VPS (không cần token):

```bash
bash ops/vps.sh 63   # .env đã đủ biến R2 chưa
bash ops/vps.sh 41   # provider nào đang được cấu hình
bash ops/vps.sh 42   # test kết nối thật tới bucket
```

Hoặc gọi qua HTTP API nếu muốn kiểm tra từ ngoài (cần token admin):

```bash
curl -H "Authorization: Bearer <admin_token>" \
  https://<api-host>/api/admin/app-versions/storage/providers

curl -X POST -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" -d '{"storage":"r2"}' \
  https://<api-host>/api/admin/app-versions/storage/test
```

Cuối cùng upload thử một version qua UI, chọn **Cloudflare R2**, rồi mở URL tải
về ở tab ẩn danh để chắc chắn file public.

---

## Ghi chú kỹ thuật

- **Region luôn là `auto`** — R2 từ chối mọi region khác.
- **Checksum**: AWS SDK ≥ 3.729 tự thêm header `x-amz-checksum-*`. R2 không
  hỗ trợ, và với presigned URL thì browser không gửi lại header đã ký →
  403 `SignatureDoesNotMatch`. Client R2 vì vậy đặt
  `requestChecksumCalculation: 'WHEN_REQUIRED'` và
  `responseChecksumValidation: 'WHEN_REQUIRED'`.
- **ACL**: R2 không hỗ trợ ACL per-object. Public access cấu hình ở mức bucket
  (bước 3), không set `ACL: 'public-read'` khi upload.
- **Multipart**: mọi part trừ part cuối phải bằng nhau và ≥ 5MB.
  `@aws-sdk/lib-storage` với `partSize` cố định 10MB thoả điều kiện này.
- **Giá**: R2 không tính phí egress — điểm lợi lớn nhất so với E2 cho use case
  phân phối file cài đặt.

## Migrate file cũ từ iDrive E2 sang R2

Chưa có script tự động. Cách nhanh nhất là dùng `rclone` với hai remote
S3-compatible:

```bash
rclone copy e2:e2bucket r2:keymaster-files --progress
```

Sau khi copy xong, cập nhật `download_url` trong bảng `app_versions` và
`app_attachments` từ domain E2 sang `R2_PUBLIC_URL`, rồi kiểm tra lại link tải.
