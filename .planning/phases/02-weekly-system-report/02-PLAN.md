---
phase: 02-weekly-system-report
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/services/email.js
  - server/services/report-scheduler.js
  - server/index.js
  - server/modules/settings.js
autonomous: true
requirements: [REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05]
user_setup: []

must_haves:
  truths:
    - "Running getWeeklyReportData() returns an object whose accounts/software/licenses/revenue/support numbers match direct DB queries over the last 7 days."
    - "sendWeeklyReport() builds a Vietnamese HTML summary email and sends it to the resolved recipient, returning { success, to, data }."
    - "The recipient resolves in order: explicit to arg -> process.env.WEEKLY_REPORT_EMAIL -> settings.weekly_report_email -> default 'dangson.1011@gmail.com'."
    - "On server boot the report scheduler logs its init line and schedules the next send for the upcoming Monday 01:00 UTC (08:00 UTC+7)."
    - "A single scheduler tick cannot double-send (same-day guard via lastRunDate)."
    - "When SMTP is unconfigured or sending throws, runWeeklyReport logs and returns without crashing the process or stopping the interval."
    - "An authenticated admin can POST /api/admin/settings/send-weekly-report (optional { to }) and receive { success, to } on success or { error } on failure."
  artifacts:
    - path: "server/services/email.js"
      provides: "getWeeklyReportData + sendWeeklyReport, both in the default export"
      contains: "export async function getWeeklyReportData"
    - path: "server/services/report-scheduler.js"
      provides: "Weekly self-scheduling job mirroring license-scheduler.js"
      contains: "export const initReportScheduler"
    - path: "server/index.js"
      provides: "initReportScheduler import + call after initLicenseScheduler()"
      contains: "initReportScheduler()"
    - path: "server/modules/settings.js"
      provides: "POST /send-weekly-report admin route"
      contains: "/send-weekly-report"
  key_links:
    - from: "server/services/report-scheduler.js"
      to: "server/services/email.js sendWeeklyReport"
      via: "import { sendWeeklyReport } and call inside runWeeklyReport try/catch"
      pattern: "sendWeeklyReport"
    - from: "server/index.js"
      to: "server/services/report-scheduler.js initReportScheduler"
      via: "import + call after initLicenseScheduler()"
      pattern: "initReportScheduler"
    - from: "server/modules/settings.js"
      to: "server/services/email.js sendWeeklyReport"
      via: "import added to email.js import line + route handler awaits it"
      pattern: "sendWeeklyReport"
---

<objective>
Add a weekly system-summary email and the machinery to send it on a backend-only, brownfield platform (Express ESM + MySQL + nodemailer). This plan delivers all five Phase 2 requirements:

- REPORT-01: `getWeeklyReportData()` aggregates last-7-day metrics; `sendWeeklyReport()` builds the Vietnamese HTML report.
- REPORT-02: `report-scheduler.js` auto-sends every Monday 08:00 UTC+7 (01:00 UTC) with a same-day guard.
- REPORT-03: recipient resolution chain (to -> env -> setting -> default `dangson.1011@gmail.com`).
- REPORT-04: admin `POST /send-weekly-report` on-demand trigger.
- REPORT-05: graceful degradation when SMTP is unconfigured / sending fails.

Purpose: Admins get an accurate weekly digest by email automatically, can override the recipient, and can trigger it on demand — degrading gracefully when SMTP is unavailable.

Output: Two functions added to `email.js`, a new `report-scheduler.js`, one wiring change in `index.js`, and one admin route in `settings.js`. No DB migration, no new dependency, no frontend change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-weekly-system-report/02-CONTEXT.md
@CLAUDE.md
@server/services/email.js
@server/services/license-scheduler.js
@server/modules/settings.js
@server/db.js

<interfaces>
<!-- Contracts the executor needs. Extracted from the codebase — use directly, no exploration needed. -->

From server/db.js — query takes NO params for these report queries; results read via .rows:
```js
export const query = async (sql, params) => { const [rows] = await pool.execute(sql, params); return { rows } }
// pool.execute returns SUM()/COUNT()/DECIMAL columns as STRINGS -> coerce every numeric with Number(...)
```

