# CLAUDE.md — KeyMaster AI (phanmemauto.com)

License-management + software-store platform. **React 19 + Vite** frontend, **Express (ESM) + MySQL (mysql2) + Socket.IO** backend. Desktop client apps activate/check-in against the license API.

## GSD workflow

This project is managed with GSD. Planning lives in `.planning/`:

- `.planning/PROJECT.md` — project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1 requirements + traceability
- `.planning/ROADMAP.md` — phases, goals, success criteria
- `.planning/STATE.md` — current focus / project memory
- `.planning/config.json` — workflow settings (mode: yolo, granularity: coarse, research: off, plan_check/verifier: on)
- `.planning/codebase/` — codebase map (STACK, ARCHITECTURE, STRUCTURE, INTEGRATIONS, CONVENTIONS, TESTING, CONCERNS)

Read `.planning/STATE.md` first to see where work stands. Typical loop: `/gsd-plan-phase N` → `/gsd-execute-phase N` → `/gsd-verify-work`. Note: the installed `gsd-sdk` CLI only supports `run`/`auto`/`init` (not the `gsd-sdk query …` helpers some workflow docs assume) — execute GSD workflow steps manually and use plain `git` for commits.

## Current milestone — Notifications & Weekly Reporting

- **Phase 1:** Realtime admin notifications on user register / trial activation (NOTIF-01..03)
- **Phase 2:** Weekly system-summary email, Monday 08:00 UTC+7, admin on-demand trigger (REPORT-01..05)

## Conventions (match existing code)

- Backend: ESM, no semicolons, 2-space indent. Per-handler `try/catch` → `res.status(...).json({ error: '<snake_case_code>' })`. SQL always parameterized with `?`.
- DB: `server/db.js` `query(sql, params)` returns **only `{ rows }`** (no `insertId`/`affectedRows`). For an inserted id, run `SELECT LAST_INSERT_ID()`.
- Notifications: `server/modules/notifications.js` `createNotification({ type, title, message, link, userId })` persists **and** emits via Socket.IO. `userId = null` → all admins; otherwise that user's room. Frontend `components/layout/AppLayout.tsx` renders any type (toast fallback).
- Email: `server/services/email.js` builds an SMTP transporter from the DB `settings` table. Reuse the existing HTML-email style.
- Schedulers: mirror `server/services/license-scheduler.js` (self-scheduling `setTimeout`/`setInterval` with a same-day guard). In-memory — not cluster/restart-safe (known limitation).
- Frontend: PascalCase components in `components/`, all API calls go through the `api` object in `services/api.ts`, UI from `components/ui/` (Radix + cva + `cn()`). User-facing strings are Vietnamese; error codes English.

## Gotchas

- `auth.js` ↔ `notifications.js` would be a **circular import** (notifications imports `requireAuth` from auth). In `auth.js`, use a dynamic `await import('./notifications.js')` inside the handler — never a top-level static import.
- No automated tests / no test runner exist. Validate via `npm run build` (TS gate) + manual checks.
- Business timezone is UTC+7 (Monday 08:00 UTC+7 = 01:00 UTC).

## Commands

- `npm run dev` — Vite frontend · `npm run backend` (or `npm run api`) — Express server (`node server/index.js`)
- `npm run build` — production build (also the TypeScript type-check gate)
