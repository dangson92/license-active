# Version Attachments & Verified Download Feature

## Goal
1. Admin quản lý **File Attachments** độc lập (tab riêng)
2. Khi tạo **Version Phần mềm** → chọn Attachments đi kèm
3. User có license ACTIVE mới download được phần mềm + attachments

---

## Admin UI Flow

```
Version Management
├── Tab: Phần mềm
│   ├── List các version phần mềm
│   └── Tạo version mới → Chọn attachments đi kèm
│
└── Tab: File Attachment  
    ├── List các attachment files
    └── Tạo attachment mới → Upload file ZIP
```

### Flow Chi tiết

**Tab "File Attachment":**
1. Hiển thị danh sách attachments (filename, size, description, created_at)
2. Button "Thêm Attachment" → Form upload tương tự AddAppVersion
3. Có thể edit/delete attachment

**Tab "Phần mềm":**
1. Hiển thị danh sách versions (như hiện tại)
2. Khi tạo/edit version → thêm field "Chọn Attachments đi kèm" (multi-select)
3. Một attachment có thể được dùng cho nhiều versions

---

## Database Design

### Option: Many-to-Many với Junction Table

```sql
-- Attachments riêng (không phụ thuộc version)
CREATE TABLE app_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,                    -- Thuộc app nào
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NULL,
  description VARCHAR(500) NULL,          -- Tên hiển thị, ví dụ "Plugin ABC"
  download_url VARCHAR(512) NOT NULL,
  storage_type ENUM('vps', 'idrive-e2') NOT NULL DEFAULT 'vps',
  storage_key VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Junction table: Version ↔ Attachment
CREATE TABLE version_attachment_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  attachment_id INT NOT NULL,
  FOREIGN KEY (version_id) REFERENCES app_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES app_attachments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_link (version_id, attachment_id)
);
```

**Ưu điểm:**
- Attachment tái sử dụng cho nhiều versions
- Xóa attachment → unlink tất cả versions (không mất data version)
- Dễ quản lý attachment độc lập

---

## Phase 1: Database Migration

- [x] **Task 1.1**: Tạo `009_add_app_attachments.sql` ✅
  → Created: `server/sql/migrations/009_add_app_attachments.sql`

---

## Phase 2: Backend API - Attachments CRUD

- [x] **Task 2.1**: Tạo module `server/modules/app-attachments.js` ✅
  - GET/POST/PUT/DELETE endpoints
  - Upload VPS + iDrive E2 presigned URL

- [x] **Task 2.2**: Đăng ký route trong `server/index.js` ✅

---

## Phase 3: Backend API - Link Attachments to Version

- [x] **Task 3.1**: Update `app-versions.js` - GET với attachments ✅
- [x] **Task 3.2**: Update `app-versions.js` - POST với attachment_ids ✅
- [x] **Task 3.3**: Update `app-versions.js` - PUT với attachment_ids ✅

---

## Phase 4: Backend API - Verified Download

- [x] **Task 4.1**: Endpoint `GET /api/download/:appCode/verify` ✅
- [x] **Task 4.2**: Endpoint `GET /api/download/:appCode/file` ✅
- [x] **Task 4.3**: Endpoint `GET /api/download/:appCode/attachment/:id` ✅

---

## Phase 2: Backend API - Attachments CRUD

- [ ] **Task 2.1**: Tạo module `server/modules/app-attachments.js`
  ```
  GET    /api/admin/apps/:appId/attachments          - List attachments của app
  POST   /api/admin/apps/:appId/attachments          - Tạo attachment mới
  POST   /api/admin/apps/:appId/attachments/upload   - Upload file cho attachment
  PUT    /api/admin/attachments/:id                  - Update attachment info
  DELETE /api/admin/attachments/:id                  - Xóa attachment + file
  ```
  → Verify: CRUD works via Postman

- [ ] **Task 2.2**: Upload logic (reuse từ app-versions.js)
  - Accept `.zip` only
  - Support VPS + iDrive E2
  - Presigned URL cho E2
  → Verify: Upload ZIP thành công

---

## Phase 3: Backend API - Link Attachments to Version

- [ ] **Task 3.1**: Update `app-versions.js` - Tạo version với attachments
  - POST body thêm field: `attachment_ids: [1, 2, 3]`
  - Insert vào `version_attachment_links`
  → Verify: Create version with attachments

- [ ] **Task 3.2**: Update `app-versions.js` - Get version kèm attachments
  - JOIN với `version_attachment_links` + `app_attachments`
  - Return `attachments: [...]` trong response
  → Verify: Get version includes attachments

- [ ] **Task 3.3**: Update `app-versions.js` - Update version attachments
  - PUT body có field `attachment_ids`
  - Delete old links, insert new links
  → Verify: Update attachments works

---

## Phase 4: Backend API - Verified Download

- [ ] **Task 4.1**: Endpoint `GET /api/download/:appCode/verify`
  - Require auth
  - Check license ACTIVE
  - Return: app info + main file + attachments của latest version
  ```json
  {
    "authorized": true,
    "app": { "code": "...", "name": "..." },
    "version": { "version": "1.0.0", "release_date": "..." },
    "mainFile": { "filename": "...", "size": 123, "downloadUrl": "..." },
    "attachments": [
      { "id": 1, "description": "Plugin ABC", "filename": "...", "size": 456, "downloadUrl": "..." }
    ]
  }
  ```
  → Verify: 401/403/200 responses correct

