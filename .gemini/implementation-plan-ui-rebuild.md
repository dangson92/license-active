# 📋 Kế hoạch xây dựng lại UI với shadcn/ui

> **Ngày tạo:** 2026-01-17
> **Trạng thái:** Đang lên kế hoạch
> **Framework:** shadcn/ui + Tailwind CSS + Radix UI

---

## 📊 Tổng quan

### Mục tiêu
Xây dựng lại toàn bộ giao diện License Management System theo thiết kế mới trong folder `tham-khao`, sử dụng shadcn/ui framework thay vì Tailwind CSS thuần.

### Các trang cần rebuild
| Trang | File hiện tại | Mô tả |
|-------|---------------|-------|
| Login/Register | `components/Auth.tsx` | Trang xác thực người dùng |
| Admin Dashboard | `components/AdminDashboard.tsx` | Quản lý licenses, apps, users |
| User Dashboard | `components/UserDashboard.tsx` | User xem licenses của mình |

### Thiết kế tham khảo
| Folder | Mô tả |
|--------|-------|
| `tham-khao/register_page_1/` | Đăng ký - Create account |
| `tham-khao/register_page_2/` | Đăng nhập - Login |
| `tham-khao/license_management_dashboard/` | Admin - Quản lý licenses |
| `tham-khao/admin_member_management/` | Admin - Quản lý members |
| `tham-khao/application_inventory_management/` | Admin - Quản lý applications |
| `tham-khao/create_new_license/` | Admin - Form tạo license mới |
| `tham-khao/user_portal_dashboard/` | User - My Licenses |

---

## 🎨 Design System mới

### Color Palette (CSS Variables)
```css
:root {
  --background: 0 0% 100%;           /* #ffffff */
  --foreground: 222.2 84% 4.9%;      /* Slate-950 */
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;      /* Slate-900 #0f172a */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;        /* Slate-50 */
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

### Typography
- **Font Family:** Inter (Google Fonts)
- **Headings:** `tracking-tight`, `font-bold`
- **Body:** `text-sm`, `font-medium`

### Layout mới
```
┌─────────────────────────────────────────────────────────┐
│                      HEADER (h-16)                      │
│  [Search Bar]                    [Notifications] [Help] │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   SIDEBAR    │              MAIN CONTENT                │
│   (w-64)     │                                          │
│              │  ┌─────────────────────────────────────┐ │
│  - Logo      │  │ Page Title                          │ │
│  - Nav Items │  │ Description                         │ │
│  - Settings  │  ├─────────────────────────────────────┤ │
│              │  │ Stats Cards (4 columns)             │ │
│              │  ├─────────────────────────────────────┤ │
│              │  │ Table with Tabs                     │ │
│  ─────────── │  │ - All | Active | Pending | Expired  │ │
│  User Info   │  │ - Rows with actions                 │ │
│              │  │ - Pagination                        │ │
│              │  └─────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

## 📦 Phase 1: Setup & Dependencies

### 1.1 Cài đặt packages
```bash
# Tailwind CSS + PostCSS
npm install -D tailwindcss postcss autoprefixer

# shadcn/ui utilities
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge

# Lucide React Icons
npm install lucide-react

# Radix UI Primitives (shadcn components sử dụng)
npm install @radix-ui/react-slot
npm install @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select
npm install @radix-ui/react-tabs
npm install @radix-ui/react-label
npm install @radix-ui/react-checkbox
npm install @radix-ui/react-tooltip
npm install @radix-ui/react-avatar
npm install @radix-ui/react-separator
npm install @radix-ui/react-scroll-area
npm install @radix-ui/react-popover
```

### 1.2 Tạo file cấu hình

| File | Mục đích |
|------|----------|
| `tailwind.config.js` | Cấu hình Tailwind với shadcn theme |
| `postcss.config.js` | PostCSS config |
| `index.css` | Global styles với CSS variables |
| `lib/utils.ts` | `cn()` helper function |
| `components.json` | shadcn/ui config (optional) |

### 1.3 Cập nhật files hiện tại

