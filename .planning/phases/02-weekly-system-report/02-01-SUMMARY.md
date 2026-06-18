---
phase: 02-weekly-system-report
plan: 01
subsystem: backend / reporting
tags: [email, scheduler, reporting, admin-route]
requires: []
provides:
  - getWeeklyReportData + sendWeeklyReport in server/services/email.js
  - server/services/report-scheduler.js (weekly self-scheduling job)
  - initReportScheduler() wired into server boot
  - POST /api/admin/settings/send-weekly-report (admin on-demand trigger)
affects:
  - server/services/email.js
  - server/index.js
  - server/modules/settings.js
tech-stack:
  added: []
  patterns: [self-scheduling-setTimeout-setInterval, per-section-defensive-aggregates, recipient-resolution-chain]
key-files:
  created:
    - server/services/report-scheduler.js
  modified:
    - server/services/email.js
    - server/index.js
    - server/modules/settings.js
decisions:
  - "Report metrics windowed to last 7 days via DATE_SUB(NOW(), INTERVAL 7 DAY); each section in its own try/catch so one failing query defaults to zeros and logs instead of aborting the whole report."
  - "All aggregate numerics coerced with Number() because mysql2 pool.execute returns SUM/COUNT/DECIMAL as strings."
  - "Recipient resolves: to arg -> WEEKLY_REPORT_EMAIL env -> settings.weekly_report_email -> default 'dangson.1011@gmail.com'."
  - "Scheduler targets the next Monday 01:00 UTC (08:00 UTC+7) via setUTCHours(1) + getUTCDay() Monday selection; same-day lastRunDate guard prevents single-tick double-send."
  - "createTransporter() is allowed to throw inside sendWeeklyReport; runWeeklyReport and the admin route wrap the call so SMTP-unconfigured degrades gracefully (REPORT-05)."
metrics:
  duration: ~15m
  completed: 2026-06-18
  tasks: 4
  files: 4
---

# Phase 2 Plan 01: Weekly System Report Summary

Backend-only weekly system-summary email: a defensive 7-day metrics aggregator and Vietnamese HTML sender in `email.js`, a Monday-08:00-UTC+7 self-scheduling job mirroring `license-scheduler.js`, boot wiring in `index.js`, and an admin on-demand trigger route — degrading gracefully when SMTP is unconfigured.

## Objective

Deliver all five Phase 2 requirements (REPORT-01..05): automatic weekly digest email of accounts/software/licenses+trials/revenue/support metrics over the last 7 days, sent every Monday 08:00 UTC+7, with an admin override recipient and an on-demand trigger, all without crashing when SMTP is unavailable. No DB migration, no new dependency, no frontend change.

## What Changed Per File

### server/services/email.js (modified — Task 1)
- Added module-level `const DEFAULT_WEEKLY_REPORT_EMAIL = 'dangson.1011@gmail.com'`.
- Added `export async function getWeeklyReportData()`: runs no-param aggregate queries over the last 7 days for accounts, software, licenses+trials, revenue (+ top-5 apps/packages by weekly paid revenue), and support. Each section is wrapped in its own try/catch that defaults to zeros/empty and `console.error`s on failure. Every numeric field is coerced with `Number(...)`. Returns `{ period: { from, to }, accounts, software, licenses, revenue: { ..., topApps }, support }`.
- Added `export async function sendWeeklyReport(to = null)`: resolves recipient (`to || WEEKLY_REPORT_EMAIL env || settings.weekly_report_email || default`), reuses `createTransporter()` (allowed to throw), `getSmtpConfig()`, `getSettings()`, and `formatCurrency()`, builds Vietnamese inline-styled HTML tables matching `sendNewOrderNotification`/`sendOrderStatusEmail`, sends, and returns `{ success, to, data }`.
- Registered both functions in the `default {}` export (hoisting allows this even though they are defined lower).

### server/services/report-scheduler.js (created — Task 2)
- Mirrors `license-scheduler.js`: `let lastRunDate = null` same-day guard, `runWeeklyReport()` (try/catch that logs and returns, never throws — REPORT-05), `getMillisecondsUntilNextRun()` targeting the next Monday 01:00 UTC via `setUTCHours(targetHourUTC=1)` + `getUTCDay()` Monday math, `scheduleNextRun()` (setTimeout → first run → `setInterval(runWeeklyReport, 7 * 24 * 60 * 60 * 1000)`), `initReportScheduler()`, and `export default { initReportScheduler, runWeeklyReport }`.

### server/index.js (modified — Task 3)
- Added `import { initReportScheduler } from './services/report-scheduler.js'` after the `initLicenseScheduler` import.
- Added `initReportScheduler()` call (with a section comment) immediately after the existing `initLicenseScheduler()` call.

### server/modules/settings.js (modified — Task 4)
- Changed the email import to `import { sendTestEmail, sendWeeklyReport } from '../services/email.js'`.
- Added `router.post('/send-weekly-report', requireAdmin, ...)` — optional `{ to }` body, `await sendWeeklyReport(to || null)`, returns `{ success, to }`, mirrors the `/test-email` error shape `res.status(500).json({ error: e.message || ... })`. Mounts at `POST /api/admin/settings/send-weekly-report`.

