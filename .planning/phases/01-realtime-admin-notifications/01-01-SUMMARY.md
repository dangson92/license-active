---
phase: 01-realtime-admin-notifications
plan: 01
subsystem: backend-notifications
tags: [notifications, socket-io, auth, store, admin]
one_liner: "Fire persisted + real-time admin new_user / trial_started notifications at the register and trial integration points by reusing createNotification, non-blocking, with a dynamic import in auth.js to avoid the circular import."
requires:
  - "server/modules/notifications.js createNotification (persist + emitToAdmins)"
provides:
  - "Admin new_user notification on successful registration (auth.js POST /register)"
  - "Admin trial_started notification on trial activation (store.js POST /trial)"
affects:
  - server/modules/auth.js
  - server/modules/store.js
tech-stack:
  added: []
  patterns:
    - "Dynamic await import('./notifications.js') inside auth.js handler to break the auth.js <-> notifications.js circular dependency"
    - "Non-blocking try/catch around notification creation so a notify failure logs and never alters the HTTP success response (NOTIF-03)"
key-files:
  created: []
  modified:
    - server/modules/auth.js
    - server/modules/store.js
decisions:
  - "auth.js uses dynamic import (never a top-level static import) for createNotification to avoid the circular import / undefined-export startup crash"
  - "store.js reuses its already-present static import (line 8) — no new import added"
  - "Trial display name prefers full_name, then email, then the JWT token email as a final fallback"
metrics:
  duration: "~2 min"
  completed: 2026-06-18
  tasks: 2
  files_changed: 2
requirements: [NOTIF-01, NOTIF-02, NOTIF-03]
---

# Phase 01 Plan 01: Realtime Admin Notifications Summary

## Objective

Fire a real-time, persisted admin notification at two existing backend integration points — when a new user finishes registration (`server/modules/auth.js` `POST /register`) and when a user activates a trial license (`server/modules/store.js` `POST /trial`) — by reusing the existing `createNotification({ type, title, message, link, userId })` helper. Both call sites are non-blocking: a notification failure logs and never alters the HTTP response. No new files, dependencies, or migrations.

## What Changed

### Task 1 — `server/modules/auth.js` (NOTIF-01, NOTIF-03) — commit `5daa73e`

Inserted a non-blocking `new_user` notification block in the `POST /register` handler, placed AFTER the user `INSERT` and BEFORE `const settings = await getSettings()`, so it runs for all three response branches (verification-email-sent, auto-verify-not-required, auto-verify-no-SMTP).

- Uses a dynamic `await import('./notifications.js')` (NOT a top-level static import) to avoid the `auth.js <-> notifications.js` circular import that would otherwise yield an undefined `createNotification` / startup crash.
- Wrapped in try/catch — a failure logs via `console.error('Failed to create new_user notification:', notifyError)` and the register response is unchanged.
- `type: 'new_user'`, Vietnamese title/message built from `fullName` + `email`, `link: '/admin/members'`.

### Task 2 — `server/modules/store.js` (NOTIF-02, NOTIF-03) — commit `54d3796`

Inserted a non-blocking `trial_started` notification block in the `POST /trial` handler, placed AFTER the `console.log('🎁 Trial license created ...')` and BEFORE `res.json({...})`.

- Reuses the already-imported `createNotification` (store.js line 8) — no new import added (no circular issue here).
- Looks up `full_name`/`email` via a parameterized query (`SELECT full_name, email FROM users WHERE id = ?`) since the JWT token carries only `id`/`email`; app name comes from `appCheck.rows[0].name`. Display name prefers `full_name`, then `email`, then `req.user.email`.
- Wrapped in try/catch — a failure logs via `console.error('Failed to create trial_started notification:', notifyError)` and the trial response is unchanged.
- `type: 'trial_started'`, Vietnamese title/message naming the user + app, `link: '/admin/members'`.

## Key Files Modified

| File | Change |
| ---- | ------ |
| `server/modules/auth.js` | +13 lines: dynamic-import `new_user` notification block in `POST /register` |
| `server/modules/store.js` | +15 lines: `trial_started` notification block (with user lookup) in `POST /trial` |

## Verification Results

**Build gate** — `npm run build`: exit code **0** (vite build, 2039 modules transformed, built in 9.32s). Pre-existing chunk-size and browserslist-staleness warnings are unrelated and out of scope.

**Server startup gate** — `node server/index.js` (run with a 12s timeout): started and kept running with **no ESM import / circular-import error**. The only log line was a pre-existing, unrelated warning (`Failed to load private key from file ... keys/private.pem`) which is not caused by this plan and did not crash the process. An explicit module-graph smoke test confirmed `requireAuth`, `createNotification`, and both routers resolve to defined functions (`IMPORT_GRAPH_OK`).

**Grep acceptance criteria** — all pass:

- auth.js: `await import('./notifications.js')` count = **1**; top-level `^import .*notifications\.js` count = **0**; `type: 'new_user'`, `'/admin/members'`, and `Failed to create new_user notification:` all present; block sits after the `INSERT INTO users` query and before `const settings = await getSettings()`.
- store.js: `type: 'trial_started'`, `'/admin/members'`, `SELECT full_name, email FROM users WHERE id = ?`, `appCheck.rows[0].name`, and `Failed to create trial_started notification:` all present; `from './notifications.js'` count = **1** (no new import); block sits after the `🎁 Trial license created` log and before `res.json({`.

**Commit integrity** — no file deletions in either task commit; working tree clean after both commits.

## Deviations from Plan

None — plan executed exactly as written. Both code blocks were inserted verbatim at the specified insertion points with the specified indentation (4-space in auth.js, 8-space in store.js).

## Authentication Gates

None encountered.

## Known Stubs

None. Both call sites are fully wired to the existing `createNotification` helper (DB persist + Socket.IO emit to admins).

## Threat Flags

None. No new endpoints, auth paths, dependencies, or SQL outside the existing parameterized `createNotification` helper. Threat register dispositions (T-01-01..05) are satisfied: user-supplied values flow only through parameterized SQL, both call sites are non-blocking (try/catch), and the dynamic import preserves non-circular module loading.

## Self-Check: PASSED

- `server/modules/auth.js` — FOUND (modified, committed in `5daa73e`)
- `server/modules/store.js` — FOUND (modified, committed in `54d3796`)
- Commit `5daa73e` — FOUND in `git log`
- Commit `54d3796` — FOUND in `git log`
- `.planning/phases/01-realtime-admin-notifications/01-01-SUMMARY.md` — created
