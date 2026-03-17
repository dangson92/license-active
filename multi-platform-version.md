# Multi-Platform Version Support

## Goal
Cho phép một version số (e.g. `2.1.0`) có nhiều bản build cho các nền tảng khác nhau (Windows, macOS, Linux), mỗi nền tảng có file upload và download URL riêng biệt.

---

## Vấn đề hiện tại

| Vấn đề | Chi tiết |
|--------|----------|
| Unique constraint | DB check `version + app_id` là unique → không thể tạo cùng version cho 2 platform |
| Upload 1-1 | `AddAppVersion` chỉ upload 1 file duy nhất per version |
| Download chọn latest | Query `ORDER BY created_at DESC LIMIT 1` không quan tâm platform |
| DownloadModal | Chỉ hiện 1 nút download, không có tab/lọc platform |
| AppVersionHistory | Không group version theo số version, không hiển thị platform icon |
| File Type thừa | Field `file_type` (.exe, .dmg...) không cần thiết vì platform đã xác định loại file |

---

## Tasks

### Task 1: DB Migration - Bỏ unique constraint cũ
- [x] Tạo file `server/sql/migrations/003_multi_platform_versions.sql`
- Xóa unique index `(app_id, version)` hiện tại
- Thêm unique index `(app_id, version, platform)` để cho phép cùng version nhưng khác platform
- Verify: chạy migration, insert 2 row cùng version khác platform → thành công

### Task 2: Backend - Cập nhật validation logic
- [x] Sửa `server/modules/app-versions.js` - `POST /` route
- Đổi check duplicate: `WHERE app_id = ? AND version = ?` → `WHERE app_id = ? AND version = ? AND platform = ?`
- Sửa error message: `'Version already exists for this app'` → `'Version already exists for this platform'`
- Verify: POST cùng version `2.0.0` với `platform=Windows` rồi `platform=macOS` → cả 2 thành công

### Task 3: Backend - Cập nhật download/verify để chọn đúng platform
- [x] Sửa `server/modules/download.js` - `/verify` endpoint
- Nhận optional query param `?platform=macOS` (hoặc detect từ user-agent)
- Query: nếu có platform → filter theo platform, fallback về Windows nếu không tìm thấy
- Thêm field `availablePlatforms` vào response (mảng tất cả platform có file của version đó)
- Verify: gọi `/verify?platform=macOS` → nhận đúng file macOS

### Task 4: Frontend - Xóa File Type, cập nhật AddAppVersion
**Option được chọn: Upload riêng từng platform (tạo version mới mỗi lần)**
- [x] Sửa `AddAppVersion.tsx`
- **Xóa** toàn bộ dropdown "File Type" khỏi form UI
- **Xóa** state `fileType` và `setFileType`
- **Xóa** field `file_type` khỏi payload `createAppVersion` và `updateAppVersion` (hoặc để server tự suy ra từ platform)
- Thêm gợi ý: "Để thêm bản macOS, sau khi tạo bản Windows xong → nhấn Add New Version với cùng version number"
- Hiện badge cảnh báo nếu version number đã tồn tại cho platform này
- Verify: form không còn dropdown File Type, submit thành công

### Task 4b: Backend - Tự suy ra file_type từ platform (nếu cần)
- [x] Sửa `server/modules/app-versions.js` - `POST /` và `PUT /` route
- Nếu `file_type` không được gửi lên, server tự map: `Windows → .exe`, `macOS → .dmg`, `Linux → .deb`, `Web → N/A`
- Verify: tạo version với platform=macOS không gửi file_type → DB lưu `.dmg` tự động

### Task 5: Frontend - AppVersionHistory: Group by version, hiện platform badges
- [x] Sửa `AppVersionHistory.tsx`
- Group versions có cùng số version thành 1 row
- Hiện platform badges trong row: `[Windows] [macOS]`
- Expand/collapse để xem chi tiết từng platform build
- Thêm cột "Platform" vào table header
- Verify: 2 rows cùng version → hiện 1 row với 2 badge platform

### Task 6: Frontend - DownloadModal: Thêm platform selector
- [x] Sửa `DownloadModal.tsx`
- Thêm interface `availablePlatforms: string[]` vào `DownloadInfo`
- Thêm state `selectedPlatform` (default: auto-detect OS hoặc 'Windows')
- Hiện platform tabs/buttons nếu có >1 platform: `[Windows] [macOS]`
- Khi đổi platform → re-fetch `/verify?platform=macOS`
- Verify: mở modal → thấy 2 nút platform → click macOS → download URL đổi

---

## Done When
- [x] Cùng version number tồn tại nhưng khác platform trong DB
- [x] Upload Windows và macOS cho version `2.1.0` thành công
- [x] Form AddAppVersion không còn dropdown "File Type"
- [x] DownloadModal hiện platform tabs, chọn macOS → download đúng file .dmg
- [x] AppVersionHistory group đúng các platform build của cùng version

## Notes
- **File Type bị xóa khỏi UI** — server tự suy ra từ platform: Windows→`.exe`, macOS→`.dmg`, Linux→`.deb`
- Cột `file_type` trong DB vẫn giữ nguyên (backward compatible), chỉ không expose ra UI nữa
- Auto-detect platform từ `navigator.platform` / `navigator.userAgent` trong DownloadModal
- Không cần migration dữ liệu cũ (Windows versions hiện tại vẫn hoạt động bình thường)
- Platform detection fallback: nếu không có file cho platform → hiện thông báo "Chưa có bản cho nền tảng này"
