# External Integrations

**Analysis Date:** 2026-06-18

This document lists every external service / dependency touchpoint, how it is configured (env var vs DB `settings` table), and where in the code it is wired.

## Configuration Sources Overview

There are **two distinct configuration channels**:

1. **Environment variables** (`.env`, loaded by `dotenv` in `server/index.js`) — infrastructure-level secrets: DB, JWT/RSA, iDrive e2, CORS origins, signing secret.
2. **Database `settings` table** (key/value, `server/sql/migrations/004_add_email_verification.sql`) — runtime, admin-editable config: SMTP credentials, app name, email-verification toggle, bank/payment info, order-notification email. Read via `getSettings()` in `server/services/email.js`; managed via `server/modules/settings.js` (`GET/PUT /api/admin/settings`).

## Data Storage

**Primary Database — MySQL:**
- Driver: `mysql2/promise` connection pool (`server/db.js`, `connectionLimit: 10`)
- Configured via env: `DB_HOST`, `DB_PORT` (3306), `DB_USER`, `DB_PASS`, `DB_NAME`
- Single exported helper `query(sql, params)` returns `{ rows }`; `getClient()` exposes a raw pooled connection
- Schema: `server/sql/schema.sql` (base tables) + 12 incremental migrations `server/sql/migrations/001..012` (applied manually via `mysql < file.sql`; no automated migration runner)
- Note: `pg` (PostgreSQL) is in `package.json` but unused; the `{ rows }` return shape is the only Postgres-style residue.

**Object Storage — iDrive e2 (S3-compatible):**
- Wired in `server/services/idrive-e2.js` using `@aws-sdk/client-s3`, `@aws-sdk/lib-storage` (multipart `Upload`), `@aws-sdk/s3-request-presigner` (`getSignedUrl`)
- Client config: `endpoint` (auto-prefixes `https://`), `region: 'e2'`, `forcePathStyle: true`
- Env vars: `IDRIVE_E2_ENDPOINT`, `IDRIVE_E2_ACCESS_KEY`, `IDRIVE_E2_SECRET_KEY`, `IDRIVE_E2_BUCKET`, `IDRIVE_E2_PUBLIC_URL`
- Capabilities: `uploadToE2()` (10 MB parts, queueSize 4), `deleteFromE2()`, `generateE2Key()` (key format `releases/{appCode}/{platform}/{appCode}-{version}.{ext}`), `getPresignedUploadUrl()` (direct browser→E2 upload), `isE2Configured()`
- Consumers: `server/modules/app-versions.js` (`/upload-e2`, `/get-presigned-url`), `server/modules/app-attachments.js` (also builds its own S3 client + presigned URLs)

**Local filesystem uploads (VPS disk):**
- `multer` disk storage writes to `./uploads/...` subfolders:
  - `uploads/icons/` - app icons, ≤500 KB (`server/modules/admin.js`)
  - `uploads/receipts/` - payment receipts, ≤5 MB (`server/modules/store.js`)
  - `uploads/releases/` - app version installers (`server/modules/app-versions.js`)
  - `uploads/attachments/` - app attachments/plugins (`server/modules/app-attachments.js`)
- Served statically at `/uploads` and `/api/uploads` (`server/index.js`)
- Attachments/versions track `storage_type ENUM('vps','idrive-e2')` so files can live on either backend.

**Caching:**
- No external cache (no Redis). Rate-limit state is in-process (`Map` in `server/middleware/rateLimiter.js`) — explicitly noted as not distributed-safe.

## Email — SMTP via Nodemailer

- Wired in `server/services/email.js` using `nodemailer`
- **Configuration lives in the DB `settings` table**, not env: `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `smtp_from`, `app_name`, `email_verify_required`, `order_notification_email`
- Transporter built per-call from `getSmtpConfig()`; throws if host/user/pass missing
- Sent emails:
  - `sendVerificationEmail()` - account email verification (template `server/templates/verification-email.html`, link → `${FRONTEND_URL}/verify-email?token=...`), triggered by `server/modules/auth.js` register/resend
  - `sendTestEmail()` - admin SMTP test (`POST /api/admin/settings/test-email`)
  - `sendNewOrderNotification()` - notify admin (`order_notification_email`) of a new order
  - `sendOrderStatusEmail()` - notify buyer on approve/reject, including generated license keys (`server/modules/store.js` approve flow)
- Admin password is masked (`********`) on `GET /api/admin/settings` and skipped on update if unchanged (`server/modules/settings.js`)

## AI — Google Gemini (GenAI)

- SDK: `@google/genai` (`GoogleGenAI`) in `services/geminiService.ts` (**frontend**)
- Model: `gemini-2.5-flash`
- API key: `process.env.API_KEY` (injected at build time from `GEMINI_API_KEY` via `vite.config.ts` `define`)
- Function `generateKeyInsights()` sends an anonymized license-stats summary and returns 3 business-insight bullets. Returns a graceful fallback string if the key is absent or the call fails. This is the only AI touchpoint and runs client-side.

## Realtime — Socket.IO

- Server: `server/socket.js` (`initSocket(httpServer)` attached to the Express HTTP server in `server/index.js`)
- CORS origins: `FRONTEND_URL` + `http://localhost:3000` + `http://localhost:5173`
- Rooms (JWT-verified with `JWT_SECRET` on join):
  - `admins` - clients emitting `join-admin` with an admin-role token
  - `user:{id}` - clients emitting `join-user` with their token
