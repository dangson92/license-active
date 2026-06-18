---
phase: 02-weekly-system-report
verified: 2026-06-18T00:00:00Z
status: human_needed
score: 7/7 must-haves verified (code-level); 3 runtime behaviors require live MySQL + SMTP
overrides_applied: 0
human_verification:
  - test: "Configure a live MySQL with representative data, run getWeeklyReportData() (or POST /api/admin/settings/send-weekly-report), and compare each section's numbers against direct DB queries."
    expected: "accounts / software / licenses+trials / revenue (+topApps) / support figures match hand-run SQL over the last 7 days; numerics render as numbers (not strings)."
    why_human: "No live DB locally; correctness of aggregate values against real data cannot be confirmed by static reading (REPORT-01)."
  - test: "Configure working SMTP, trigger POST /api/admin/settings/send-weekly-report (with and without a custom { to }) as an authenticated admin."
    expected: "A Vietnamese HTML report email arrives at the resolved recipient; response is { success: true, to: <recipient> }. With a custom { to }, it overrides; without it, falls back env -> setting -> default dangson.1011@gmail.com."
    why_human: "Actual email delivery and rendered HTML require a live SMTP server (REPORT-03, REPORT-04)."
  - test: "Across a real Monday tick (or by simulating two ticks on the same calendar day), confirm the same-day guard prevents a double-send and the weekly interval continues running."
    expected: "Second same-day invocation logs 'Weekly report already ran today, skipping...' and does not re-send; the setInterval keeps firing weekly."
    why_human: "Same-day guard across calendar days and the long-lived weekly interval cannot be exercised in a static check; needs a running process over time (REPORT-02)."
  - test: "With SMTP unconfigured, let the scheduled tick fire (or invoke runWeeklyReport) and confirm the server stays up and the scheduler interval is not torn down."
    expected: "createTransporter throws 'SMTP not configured...'; runWeeklyReport catches, logs '❌ Error sending weekly report:', returns; process keeps running, interval intact. Admin route returns 500 { error } without crashing."
    why_human: "Requires running the process with SMTP intentionally unconfigured to observe graceful degradation at runtime (REPORT-05)."
---

# Phase 2: Weekly System Report Verification Report

**Phase Goal:** Admins receive an accurate weekly digest of overall system health by email every Monday morning, can override the recipient, and can trigger the report on demand for testing — all degrading gracefully when SMTP is unavailable.
**Verified:** 2026-06-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getWeeklyReportData() returns accounts/software/licenses/revenue/support numbers matching DB queries over the last 7 days | ✓ VERIFIED (code) / ? data | email.js:351-494 — 6 sections, all column names verified real against schema/migrations, all `DATE_SUB(NOW(), INTERVAL 7 DAY)` windows, every numeric `Number()`-coerced (22×). Actual value correctness vs live data = human. |
| 2 | sendWeeklyReport() builds Vietnamese HTML and sends to resolved recipient, returning { success, to, data } | ✓ VERIFIED (code) | email.js:502-604 — Vietnamese section headings, inline-style tables (matches sendNewOrderNotification), formatCurrency on money, `return { success: true, to: recipient, data }`. Delivery = human. |
| 3 | Recipient resolves: to -> WEEKLY_REPORT_EMAIL env -> settings.weekly_report_email -> default 'dangson.1011@gmail.com' | ✓ VERIFIED | email.js:506 exact chain; DEFAULT_WEEKLY_REPORT_EMAIL='dangson.1011@gmail.com' at email.js:10 |
| 4 | On boot, scheduler logs init and schedules next send for upcoming Monday 01:00 UTC (08:00 UTC+7) | ✓ VERIFIED | report-scheduler.js:45-66 setUTCHours(1) + getUTCDay() Monday math; independently computed → 2026-06-22T01:00:00.000Z (Monday), matches boot log. Wired in index.js. |
| 5 | A single scheduler tick cannot double-send (same-day lastRunDate guard) | ✓ VERIFIED (code) / ? cross-day | report-scheduler.js:10,19-25,30 — `lastRunDate` set after send, skips if `=== today`. Cross-day behavior = human. |
| 6 | When SMTP is unconfigured or sending throws, runWeeklyReport logs and returns without crashing process or stopping interval | ✓ VERIFIED (code) | createTransporter throws (email.js:44-49, no try/catch in sendWeeklyReport so it propagates); report-scheduler.js:35-39 catch logs + returns, never re-throws; setInterval (line 77) independent of the awaited call. Runtime = human. |
| 7 | Authenticated admin can POST /send-weekly-report (optional { to }) and receive { success, to } / { error } | ✓ VERIFIED | settings.js:88-97 — requireAdmin guard, optional `{ to }`, `await sendWeeklyReport(to || null)`, returns `{ success, to: result.to }`, 500 `{ error }` on failure |