- [ ] **Task 4.2**: Endpoint `GET /api/download/:appCode/file` 
  - Verify auth + license → redirect to main file
  → Verify: Download works

- [ ] **Task 4.3**: Endpoint `GET /api/download/:appCode/attachment/:id`
  - Verify auth + license → redirect to attachment file
  → Verify: Download attachment works

---

## Phase 5: Frontend - Admin UI ✅

### 5A: Component AttachmentManagement (Tab File Attachment)

- [x] **Task 5.1**: Tạo `components/AttachmentManagement.tsx` ✅
  - Props: `appId`, `appName`, `appCode`
  - State: `attachments[]`, `showAddDialog`, uploads với progress
  - Layout table với actions

- [x] **Task 5.2**: List Attachments ✅
  - Table: filename, description, size, storage, actions
  - Actions: Edit, Delete (with confirm dialog)

- [x] **Task 5.3**: Add/Edit Attachment Form ✅
  - Description input
  - Storage selector (VPS/iDrive E2)
  - File upload zone (ZIP only) với progress bar

### 5B: Update AddAppVersion (Tab Phần mềm)

- [x] **Task 5.4**: Thêm Multi-Select Attachments ✅
  - Fetch attachments của app
  - Checkbox list với description + size

- [x] **Task 5.5**: Save version với attachment_ids ✅
  - Gửi `attachment_ids[]` trong POST/PUT request

### 5C: Update Version Management với Tabs

- [x] **Task 5.6**: Tạo `components/VersionManagementTabs.tsx` wrapper ✅
  - 2 Tabs: "Phần mềm" | "File Attachment"
  - Tab Phần mềm → render VersionManagement (existing)
  - Tab File Attachment → render AttachmentManagement (new)

- [x] **Task 5.7**: Update AdminDashboard.tsx ✅
  - Import và sử dụng VersionManagementTabs

---

## Phase 6: Frontend - User UI (Download Modal) ✅

- [x] **Task 6.1**: Tạo `components/DownloadModal.tsx` ✅
  - Verify license trước khi hiển thị
  - Hiển thị main file + attachments với download buttons
  - Handle các trạng thái: loading, error (auth/license), success

- [x] **Task 6.2**: Download functionality ✅
  - Main file download via redirect
  - Attachment download via redirect
  - Progress states

- [x] **Task 6.3**: Error states UI ✅
  - "Vui lòng đăng nhập" + Button Login
  - "Bạn chưa có license" + Button "Mua ngay"
  - Generic error with retry button

---

## Phase 7: Testing

- [ ] **Task 7.1**: Admin E2E
  1. Vào Tab "File Attachment" → Thêm 2 attachments
  2. Vào Tab "Phần mềm" → Tạo version → Chọn 2 attachments → Save
  3. Edit version → Bỏ 1 attachment → Save
  → Verify: All operations work

- [ ] **Task 7.2**: User E2E
  1. User chưa login → Click card → Thấy "Đăng nhập"
  2. User login (không có license) → Click card → Thấy "Mua license"
  3. User có license ACTIVE → Click card → Thấy download modal → Tải được files
  → Verify: All scenarios work

---

## Done When
- [ ] Admin có 2 tabs: Phần mềm | File Attachment
- [ ] Admin upload attachment độc lập (trong tab File Attachment)
- [ ] Admin tạo version và chọn attachments đi kèm
- [ ] User click card → modal download với phần mềm + attachments
- [ ] Chỉ user có license ACTIVE mới download được

---

## Files to Create/Modify

```
NEW FILES:
├── server/sql/migrations/009_add_app_attachments.sql
├── server/modules/app-attachments.js
├── components/AttachmentManagement.tsx
├── components/VersionManagementTabs.tsx

MODIFIED FILES:
├── server/modules/app-versions.js      # Add attachment_ids support
├── server/modules/download.js          # Add verify endpoint
├── components/AddAppVersion.tsx        # Add attachment selector
├── components/ApplicationStore.tsx     # Add download modal
├── services/api.ts                     # Add new API methods
├── App.tsx                             # Update routing if needed
```

---

## API Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/apps/:appId/attachments` | GET | Admin | List attachments của app |
| `/api/admin/apps/:appId/attachments` | POST | Admin | Tạo attachment mới |
| `/api/admin/apps/:appId/attachments/upload` | POST | Admin | Upload file |
| `/api/admin/attachments/:id` | PUT | Admin | Update attachment |
| `/api/admin/attachments/:id` | DELETE | Admin | Delete attachment |
| `/api/admin/app-versions` | POST | Admin | Tạo version (+ attachment_ids) |
| `/api/admin/app-versions/:id` | PUT | Admin | Update version (+ attachment_ids) |
| `/api/download/:appCode/verify` | GET | User | Verify license + get files |
| `/api/download/:appCode/file` | GET | User | Download main file |
| `/api/download/:appCode/attachment/:id` | GET | User | Download attachment |