- Emit helpers: `emitToAdmins(event, data)`, `emitToUser(userId, event, data)`
- Client: `services/socket.ts` (`socket.io-client`) connects to `config.apiUrl` (strips trailing `/api`), transports `['websocket','polling']`, auto-reconnect (5 attempts). `joinAdminRoom()` / `joinUserRoom()` emit the stored JWT.

## Authentication & Identity

- **Custom JWT auth** (no external IdP).
- User tokens: `jsonwebtoken` HS256 signed with `JWT_SECRET`, 7-day expiry (`signUserToken` in `server/modules/auth.js`). Payload `{ id, role, email }`. Verified by `requireUser` / `requireAdmin` middleware.
- Passwords: `bcryptjs` hash cost 10.
- License/device tokens (for desktop client apps): `jsonwebtoken` **RS256** signed with the RSA private key (`server/config/keys.js`), 30-day expiry, issued by `server/modules/activate.js` and renewed by `server/modules/check-in.js`. Verified with the public key.
- Download tokens: short-lived (30 min) HS256 tokens signed with `JWT_SECRET` (`server/modules/download.js`).
- Frontend stores the JWT in `localStorage` under `auth_token` and decodes it client-side for role/expiry (`services/api.ts`).

## Payments / Banking

- **Manual bank-transfer flow** (no payment gateway/SDK).
- Bank info stored in DB `settings`: `bank_name`, `bank_code`, `bank_account`, `bank_holder`
- Exposed publicly (no auth) via `GET /api/admin/settings/payment` (`server/modules/settings.js`) for the checkout screen
- Buyer uploads a payment receipt image with the order (`POST /api/store/orders`, multer → `uploads/receipts/`); admin manually approves/rejects, which generates license keys (`server/modules/store.js`).

## CI/CD & Deployment

**Hosting / topology (see `docs/`):**
- VPS behind **Nginx reverse proxy** with three subdomains on `phanmemauto.com`:
  - `app.phanmemauto.com` - frontend SPA (served from `dist/`) and proxied `/api/*` to Express
  - `api.phanmemauto.com` - direct API for desktop client apps (activation/check-in/version without `/api` prefix)
  - `upload.phanmemauto.com` - large-file upload/download path (bypasses CDN 100 MB limit; see `config.ts` comment)
- Backend run under **PM2** (`license-server`), TLS via **Certbot**
- Docs: `docs/DEPLOYMENT.md`, `docs/TWO_DOMAINS_SETUP.md`, `docs/NGINX_TWO_DOMAINS.md`, `docs/VPS_SETUP_QUICK.md`, `docs/HD-Deploy-vps.txt`, `docs/LOCAL_DEVELOPMENT.md`

**CI Pipeline:**
- None detected (no `.github/workflows`, no CI config). Deployment is manual per the docs.

**Monitoring / Observability:**
- Error tracking: none (no Sentry/etc.). Errors are `console.error`-logged.
- Logs: HTTP access logging via `morgan('combined')` (`server/index.js`); heavy emoji-prefixed `console.log` instrumentation throughout modules.

## CORS / Network Allow-list

- Express CORS (`server/index.js`) allows `FRONTEND_URL`, the three `*.phanmemauto.com` subdomains, `localhost:3000`, `localhost:5173`, and **requests with no Origin** (so Electron/desktop clients pass). Custom headers allowed include `X-Request-Signature`, `X-Request-Timestamp`. `app.set('trust proxy', 1)` for Nginx.

## Environment Configuration Summary

**Required env vars (backend `.env`):**
`PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`, `DEVICE_SALT`, `PRIVATE_KEY_PATH`, `PUBLIC_KEY_PATH`, `FRONTEND_URL`, `UPLOAD_URL`, `LICENSE_SIGNING_SECRET`, `IDRIVE_E2_ENDPOINT`, `IDRIVE_E2_ACCESS_KEY`, `IDRIVE_E2_SECRET_KEY`, `IDRIVE_E2_BUCKET`, `IDRIVE_E2_PUBLIC_URL`

**Required env vars (frontend build):**
`VITE_API_URL`, `VITE_UPLOAD_API_URL`, `GEMINI_API_KEY`

**DB-stored config (`settings` table):**
SMTP (`smtp_*`), `app_name`, `email_verify_required`, `order_notification_email`, bank info (`bank_*`)

**Secrets location:**
- `.env` (git-ignored via `.gitignore`)
- RSA keypair files under `keys/` (`keys/.gitignore` excludes the `.pem` files)
- SMTP/bank secrets persisted in MySQL `settings`

## Webhooks & Callbacks

**Incoming:**
- License client endpoints consumed by desktop apps (HMAC-signed): `POST /activate` (`/api/activate`), `POST /check-in` (`/api/check-in`), `GET /version` (`/api/version`) — see `server/modules/activate.js`, `check-in.js`, `version.js`.
- Public download endpoints: `GET /:appCode.zip|.exe` (302 redirect to latest version URL), `GET /download/:appCode/info` (`server/index.js`, `server/modules/download.js`).

**Outgoing:**
- No outbound webhooks. The only outbound network calls are: MySQL, SMTP (Nodemailer), iDrive e2 (AWS S3 SDK), and Google Gemini (frontend).

---

*Integration audit: 2026-06-18*
