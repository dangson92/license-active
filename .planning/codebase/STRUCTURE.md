# Codebase Structure

**Analysis Date:** 2026-06-18

The repo is a single project holding both the React/Vite **frontend** (at the project root + `components/`, `services/`, `lib/`) and the Node/Express **backend** (`server/`). One shared `package.json`.

> Excluded from this map (reference/scaffolding, not the app): `node_modules/`, `.agent/`, `tham-khao/`, `.gemini/`, `.claude/`, `dist/` (build output).

## Directory Layout

```
license-active/
├── index.html              # SPA shell, loads /index.tsx
├── index.tsx               # React entry — mounts <App/> in <ToastProvider>
├── index.css               # Tailwind layers + CSS-var design tokens
├── App.tsx                 # Root router: admin/user/auth route split + role gating
├── config.ts               # Frontend API base URLs (app./api./upload. domains)
├── types.ts                # Shared frontend TS types/enums (User, LicenseKey, ...)
├── vite.config.ts          # Vite/React config, @ alias, Gemini key injection
├── tsconfig.json           # TypeScript config (noEmit, ES2022, bundler)
├── tailwind.config.js      # Tailwind theme/tokens
├── postcss.config.js       # PostCSS (@tailwindcss/postcss + autoprefixer)
├── package.json            # Shared deps + scripts (dev/build/backend/api)
│
├── components/             # All React UI (admin + user + store + shared)
│   ├── layout/             # AppLayout, Header, Sidebar (admin/user chrome)
│   ├── ui/                 # Radix-based primitives (button, dialog, table, ...)
│   ├── UserRoutes.tsx      # User-side nested router
│   └── *.tsx               # Feature pages (see "Frontend Components" below)
│
├── services/               # Frontend service clients
│   ├── api.ts              # Typed REST client (fetch + JWT) — central API surface
│   ├── socket.ts           # Socket.IO client (rooms, reconnect)
│   └── geminiService.ts    # Google Gemini AI insights (client-side)
│
├── lib/
│   └── utils.ts            # cn() classname merge helper
│
├── keys/                   # RSA keypair for RS256 license tokens (.pem git-ignored)
│
├── scripts/                # One-off node utilities (check-db, seed-sample-data)
│
├── server/                 # Express + Socket.IO backend (ESM)
│   ├── index.js            # App bootstrap: middleware, route mounting, listen, socket+scheduler init
│   ├── db.js               # mysql2 promise pool + query() helper
│   ├── socket.js           # Socket.IO init + emit helpers (admin/user rooms)
│   ├── config/
│   │   └── keys.js         # Loads RSA private/public keys from files
│   ├── middleware/
│   │   ├── rateLimiter.js  # Custom in-memory IP/device/license rate limiter
│   │   └── verifySignature.js  # HMAC request-signature verification (anti-replay)
│   ├── modules/            # One express.Router per domain (see "Server Modules")
│   ├── services/           # email.js, idrive-e2.js, license-scheduler.js
│   ├── templates/
│   │   └── verification-email.html
│   └── sql/
│       ├── schema.sql      # Base tables (users, apps, licenses, activations, renew_requests)
│       └── migrations/     # 001..012 incremental migrations (manual apply)
│
├── docs/                   # Deployment/architecture docs (Nginx, VPS, 2-domain setup)
└── *.md                    # Feature notes (trial-license, multi-platform-version, README)
```

## Directory Purposes

**`components/` (frontend UI):**
- All React pages and widgets. Flat file-per-feature plus two subfolders.
- `components/ui/` — design-system primitives wrapping Radix (e.g. `button.tsx`, `dialog.tsx`, `select.tsx`, `table.tsx`, `tabs.tsx`, `toast.tsx`, `pagination.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`). Use these, not raw Radix, in feature components.
- `components/layout/` — `AppLayout.tsx` (shell, `variant="admin"|"user"`), `Header.tsx`, `Sidebar.tsx`.

**`services/` (frontend clients):**
- `api.ts` is the single source of truth for backend endpoints — every new API call belongs here under the matching namespace (`auth`, `admin`, `user`, `store`, `support`, `notifications`, `announcements`, `download`, `settings`).
- `socket.ts` for realtime; `geminiService.ts` for AI insights.

