# ops/ — Quản trị VPS

Công cụ vận hành server production (Ubuntu + Nginx + PM2 + MySQL).
Chạy **trên VPS**, không phải trên máy dev.

```bash
cd ~/apps/license-active
bash ops/vps.sh
```

## Ba cách gọi

| Cách | Dùng khi |
|---|---|
| `bash ops/vps.sh` | Mở menu, chọn theo số |
| `bash ops/vps.sh 24` | Chạy thẳng một tác vụ theo số |
| `bash ops/vps.sh restart` | Hoặc theo tên ngắn — tiện cho cron/alias |

`bash ops/vps.sh --help` liệt kê toàn bộ tác vụ.

Gọi kèm tham số thì script thoát với đúng exit code của tác vụ, nên dùng được
trong cron hoặc CI. Ví dụ health check mỗi 5 phút:

```cron
*/5 * * * * cd ~/apps/license-active && bash ops/vps.sh health >> /tmp/health.log 2>&1
```

## Tác vụ

**Deploy & Git** — `11` deploy đầy đủ · `12` chỉ backend · `13` chỉ frontend ·
`14` deploy kèm `npm install` · `15` xem commit hiện tại và so với origin ·
`16` rollback về commit cũ rồi deploy lại.

Nhóm deploy gọi lại [`scripts/deploy.sh`](../scripts/deploy.sh) — một nguồn sự
thật duy nhất, không nhân bản logic build.

**Backend (PM2)** — `21` trạng thái · `22` log · `23` chỉ log lỗi · `24` restart ·
`25` theo dõi log realtime · `26` start · `27` stop · `28` monit · `29` xoá log.

**Database** — `31` trạng thái migration · `32` áp dụng migration đang chờ ·
`33` baseline · `34` backup · `35` phục hồi · `36` MySQL shell · `37` check-db.

**Storage & Uploads** — `41` cấu hình R2/E2 · `42` test kết nối bucket ·
`43` dung lượng uploads và ổ đĩa · `44` backup uploads.

**Nginx & SSL** — `51` test config · `52` reload · `53` error log · `54` access
log · `55` trạng thái chứng chỉ · `56` gia hạn SSL.

**Hệ thống** — `61` tổng quan · `62` health check · `63` kiểm tra `.env` ·
`64` danh sách backup · `65` dọn backup cũ · `66` đối chiếu `.env` với env của
process đang chạy.

> `63` đọc file `.env` trên đĩa, `66` đọc env THẬT của process PM2. Sửa `.env`
> mà quên restart thì `63` báo ✓ còn backend vẫn chạy env cũ — `66` bắt được
> đúng trường hợp đó.

## Migration — đọc trước khi dùng lần đầu

Script theo dõi migration đã chạy bằng bảng `schema_migrations` (tự tạo).
Database hiện tại **đã chạy migration 001–012 bằng tay từ trước**, nên bảng này
lúc đầu rỗng và tác vụ `31` sẽ báo tất cả là "chưa áp dụng".

Lần đầu, chạy `33` (baseline). Nó hỏi **file cuối cùng mà DB đã áp dụng** rồi
chỉ đánh dấu tới đó — những file sau vẫn ở trạng thái chờ để `32` chạy thật.

```bash
bash ops/vps.sh 31   # xem hiện trạng
bash ops/vps.sh 33   # baseline — nhập số của migration cuối đã chạy
bash ops/vps.sh 32   # áp dụng phần còn lại
```

Ví dụ khi DB đã chạy tay tới `012` và vừa pull về `013`: ở bước `33` nhập `12`,
sau đó `32` sẽ chạy đúng mỗi `013`.

Nhập số quá tay ở bước `33` sẽ đánh dấu migration mới là "đã chạy" và nó bị bỏ
qua vĩnh viễn — script in ra danh sách hai nhóm để bạn soát trước khi xác nhận.
Đảo thứ tự (chạy `32` trước khi baseline) thì ngược lại: chạy lại toàn bộ
migration cũ. Phần lớn là `CREATE TABLE IF NOT EXISTS` nên thường vô hại, nhưng
đừng thử.

## Cấu hình

Mặc định trong script khớp với server hiện tại. Nếu khác:

```bash
cp ops/vps.conf.example ops/vps.conf
nano ops/vps.conf
```

`ops/vps.conf` không được commit (đã có trong `.gitignore`). Hoặc override tạm
bằng biến môi trường: `PM2_NAME=abc bash ops/vps.sh 21`.

`APP_DIR` mặc định suy ra từ vị trí của chính script (thư mục cha của `ops/`),
nên thường không cần khai báo.

## Ghi chú an toàn

- Thao tác phá huỷ dữ liệu (`35` restore, `27` stop, `16` rollback, `65` dọn
  backup) đều hỏi xác nhận. Riêng restore bắt gõ đúng tên database.
- Mật khẩu MySQL đi qua file `--defaults-extra-file` tạm quyền 600, không bao
  giờ xuất hiện trong `ps aux`.
- Tác vụ `63` in giá trị `.env` nhưng che các biến bí mật (chỉ báo độ dài);
  endpoint, bucket, URL hiện nguyên văn để còn debug được.
- Script cố ý **không** dùng `set -e`: một tác vụ lỗi phải quay lại menu chứ
  không đánh sập cả phiên làm việc.

## Việc script không làm

- Không sửa `.env` — thêm biến mới (ví dụ `R2_*`) vẫn phải tự `nano .env`.
- Không cấu hình CORS cho bucket R2 — việc đó nằm trên Cloudflare dashboard,
  xem [docs/cloudflare-r2-setup.md](../docs/cloudflare-r2-setup.md).
- Không cài đặt server lần đầu (Node, MySQL, Nginx, PM2, certbot).
