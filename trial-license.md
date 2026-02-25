# Trial License 7 Ngày — Implementation Plan

> **Status:** ✅ Confirmed — Sẵn sàng implement
> **Updated:** 2026-02-25

## Goal
Thêm gói trial 7 ngày cho application. User đăng ký trial trên web dashboard (không checkout), nhận license key, nhập vào app client. Hệ thống check device ID để chống abuse (đăng ký nhiều tài khoản lấy trial).

## Kiến trúc hiện tại
- **DB**: MySQL — `users`, `apps`, `licenses`, `activations`, `purchase_orders`, `app_pricing`
- **License flow**: User mua → Admin approve → license tạo → Client activate bằng `licenseKey + appCode + deviceId`
- **API**: `/api/activate` (POST) → trả JWT token, `/api/check-in` (POST) → verify device còn active
- **Store**: `/api/store/apps` hiển thị app + pricing, `/api/store/orders` tạo đơn hàng

## Thiết kế

### Flow tổng thể
```
Admin: Enable trial cho app X (settings)
         ↓
User: Vào Store/Dashboard → Thấy app X có nút "Dùng thử 7 ngày"
         ↓
User: Click "Dùng thử" → API tạo trial license (không checkout)
         ↓
User: Nhận license key → Copy → Paste vào Electron app
         ↓
Client: POST /activate { licenseKey, appCode, deviceId }
         ↓
Server: Nhận diện license là trial → Check device_id trong trial_devices
         ├── Device chưa trial app này → Active bình thường, lưu vào trial_devices
         └── Device đã trial app này → Reject: "device_already_trialed"
```

### Anti-abuse Logic (tại `/activate`)
```
1. License là trial? (licenses.is_trial = TRUE)
2. Nếu YES → Check trial_devices WHERE device_id = ? AND app_id = ?
   ├── Tìm thấy → Reject: device đã dùng trial app này rồi
   └── Không thấy → Cho active, INSERT vào trial_devices
3. Nếu NO → Flow bình thường (không thay đổi gì)
```

### Quy tắc business (✅ ĐÃ XÁC NHẬN)
| Quy tắc | Mô tả |
|---------|-------|
| **1 trial / user / app (vĩnh viễn)** | Mỗi user chỉ đăng ký trial 1 lần cho mỗi app. Dù trial đã expired, user KHÔNG thể đăng ký lại |
| **1 trial / device / app (vĩnh viễn)** | Mỗi device chỉ trial 1 lần cho mỗi app (chống multi-account abuse) |
| **Không gia hạn** | Trial license không thể renew hoặc extend |
| **Không checkout** | Tạo trial tức thì, không qua flow đặt hàng |
| **7 ngày** | Trial hết hạn sau 7 ngày kể từ khi tạo |
| **max_devices = 1** | Trial license chỉ cho 1 thiết bị |
| **Badge "Trial" only** | UI chỉ thêm badge "Trial" để phân biệt, các cột khác (status, expires_at, app, etc.) hiển thị giống license thường |

---

## Tasks

### Task 1: Migration — Thêm cột `is_trial` vào `licenses` + Tạo bảng `trial_devices`
**Agent:** `backend-specialist` | **Skill:** `database-design`

**Thay đổi:**
- File: `server/sql/migrations/010_add_trial_support.sql`

```sql
-- 1. Thêm cột is_trial vào licenses
ALTER TABLE licenses ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Thêm trial_enabled vào app_pricing (hoặc apps)
ALTER TABLE app_pricing ADD COLUMN trial_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Bảng tracking device đã trial
CREATE TABLE IF NOT EXISTS trial_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_id INT NOT NULL,
  user_id INT NOT NULL,
  license_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_trial_device_app (device_id, app_id),
  CONSTRAINT fk_trial_devices_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_devices_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);
```

→ **Verify:** Chạy migration thành công, `DESCRIBE licenses` có cột `is_trial`, `SHOW TABLES` có `trial_devices`

---

### Task 2: API — Đăng ký trial trên Store (User)
**Agent:** `backend-specialist` | **Skill:** `api-patterns`

**Thay đổi:**
- File: `server/modules/store.js` — Thêm endpoint `POST /api/store/trial`

**Logic:**
```
POST /api/store/trial
Body: { app_id }
Auth: requireAuth (user phải đăng nhập)

1. Check app tồn tại + trial_enabled = TRUE
2. Check user chưa có trial license cho app này
   → SELECT FROM licenses WHERE user_id=? AND app_id=? AND is_trial=TRUE
   → Nếu có → 400: "trial_already_used"
3. Tạo license:
   - license_key: genKey()
   - is_trial: TRUE
   - max_devices: 1
   - expires_at: NOW() + 7 DAY
   - status: 'active'
4. Return { license_key, expires_at }
```

→ **Verify:** `curl -X POST /api/store/trial -d '{"app_id":1}' -H "Authorization: Bearer ..."` → trả license key. Gọi lần 2 → 400 `trial_already_used`

---

### Task 3: API — Update `/activate` để check trial + device
**Agent:** `backend-specialist` | **Skill:** `api-patterns`

**Thay đổi:**
- File: `server/modules/activate.js` — Thêm logic check trial sau khi xác nhận license valid