**`server/modules/` (backend feature routers):**
- Each file is an `express.Router` mounted in `server/index.js`. Handlers contain inline SQL via `query()` and apply `requireUser`/`requireAdmin` guards from `auth.js`.

**`server/services/` (backend integrations):**
- External-system adapters: SMTP email, iDrive e2 storage, the license expiry scheduler.

**`server/sql/`:**
- `schema.sql` = base tables. `migrations/NNN_*.sql` = ordered changes applied manually (`mysql < file.sql`). No migration runner.

**`docs/`:**
- Deployment + topology references: `DEPLOYMENT.md`, `TWO_DOMAINS_SETUP.md`, `NGINX_TWO_DOMAINS.md`, `VPS_SETUP_QUICK.md`, `HD-Deploy-vps.txt`, `LOCAL_DEVELOPMENT.md`, `ARCHITECTURE.md`, `FLOW_VERIFICATION.md`, `PLAN-combo-packages.md`, `multi-platform-file-feature.md`.

## Frontend Components (`components/`)

**Admin pages** (rendered under `/admin/*` by `App.tsx`):
- `AdminDashboardOverview.tsx` - admin dashboard
- `MemberManagement.tsx` - users CRUD
- `LicenseManagement.tsx`, `CreateLicense.tsx` - license list + creation
- `ApplicationManagement.tsx`, `ApplicationSetting.tsx` - apps CRUD + per-app settings/icon
- `VersionManagement.tsx`, `VersionManagementTabs.tsx`, `AppVersionHistory.tsx`, `AddAppVersion.tsx` - app version management (multi-platform)
- `AttachmentManagement.tsx`, `AttachmentList.tsx`, `AddAttachment.tsx` - app attachments/plugins
- `OrderManagement.tsx` - approve/reject purchase orders
- `PackageManagement.tsx` - software package bundles
- `AdminTicketManagement.tsx`, `AdminTicketDetail.tsx` - support tickets + FAQs
- `AnnouncementManagement.tsx`, `AnnouncementEditor.tsx`, `AnnouncementDetailPage.tsx` - announcements (TinyMCE)
- `Settings.tsx` - SMTP/bank/app settings
- `NotificationsPage.tsx` - notifications

**User pages** (under `/user/*`, `UserRoutes.tsx`):
- `UserDashboard.tsx`, `UserDashboardOverview.tsx` - user home
- `ApplicationStore.tsx`, `Checkout.tsx`, `CheckoutSuccess.tsx`, `DownloadModal.tsx` - store + checkout + downloads
- `UserOrders.tsx` - order history
- `UserSupport.tsx`, `TicketDetail.tsx` - tickets
- `UserAnnouncements.tsx` - announcements feed
- `UserSettings.tsx` - profile/password

**Auth / shared:**
- `Auth.tsx` (login/register), `VerifyEmail.tsx`, `Icons.tsx`

## Server Modules (`server/modules/`) — responsibilities

| Module | Mounted at | Responsibility |
|---|---|---|
| `auth.js` | `/api/auth` | Register/login/verify-email/resend/change-password; exports `requireUser`, `requireAdmin`, `requireAuth` guards; HS256 JWT signing |
| `user.js` | `/api/user` | User's licenses + download links; renewal requests |
| `admin.js` | `/api/admin` | Users CRUD, apps CRUD + icon upload, licenses CRUD/extend/transfer/device-remove, renew-request processing |
| `settings.js` | `/api/admin/settings` | Get/update `settings` table (SMTP masked), public `/payment` bank info, test-email |
| `activate.js` | `/api/activate`, `/activate` | License activation for desktop clients (HMAC + rate limit, trial anti-abuse, device cap, RS256 token) |
| `check-in.js` | `/api/check-in`, `/check-in` | Periodic device validity check + RS256 token renewal |
| `version.js` | `/api/version`, `/version` | Latest version lookup per app/platform (public) |
| `app-versions.js` | `/api/admin/app-versions` | Admin version CRUD + file upload (VPS + iDrive e2 direct/presigned) |
| `app-attachments.js` | `/api/admin/apps`, `/api/admin/attachments` | App attachment CRUD + upload/presign (exports `appsRouter`, `attachmentsRouter`) |
| `store.js` | `/api/store` | Store apps/packages/pricing, trials, orders (receipt upload), admin approve/reject (license generation) |
| `support.js` | `/api/support` | Tickets + replies (user & admin), FAQs |
| `notifications.js` | `/api/notifications` | List/unread-count/mark-read/delete; exports `createNotification()` (DB persist + Socket.IO emit) |
| `announcements.js` | `/api/announcements` | Announcements (public read, admin CRUD/publish/archive) |
| `download.js` | `/api/download`, `/download`, `/d` | License-verified downloads, signed 30-min download tokens, public info/redirects |

