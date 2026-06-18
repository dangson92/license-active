# Technology Stack

**Analysis Date:** 2026-06-18

The project (`package.json` name `keymaster-ai`, branded **phanmemauto.com**) is a single repository containing both a React SPA frontend and a Node.js/Express backend. There is **one shared `package.json`** at the root (`package.json`) — frontend and backend dependencies are mixed together.

## Languages

**Primary:**
- TypeScript `~5.8.2` - All frontend code (`App.tsx`, `index.tsx`, `components/**/*.tsx`, `services/*.ts`, `lib/utils.ts`, `config.ts`, `types.ts`)
- JavaScript (ESM, Node) - All backend code (`server/**/*.js`, `scripts/*.js`). The root `package.json` declares `"type": "module"`, so backend uses native ES modules (`import`/`export`).

**Secondary:**
- SQL (MySQL dialect) - Schema and migrations (`server/sql/schema.sql`, `server/sql/migrations/*.sql`)
- HTML - Email template (`server/templates/verification-email.html`), SPA shell (`index.html`)
- CSS - Tailwind layer + design tokens (`index.css`)

## Runtime

**Environment:**
- Node.js with native ESM (`"type": "module"`). `@types/node` `^22.14.0` implies Node 20/22 target. Backend entry: `server/index.js`.
- Browser (modern ES2022) for the React SPA. `tsconfig.json` targets `ES2022`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, ~345 KB). No `pnpm`/`yarn` lockfiles.

## Frameworks

**Frontend Core:**
- React `^19.2.1` + React DOM `^19.2.1` - UI library
- react-router-dom `^7.12.0` - Client-side routing (`BrowserRouter`, nested routes in `App.tsx` and `components/UserRoutes.tsx`)
- Vite `^6.2.0` - Dev server and build tool (`vite.config.ts`)
- TailwindCSS `^4.1.18` - Utility-first CSS, configured via `@tailwindcss/postcss` (`tailwind.config.js`, `postcss.config.js`)

**Backend Core:**
- Express `^4.21.1` - HTTP server and routing (`server/index.js`, all `server/modules/*.js` use `express.Router()`)
- Socket.IO `^4.8.3` (server) - Realtime (`server/socket.js`)

**Testing:**
- Not detected. No test runner (`jest`, `vitest`, `mocha`), no `*.test.*`/`*.spec.*` files, and no `test` script in `package.json`.

**Build/Dev:**
- Vite `^6.2.0` - Frontend bundler/dev server (port 80 configured in `vite.config.ts`)
- `@vitejs/plugin-react` `^5.0.0` - React Fast Refresh / JSX
- TypeScript `~5.8.2` - Type checking only (`noEmit: true`; Vite handles transpilation)
- PostCSS `^8.5.6` + Autoprefixer `^10.4.23` - CSS pipeline

## Key Dependencies

**UI component layer (frontend):**
- Radix UI primitives (`@radix-ui/react-*`) - 17 packages: `react-dialog`, `react-alert-dialog`, `react-dropdown-menu`, `react-select`, `react-tabs`, `react-tooltip`, `react-popover`, `react-checkbox`, `react-switch`, `react-progress`, `react-scroll-area`, `react-avatar`, `react-label`, `react-separator`, `react-slot`. Wrapped into local primitives under `components/ui/`.
- `lucide-react` `^0.562.0` - Icon set (also see `components/Icons.tsx`)
- `class-variance-authority` `^0.7.1`, `clsx` `^2.1.1`, `tailwind-merge` `^3.4.0`, `tailwindcss-animate` `^1.0.7` - Styling helpers (`lib/utils.ts` exports the `cn()` merge helper)
- `@tinymce/tinymce-react` `^6.3.0` + `tinymce` `^8.3.2` - Rich text editor (used by announcement/FAQ editors)
- `@google/genai` `^1.31.0` - Google Gemini SDK (`services/geminiService.ts`, model `gemini-2.5-flash`)
- `socket.io-client` `^4.8.3` - Realtime client (`services/socket.ts`)

**Backend critical:**
- `mysql2` `^3.11.3` - MySQL driver; promise pool in `server/db.js`
- `jsonwebtoken` `^9.0.2` - JWT for user auth (HS256 via `JWT_SECRET`) AND license/check-in tokens (RS256 via RSA keys)
- `bcryptjs` `^2.4.3` - Password hashing (cost 10) in `server/modules/auth.js`
- `nodemailer` `^7.0.12` - SMTP email (`server/services/email.js`), config read from DB `settings` table
- `multer` `^1.4.5-lts.1` - Multipart file uploads (icons, receipts, version files, attachments)

