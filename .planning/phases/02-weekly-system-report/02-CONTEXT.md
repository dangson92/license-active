# Phase 2: Weekly System Report - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning
**Source:** Decisions captured during /gsd-new-project questioning

<domain>
## Phase Boundary

Backend-only. Add a weekly system-summary email and the machinery to send it: a data-gathering function + an email builder/sender in `server/services/email.js`, a new self-scheduling weekly job `server/services/report-scheduler.js` (mirrors `server/services/license-scheduler.js`), wiring in `server/index.js`, and an admin "send now" route in `server/modules/settings.js`. No frontend, no DB migration, no new npm dependency (`nodemailer` already present).
</domain>

<decisions>
## Implementation Decisions (locked)

### Report content (REPORT-01) — last 7 days + relevant totals
- **Accounts** (`users`): total, new this week, active this week (last_login within 7d), admins.
- **Software**: `apps` total + active (`is_active = TRUE`), `app_versions` count, `packages` count.
- **Licenses & trials** (`licenses`): active (`status='active'`), active trials (`is_trial=TRUE AND status='active'`), new this week, new trials this week, expiring within 7 days.
- **Revenue / orders** (`purchase_orders`): weekly revenue = SUM(total_price) WHERE `status='paid'` AND `paid_at` ≥ now-7d; weekly paid-order count; all-time paid revenue; new orders this week (created_at); pending orders count; top 5 apps/packages by weekly paid revenue.
- **Support** (`support_tickets`): open tickets (`status IN ('pending','in_progress')`), new tickets this week.

### Data gathering — `getWeeklyReportData()` in `server/services/email.js`
- Reuse the existing `query` from `../db.js`. NOTE: `query()` returns `{ rows }`; it uses `pool.execute` (prepared statements). Report queries take NO params → call `query(sql)`.
- Aggregates use MySQL `SUM(<boolean expr>)` / `COALESCE(...)`. mysql2 may return `SUM`/`DECIMAL` columns as **strings** — coerce every numeric field with `Number(...)` before use.
- Be **defensive**: wrap each section's query so one failing query (e.g. an unexpected schema difference) defaults that section to zeros/empty and logs, rather than aborting the whole report.

### Email send — `sendWeeklyReport(to = null)` in `server/services/email.js`
- Recipient resolution order: explicit `to` arg → `process.env.WEEKLY_REPORT_EMAIL` → `settings.weekly_report_email` (DB) → default constant `dangson.1011@gmail.com` (REPORT-03).
- Reuse existing `createTransporter()` (throws if SMTP unconfigured), `getSmtpConfig()`, `getSettings()`, and `formatCurrency()` already in email.js. Subject like `[<app_name>] Báo cáo hệ thống tuần (<period>)`. Build a clean HTML report in the existing inline-style table format used by `sendNewOrderNotification`/`sendOrderStatusEmail`. Vietnamese labels.
- Add `getWeeklyReportData` and `sendWeeklyReport` to the module's `default {}` export (function declarations are hoisted, so this works even though they're defined lower — mirror how `sendNewOrderNotification` is already in the default export while defined after it).
- Return `{ success: true, to, data }`.

### Scheduler — new file `server/services/report-scheduler.js`
- Mirror `server/services/license-scheduler.js` structure exactly: `runWeeklyReport()` (calls `sendWeeklyReport()`, try/catch logs + returns), `getMillisecondsUntilNextRun()` (next **Monday 01:00 UTC** = 08:00 UTC+7), `scheduleNextRun()` (setTimeout → run → `setInterval(runWeeklyReport, 7*24*60*60*1000)`), `initReportScheduler()`, default export.
- Same-day guard (`lastRunDate` module var, like license-scheduler's `lastCheckDate`) so a single tick can't double-send (REPORT-02).
- Graceful: if SMTP unconfigured or send throws, `runWeeklyReport` catches, logs, and returns — never crashes the process or stops the interval (REPORT-05).

### Wiring — `server/index.js`
- `import { initReportScheduler } from './services/report-scheduler.js'` and call `initReportScheduler()` right after the existing `initLicenseScheduler()` call.

### Admin trigger — `server/modules/settings.js` (REPORT-04)
- Add `sendWeeklyReport` to the existing `import { sendTestEmail } from '../services/email.js'`.
- Add `router.post('/send-weekly-report', requireAdmin, ...)`: optional `{ to }` body; calls `await sendWeeklyReport(to)`; returns `{ success, to }`; mirror the existing `/test-email` route's try/catch + error shape (`res.status(500).json({ error: e.message })`). This mounts at `POST /api/admin/settings/send-weekly-report`.

### Claude's Discretion
- Exact HTML layout/wording of the report and the precise SQL phrasing, as long as the numbers are correct and match direct DB queries.
- Whether `getWeeklyReportData` runs queries sequentially or via `Promise.all` (either is fine).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Email + transporter
- `server/services/email.js` — `getSettings`, `getSmtpConfig`, `createTransporter` (throws if unconfigured), `formatCurrency`, the `default {}` export block, and the HTML style of `sendNewOrderNotification` (line ~163) / `sendOrderStatusEmail` (line ~230).
- `server/db.js` — `query(sql, params)` → `{ rows }` via `pool.execute`.

### Scheduler pattern (mirror this)
- `server/services/license-scheduler.js` — `checkExpiringLicenses` + `getMillisecondsUntilNextRun` (UTC-hour math, the 03:00 UTC = 10:00 UTC+7 example) + `scheduleNextCheck` + `initLicenseScheduler` + default export + the `lastCheckDate` same-day guard.

### Wiring + route
- `server/index.js` — the `initLicenseScheduler()` call site (~line 196) and its import (~line 24).
- `server/modules/settings.js` — the `/test-email` admin route (~line 71) and `requireAdmin` import for the new route shape.

### Schema (for correct SQL)
- `server/sql/schema.sql` (users, licenses, apps), `server/sql/migrations/005_add_support_and_store.sql` (purchase_orders: status ENUM pending/paid/cancelled/refunded, paid_at, total_price; support_tickets; app_pricing), `010_add_trial_support.sql` (`licenses.is_trial`), `012_add_packages.sql` (packages; purchase_orders.package_id, app_id nullable), `002_create_app_versions_table.sql` (app_versions).
</canonical_refs>

<specifics>
## Specific Ideas

- Revenue is "paid" orders: `purchase_orders.status='paid'` with `paid_at` set on approval (see `store.js` approve handler ~line 412). Weekly window = `paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`.
- Top apps: LEFT JOIN apps + packages, `COALESCE(a.name, pk.name, '(Khác)')`, GROUP BY name, ORDER BY revenue DESC LIMIT 5.
- Mirror the daily scheduler's UTC math: license-scheduler targets 03:00 UTC (10:00 UTC+7); this one targets **01:00 UTC** (08:00 UTC+7) but only on Mondays.
</specifics>

<deferred>
## Deferred Ideas

- Multi-recipient distribution lists (REPORT-V2-01), configurable template/sections (REPORT-V2-02), cluster/restart-safe scheduling (REPORT-V2-03) — all out of scope this milestone. The in-memory scheduler's restart/cluster limitation is a known, accepted constraint for v1.
</deferred>

---

*Phase: 02-weekly-system-report*
*Context gathered: 2026-06-18 during /gsd-new-project*
