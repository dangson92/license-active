# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** Admins have timely, accurate visibility into system activity — real time for individual events, weekly digest for overall health.
**Current focus:** Phase 1 — Realtime Admin Notifications

## Current Position

Phase: 1 of 2 (Realtime Admin Notifications)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-06-18 — Roadmap created (2 phases, 8/8 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Register/trial notifications go to admins only (matches existing `new_order` pattern).
- Phase 1: Reuse `createNotification` for both events (DB persist + Socket.IO emit; frontend renders unknown types via toast fallback).
- Phase 1: Dynamic `import('./notifications.js')` inside the `auth.js` register handler to avoid the `auth.js ↔ notifications.js` circular import.
- Phase 2: Weekly report sent Monday 08:00 UTC+7 (01:00 UTC); recipient defaults to dangson.1011@gmail.com, overridable via env/settings.
- Phase 2: New weekly scheduler mirrors `license-scheduler.js` (in-memory self-scheduling) — not cluster/restart-safe (known limitation).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Scheduler is in-memory self-scheduling — not restart/cluster-safe; same-day guard mitigates duplicate sends but multi-instance deploy would need rework (deferred to v2: REPORT-V2-03).
- Weekly send depends on SMTP being configured in the DB `settings` table; must fail gracefully (log + skip) when unconfigured.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Reporting | Multi-recipient distribution (REPORT-V2-01) | Deferred to v2 | 2026-06-18 |
| Reporting | Configurable report template/sections (REPORT-V2-02) | Deferred to v2 | 2026-06-18 |
| Reporting | Cluster/restart-safe scheduling (REPORT-V2-03) | Deferred to v2 | 2026-06-18 |
| Notifications | End-user register/trial notifications (NOTIF-V2-01) | Deferred to v2 | 2026-06-18 |

## Session Continuity

Last session: 2026-06-18
Stopped at: Roadmap and STATE initialized; REQUIREMENTS traceability filled (8/8 mapped).
Resume file: None