**Backend infrastructure / S3:**
- `@aws-sdk/client-s3` `^3.974.0`, `@aws-sdk/lib-storage` `^3.974.0`, `@aws-sdk/s3-request-presigner` `^3.975.0` - iDrive e2 (S3-compatible) object storage (`server/services/idrive-e2.js`)
- `cors` `^2.8.5`, `helmet` `^7.1.0`, `morgan` `^1.10.0`, `express-rate-limit` `^7.4.0` - HTTP middleware (`server/index.js`)
- `dotenv` `^16.4.5` - Loads `.env` (`import 'dotenv/config'` at top of `server/index.js`)

**Unused / latent:**
- `pg` `^8.13.1` - PostgreSQL driver is declared but the app uses MySQL (`server/db.js`). The `query()` wrapper returns `{ rows }`, a Postgres-style shape kept for compatibility — but the actual driver is `mysql2`.

## Configuration

**Frontend environment (Vite, `VITE_*` / `process.env`):**
- `VITE_API_URL` - Main API base URL (also reused as `assetApiUrl`). Default `https://app.phanmemauto.com` (`config.ts`).
- `VITE_UPLOAD_API_URL` - Upload/large-file domain. Default `https://upload.phanmemauto.com` (`config.ts`).
- `GEMINI_API_KEY` - Injected at build time as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` via `vite.config.ts` `define`.
- Examples: `.env.frontend.example`, `.env.development.example`.
- Path alias `@` → project root (`vite.config.ts` + `tsconfig.json` `paths`).

**Backend environment (`.env`, see `.env.example`):**
- `PORT` (default 3000), `DB_HOST`, `DB_PORT` (3306), `DB_USER`, `DB_PASS`, `DB_NAME`
- `JWT_SECRET` - HS256 secret for user/download tokens
- `DEVICE_SALT` - (declared in `.env.example`; reserved for device hashing)
- `PRIVATE_KEY_PATH`, `PUBLIC_KEY_PATH` - RSA key file paths for RS256 license tokens (`server/config/keys.js`, default `keys/private.pem` / `keys/public.pem`)
- `FRONTEND_URL` - CORS allow-origin + email link base
- `UPLOAD_URL` - Base URL used to build download links (`server/modules/download.js`, `server/modules/user.js`)
- `LICENSE_SIGNING_SECRET` - HMAC secret for request-signature middleware (`server/middleware/verifySignature.js`; has insecure default)
- iDrive e2: `IDRIVE_E2_ENDPOINT`, `IDRIVE_E2_ACCESS_KEY`, `IDRIVE_E2_SECRET_KEY`, `IDRIVE_E2_BUCKET`, `IDRIVE_E2_PUBLIC_URL`
- SMTP and bank/payment settings are **not** env vars — they live in the DB `settings` table (see INTEGRATIONS.md).

**Build config files:**
- `vite.config.ts` - Vite/React, dev port 80, host exposure, `@` alias, Gemini key injection
- `tsconfig.json` - TS ES2022, `noEmit`, `allowJs`, `allowImportingTsExtensions`
- `tailwind.config.js` - CSS-var design tokens, `tailwindcss-animate`, Inter font
- `postcss.config.js` - `@tailwindcss/postcss` + `autoprefixer`

## Platform Requirements

**Development:**
- Node.js 20+ and npm
- A reachable MySQL instance (schema + migrations applied manually, see `server/sql/`)
- RSA keypair generated into `keys/` (`openssl genrsa ...`) for license issuance — backend `process.exit(1)`s on startup if the private key is missing (`server/config/keys.js`)
- Frontend: `npm run dev` (Vite, port 80); Backend: `npm run backend` / `npm run api`

**Production:**
- VPS deployment behind **Nginx reverse proxy** across three subdomains: `app.` (frontend SPA + proxied API), `api.` (direct API for client apps), `upload.` (large-file upload/download, bypasses CDN size limits). See `docs/TWO_DOMAINS_SETUP.md`, `docs/NGINX_TWO_DOMAINS.md`, `docs/DEPLOYMENT.md`.
- Process management via PM2 (`pm2 restart license-server`, referenced in docs)
- TLS via Certbot/Let's Encrypt (per docs)
- Static frontend served from `dist/` (output of `vite build`) under the web root

## Scripts (`package.json`)

```bash
npm run dev       # vite                — frontend dev server (port 80)
npm run build     # vite build          — production frontend bundle → dist/
npm run preview   # vite preview        — preview built frontend
npm run backend   # node server/index.js — Express + Socket.IO API server
npm run api       # node server/index.js — alias of backend
```

Utility scripts (not wired to npm scripts, run directly with `node`):
- `scripts/check-db.js` - DB connectivity/inspection check
- `scripts/seed-sample-data.js` - Seed sample data

---

*Stack analysis: 2026-06-18*
