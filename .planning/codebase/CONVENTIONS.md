# Coding Conventions

**Analysis Date:** 2026-06-18

This codebase has **no automated style enforcement** — there is no ESLint, Prettier, Biome, or `.editorconfig` (verified: no `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, `biome.json`). Conventions below are therefore *de facto* patterns observed consistently across the source. Follow them by hand; do not assume a formatter will fix style for you.

There are **two distinct style worlds**:
- **Backend** (`server/**/*.js`, `scripts/*.js`): JavaScript ESM, **no semicolons**, 2-space indent, single quotes.
- **Frontend** (`*.tsx`, `services/*.ts`, `lib/*.ts`): TypeScript + React, **semicolons used**, single quotes, mixed 2/4-space indent (feature components tend to 4-space; `components/ui/*` primitives are 4-space).

Match the surrounding file's existing style rather than imposing one global style.

## Naming Patterns

**Files:**
- Frontend feature components: `PascalCase.tsx` — `components/LicenseManagement.tsx`, `components/UserOrders.tsx`, `components/Checkout.tsx`, `components/AdminTicketDetail.tsx`.
- Frontend UI primitives (Radix wrappers): `kebab-case.tsx` — `components/ui/button.tsx`, `components/ui/alert-dialog.tsx`, `components/ui/dropdown-menu.tsx`.
- Frontend services / libs: `camelCase.ts` — `services/api.ts`, `services/socket.ts`, `services/geminiService.ts`, `lib/utils.ts`.
- Backend modules / services: `kebab-case.js` — `server/modules/app-versions.js`, `server/modules/check-in.js`, `server/services/license-scheduler.js`, `server/services/idrive-e2.js`.
- Backend core/short files: lowercase — `server/db.js`, `server/socket.js`, `server/index.js`.
- SQL migrations: `NNN_snake_case.sql` with zero-padded sequence — `server/sql/migrations/001_*.sql`.

**Functions:**
- `camelCase` everywhere — backend: `signUserToken`, `generateDownloadToken`, `getSettings` (`server/modules/auth.js`, `server/modules/user.js`); frontend: `loadOrders`, `formatCurrency`, `getStatusBadge` (`components/UserOrders.tsx`).
- React components: `PascalCase`, typed as `React.FC` — `export const UserOrders: React.FC = () => { ... }`.

**Variables:**
- `camelCase` for locals (`passwordHash`, `verificationToken`, `mainDownloadUrl`).
- `UPPER_SNAKE_CASE` for module-level constants — `DOWNLOAD_TOKEN_EXPIRY` (`server/modules/user.js`), `TOKEN_KEY` (`services/api.ts`).
- DB columns are `snake_case` (`full_name`, `email_verified`, `max_devices`, `expires_at`) and flow through unchanged into JSON responses and frontend interfaces — frontend interfaces deliberately mirror DB column casing (`components/UserOrders.tsx` `interface Order { order_code; app_name; duration_months; ... }`). Do **not** camelCase DB fields when shaping responses; the frontend reads `snake_case` keys directly.

**Types (frontend):**
- Shared domain types/enums live in `types.ts` (`User`, `UserRole`, `LicenseKey`).
- Component-local response shapes are declared inline as `interface` at the top of the component file (e.g. `interface Order` in `components/UserOrders.tsx`, `interface DecodedToken`/`LoginResponse` in `services/api.ts`).

**Error codes (backend → frontend contract):**
- Machine-readable `snake_case` strings: `invalid_input`, `email_exists`, `invalid_credentials`, `email_not_verified`, `unauthorized`, `forbidden`, `server_error`, `token_expired`, `user_not_found`. Reuse existing codes; the frontend keys off `error.message`.

## Code Style

**Backend (`server/**/*.js`):**
- ESM only (root `package.json` `"type": "module"`). Use `import`/`export`, never `require`.
- **No semicolons.** 2-space indent. Single quotes.
- Named exports for helpers/middleware; `export default router` for each module's `express.Router`.
- `__dirname`/`__filename` are reconstructed via `fileURLToPath(import.meta.url)` (see `server/index.js`) — there is no CommonJS `__dirname`.

**Frontend (`*.tsx` / `*.ts`):**
- TypeScript with `React.FC` components and `useState`/`useEffect` hooks.
- **Semicolons used.** Single quotes. JSX via `react-jsx` runtime (no `import React` needed for JSX, though files still import React for hooks).
- Styling is Tailwind utility classes inline in `className`; conditional/variant classes via the `cn()` helper.

**Shared:** No formatter — keep lines reasonable, match the file you are editing.

## Import Organization

**Backend** (`server/modules/auth.js`, `server/index.js`) — observed order:
1. Third-party packages — `import express from 'express'`, `import jwt from 'jsonwebtoken'`, `import bcrypt from 'bcryptjs'`.
2. Local modules with **explicit `.js` extension** (required by Node ESM) — `import { query } from '../db.js'`, `import { requireUser } from './auth.js'`.
- `import 'dotenv/config'` is the **first line** of `server/index.js`.

**Frontend** (`App.tsx`, `components/UserOrders.tsx`) — observed order:
1. React + router — `import React, { useState, useEffect } from 'react'`, `import { BrowserRouter, ... } from 'react-router-dom'`.
2. Services — `import api from '../services/api'` (default import) or `import api, { getCurrentUser } from './services/api'`.
3. UI primitives via the `@` alias — `import { Card, CardContent } from '@/components/ui/card'`.
4. Icons last — `import { ShoppingCart, Package, ... } from 'lucide-react'`.

**Path aliases:**
- `@` → project root, configured in both `vite.config.ts` and `tsconfig.json`. Used mainly for `@/components/ui/*` and `@/lib/utils`. Note: feature components frequently use **relative** imports for services (`../services/api`) but the `@` alias for ui primitives — both styles coexist; prefer `@/` for `components/ui` and `lib`.

## Error Handling

**Backend — the dominant pattern (114 `try` blocks across `server/modules/*.js`):**
Every route handler wraps its body in `try/catch`; the catch logs and returns a 500 JSON error:

```js
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'invalid_input' })
    // ... query() calls, business logic ...
    res.json({ token })
  } catch (e) {
    console.error('Login error:', e)        // prefixed, human-readable label
    res.status(500).json({ error: 'server_error' })
  }
})
```

Rules to follow when adding handlers:
- Validate inputs first with early `return res.status(4xx).json({ error: '<code>' })` (guard clauses, not nested `if`).
- Status conventions: `400` invalid input, `401` unauthorized, `403` forbidden, `404` not found, `409` conflict, `429` rate limit, `500` server error.
- Catch block: `console.error('<Handler> error:', e)` then `res.status(500).json({ error: 'server_error' })`.
- The error body is **always** `{ error: '<string code>' }` (occasionally with extra fields like `{ success, message }` on success paths). Keep this shape — the frontend depends on it.
- There is **no centralized Express error middleware**; each handler owns its own error response.

**Non-critical side effects** (sending email, creating notifications) are wrapped in their own inner `try/catch` or `.catch()` so they never abort the main request — see the verification-email branch in `server/modules/auth.js` (`register`), which still returns `success: true` when email fails.

**Frontend — fetch wrapper + toast pattern:**
- `apiCall()` in `services/api.ts` throws `new Error(errorData.error || 'HTTP <status>')` on any non-2xx response.
- Components catch and either log or surface a toast:

```ts
const loadOrders = async () => {
  try {
    setLoading(true);
    const response = await api.store.getMyOrders();
    setOrders(response.items || []);
  } catch (error) {
    console.error('Failed to load orders:', error);
  } finally {
    setLoading(false);
  }
};
```

- User-facing feedback uses the toast helper (`components/ui/toast.tsx`): `toast.success(title, msg)`, `toast.error(...)`, `toast.info(...)`, `toast.warning(...)` — these dispatch a `window` `CustomEvent`, so they can be called from anywhere without the hook.

## Database Access

- Single helper: `query(sql, params)` from `server/db.js`, returning a **`{ rows }`** object (a Postgres-style shape kept for compatibility even though the driver is `mysql2`). Always read results as `result.rows` / `r.rows[0]`.
- Raw parameterized SQL inlined in handlers — **always use `?` placeholders** with a params array (`query('SELECT ... WHERE email=?', [email])`). Never string-concatenate user input into SQL. There is **no ORM and no query builder**.
- Multi-row async work uses `Promise.all(rows.map(async ...))` (see `server/modules/user.js` license enrichment).
- For transactions, `getClient()` exposes a pooled connection, but most code uses single `query()` calls.

## Logging

- Backend: `console.log` / `console.error` / `console.warn`, frequently with **emoji tags** (`⚠️`, `✓`) and a human-readable prefix label (`'Login error:'`, `'Failed to send verification email:'`). HTTP access logging via `morgan('combined')` in `server/index.js`. No structured logger.
- Frontend: `console.error('<context>:', error)` for diagnostics; the toast convenience functions also `console.log('[Toast] ...')`.

## Comments & Language

- **User-facing strings are Vietnamese** — response `message` fields, UI labels, and toast text (`'Vui lòng kiểm tra email để xác thực tài khoản.'`, `'Mật khẩu đã được thay đổi thành công!'`, `'Đã duyệt'`/`'Chờ duyệt'`). Locale formatting uses `vi-VN` (`new Intl.NumberFormat('vi-VN')`, `toLocaleDateString('vi-VN', ...)` in `components/UserOrders.tsx`).
- **Comments mix Vietnamese and English** — inline explanatory comments are often Vietnamese (`// Lấy danh sách licenses của user ...` in `server/modules/user.js`); some are English. Match the file. Keep machine-readable **error codes in English `snake_case`** (those are an API contract, not user copy).
- JSDoc is used sparingly for non-trivial helpers (e.g. the `generateDownloadToken` block comment in `server/modules/user.js`); most functions are uncommented.

## Function & Module Design

**Backend:**
- One `express.Router` per domain file in `server/modules/`, default-exported and mounted in `server/index.js` (under `/api/<feature>`, and additionally at the bare path for desktop-client routers).
- Route guards come from `server/modules/auth.js`: `requireUser` (alias `requireAuth`) and `requireAdmin`, applied as the second arg to a route — `router.get('/licenses', requireUser, async (req, res) => { ... })`. `requireAdmin` composes `requireUser` then checks `req.user.role === 'admin'`. Both attach `req.user = { id, role, email }`.
- Small private helpers (token signing, key generation) are module-scoped functions above the routes.

**Frontend:**
- Components are functional, typed `React.FC`, with local `useState` for data + a `loading` flag; data fetched in `useEffect` on mount via a named `loadX()` async function.
- No global state store (no Redux/Zustand). The JWT in `localStorage` (key `auth_token`) is the only persisted state; server data is re-fetched per view.
- All backend calls go through the single `api` object in `services/api.ts`, namespaced by domain (`api.auth`, `api.admin`, `api.user`, `api.store`, `api.settings`, `api.support`, `api.notifications`, `api.announcements`, `api.download`). **Add new endpoints as methods on the matching namespace there** — components never call `fetch` directly (file uploads being the exception, which still build their request inside `services/api.ts`).
- `api` is both a named and default export.

**UI primitives (`components/ui/`):**
- Built on Radix primitives + `class-variance-authority` (`cva`) for variants, `React.forwardRef`, and the `cn()` class-merge helper. Pattern (`components/ui/button.tsx`):

```tsx
const buttonVariants = cva("inline-flex items-center ...", {
  variants: { variant: { default: "...", destructive: "..." }, size: { ... } },
  defaultVariants: { variant: "default", size: "default" },
})

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
```

- New primitives go in `components/ui/` following this shape; **feature components must use these wrappers, not raw Radix**. Use `cn()` (from `@/lib/utils`) to merge incoming `className` with base classes so callers can override.

**Styling:**
- Tailwind 4 utility classes inline. Design tokens are CSS variables (`bg-primary`, `text-primary-foreground`, `bg-destructive`) defined via `tailwind.config.js` + `index.css`. Prefer token classes over hard-coded colors; ad-hoc palette colors do appear in feature components (e.g. status badges `bg-emerald-100 text-emerald-700` in `components/UserOrders.tsx`) — acceptable for one-off semantic states.

## Anti-Patterns Present (avoid extending)

- `services/api.ts` repeats the FormData-upload + auth-header + error-check block per upload method instead of sharing a helper — reuse `apiCall()` where possible.
- `App.tsx` carries a `DEV_MODE` login bypass and `MOCK_*` users — leave `DEV_MODE = false`; never ship it `true`.
- No input-validation library (no zod/joi); validation is manual per handler. Stay consistent with manual guard clauses rather than introducing a competing approach mid-module.

---

*Convention analysis: 2026-06-18*