| File | Thay đổi |
|------|----------|
| `index.html` | Xóa Tailwind CDN, thêm font Inter |
| `vite.config.ts` | Không cần thay đổi |
| `tsconfig.json` | Đảm bảo paths alias `@/*` hoạt động |

---

## 📦 Phase 2: Tạo shadcn Components

### 2.1 Base Components (lib/)
```
lib/
└── utils.ts              # cn() helper
```

### 2.2 UI Components (components/ui/)
```
components/
└── ui/
    ├── button.tsx
    ├── input.tsx
    ├── label.tsx
    ├── card.tsx
    ├── table.tsx
    ├── badge.tsx
    ├── dialog.tsx
    ├── select.tsx
    ├── tabs.tsx
    ├── tooltip.tsx
    ├── avatar.tsx
    ├── separator.tsx
    ├── scroll-area.tsx
    ├── dropdown-menu.tsx
    └── checkbox.tsx
```

### 2.3 Layout Components (components/layout/)
```
components/
└── layout/
    ├── Sidebar.tsx       # Sidebar navigation
    ├── Header.tsx        # Top header với search
    └── AppLayout.tsx     # Layout wrapper
```

---

## 📦 Phase 3: Rebuild Auth Component

### 3.1 File: `components/Auth.tsx`

**Thay đổi chính:**
- Header với logo và navigation links (Product, Pricing, About)
- Card centered với rounded corners
- Icon trong input fields (Mail, Lock, User)
- Remember me checkbox
- Forgot password link
- "Trusted by industry leaders" section

**Components sử dụng:**
- `Card`, `CardHeader`, `CardContent`
- `Input` với icon prefix
- `Button`
- `Label`
- `Checkbox`

**Mockup layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Quản lý SD Automation    Product Pricing About [SignUp] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ┌─────────────────────────┐                │
│              │      [Icon]              │                │
│              │  Log in to your account │                │
│              │  Welcome back! ...      │                │
│              │                         │                │
│              │  Email Address          │                │
│              │  [📧 name@company.com ] │                │
│              │                         │                │
│              │  Password               │                │
│              │  [🔒 ••••••••         ] │                │
│              │                         │                │
│              │  [✓] Remember me  Forgot?│                │
│              │                         │                │
│              │  [ Sign In            ] │                │
│              │                         │                │
│              │  Don't have account? SignUp │            │
│              └─────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Phase 4: Rebuild AdminDashboard

### 4.1 File: `components/AdminDashboard.tsx`

**Thay đổi chính:**

#### Sidebar Navigation
- Logo + App name
- Nav items: Dashboard, Licenses, Applications, Members
- Settings section
- User profile at bottom

#### Header
- Search bar
- Notification icon
- Help icon

#### Stats Cards (4 columns)
| Card | Icon | Value | Subtitle |
|------|------|-------|----------|
| Total Active | verified | 1,284 | +12.5% from last month |
| Expiring Soon | warning | 42 | Within 30 days |
| Unassigned | person_off | 156 | 82% utilization rate |
| Revenue | payments | $14.2k | Annual recurring |

#### License Table
- Tabs: All Licenses, Active, Pending, Expired
- Columns: License Key, Application, Assigned User, Expiry Date, Status, Actions
- Actions: Block, Refresh, Unlink device, Delete
- Pagination

**Components sử dụng:**
- `AppLayout` (Sidebar + Header)
- `Card`, `CardHeader`, `CardContent`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `Badge` với variants (active, pending, expired, revoked)
- `Button` với variants (default, outline, ghost, destructive)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `DropdownMenu` cho actions
- `Dialog` cho device removal popup
- `Select` cho filters
- `Input` cho search

---

## 📦 Phase 5: Rebuild UserDashboard

### 5.1 File: `components/UserDashboard.tsx`

**Thay đổi chính:**

#### Sidebar Navigation
- Logo + "User Portal"
- Nav items: Overview, My Licenses, Store, Support
- Settings, Logout at bottom

#### License Table
- Columns: App Icon/Name, License Key, Expiry Date, Device Usage, Status
- Device Usage với progress bar
- Copy key button

**Components sử dụng:**
- `AppLayout`
- `Table` components
- `Badge`
- `Progress` (cho device usage)
- `Button` (copy icon)
- `Tooltip` (cho hover info)

