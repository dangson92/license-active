# Architecture

**Analysis Date:** 2026-06-18

## Pattern Overview

**Overall:** Decoupled **SPA + REST API** monorepo. A React 19 single-page app (admin + user dashboards + store) talks over HTTP/JSON to a modular Express 4 backend, which persists to MySQL and pushes realtime events over Socket.IO. A separate class of **desktop client apps** (Electron/Node, not in this repo) consume the licensing endpoints (`/activate`, `/check-in`, `/version`, `/download`) using HMAC-signed requests and RS256 license tokens.

**Key Characteristics:**
- Two audiences, one backend: browser SPA users (JWT/HS256 in `localStorage`) and desktop license clients (HMAC-signed, RS256 tokens).
- Modular router-per-feature backend (`server/modules/*.js`), each an `express.Router` mounted in `server/index.js`. No service/repository abstraction — modules issue SQL directly via the shared `query()` helper.
- Dual route mounting: every API router is mounted both under `/api/*` (for the browser via Nginx proxy on `app.`) and the licensing routers also under the bare path (for desktop clients hitting `api.` directly).
- Config split: infra secrets in env; runtime/admin-editable config (SMTP, bank, app name) in the MySQL `settings` table.
- Three deployment subdomains (`app.`, `api.`, `upload.`) front the same Express process via Nginx.

## Layers

**Frontend SPA (`/` root: `index.tsx`, `App.tsx`, `components/`, `services/`, `lib/`):**
- Purpose: Admin + User + Store UI
- Entry: `index.tsx` mounts `<App/>` inside `ToastProvider` (`components/ui/toast.tsx`)
- Routing: `App.tsx` `BrowserRouter` splits `/admin/*` (admin role), `/user/*` (user role, `components/UserRoutes.tsx`), plus `/login`, `/register`, `/verify-email`. Role gating reads the decoded JWT.
- Data access: all calls go through the `api` object in `services/api.ts` (thin `fetch` wrapper that injects `Authorization: Bearer <token>`); realtime through `services/socket.ts`.
- Depends on: backend REST API + Socket.IO.

**API edge / middleware (`server/index.js`, `server/middleware/`):**
- Purpose: cross-cutting HTTP concerns before routing
- Order: `trust proxy` → CORS (+ explicit OPTIONS) → `express.json/urlencoded` (10 MB) → `helmet` (CSP off, cross-origin RP off) → `morgan('combined')` → global `express-rate-limit` on `/activate` paths → routers → static `/uploads`.
- License-specific middleware applied per-route: `verifySignature` (HMAC) then `createRateLimiter('activate'|'checkIn')` (`server/middleware/`).

**Feature modules (`server/modules/*.js`):**
- Purpose: one router per domain area; contains route handlers + inline SQL + auth guards
- Auth guards exported from `server/modules/auth.js`: `requireUser`/`requireAuth`, `requireAdmin`
- Modules: `auth`, `user`, `admin`, `activate`, `check-in`, `version`, `app-versions`, `app-attachments`, `settings`, `support`, `store`, `notifications`, `announcements`, `download`. See STRUCTURE.md for per-module responsibilities.

**Services (`server/services/*.js`):**
- `email.js` - Nodemailer transport built from DB `settings`; verification + order emails; also the canonical `getSettings()` reader
- `idrive-e2.js` - S3-compatible object storage (upload/delete/presign)
- `license-scheduler.js` - self-scheduling daily cron creating expiry notifications

**Data layer (`server/db.js`, `server/sql/`):**
- Purpose: MySQL access + schema
- `db.js` exposes `query()` over a `mysql2` promise pool. No ORM. Tables created via `schema.sql` + numbered migrations (manual apply).

**Realtime (`server/socket.js` ↔ `services/socket.ts`):**
- Purpose: push notifications to admins and individual users without polling.

## Data Flow

**Browser request lifecycle (e.g. admin lists licenses):**
1. Component calls `api.admin.getLicenses(...)` (`services/api.ts`)
2. `apiCall()` prepends `config.apiUrl`, attaches `Authorization: Bearer <auth_token>` from `localStorage`
3. Request hits Nginx on `app.phanmemauto.com`, proxied to Express `/api/admin/licenses`
4. Middleware chain runs (CORS, json, helmet, morgan)
5. Router `server/modules/admin.js` runs `requireAdmin` → `jwt.verify(token, JWT_SECRET)` → role check
6. Handler runs SQL via `query(...)` against MySQL, shapes JSON, responds
7. On non-2xx, `apiCall()` throws `Error(errorData.error)`; component catches and surfaces a toast

**Desktop license activation lifecycle (`server/modules/activate.js`):**
1. Client `POST /activate` (or `/api/activate`) with `{ licenseKey, appCode, deviceId, appVersion }` plus `X-Request-Signature` + `X-Request-Timestamp` headers
2. `verifySignature` recomputes `HMAC-SHA256(sortedJSON(body) + timestamp, LICENSE_SIGNING_SECRET)`, timing-safe compares, rejects stale/future timestamps (5-min window)
3. `createRateLimiter('activate')` checks composite IP/device/license keys (in-memory)
4. Handler resolves app + license, validates `status='active'` and not expired
5. Trial anti-abuse: if `is_trial`, reject if `device_id` already in `trial_devices` for that app
6. Device-cap check: counts active rows in `activations`; rejects at `max_devices`; otherwise inserts an `activations` row (and a `trial_devices` row for trials)
7. Signs an **RS256** JWT (`privateKey`, 30-day) with license/device payload → returns `{ token, expiresAt, licenseInfo }`