**Score:** 7/7 truths verified at code level. 3 runtime behaviors (live-data number correctness, actual email delivery, cross-day guard + graceful runtime degradation) routed to human verification — none are gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/services/email.js` | getWeeklyReportData + sendWeeklyReport, both in default export | ✓ VERIFIED | Both `export async function` present (351, 502); both listed in `export default {` (153,154); wired + data flows from live `query()` |
| `server/services/report-scheduler.js` | Weekly self-scheduling job mirroring license-scheduler.js | ✓ VERIFIED | runWeeklyReport, getMillisecondsUntilNextRun, scheduleNextRun, initReportScheduler, default export; lastRunDate guard; imports sendWeeklyReport |
| `server/index.js` | initReportScheduler import + call after initLicenseScheduler() | ✓ VERIFIED | import line 25; call line 200 (after initLicenseScheduler() at line 197) |
| `server/modules/settings.js` | POST /send-weekly-report admin route | ✓ VERIFIED | import line 4; route line 88 behind requireAdmin |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| report-scheduler.js | email.js sendWeeklyReport | import + call in runWeeklyReport try/catch | ✓ WIRED | import line 7; called line 29 inside try |
| index.js | report-scheduler.js initReportScheduler | import + call after initLicenseScheduler() | ✓ WIRED | import line 25; called line 200 |
| settings.js | email.js sendWeeklyReport | import + awaited in route handler | ✓ WIRED | import line 4; awaited line 91 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| email.js getWeeklyReportData | accounts/software/licenses/revenue/support | live `query(sql)` aggregates over real tables | Yes (no static returns; defaults only on query error) | ✓ FLOWING (pending live-DB number confirmation) |
| email.js sendWeeklyReport HTML | data.* fields | getWeeklyReportData() return | Yes — all fields rendered from `data`, none hardcoded | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All four files parse | node --check (×4) | ALL_SYNTAX_OK | ✓ PASS |
| Scheduler targets next Monday 01:00 UTC | replicate getMillisecondsUntilNextRun from Thu 2026-06-18 | 2026-06-22T01:00:00.000Z (getUTCDay=1=Mon) — matches boot log | ✓ PASS |
| Edge: Monday past 01:00 UTC rolls +7 | replicate from Mon 05:00 UTC | 2026-06-29T01:00:00.000Z | ✓ PASS |
| Edge: Monday before 01:00 UTC stays | replicate from Mon 00:30 UTC | 2026-06-22T01:00:00.000Z | ✓ PASS |
| Build gate | npm run build (executor) | exit 0 | ✓ PASS |
| Boot gate | node server/index.js (executor) | logs "⏰ Next weekly report scheduled for: 2026-06-22T01:00:00.000Z", no crash | ✓ PASS |
| Live-data number correctness | (needs MySQL) | — | ? SKIP → human |
| Email delivery | (needs SMTP) | — | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REPORT-01 | 02-PLAN | HTML summary of last 7 days: accounts, software, licenses+trials, revenue (+top apps), support | ✓ SATISFIED (code) | email.js:351-604; all 6 sections; column names verified real (schema.sql + mig 002/005/010/012); Number() coercion. Number correctness vs live data → human. |
| REPORT-02 | 02-PLAN | Sent automatically every Monday 08:00 UTC+7 | ✓ SATISFIED (code) | report-scheduler.js Monday/01:00-UTC math verified; same-day guard; wired in index.js. Cross-day/long-interval → human. |
| REPORT-03 | 02-PLAN | Default dangson.1011@gmail.com, overridable via WEEKLY_REPORT_EMAIL env or settings.weekly_report_email | ✓ SATISFIED | email.js:506 exact chain; default constant line 10 |
| REPORT-04 | 02-PLAN | Admin can trigger immediately, optional custom address | ✓ SATISFIED | settings.js:88-97 requireAdmin, optional { to }, returns { success, to } |
| REPORT-05 | 02-PLAN | SMTP unconfigured/failing → logs and skips without crashing server or scheduler | ✓ SATISFIED (code) | createTransporter propagates; runWeeklyReport catch logs+returns; setInterval unaffected; admin route 500. Runtime → human. |

No orphaned requirements: REQUIREMENTS.md maps exactly REPORT-01..05 to Phase 2; all five are declared in the plan's `requirements:` frontmatter and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none | — | No TODO/FIXME/placeholder; no hardcoded empty data flowing to output. Section defaults (zeros/`[]`) are overwritten by live queries or only used as graceful fallback on query error — not stubs. |

### Human Verification Required

The phase is fully implemented and wired at the code level; the following require a live MySQL + SMTP environment (explicitly out of scope for static verification per the task brief — NOT gaps):

1. **Report number correctness** — With representative DB data, confirm each section's figures match direct SQL over the last 7 days (REPORT-01).
2. **Email delivery + recipient override** — With SMTP configured, trigger POST /api/admin/settings/send-weekly-report with and without `{ to }`; confirm a Vietnamese HTML email arrives at the correctly-resolved recipient (REPORT-03, REPORT-04).
3. **Same-day guard across days** — Over a real Monday tick (or simulated same-day double-tick), confirm no double-send and the weekly interval keeps running (REPORT-02).
4. **Graceful degradation at runtime** — With SMTP unconfigured, confirm the scheduled tick logs the error and the server + interval stay alive; admin route returns 500 without crashing (REPORT-05).

### Gaps Summary

No gaps. All seven must-haves are satisfied in the actual codebase: both report functions exist, are substantive, in the default export, and draw from live DB queries; the scheduler's Monday-08:00-UTC+7 math is independently verified and wired into boot after initLicenseScheduler(); the recipient resolution chain is exact (default dangson.1011@gmail.com); the admin route is admin-guarded with an optional custom address; and graceful-degradation wiring is correct (createTransporter throws-and-propagates, runWeeklyReport catches without re-throwing, interval independent). Every SQL column name was confirmed against schema.sql and migrations 002/005/010/012. The only outstanding items are runtime behaviors that genuinely require a live MySQL + SMTP, which is why the status is human_needed rather than passed.

---

_Verified: 2026-06-18_
_Verifier: Claude (gsd-verifier)_
