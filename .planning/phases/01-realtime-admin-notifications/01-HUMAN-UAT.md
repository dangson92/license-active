---
status: partial
phase: 01-realtime-admin-notifications
source: [01-VERIFICATION.md]
started: 2026-06-18T00:00:00Z
updated: 2026-06-18T00:00:00Z
---

## Current Test

[awaiting human testing — requires a running server + configured MySQL + an authenticated admin Socket.IO client]

## Tests

### 1. Register → admin notification
expected: Connected admin receives a `new-notification` toast + unread-badge increment, and a `new_user` row exists — `SELECT * FROM notifications WHERE type='new_user' ORDER BY id DESC LIMIT 1`
result: [pending]

### 2. Trial → admin notification
expected: Admin receives a `new-notification` naming the user + app, and a `trial_started` row exists — `SELECT * FROM notifications WHERE type='trial_started' ORDER BY id DESC LIMIT 1`
result: [pending]

### 3. Non-blocking under real failure
expected: Inducing a notification failure (e.g. drop/rename the `notifications` table) leaves register + trial returning their normal success payloads (token / license), and the error is logged via `console.error('Failed to create ... notification:')`
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
