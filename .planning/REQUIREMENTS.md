# Requirements: KeyMaster AI — Notifications & Weekly Reporting

**Defined:** 2026-06-18
**Core Value:** Admins have timely, accurate visibility into system activity — real time for individual events, weekly digest for overall health.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Realtime Notifications

- [ ] **NOTIF-01**: When a new user completes registration, an admin notification is persisted and emitted in real time to connected admins (Socket.IO `new-notification`), surfacing as a toast + unread badge in the admin dashboard.
- [ ] **NOTIF-02**: When a user activates a trial license, an admin notification is persisted and emitted in real time to connected admins, including the user and app involved.
- [ ] **NOTIF-03**: Notification side-effects are non-blocking — if creating/emitting a notification fails, the register and trial requests still succeed and the error is logged.

### Weekly Reporting

- [ ] **REPORT-01**: The system can generate an HTML summary of the last 7 days covering: accounts (total, new this week, active this week), software (total/active apps, versions, packages), licenses & trials (active licenses, active trials, new licenses/trials this week, expiring within 7 days), weekly revenue (paid total, paid-order count, top-selling apps, pending orders, all-time revenue), and support (open tickets, new tickets this week).
- [ ] **REPORT-02**: The summary email is sent automatically every Monday at 08:00 (UTC+7).
- [ ] **REPORT-03**: The recipient defaults to `dangson.1011@gmail.com` and is overridable via the `WEEKLY_REPORT_EMAIL` environment variable or a `weekly_report_email` row in the DB `settings` table.
- [ ] **REPORT-04**: An authenticated admin can trigger the weekly report to be sent immediately (optionally to a custom address) for testing.
- [ ] **REPORT-05**: If SMTP is not configured (or sending fails), the scheduled send fails gracefully — it logs and skips without crashing the server or the scheduler.

## v2 Requirements

Deferred to future. Tracked, not in current roadmap.

### Reporting

- **REPORT-V2-01**: Per-recipient / multi-recipient distribution lists for the weekly report.
- **REPORT-V2-02**: Configurable report template and selectable sections.
- **REPORT-V2-03**: Cluster/restart-safe scheduling (e.g. node-cron + DB lock or a job queue) for multi-instance deploys.

### Notifications

- **NOTIF-V2-01**: End-user notifications on their own register/trial (welcome / trial-activated).

## Out of Scope

| Feature | Reason |
|---------|--------|
| End-user notifications on register/trial | Milestone targets admin visibility only (decision in PROJECT.md) |
| Cluster/restart-safe job scheduler | Reuse existing in-memory self-scheduling pattern; revisit on multi-instance deploy |
| Charts/dashboards in the report | Email-only summary is sufficient for v1 |
| Per-user weekly digests | Single fixed admin report for now |

## Traceability

Populated during roadmap creation. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTIF-01 | TBD | Pending |
| NOTIF-02 | TBD | Pending |
| NOTIF-03 | TBD | Pending |
| REPORT-01 | TBD | Pending |
| REPORT-02 | TBD | Pending |
| REPORT-03 | TBD | Pending |
| REPORT-04 | TBD | Pending |
| REPORT-05 | TBD | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-06-18*
*Last updated: 2026-06-18 after initial definition*
