# PLAN: Software Package Bundles Feature

> **Task slug:** `combo-packages`
> **Estimated effort:** Medium–Large (3–4 days dev)
> **Agents:** `backend-specialist` + `frontend-specialist`

---

## 📌 Tổng quan

Thêm tính năng **Gói Phần Mềm (Package)** vào Store — cho phép Admin tạo các gói bundle gồm nhiều phần mềm, bán với giá ưu đãi. Người dùng thấy Package và App đơn lẻ **trong cùng một trang Store**.

---

## 🔍 Phân tích hệ thống hiện tại

### Database (core tables liên quan)
| Table | Vai trò |
|---|---|
| `apps` | Danh sách phần mềm đơn lẻ |
| `app_pricing` | Giá của từng app (1m/6m/1y) |
| `purchase_orders` | Đơn hàng người dùng đặt mua (`app_id`) |
| `licenses` | License cấp phát sau khi duyệt đơn (`app_id`) |

### Frontend
| File | Vai trò |
|---|---|
| `components/ApplicationStore.tsx` | Trang Store hiển thị app grid |
| `components/Checkout.tsx` | Form đặt hàng + upload bill |
| `components/OrderManagement.tsx` | Admin quản lý đơn hàng |

### Backend
| File | Vai trò |
|---|---|
| `server/modules/store.js` | API Store: GET /apps, POST /orders, POST /orders/:id/approve |

---

## 🏗️ Kiến trúc Package

### Concept
```
Package "Gói Văn Phòng"
├── App A (SEO Tool)
├── App B (Auto Poster)
└── App C (Report Builder)
  → Giá package riêng (rẻ hơn mua lẻ ~20%)
  → Khi approve → tạo 3 licenses riêng biệt (1 per app)
```

### Loại item trong Store
```
Store Grid
├── [APP]     App đơn lẻ      → logic hiện tại
└── [PACKAGE] Gói phần mềm   → logic mới (có badge "PACKAGE")
```

---

## Phase 1 — Database Migration

**File cần tạo:** `server/sql/migrations/012_add_packages.sql`

```sql
-- Bảng định nghĩa Package (gói phần mềm)
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(128) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  icon_url VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  badge VARCHAR(50) NULL,
  discount_percent DECIMAL(5,2) NULL,
  price_1_month DECIMAL(10,2) NULL,
  price_1_month_enabled TINYINT(1) NOT NULL DEFAULT 1,
  price_6_months DECIMAL(10,2) NULL,
  price_6_months_enabled TINYINT(1) NOT NULL DEFAULT 1,
  price_1_year DECIMAL(10,2) NULL,
  price_1_year_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
);

-- Bảng apps trong package (many-to-many)
CREATE TABLE IF NOT EXISTS package_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  app_id INT NOT NULL,
  UNIQUE KEY uniq_package_app (package_id, app_id),
  CONSTRAINT fk_package_items_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_package_items_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Mở rộng purchase_orders để hỗ trợ cả app đơn lẻ và package
ALTER TABLE purchase_orders
  ADD COLUMN package_id INT NULL AFTER app_id,
  ADD CONSTRAINT fk_orders_package FOREIGN KEY (package_id) REFERENCES packages(id);

-- app_id trở thành nullable (package order không cần app_id)
ALTER TABLE purchase_orders MODIFY COLUMN app_id INT NULL;
```

> ⚠️ **Edge case:** `purchase_orders` phải validate: hoặc `app_id` hoặc `package_id` phải có giá trị, không được cả 2 đều NULL.

---

## Phase 2 — Backend API

**File cần sửa:** `server/modules/store.js`

### 2.1 Public API — Store listing

| Endpoint | Method | Mô tả |
|---|---|---|
| `GET /store/packages` | GET | Danh sách package active |
| `GET /store/packages/:id` | GET | Chi tiết 1 package + danh sách apps |

```js
// GET /store/packages — trả về package + apps bên trong
SELECT p.*,
       GROUP_CONCAT(a.name SEPARATOR ', ') as included_apps,
       COUNT(pi.app_id) as app_count
FROM packages p
LEFT JOIN package_items pi ON pi.package_id = p.id
LEFT JOIN apps a ON a.id = pi.app_id
WHERE p.is_active = TRUE
GROUP BY p.id
ORDER BY p.is_featured DESC, p.name ASC
```

### 2.2 Order flow — Package purchase

**Sửa** `POST /store/orders` — thêm support `package_id`:
- Validate: phải có `app_id` HOẶC `package_id`, không cả hai
- Nếu package: verify package đang active

**Sửa** `POST /store/admin/orders/:id/approve` — khi approve package order:
- Nếu `order.package_id` → lấy tất cả apps trong package
- Tạo license riêng cho từng app với cùng duration và user_id

### 2.3 Admin API — Manage Packages

| Endpoint | Method | Mô tả |
|---|---|---|
| `GET /store/admin/packages` | GET | Danh sách package |
| `POST /store/admin/packages` | POST | Tạo package mới |
| `PUT /store/admin/packages/:id` | PUT | Cập nhật package |
| `DELETE /store/admin/packages/:id` | DELETE | Xóa package |
| `POST /store/admin/packages/:id/items` | POST | Thêm app vào package |
| `DELETE /store/admin/packages/:id/items/:appId` | DELETE | Xóa app khỏi package |