From server/services/email.js — reuse these exactly (do NOT reimplement):
```js
export async function getSettings()            // -> { [setting_key]: setting_value }
export async function getSmtpConfig()          // -> { host, port, secure, auth, from }
async function createTransporter()             // THROWS 'SMTP not configured...' if host/user/pass missing
function formatCurrency(amount)                // -> Intl vi-VN number + 'đ'
// default export block currently lists: getSettings, getSmtpConfig, generateVerificationToken,
//   sendVerificationEmail, sendTestEmail, sendNewOrderNotification, sendOrderStatusEmail
// Function declarations are hoisted -> a name can appear in `default {}` even when defined lower in the file.
```

From server/services/license-scheduler.js — the structure the new scheduler MUST mirror:
```js
let lastCheckDate = null                                  // same-day guard (module var)
export const checkExpiringLicenses = async () => { ... }  // try/catch, returns count, never throws
const getMillisecondsUntilNextRun = () => { ... }         // setUTCHours(3,0,0,0); if past, +1 day
const scheduleNextCheck = () => { setTimeout(async () => { await checkExpiringLicenses(); setInterval(checkExpiringLicenses, 24*60*60*1000) }, ms) }
export const initLicenseScheduler = () => { ...; scheduleNextCheck(); ... }
export default { initLicenseScheduler, checkExpiringLicenses }
```

From server/modules/settings.js — the route to mirror:
```js
import { sendTestEmail } from '../services/email.js'   // ADD sendWeeklyReport here
import { requireAdmin } from './auth.js'               // already imported
router.post('/test-email', requireAdmin, async (req, res) => {
    try { const { to } = req.body; if (!to) return res.status(400).json({ error: 'Email address required' })
          await sendTestEmail(to); res.json({ success: true, message: '...' }) }
    catch (e) { console.error('Test email error:', e); res.status(500).json({ error: e.message || '...' }) }
})
// router mounts under /api/admin/settings -> new route resolves to POST /api/admin/settings/send-weekly-report
```