## Key File Locations

**Entry Points:**
- Frontend: `index.tsx` → `App.tsx`
- Backend: `server/index.js` (`npm run backend` / `npm run api`)

**Configuration:**
- Frontend API targets: `config.ts`; build/env: `vite.config.ts`
- Backend env loading: `import 'dotenv/config'` in `server/index.js`; RSA keys: `server/config/keys.js`

**Core Logic:**
- API client: `services/api.ts`
- DB access: `server/db.js`
- Auth/guards: `server/modules/auth.js`
- Licensing core: `server/modules/activate.js`, `server/modules/check-in.js`
- Storage: `server/services/idrive-e2.js`; Email: `server/services/email.js`; Scheduler: `server/services/license-scheduler.js`

**Data model:** `server/sql/schema.sql` + `server/sql/migrations/*.sql`

## Naming Conventions

**Files:**
- Frontend components: `PascalCase.tsx` (e.g. `LicenseManagement.tsx`); ui primitives: `kebab-case.tsx` (e.g. `alert-dialog.tsx`)
- Frontend services/libs: `camelCase.ts` (e.g. `geminiService.ts`)
- Backend modules/services: `kebab-case.js` (e.g. `app-versions.js`, `license-scheduler.js`); core files short lower-case (`db.js`, `socket.js`)
- Migrations: `NNN_snake_case_description.sql` (zero-padded sequence)

**Directories:** lowercase (`components`, `server`, `services`, `modules`). Frontend sub-grouping by concern (`layout/`, `ui/`).

## Where to Add New Code

**New backend feature (a new API area):**
1. Create `server/modules/<feature>.js` exporting an `express.Router`; guard handlers with `requireUser`/`requireAdmin` from `./auth.js`; use `query()` from `../db.js`.
2. Mount it in `server/index.js` under `/api/<feature>` (and the bare path too only if it's a desktop-client endpoint).
3. If it needs schema changes, add `server/sql/migrations/NNN_*.sql` (next sequence number).
4. Add matching methods to the relevant namespace in `services/api.ts`.

**New external integration:** add an adapter in `server/services/` (mirror `email.js`/`idrive-e2.js`); read secrets from env, or from the `settings` table if admin-editable.

**New admin/user page:** add `components/<Page>.tsx`, register the route in `App.tsx` (admin) or `components/UserRoutes.tsx` (user), and add a nav entry via the layout's `onNavClick`/`getActiveSection` mapping in `App.tsx`.

**New UI primitive:** add to `components/ui/` wrapping the Radix primitive; use the `cn()` helper from `lib/utils.ts`.

**Realtime event:** persist + emit via `createNotification()` (`server/modules/notifications.js`) or call `emitToAdmins`/`emitToUser` from `server/socket.js`; consume on the client via `services/socket.ts`.

## Special Directories

**`keys/`** - RSA keypair for RS256 license tokens. Contains `.gitignore` + `.gitkeep` + `README.md`; the `.pem` files are git-ignored and must be generated per environment. Committed: keypair NO, placeholders YES.

**`uploads/`** (runtime, not in repo) - multer destination (`icons/`, `receipts/`, `releases/`, `attachments/`), served at `/uploads` and `/api/uploads`. Generated at runtime.

**`dist/`** - Vite build output (git-ignored). Generated; deployed to the web root behind Nginx.

**`docs/`** - Markdown deployment/architecture references. Not app code; committed.

---

*Structure analysis: 2026-06-18*