**Desktop check-in lifecycle (`server/modules/check-in.js`):**
1. Client `POST /check-in` with `{ token, appCode, deviceId, appVersion }` (signed + rate-limited)
2. Verify RS256 token with public key; assert `appCode`/`deviceId` match the payload
3. Confirm the `activations` row still exists and is `active`, and the license is still `active`/unexpired (admin may have revoked/removed the device)
4. Update `last_checkin_at` + `app_version`; re-issue a fresh 30-day RS256 token (rolling renewal)

**Store / order lifecycle (`server/modules/store.js`):**
1. User browses `/api/store/apps` and `/api/store/packages` (public pricing)
2. Trial: `POST /api/store/trial` instantly creates an `is_trial` license (no checkout)
3. Purchase: `POST /api/store/orders` (multer receipt upload) creates a `pending` `purchase_orders` row; admin is emailed/notified
4. Admin `POST /api/store/admin/orders/:id/approve` → generates one license per app (single app, or one per `package_items` × quantity for packages), sets order `paid`, emails buyer the keys, and creates an in-app notification
5. Reject sets status + notifies buyer

**Download lifecycle (`server/modules/download.js`):**
1. `GET /api/download/:appCode/verify` (auth) checks the user holds an active, unexpired license; returns per-platform download URLs + attachment URLs, each carrying a 30-min download JWT
2. `GET /api/download/:appCode/file?token=...&platform=...` verifies the download token and 302-redirects to the actual file (VPS path or iDrive e2 URL)
3. Public shortcuts: `GET /:appCode.zip|.exe` (root handler in `server/index.js`) redirects to the latest version; `GET /download/:appCode/info` returns public version info

**State Management (frontend):**
- No global store (no Redux/Zustand). State is local React `useState`/`useEffect` per page; the JWT in `localStorage` is the only persistent app state. Server data is re-fetched per view via `services/api.ts`.

## Auth / JWT Flow

- **Register** (`POST /api/auth/register`): bcrypt-hash password, create user with a verification token. If `email_verify_required=true` and SMTP configured → send verification email; otherwise auto-verify and return a 7-day HS256 JWT.
- **Verify email** (`POST /api/auth/verify-email`): validate token + expiry, set `email_verified`.
- **Login** (`POST /api/auth/login`): bcrypt compare; block if verification required and unverified; update `last_login_at`; return HS256 JWT `{ id, role, email }` (7d).
- **Authorization**: `requireUser`/`requireAdmin` (`server/modules/auth.js`) parse `Bearer` and `jwt.verify` with `JWT_SECRET`, attaching `req.user`.
- **Frontend**: `services/api.ts` stores token (`auth_token`), client-side base64-decodes it for role/expiry, auto-clears when expired. `App.tsx` derives the user and gates `/admin/*` vs `/user/*`.
- **Two token families**: HS256 (`JWT_SECRET`) for browser users + 30-min download tokens; **RS256** (RSA keypair) for desktop license/check-in tokens. Socket room joins re-verify the HS256 token server-side.

## Realtime / Socket.IO Flow

1. After login, the frontend calls `initSocket()` then `joinAdminRoom()` / `joinUserRoom()` (`services/socket.ts`), emitting the JWT
2. Server (`server/socket.js`) verifies the token on `join-admin`/`join-user`; admins join room `admins`, users join `user:{id}`
3. Backend events use `emitToAdmins(event, data)` / `emitToUser(userId, event, data)` (e.g. new order → admins; order approved/expiring license → specific user)
4. Notifications are **also persisted** to the `notifications` table (`createNotification()` in `server/modules/notifications.js`) so they survive offline clients and are queryable via `GET /api/notifications`.

## Scheduler / Cron

- `server/services/license-scheduler.js`, started by `initLicenseScheduler()` in `server/index.js`
- Self-scheduling via `setTimeout` until the next **03:00 UTC (10:00 UTC+7)**, then `setInterval` every 24 h
- `checkExpiringLicenses()` finds licenses expiring in exactly 15 days (and not already notified within 20 days) and creates a `license_expiring` notification per user; a `lastCheckDate` guard prevents duplicate same-day runs
- A second in-process timer in `server/middleware/rateLimiter.js` cleans expired rate-limit entries every 5 minutes

## Error Handling

**Strategy:** Per-handler `try/catch` returning JSON `{ error: '<code>' }` with appropriate HTTP status; `console.error` for diagnostics. No centralized Express error middleware.

**Patterns:**
- Stable machine-readable error codes (`invalid_input`, `unauthorized`, `forbidden`, `license_expired`, `max_devices_reached`, `device_already_trialed`, `rate_limit_exceeded`, `server_error`, ...) consumed by the frontend
- Auth/role failures: 401/403; not-found: 404; rate limit: 429
- Fail-open in the custom rate limiter (errors call `next()` rather than blocking)
- Non-critical side effects (emails, notifications) are wrapped so failures don't abort the main request (e.g. order approval emails are `.catch`-logged)

## Cross-Cutting Concerns

**Logging:** `morgan('combined')` HTTP logs + extensive emoji-tagged `console.log`/`console.error` in modules. No structured logger or log aggregation.

**Validation:** Manual per-handler checks (presence/role/status). No schema-validation library (no zod/joi/express-validator). Multer enforces upload size limits per route.

**Authentication:** JWT middleware (`requireUser`/`requireAdmin`) for browser routes; HMAC signature + RS256 token verification for desktop license routes; Socket.IO room joins re-verify JWT.

**Security middleware:** `helmet` (CSP disabled, delegated to frontend), `cors` allow-list (permits no-origin desktop clients), `express-rate-limit` (global on activate) + custom IP/device/license limiter, `verifySignature` (HMAC replay protection). `trust proxy = 1` for correct client IPs behind Nginx.

---

*Architecture analysis: 2026-06-18*