**Logic bổ sung (sau dòng 38, trước khi check activations):**
```javascript
// --- Trial device check ---
if (lic.is_trial) {
  // Check if device already used trial for this app
  const trialCheck = await query(
    'SELECT id FROM trial_devices WHERE device_id=? AND app_id=?',
    [deviceId, appId]
  )
  if (trialCheck.rows.length) {
    return res.status(403).json({ error: 'device_already_trialed' })
  }
}
```

**Sau khi activate thành công (sau dòng 63):**
```javascript
// Record trial device
if (lic.is_trial) {
  await query(
    `INSERT IGNORE INTO trial_devices(device_id, app_id, user_id, license_id, created_at)
     VALUES(?, ?, (SELECT user_id FROM licenses WHERE id=?), ?, NOW())`,
    [deviceId, appId, lic.id, lic.id]
  )
}
```

**Cần sửa SELECT query (dòng 29-35):** Thêm `l.is_trial` vào SELECT.

→ **Verify:** Activate trial license lần 1 → OK. Tạo tài khoản mới, trial license mới, activate cùng deviceId → 403 `device_already_trialed`

---

### Task 4: API — Block renew/extend cho trial license
**Agent:** `backend-specialist`

**Thay đổi:**
- File: `server/modules/user.js` — Block endpoint `POST /licenses/:id/renew-requests` nếu license là trial
- File: `server/modules/admin.js` — Block endpoint `POST /licenses/:id/extend` nếu license là trial

**Logic:**
```javascript
// user.js - renew-requests
const licCheck = await query('SELECT is_trial FROM licenses WHERE id=?', [id])
if (licCheck.rows[0]?.is_trial) {
  return res.status(400).json({ error: 'trial_cannot_renew' })
}

// admin.js - extend
const licCheck = await query('SELECT is_trial FROM licenses WHERE id=?', [id])
if (licCheck.rows[0]?.is_trial) {
  return res.status(400).json({ error: 'trial_cannot_extend' })
}
```

→ **Verify:** POST renew request cho trial license → 400. POST extend cho trial license → 400.

---

### Task 5: Admin API — Quản lý trial setting cho app
**Agent:** `backend-specialist`

**Thay đổi:**
- File: `server/modules/store.js` — Update endpoint `POST /admin/pricing` để lưu `trial_enabled`

**Logic:** Thêm field `trial_enabled` vào INSERT/UPDATE query của app_pricing.

→ **Verify:** POST admin/pricing với `trial_enabled: true` → DB cập nhật

---

### Task 6: Frontend Store — Nút "Dùng thử" cho user
**Agent:** `frontend-specialist` | **Skill:** `frontend-design`

**Thay đổi:**
- Component Store hiển thị nút "Dùng thử 7 ngày" khi app có `trial_enabled = TRUE`
- Click → Gọi `POST /api/store/trial` → Hiển thị license key cho user copy
- Nếu user đã trial → Ẩn nút hoặc disable với tooltip "Bạn đã dùng thử app này"

→ **Verify:** Vào Store, thấy nút trial. Click → nhận license. Refresh → nút disabled.

---

### Task 7: Frontend Admin — Toggle trial + Badge trial
**Agent:** `frontend-specialist`

**Thay đổi:**
- Admin pricing form: Thêm checkbox "Bật trial 7 ngày"
- Admin license list: Hiển thị badge "Trial" cho license có `is_trial = TRUE`
- Admin license detail: Disable nút "Extend" cho trial license

→ **Verify:** Admin bật trial cho app → Saved. License list hiển thị badge Trial.

---

### Task 8: Frontend User — Badge trial + Block renew
**Agent:** `frontend-specialist`

**Thay đổi:**
- My Licenses: Hiển thị badge "Trial" bên cạnh tên app/license (nhỏ, màu khác biệt)
- Tất cả cột khác (status, expires_at, app name, devices...) hiển thị **giống hệt** license thường
- License detail: Ẩn/disable nút "Gia hạn" cho trial license
- Trial expired: Hiển thị status "Expired" bình thường + badge "Trial" vẫn hiện

→ **Verify:** User vào My Licenses → Thấy badge Trial nhỏ bên cạnh. Các cột khác giống license thường. Không thấy nút gia hạn cho trial.

---

## Dependency Graph
```
Task 1 (Migration)
  ├──→ Task 2 (Store Trial API)
  ├──→ Task 3 (Activate Check)
  ├──→ Task 4 (Block Renew/Extend)
  ├──→ Task 5 (Admin Pricing API)
  │
  ├──→ Task 6 (Frontend Store) — depends on Task 2, 5
  ├──→ Task 7 (Frontend Admin) — depends on Task 5
  └──→ Task 8 (Frontend User) — depends on Task 4
```

**Parallel nhóm:**
- **Backend (Task 2-5):** Sau Task 1, có thể làm song song
- **Frontend (Task 6-8):** Sau backend tương ứng hoàn thành

---

## Done When
- [ ] Migration chạy thành công
- [ ] User đăng ký trial → nhận license key (không checkout)
- [ ] User đã trial (dù expired) → không đăng ký lại được
- [ ] Activate trial trên client → thành công lần đầu
- [ ] Activate trial cùng deviceId (tài khoản khác) → bị reject
- [ ] Trial license không thể renew/extend
- [ ] Admin có thể bật/tắt trial cho mỗi app
- [ ] UI hiển thị badge "Trial" — các cột khác giống license thường
- [ ] Trial license hết hạn sau 7 ngày → status expired (handled by existing scheduler)