---

## Phase 3 — Frontend: Store UI

**File cần sửa:** `components/ApplicationStore.tsx`

### 3.1 Data model mới

```typescript
interface SoftwarePackage {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon_url?: string;
  is_featured?: boolean;
  badge?: string;
  discount_percent?: number;
  price_1_month?: number;
  price_1_month_enabled?: boolean;
  price_6_months?: number;
  price_6_months_enabled?: boolean;
  price_1_year?: number;
  price_1_year_enabled?: boolean;
  included_apps?: string;   // "App A, App B, App C"
  app_count?: number;
  type: 'package';          // discriminator
}

// Sửa StoreApp: thêm type discriminator
// type: 'app'

type StoreItem = StoreApp | SoftwarePackage;
```

### 3.2 Unified Store Grid

Store hiển thị cả App + Package trong cùng một grid, featured items lên trước.
PackageCard phân biệt bằng:
- Badge "PACKAGE" màu gradient vàng-cam
- Section hiển thị danh sách app included
- Hiển thị `% tiết kiệm` nếu có `discount_percent`
- Pricing selector giống App (1m/6m/1y)

### 3.3 Filter update

```tsx
<SelectContent>
  <SelectItem value="all">Tất cả</SelectItem>
  <SelectItem value="app">Phần mềm đơn lẻ</SelectItem>
  <SelectItem value="package">Gói Phần Mềm</SelectItem>
</SelectContent>
```

### 3.4 Checkout flow update

**File cần sửa:** `components/Checkout.tsx`

Sửa để truyền `package_id` thay vì `app_id` khi mua package.

---

## Phase 4 — Admin: Package Management

**File cần tạo:** `components/PackageManagement.tsx`

| Feature | Mô tả |
|---|---|
| Danh sách package | Table hiển thị tất cả package, toggle active |
| Tạo/sửa package | Form: tên, mô tả, giá, badge, discount % |
| App selector | Multi-select checkbox chọn apps vào package |
| Preview | Hiển thị tổng giá lẻ vs giá package |

**File cần sửa:** `App.tsx` — thêm route `/admin/packages`
**File cần sửa:** `components/AdminDashboard.tsx` — thêm menu item "Package Management"

---

## 📋 Task Breakdown

### Phase 1 — DB (0.5 ngày)
- [ ] Tạo `012_add_packages.sql`
- [ ] Chạy migration trên dev DB
- [ ] Verify foreign keys & constraints

### Phase 2 — Backend (1 ngày)
- [ ] Thêm `GET /store/packages` + `GET /store/packages/:id`
- [ ] Sửa `POST /store/orders` → support `package_id`
- [ ] Sửa `POST /store/admin/orders/:id/approve` → multi-license for package
- [ ] Thêm CRUD admin package routes
- [ ] Test tất cả API

### Phase 3 — Store UI (1 ngày)
- [ ] Update `ApplicationStore.tsx`: fetch packages, merge vào unified list
- [ ] Tạo `PackageCard` component (inline hoặc tách file)
- [ ] Update filter dropdown
- [ ] Update `Checkout.tsx` để handle `package_id`
- [ ] Test end-to-end flow: xem package → checkout → upload bill

### Phase 4 — Admin UI (0.5–1 ngày)
- [ ] Tạo `PackageManagement.tsx`
- [ ] Thêm route trong App.tsx
- [ ] Thêm menu sidebar Admin
- [ ] Test: tạo package → approve order → verify licenses tạo đúng

---

## ✅ Verification Checklist

### Database
- [ ] `packages` table tồn tại
- [ ] `package_items` table tồn tại với FK chính xác
- [ ] `purchase_orders` có cột `package_id` nullable
- [ ] `purchase_orders.app_id` nullable

### API
- [ ] `GET /store/packages` trả về danh sách + `included_apps`
- [ ] `POST /store/orders` với `package_id` tạo đơn hàng
- [ ] `POST /store/admin/orders/:id/approve` tạo licenses cho tất cả apps trong package
- [ ] Admin CRUD package hoạt động đúng

### Frontend
- [ ] Store hiển thị cả App và Package trong cùng grid
- [ ] PackageCard có badge "PACKAGE" phân biệt rõ
- [ ] Filter "Gói Phần Mềm" chỉ hiện package items
- [ ] Checkout nhận đúng `package_id` khi mua package
- [ ] Sau khi approve: user thấy nhiều licenses trong My Licenses (1 per app)

### Edge Cases
- [ ] Package có 0 app → không hiển thị hoặc disable mua
- [ ] Admin xóa app đang có trong package → FK cascade xóa khỏi package_items
- [ ] Order có cả `app_id` và `package_id` → backend từ chối với lỗi rõ ràng
- [ ] Approve package order → số lượng licenses = số apps trong package

---

## 📁 Files Summary

| Action | File |
|---|---|
| CREATE | `server/sql/migrations/012_add_packages.sql` |
| MODIFY | `server/modules/store.js` |
| MODIFY | `components/ApplicationStore.tsx` |
| MODIFY | `components/Checkout.tsx` |
| CREATE | `components/PackageManagement.tsx` |
| MODIFY | `App.tsx` |
| MODIFY | `components/AdminDashboard.tsx` |

---

> **Next step:** Confirm plan → Run `/enhance` để bắt đầu implementation từng phase.
