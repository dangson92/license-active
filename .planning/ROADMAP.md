# Roadmap: KeyMaster AI — Notifications & Weekly Reporting

## Overview

A brownfield milestone on the existing Express (ESM) + MySQL + Socket.IO + React platform that gives admins timely, accurate visibility into system activity. It delivers two independent capabilities by reusing established patterns: (1) realtime admin notifications when a user registers or activates a trial, built on the existing `createNotification` (DB persist + Socket.IO emit) wired into the register and trial handlers, and (2) a weekly system-summary email (accounts, software, licenses/trials, revenue, support) sent automatically every Monday 08:00 UTC+7 via a new self-scheduling job that mirrors the existing license scheduler, plus an admin on-demand trigger for testing. Both features build only on existing infrastructure and require no frontend phase — the admin UI already renders unknown notification types via a toast fallback.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Realtime Admin Notifications** - Persist + emit an admin notification when a user registers or activates a trial, non-blocking (completed 2026-06-18)
- [ ] **Phase 2: Weekly System Report** - Generate and auto-send a weekly system-summary email (Monday 08:00 UTC+7) with an admin on-demand trigger

## Phase Details

### Phase 1: Realtime Admin Notifications
**Goal**: Admins are notified in real time, with a persisted record, whenever a user registers or activates a trial — without those notifications ever blocking or breaking the underlying request.
**Depends on**: Nothing (builds on existing `createNotification`, Socket.IO admin rooms, and the existing admin notification UI)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. When a user completes registration, connected admins receive a `new-notification` (toast + unread badge updates) and a corresponding row is persisted in the `notifications` table.
  2. When a user activates a trial, connected admins receive a `new-notification` identifying the user and the app, and a corresponding row is persisted.
  3. If notification creation or emission fails, the register and trial requests still succeed (correct response returned) and the failure is logged rather than surfaced to the caller.
  4. The register handler integrates `createNotification` via dynamic import, so the server starts without a circular-import error between `auth.js` and `notifications.js`.
**Plans**: 1 plan
- [x] 01-01-PLAN.md — Fire non-blocking admin notifications on user register (new_user, via dynamic import) and trial activation (trial_started)

### Phase 2: Weekly System Report
**Goal**: Admins receive an accurate weekly digest of overall system health by email every Monday morning, can override the recipient, and can trigger the report on demand for testing — all degrading gracefully when SMTP is unavailable.
**Depends on**: Nothing (independent of Phase 1; builds on existing `email.js` SMTP transport, the `settings` table, and the `license-scheduler.js` self-scheduling pattern)
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05
**Success Criteria** (what must be TRUE):
  1. The system generates an HTML summary of the last 7 days covering accounts, software, licenses/trials, weekly revenue (paid orders + top-selling apps), and support — with numbers that match direct DB queries.
  2. The summary email is sent automatically every Monday at 08:00 UTC+7 (01:00 UTC), with a same-day guard preventing duplicate sends on a single tick.
  3. The recipient defaults to `dangson.1011@gmail.com` and can be overridden via the `WEEKLY_REPORT_EMAIL` environment variable or a `weekly_report_email` row in the `settings` table.
  4. An authenticated admin can trigger the weekly report to be sent immediately (optionally to a custom address) via an admin route and receive a success/failure response.
  5. When SMTP is not configured or sending fails, the scheduled send logs the error and skips without crashing the server or stopping the scheduler.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Realtime Admin Notifications | 1/1 | Complete (code-verified; 3 human-UAT items pending) | 2026-06-18 |
| 2. Weekly System Report | 0/TBD | Not started | - |
