# KeyMaster AI — License & Software Store (phanmemauto.com)

## What This Is

A license-management and software-store platform: users register, buy/renew software licenses (single apps or bundled packages) via manual bank-transfer + receipt approval, activate trials, download apps, and get support; admins manage apps/versions, orders, members, announcements and support from a dashboard. Desktop client apps activate and check-in against the license API. Stack: React 19 + Vite frontend, Express (ESM) + MySQL + Socket.IO backend.

## Core Value

Admins have timely, accurate visibility into what's happening in the system (new signups, trials, sales) — in real time for individual events and as a weekly digest for the overall health of accounts, software, licenses and revenue.

## Requirements

### Validated

<!-- Existing, working capabilities inferred from the codebase map (.planning/codebase/). -->

- ✓ User auth: register, login, email verification, JWT sessions (HS256) — existing
- ✓ License lifecycle: issue, activate (RS256 device tokens), check-in/renew, revoke — existing
- ✓ Trial licenses: 7-day trials with device-level anti-abuse (`trial_devices`) — existing
- ✓ Software store: apps, pricing, packages/bundles, purchase orders (bank transfer + receipt upload → admin approval → license generation) — existing
- ✓ App versions (multi-platform), attachments, verified downloads via iDrive e2 / S3 — existing
- ✓ Support tickets + replies, FAQs, announcements — existing
- ✓ Notifications: DB-persisted + Socket.IO realtime (`createNotification` → `emitToAdmins`/`emitToUser`), admin & per-user rooms with JWT verification — existing
- ✓ Email service: nodemailer using SMTP config stored in DB `settings` (verification email, new-order + order-status emails) — existing
- ✓ Admin dashboard: members, orders, apps, settings (SMTP, bank, app config) — existing
- ✓ Daily license-expiry scheduler (self-scheduling setTimeout/setInterval, 10:00 UTC+7) — existing
- ✓ Realtime admin notification (WebSocket + persisted) on new user registration — Phase 1 (2026-06-18)
- ✓ Realtime admin notification (WebSocket + persisted) on trial activation — Phase 1 (2026-06-18)
- ✓ Weekly system summary email (accounts, software, licenses/trials, weekly revenue, support), Monday 08:00 UTC+7, configurable recipient (default dangson.1011@gmail.com) — Phase 2 (2026-06-18)
- ✓ Admin on-demand trigger to send the weekly report immediately — Phase 2 (2026-06-18)

### Active

<!-- Milestone "Notifications & Weekly Reporting" complete — all Active requirements validated and moved above. -->

(None — milestone complete. Next milestone's requirements go here.)

### Out of Scope

- Notifying end-users on register/trial — this milestone targets admin visibility only (decision: admin-only, consistent with existing `new_order` notifications)
- Persistent/cluster-safe job scheduler (e.g. node-cron + DB lock, BullMQ) — reuse the existing in-memory self-scheduling pattern for now; revisit if multi-instance deployment is adopted
- Per-user weekly digests or configurable report templates — single fixed admin report for now
- Dashboards/charts for the report — email-only summary

## Context

- Brownfield: codebase fully mapped in `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, INTEGRATIONS, CONVENTIONS, TESTING, CONCERNS).
- Established patterns to reuse:
  - `server/modules/notifications.js` → `createNotification({ type, title, message, link, userId })` already persists to DB **and** emits via Socket.IO (`userId = null` → all admins).
  - `server/services/email.js` → SMTP transporter built from DB `settings`; existing `sendNewOrderNotification` / `sendOrderStatusEmail` show the HTML-email style to follow.
  - `server/services/license-scheduler.js` → the self-scheduling daily-cron pattern to mirror for the weekly report.
  - Frontend `components/layout/AppLayout.tsx` already listens to `new-notification` and renders any type (has an `else → toast.info` fallback), so new notification types surface automatically.
- Integration points for the new events: `server/modules/auth.js` `POST /register`; `server/modules/store.js` `POST /trial`.
- Revenue source: `purchase_orders` with `status='paid'` and `paid_at` (weekly revenue = SUM(total_price) over last 7 days).

## Constraints

- **Tech stack**: Node ESM + Express + MySQL (mysql2) + Socket.IO — match existing module/style conventions (no new heavy deps; `nodemailer` already present).
- **DB access**: `server/db.js` `query()` returns only `{ rows }` (no `insertId`/`affectedRows`) — if an inserted id is needed, use `SELECT LAST_INSERT_ID()` (the report/notifications here don't need it).
- **Circular import**: `notifications.js` imports from `auth.js`, so `auth.js` must NOT statically import `notifications.js` — use a dynamic `await import('./notifications.js')` inside the register handler.
- **Email delivery**: depends on SMTP being configured in the DB `settings` table; if unconfigured, the weekly send should fail gracefully (log + skip), not crash.
- **Scheduler**: in-memory self-scheduling — not restart/cluster-safe; add a same-day guard to avoid duplicate sends (mirrors `license-scheduler.js`). Documented as a known limitation.
- **Timezone**: business timezone is UTC+7; Monday 08:00 UTC+7 = 01:00 UTC.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Register/trial notifications go to **admins only** | Matches existing `new_order` pattern; goal is admin visibility ("bắn về" dashboard) | ✓ Good (Phase 1) |
| Reuse `createNotification` for both events | Already does DB persist + Socket.IO emit + frontend renders unknown types | ✓ Good (Phase 1) |
| Dynamic import of `createNotification` inside `auth.js` register | Avoids the `auth.js ↔ notifications.js` circular import at startup | ✓ Good (Phase 1) |
| Weekly report sent **Monday 08:00 UTC+7** | Start-of-week digest of the previous 7 days | ✓ Good (Phase 2) |
| Recipient = **default dangson.1011@gmail.com, overridable** via `WEEKLY_REPORT_EMAIL` env or `weekly_report_email` setting | Honors the request but stays configurable | ✓ Good (Phase 2) |
| New weekly scheduler mirrors `license-scheduler.js` (in-memory) | Consistency; avoid new infra deps for one job | ✓ Good (Phase 2) |
| Add admin route to trigger report on demand | Enables testing without waiting for the weekly tick | ✓ Good (Phase 2) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-18 after Phase 2 completion — milestone "Notifications & Weekly Reporting" finished*