## Commits

- `3b3a30f` feat(02): add weekly report data + email sender to email.js (REPORT-01,03,05)
- `dfcabcd` feat(02): add self-scheduling weekly report scheduler (REPORT-02,05)
- `8141a96` feat(02): wire weekly report scheduler into server startup (REPORT-02)
- `86f448a` feat(02): add admin send-weekly-report trigger route (REPORT-04)

## Verification Results

### node --check (all four files)
```
OK: server/services/email.js
OK: server/services/report-scheduler.js
OK: server/index.js
OK: server/modules/settings.js
```

### npm run build
Exit code 0. `vite build` transformed 2039 modules, `✓ built in 11.10s`. Frontend build unaffected (the 500 kB chunk-size note is a pre-existing warning, not an error).

### Boot smoke test (`node server/index.js`)
The boot path calls `process.exit(1)` in `server/config/keys.js` when `keys/private.pem` is missing (an environment precondition, not a code defect). A temporary ephemeral RSA keypair was generated solely to exercise the boot path, then removed (working tree left clean; `keys/private.pem` is gitignored). First lines of the boot log:
```
✓ Private key loaded from file: ./keys/private.pem
✓ Public key loaded from file: ./keys/public.pem
✅ Socket.IO initialized
🗓️ Initializing license expiring scheduler...
   - Check time: 10:00 AM UTC+7 daily
   - Warning period: 15 days before expiry
⏰ Next license check scheduled for: 2026-06-19T03:00:00.000Z (in 1131 minutes)
✅ License expiring scheduler initialized
🗓️ Initializing weekly report scheduler...
   - Send time: Monday 08:00 UTC+7 (01:00 UTC)
⏰ Next weekly report scheduled for: 2026-06-22T01:00:00.000Z (in 5331 minutes)
✅ Weekly report scheduler initialized
✅ Server running on port 3000
```
Confirms: the report-scheduler init line is present, it schedules for `2026-06-22T01:00:00.000Z` (a Monday at 01:00 UTC — the Monday math is correct), it runs after `initLicenseScheduler()`, and there is no ESM/syntax/import crash. The MySQL-unconfigured environment does not crash the boot.

### grep acceptance criteria
- email.js: `export async function getWeeklyReportData` -> 1; `export async function sendWeeklyReport` -> 1; both present in `export default {`; `dangson.1011@gmail.com` -> 1; `WEEKLY_REPORT_EMAIL` -> 3; `settings.weekly_report_email` -> 1; `status = 'paid'` -> 4; `is_trial` -> 2; `DATE_SUB(NOW(), INTERVAL 7 DAY)` -> 9; `Number(` -> 22. No JS statement-ending semicolons (all 71 `;` are inside inline-CSS strings, matching existing style). `createTransporter()` is called without a surrounding try/catch (propagates).
- report-scheduler.js: file exists; `import { sendWeeklyReport } from './email.js'` -> 1; `export const runWeeklyReport` -> 1; `export const initReportScheduler` -> 1; `let lastRunDate` -> 1; `setUTCHours(targetHourUTC` -> 1; `7 * 24 * 60 * 60 * 1000` -> 1; `getUTCDay` -> 2; 0 trailing semicolons; runWeeklyReport catch logs + returns (no re-throw).
- index.js: `import { initReportScheduler } ...` -> 1; `initReportScheduler()` call at line 200, after `initLicenseScheduler()` at line 197.
- settings.js: `import { sendTestEmail, sendWeeklyReport } from '../services/email.js'` -> 1; `/send-weekly-report` -> 1; route line is `router.post('/send-weekly-report', requireAdmin, ...)`; `await sendWeeklyReport(` -> 1; `res.status(500).json({ error: e.message` -> 2 (matches /test-email).

## Deviations from Plan

None — the plan was executed exactly as written. The four suggested atomic commits were made verbatim. The only environment-specific action was generating a throwaway RSA keypair to get past `server/config/keys.js`'s `process.exit(1)` for the boot smoke test; the temp keys were deleted afterward and the working tree is clean. STATE.md and ROADMAP.md were not modified (orchestrator-owned); `gsd-sdk` was not used.

## Known Stubs

None. All report fields are wired to live DB aggregate queries; no hardcoded/placeholder data.

## Self-Check: PASSED

- `server/services/email.js` — FOUND (getWeeklyReportData + sendWeeklyReport added, both in default export)
- `server/services/report-scheduler.js` — FOUND (created)
- `server/index.js` — FOUND (initReportScheduler import + call after initLicenseScheduler)
- `server/modules/settings.js` — FOUND (POST /send-weekly-report behind requireAdmin)
- Commit 3b3a30f — FOUND
- Commit dfcabcd — FOUND
- Commit 8141a96 — FOUND
- Commit 86f448a — FOUND
- node --check on all four files — PASSED
- npm run build — exit 0
- Boot smoke test — report-scheduler init line logged, no crash