---

## 📦 Phase 6: Xóa code cũ & Cleanup

### 6.1 Files cần xóa/sửa
- Xóa `components/Icons.tsx` (thay bằng lucide-react)
- Cập nhật imports trong `App.tsx`

### 6.2 Testing
- [ ] Test Auth flow (login/register)
- [ ] Test Admin Dashboard
  - [ ] View licenses
  - [ ] Create license
  - [ ] Revoke/Extend/Delete license
  - [ ] Remove device
  - [ ] Filter & Search
- [ ] Test User Dashboard
  - [ ] View my licenses
  - [ ] Copy license key
- [ ] Test responsive design

---

## 📁 Cấu trúc thư mục cuối cùng

```
license-active/
├── .gemini/
│   └── implementation-plan-ui-rebuild.md
├── components/
│   ├── ui/                    # shadcn components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── avatar.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── progress.tsx
│   │   └── checkbox.tsx
│   ├── layout/                # Layout components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AppLayout.tsx
│   ├── AdminDashboard.tsx     # REBUILD
│   ├── UserDashboard.tsx      # REBUILD
│   ├── Auth.tsx               # REBUILD
│   └── VersionManagement.tsx  # CẬP NHẬT style
├── lib/
│   └── utils.ts               # NEW
├── services/
│   ├── api.ts
│   └── geminiService.ts
├── App.tsx
├── index.tsx
├── index.html                 # CẬP NHẬT
├── index.css                  # NEW (global styles)
├── types.ts
├── tailwind.config.js         # NEW
├── postcss.config.js          # NEW
├── vite.config.ts
├── tsconfig.json
└── package.json               # CẬP NHẬT dependencies
```

---

## ⏱️ Timeline ước tính

| Phase | Công việc | Thời gian |
|-------|-----------|-----------|
| 1 | Setup & Dependencies | 10 phút |
| 2 | Tạo shadcn Components | 20 phút |
| 3 | Rebuild Auth | 15 phút |
| 4 | Rebuild AdminDashboard | 30 phút |
| 5 | Rebuild UserDashboard | 15 phút |
| 6 | Cleanup & Testing | 10 phút |
| **Tổng** | | **~100 phút** |

---

## ✅ Checklist thực hiện

### Phase 1: Setup
- [ ] Cài đặt npm packages
- [ ] Tạo `tailwind.config.js`
- [ ] Tạo `postcss.config.js`
- [ ] Tạo `index.css` với CSS variables
- [ ] Tạo `lib/utils.ts`
- [ ] Cập nhật `index.html`

### Phase 2: shadcn Components
- [ ] `button.tsx`
- [ ] `input.tsx`
- [ ] `label.tsx`
- [ ] `card.tsx`
- [ ] `table.tsx`
- [ ] `badge.tsx`
- [ ] `dialog.tsx`
- [ ] `select.tsx`
- [ ] `tabs.tsx`
- [ ] `tooltip.tsx`
- [ ] `avatar.tsx`
- [ ] `separator.tsx`
- [ ] `scroll-area.tsx`
- [ ] `dropdown-menu.tsx`
- [ ] `checkbox.tsx`
- [ ] `progress.tsx`

### Phase 3: Layout Components
- [ ] `Sidebar.tsx`
- [ ] `Header.tsx`
- [ ] `AppLayout.tsx`

### Phase 4: Page Components
- [ ] `Auth.tsx` rebuild
- [ ] `AdminDashboard.tsx` rebuild
- [ ] `UserDashboard.tsx` rebuild
- [ ] `VersionManagement.tsx` update styles

### Phase 5: Finalization
- [ ] Xóa `Icons.tsx` cũ
- [ ] Test tất cả flows
- [ ] Fix responsive issues

---

## 📝 Ghi chú

1. **Giữ nguyên logic business** - Chỉ thay đổi UI/UX, không thay đổi API calls hay business logic
2. **Sử dụng lucide-react** thay cho custom Icons component
3. **Responsive design** - Sidebar có thể collapse trên mobile
4. **Light mode only** - Không cần hỗ trợ dark mode

---

**Xác nhận bởi user để bắt đầu implement? ✅**
