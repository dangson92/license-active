---
status: partial
phase: 02-weekly-system-report
source: [02-VERIFICATION.md]
started: 2026-06-18T00:00:00Z
updated: 2026-06-18T00:00:00Z
---

## Current Test

[awaiting human testing — requires a running server + configured MySQL + configured SMTP]

## Tests

### 1. On-demand report send (REPORT-04) + delivery (REPORT-01/03)
expected: As an admin, `POST /api/admin/settings/send-weekly-report` (optionally `{ "to": "you@example.com" }`) returns `{ success: true, to }` and an email arrives at the resolved recipient. With no `to` and no override, it goes to `dangson.1011@gmail.com`; setting `WEEKLY_REPORT_EMAIL` env or the `weekly_report_email` DB setting redirects it.
result: [pending]

### 2. Report numbers match the database (REPORT-01)
expected: The figures in the email (accounts, software, licenses/trials, weekly revenue + top apps, support) match direct DB queries for the last 7 days. Revenue = SUM(total_price) of `purchase_orders` with `status='paid'` and `paid_at` within 7 days.
result: [pending]

### 3. Automatic weekly send + same-day guard (REPORT-02)
expected: Left running, the job fires Monday 08:00 UTC+7 (01:00 UTC) and sends exactly once; it does not double-send on the same day.
result: [pending]

### 4. Graceful degradation when SMTP unconfigured/failing (REPORT-05)
expected: With SMTP not configured (or a forced send failure), the scheduled run and the admin route log the error and the server keeps running — the scheduler interval is not stopped and the process does not crash.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