VERIFIED schema column names (use these EXACT names in SQL):
```text
users:           created_at, last_login_at, role ('user'|'admin'), email, full_name
apps:            is_active (BOOLEAN/TINYINT), name, created_at
app_versions:    (count rows) — table exists
packages:        (count rows) is_active — table exists
licenses:        status ('active'|'revoked'|'expired'), is_trial (BOOLEAN), expires_at, created_at, app_id
purchase_orders: status ('pending'|'paid'|'cancelled'|'refunded'), total_price (DECIMAL), paid_at, created_at,
                 app_id (NULLABLE), package_id (NULLABLE)
support_tickets: status ('pending'|'in_progress'|'resolved'|'closed'), created_at
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add getWeeklyReportData() and sendWeeklyReport() to email.js (REPORT-01, REPORT-03, REPORT-05)</name>
  <files>server/services/email.js</files>

  <read_first>
  - server/services/email.js (the WHOLE file — this is its own analog): reuse getSettings/getSmtpConfig/createTransporter/formatCurrency; copy the inline-style HTML table format of sendNewOrderNotification (~line 163) and sendOrderStatusEmail (~line 230); replicate how sendNewOrderNotification is listed in the `default {}` export (line ~143-151) while defined lower.
  - server/db.js: query(sql) -> { rows }; numerics come back as strings.
  - .planning/phases/02-weekly-system-report/02-CONTEXT.md <decisions> for the exact section list and recipient order.
  </read_first>

  <action>
  Backend style: ESM, NO semicolons, 4-space indent for these function bodies (match the indentation already used inside email.js functions), single quotes, Vietnamese user-facing strings.

  STEP A — add a module-level default constant near the top of the file (after the imports / __dirname line):
  ```
  const DEFAULT_WEEKLY_REPORT_EMAIL = 'dangson.1011@gmail.com'
  ```

  STEP B — add `getWeeklyReportData` to the `default {}` export object AND `sendWeeklyReport` to it (function declarations are hoisted, mirror how sendNewOrderNotification is already listed there). The export block must contain the lines `getWeeklyReportData,` and `sendWeeklyReport,`.

  STEP C — add `export async function getWeeklyReportData()`. Run NO-param aggregate queries (call `query(sql)`), each section in its OWN try/catch so one failing section defaults to zeros/empty and logs rather than aborting the whole report. Coerce EVERY numeric field with `Number(...)` because pool.execute returns SUM/COUNT/DECIMAL as strings. Use these exact SQL statements (window = last 7 days via `DATE_SUB(NOW(), INTERVAL 7 DAY)`):

  Accounts:
  ```sql
  SELECT
    COUNT(*) AS total,
    SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week,
    SUM(last_login_at IS NOT NULL AND last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS active_this_week,
    SUM(role = 'admin') AS admins
  FROM users
  ```

  Software (three separate simple counts, or one query each — keep each in the section try/catch):
  ```sql
  SELECT
    (SELECT COUNT(*) FROM apps) AS apps_total,
    (SELECT COUNT(*) FROM apps WHERE is_active = TRUE) AS apps_active,
    (SELECT COUNT(*) FROM app_versions) AS versions,
    (SELECT COUNT(*) FROM packages) AS packages
  ```

  Licenses & trials:
  ```sql
  SELECT
    SUM(status = 'active') AS active_licenses,
    SUM(is_trial = TRUE AND status = 'active') AS active_trials,
    SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week,
    SUM(is_trial = TRUE AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_trials_this_week,
    SUM(status = 'active' AND expires_at IS NOT NULL
        AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) AS expiring_soon
  FROM licenses
  ```

  Revenue / orders:
  ```sql
  SELECT
    COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN total_price ELSE 0 END), 0) AS weekly_paid_total,
    SUM(status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weekly_paid_count,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN total_price ELSE 0 END), 0) AS all_time_paid_total,
    SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_orders_this_week,
    SUM(status = 'pending') AS pending_orders
  FROM purchase_orders
  ```

  Top-selling apps/packages this week (LEFT JOIN apps + packages because app_id and package_id are both nullable):
  ```sql
  SELECT COALESCE(a.name, pk.name, '(Khác)') AS name,
         COALESCE(SUM(po.total_price), 0) AS revenue
  FROM purchase_orders po
  LEFT JOIN apps a ON a.id = po.app_id
  LEFT JOIN packages pk ON pk.id = po.package_id
  WHERE po.status = 'paid' AND po.paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  GROUP BY name
  ORDER BY revenue DESC
  LIMIT 5
  ```
  Map this to an array `[{ name, revenue: Number(row.revenue) }]`; default to `[]` on failure.

  Support:
  ```sql
  SELECT
    SUM(status IN ('pending','in_progress')) AS open_tickets,
    SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week
  FROM support_tickets
  ```

  Return a structured object, e.g.:
  ```
  { period: { from, to }, accounts: {...}, software: {...}, licenses: {...}, revenue: { ..., topApps: [...] }, support: {...} }
  ```
  Compute `from`/`to` as JS dates (to = now, from = now - 7 days) for display. Each section's catch sets that section to its zeroed/empty default and `console.error('Weekly report <section> query error:', e)`.

  STEP D — add `export async function sendWeeklyReport(to = null)`:
  1. `const data = await getWeeklyReportData()`
  2. `const settings = await getSettings()`
  3. Recipient resolution (EXACT order, REPORT-03):
     ```
     const recipient = to || process.env.WEEKLY_REPORT_EMAIL || settings.weekly_report_email || DEFAULT_WEEKLY_REPORT_EMAIL
     ```
  4. `const transporter = await createTransporter()` — let it THROW if SMTP unconfigured (callers wrap it; REPORT-05). Do NOT swallow this here.
  5. `const config = await getSmtpConfig()`
  6. Build Vietnamese HTML using the same inline-style table format as sendNewOrderNotification (`<div style="font-family: Arial...max-width: 600px">`, section `<h3>` headings, `<table style="width:100%;border-collapse:collapse">` rows with `padding:10px;border:1px solid #e5e7eb`). Use `formatCurrency(...)` for all money fields and the topApps rows. Vietnamese section labels (e.g. "Tài khoản", "Phần mềm", "License & dùng thử", "Doanh thu (7 ngày)", "Hỗ trợ"). Build a period string from data.period for the subject/header.
  7. Subject: `` `[${settings.app_name || 'Phanmemauto.com'}] Báo cáo hệ thống tuần (${period})` ``.
  8. `await transporter.sendMail({ from: config.from, to: recipient, subject, html })`.
  9. `return { success: true, to: recipient, data }`.

  HTML layout/wording and exact SQL phrasing are Claude's discretion per CONTEXT, as long as numbers match direct DB queries and the recipient chain + Number() coercion are exact.
  </action>

  <acceptance_criteria>
  - grep `export async function getWeeklyReportData` in server/services/email.js -> 1 match
  - grep `export async function sendWeeklyReport` in server/services/email.js -> 1 match
  - grep `getWeeklyReportData,` AND `sendWeeklyReport,` inside the `export default {` block -> both present
  - grep `dangson.1011@gmail.com` -> present (the default constant)
  - grep `WEEKLY_REPORT_EMAIL` -> present (env override)
  - grep `settings.weekly_report_email` -> present (DB override)
  - grep `status = 'paid'` AND `is_trial` AND `DATE_SUB(NOW(), INTERVAL 7 DAY)` -> all present
  - grep `Number(` appears multiple times (numeric coercion of aggregate results)
  - createTransporter() is called inside sendWeeklyReport WITHOUT a surrounding try/catch (it must propagate) — verify by reading the function
  - File still has NO semicolons (matches existing style)
  </acceptance_criteria>

  <verify>
  <automated>cd "c:/Users/dangs/OneDrive/Máy tính/Code/license-active" && node --check server/services/email.js && echo SYNTAX_OK</automated>
  </verify>

  <done>
  email.js exports getWeeklyReportData (defensive per-section aggregates, all numerics Number()-coerced) and sendWeeklyReport (recipient chain to->env->setting->default, Vietnamese HTML, returns { success, to, data }, lets createTransporter throw); both are in the default export; node --check passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create report-scheduler.js mirroring license-scheduler.js (REPORT-02, REPORT-05)</name>
  <files>server/services/report-scheduler.js</files>

  <read_first>
  - server/services/license-scheduler.js (THE analog — mirror its structure exactly: lastCheckDate guard, getMillisecondsUntilNextRun with setUTCHours math, scheduleNextCheck setTimeout->setInterval, initLicenseScheduler, default export).
  - server/services/email.js (Task 1 output) for the sendWeeklyReport signature/return.
  - .planning/phases/02-weekly-system-report/02-CONTEXT.md <decisions> "Scheduler" + <specifics> (target 01:00 UTC = 08:00 UTC+7, Mondays only).
  </read_first>

  <action>
  NEW FILE. Backend style: ESM, NO semicolons, 4-space indent inside functions, single quotes, Vietnamese-friendly log strings (English logs like license-scheduler are fine — match that file's emoji-prefixed log style).

  ```
  import { sendWeeklyReport } from './email.js'

  // Same-day guard (mirror license-scheduler's lastCheckDate)
  let lastRunDate = null

  export const runWeeklyReport = async () => {
      try {
          const today = new Date().toISOString().split('T')[0]
          if (lastRunDate === today) {
              console.log('📅 Weekly report already ran today, skipping...')
              return
          }
          console.log('📨 Running weekly system report...')
          const result = await sendWeeklyReport()
          lastRunDate = today
          console.log(`✅ Weekly report sent to ${result.to}`)
          return result
      } catch (e) {
          // REPORT-05: SMTP unconfigured or send failed -> log + return, NEVER throw/crash
          console.error('❌ Error sending weekly report:', e)
          return
      }
  }
  ```

  getMillisecondsUntilNextRun — next Monday 01:00 UTC (= 08:00 UTC+7). Mirror license-scheduler's setUTCHours pattern but add Monday selection:
  ```
  const getMillisecondsUntilNextRun = () => {
      const now = new Date()
      const targetHourUTC = 1   // 01:00 UTC = 08:00 UTC+7
      const nextRun = new Date(now)
      nextRun.setUTCHours(targetHourUTC, 0, 0, 0)
      // Advance to the next Monday (getUTCDay(): 0=Sun,1=Mon). If today is Monday but
      // we're already past 01:00 UTC, go to next Monday (+7).
      const day = nextRun.getUTCDay()
      let addDays = (1 - day + 7) % 7   // days until next Monday (0 if today is Monday)
      if (addDays === 0 && now >= nextRun) addDays = 7
      nextRun.setUTCDate(nextRun.getUTCDate() + addDays)
      const ms = nextRun.getTime() - now.getTime()
      console.log(`⏰ Next weekly report scheduled for: ${nextRun.toISOString()} (in ${Math.round(ms / 1000 / 60)} minutes)`)
      return ms
  }
  ```

  scheduleNextRun — setTimeout to first run, then weekly interval:
  ```
  const scheduleNextRun = () => {
      const ms = getMillisecondsUntilNextRun()
      setTimeout(async () => {
          await runWeeklyReport()
          setInterval(runWeeklyReport, 7 * 24 * 60 * 60 * 1000)
      }, ms)
  }
  ```

  init + default export:
  ```
  export const initReportScheduler = () => {
      console.log('🗓️ Initializing weekly report scheduler...')
      console.log('   - Send time: Monday 08:00 UTC+7 (01:00 UTC)')
      scheduleNextRun()
      console.log('✅ Weekly report scheduler initialized')
  }

  export default { initReportScheduler, runWeeklyReport }
  ```
  </action>

  <acceptance_criteria>
  - File server/services/report-scheduler.js exists
  - grep `import { sendWeeklyReport } from './email.js'` -> present
  - grep `export const runWeeklyReport` -> present
  - grep `export const initReportScheduler` -> present
  - grep `let lastRunDate` -> present (same-day guard)
  - grep `setUTCHours(targetHourUTC` or `setUTCHours(1` -> present (01:00 UTC target)
  - grep `7 * 24 * 60 * 60 * 1000` -> present (weekly interval)
  - grep `getUTCDay` -> present (Monday selection)
  - runWeeklyReport body has a try/catch whose catch `console.error`s and `return`s (never re-throws) — verify by reading
  - File has NO semicolons
  </acceptance_criteria>

  <verify>
  <automated>cd "c:/Users/dangs/OneDrive/Máy tính/Code/license-active" && node --check server/services/report-scheduler.js && echo SYNTAX_OK</automated>
  </verify>

  <done>
  report-scheduler.js mirrors license-scheduler.js: runWeeklyReport (try/catch logs + returns, never throws — REPORT-05), getMillisecondsUntilNextRun targeting next Monday 01:00 UTC, scheduleNextRun (setTimeout->weekly setInterval), same-day lastRunDate guard (REPORT-02), initReportScheduler, default export; node --check passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire initReportScheduler into index.js (REPORT-02)</name>
  <files>server/index.js</files>

  <read_first>
  - server/index.js lines 1-30 (the import block; `initLicenseScheduler` import is at ~line 24) and lines 185-202 (the `initLicenseScheduler()` call site is at ~line 196). This file IS its own analog — copy the existing scheduler import + call pattern.
  </read_first>

  <action>
  Backend style: ESM, NO semicolons, single quotes — match index.js exactly.

  1. After the existing import line `import { initLicenseScheduler } from './services/license-scheduler.js'` (~line 24), add:
  ```
  import { initReportScheduler } from './services/report-scheduler.js'
  ```

  2. Immediately after the existing `initLicenseScheduler()` call (~line 196, currently preceded by the comment `// Initialize License Expiring Scheduler ...`), add:
  ```

  // Initialize Weekly Report Scheduler (Monday 08:00 UTC+7 = 01:00 UTC)
  initReportScheduler()
  ```

  Do not touch anything else in the file.
  </action>

  <acceptance_criteria>
  - grep `import { initReportScheduler } from './services/report-scheduler.js'` in server/index.js -> present
  - grep `initReportScheduler()` (the call) in server/index.js -> present
  - The call appears AFTER `initLicenseScheduler()` in the file (verify ordering by reading the call-site region)
  - No semicolons added
  </acceptance_criteria>

  <verify>
  <automated>cd "c:/Users/dangs/OneDrive/Máy tính/Code/license-active" && node --check server/index.js && echo SYNTAX_OK</automated>
  </verify>

  <done>
  index.js imports initReportScheduler and calls it right after initLicenseScheduler(); node --check passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Add admin POST /send-weekly-report route to settings.js (REPORT-04)</name>
  <files>server/modules/settings.js</files>

  <read_first>
  - server/modules/settings.js (THE analog — mirror the `/test-email` route at ~line 71: requireAdmin guard, optional `{ to }` body, try/catch with `res.status(500).json({ error: e.message || ... })`). The email.js import is line 4; requireAdmin is imported on line 3.
  - server/services/email.js (Task 1) for the sendWeeklyReport signature: `sendWeeklyReport(to = null)` -> `{ success, to, data }`.
  </read_first>

  <action>
  Backend style: ESM, NO semicolons, 4-space indent in handler body, single quotes, Vietnamese-friendly messages.

  1. Change the email import (line 4) from:
  ```
  import { sendTestEmail } from '../services/email.js'
  ```
  to:
  ```
  import { sendTestEmail, sendWeeklyReport } from '../services/email.js'
  ```

  2. Add a new route after the `/test-email` route (before `export default router`), mirroring /test-email's error shape:
  ```
  // Send weekly system report now (admin on-demand trigger)
  router.post('/send-weekly-report', requireAdmin, async (req, res) => {
      try {
          const { to } = req.body
          const result = await sendWeeklyReport(to || null)
          res.json({ success: true, to: result.to })
      } catch (e) {
          console.error('Send weekly report error:', e)
          res.status(500).json({ error: e.message || 'Failed to send weekly report' })
      }
  })
  ```
  Note: `to` is OPTIONAL — when omitted, sendWeeklyReport falls back through env -> setting -> default. This route mounts under the settings router at `POST /api/admin/settings/send-weekly-report`.
  </action>

  <acceptance_criteria>
  - grep `import { sendTestEmail, sendWeeklyReport } from '../services/email.js'` in server/modules/settings.js -> present
  - grep `/send-weekly-report` -> present
  - grep `requireAdmin` on the new route line -> present (route is admin-guarded)
  - grep `await sendWeeklyReport(` -> present
  - grep `res.status(500).json({ error: e.message` -> present (mirrors /test-email error shape)
  - No semicolons added
  </acceptance_criteria>

  <verify>
  <automated>cd "c:/Users/dangs/OneDrive/Máy tính/Code/license-active" && node --check server/modules/settings.js && echo SYNTAX_OK</automated>
  </verify>

  <done>
  settings.js imports sendWeeklyReport and exposes POST /api/admin/settings/send-weekly-report behind requireAdmin, accepting optional { to }, returning { success, to } or { error }; node --check passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin client -> POST /api/admin/settings/send-weekly-report | Authenticated admin supplies an optional `to` recipient; crosses into the email-send path. |
| app -> SMTP server | Outbound report email carries internal business figures/PII to the configured recipient. |
| app -> MySQL | Read-only aggregate report queries; no user input flows into SQL. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Spoofing/Elevation | POST /send-weekly-report | mitigate | Route guarded by `requireAdmin` (JWT admin role). Only admins can trigger sends. |
| T-02-02 | Information Disclosure | `to` arbitrary-recipient send (SSRF-ish exfil) | accept | Admin-only endpoint; an admin already has full system read access. Low risk; multi-recipient/allow-list deferred to REPORT-V2-01. |
| T-02-03 | Tampering (Injection) | getWeeklyReportData SQL | mitigate | All report queries are static, parameterless aggregates — no string concatenation, no user input reaches SQL. No injection surface. |
| T-02-04 | Information Disclosure | report email content (PII/revenue) | accept | Email goes only to the resolved configured recipient (to/env/setting/default). No new public surface. |
| T-02-05 | Denial of Service | scheduler / send failure | mitigate | runWeeklyReport wraps sendWeeklyReport in try/catch (logs + returns, never throws); same-day guard prevents duplicate-send on a single tick. SMTP-unconfigured throw is caught (REPORT-05). |
| T-02-06 | Information Disclosure | `e.message` returned by /send-weekly-report | accept | Mirrors the existing `/test-email` route's error shape (CONCERNS #7, codebase-wide pattern). Consistency over divergence; admin-only endpoint. Not introducing a new leak class. |

No high-severity threats. ASVS L1 auth (V4) satisfied via requireAdmin; injection (V5) N/A — no dynamic SQL.
</threat_model>

<verification>
Run after all four tasks:

1. Syntax — every changed/new file parses:
   ```
   node --check server/services/email.js
   node --check server/services/report-scheduler.js
   node --check server/index.js
   node --check server/modules/settings.js
   ```
   All print SYNTAX_OK.

2. Build / type gate (no TS in these files, but the repo gate is `npm run build`):
   ```
   npm run build
   ```
   Exit code 0 (frontend build unaffected; this confirms nothing was broken project-wide).

3. Boot smoke test — server starts and the report scheduler logs its init line (then stop the process):
   ```
   node server/index.js
   ```
   Expect log lines: `🗓️ Initializing weekly report scheduler...`, `⏰ Next weekly report scheduled for: <next-Monday>T01:00:00.000Z`, `✅ Weekly report scheduler initialized`. Server keeps running and does NOT crash even if SMTP is unconfigured (the send only happens on the scheduled Monday tick, wrapped in try/catch). Ctrl-C to stop.

4. grep wiring checks:
   - `initReportScheduler()` in server/index.js
   - `/send-weekly-report` in server/modules/settings.js
   - `dangson.1011@gmail.com`, `WEEKLY_REPORT_EMAIL`, `settings.weekly_report_email` in server/services/email.js
   - `status = 'paid'`, `is_trial`, `DATE_SUB(NOW(), INTERVAL 7 DAY)` in server/services/email.js

5. (Optional, requires SMTP + live DB) Admin on-demand trigger returns success:
   ```
   curl -X POST http://localhost:3000/api/admin/settings/send-weekly-report \
     -H "Authorization: Bearer <admin_jwt>" -H "Content-Type: application/json" -d '{}'
   ```
   Expect `{ "success": true, "to": "<resolved recipient>" }`. With SMTP unconfigured, expect `500 { "error": "SMTP not configured..." }` (graceful — server stays up).
</verification>

<success_criteria>
- REPORT-01: getWeeklyReportData() returns accounts/software/licenses+trials/revenue(+topApps)/support metrics over the last 7 days, numerics Number()-coerced; sendWeeklyReport() renders them as Vietnamese HTML. Numbers match direct DB queries.
- REPORT-02: report-scheduler.js schedules the next send for the upcoming Monday 01:00 UTC (08:00 UTC+7) and logs it on boot; same-day guard prevents a single-tick double-send.
- REPORT-03: recipient resolves to -> process.env.WEEKLY_REPORT_EMAIL -> settings.weekly_report_email -> 'dangson.1011@gmail.com'.
- REPORT-04: POST /api/admin/settings/send-weekly-report (requireAdmin, optional { to }) returns { success, to } / { error }.
- REPORT-05: SMTP-unconfigured / send failure is caught in runWeeklyReport (logs + returns) — server and interval keep running; the admin route returns a 500 without crashing.
- node --check passes on all four files; `npm run build` exits 0; `node server/index.js` boots and logs the report-scheduler init line.
</success_criteria>

<output>
After completion, create `.planning/phases/02-weekly-system-report/02-01-SUMMARY.md`
</output>
