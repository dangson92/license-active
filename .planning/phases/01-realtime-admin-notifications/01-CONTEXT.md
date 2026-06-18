# Phase 1: Realtime Admin Notifications - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning
**Source:** Decisions captured during /gsd-new-project questioning

<domain>
## Phase Boundary

Backend-only. Emit a real-time, persisted admin notification when (a) a new user finishes registration and (b) a user activates a trial license. No frontend changes — the admin UI (`components/layout/AppLayout.tsx`) already listens to the Socket.IO `new-notification` event and renders unknown types via an `else → toast.info` fallback + unread-badge update.
</domain>

<decisions>
## Implementation Decisions (locked)

### Mechanism
- Reuse the existing `createNotification({ type, title, message, link, userId })` from `server/modules/notifications.js` — it already persists to the `notifications` table AND emits via Socket.IO.
- Audience = **admins only** → call with `userId: null` (routes to `emitToAdmins('new-notification', …)`). Do NOT notify the end user this milestone.

### Register event (`server/modules/auth.js`, `POST /register`)
- `auth.js` must NOT statically import `notifications.js` (circular import: notifications.js imports `requireAuth` from auth.js, and that const is in the TDZ during module load → startup crash). Use a **dynamic `await import('./notifications.js')`** inside the handler.
- Fire AFTER the user `INSERT` succeeds and BEFORE the response-branch logic (so it runs for all three response branches: verification-email-sent, auto-verify-not-required, auto-verify-no-SMTP).
- Non-blocking: wrap so a notification failure never changes the HTTP response or throws — log and continue.
- Type `new_user`, Vietnamese title/message using `fullName` + `email` from the request body, `link: '/admin/members'`.

### Trial event (`server/modules/store.js`, `POST /trial`)
- `store.js` already imports `createNotification` from `./notifications.js` (no circular issue) — call it directly.
- Fire AFTER the trial-license `INSERT` (after the existing `console.log` at ~line 138) and BEFORE `res.json(...)`.
- Look up the user's `full_name`/`email` (only `req.user.id`/`email` are on the token); app name is available as `appCheck.rows[0].name`.
- Non-blocking: wrap in try/catch so trial creation still returns success if notify fails.
- Type `trial_started`, Vietnamese title/message naming the user + app, `link: '/admin/members'`.

### Claude's Discretion
- Exact Vietnamese wording of titles/messages.
- Whether to `await` createNotification inside a try/catch vs fire-and-`.catch()` — either is acceptable as long as it is non-blocking and errors are logged.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Notification + socket mechanism
- `server/modules/notifications.js` — `createNotification` (persist + emit); note `query()` returns only `{ rows }` (insertId is undefined — not needed here).
- `server/socket.js` — `emitToAdmins` / `emitToUser`, admin room join with JWT.

### Integration sites
- `server/modules/auth.js` — `POST /register` (insert at ~line 29-33; three response branches at ~line 40-71).
- `server/modules/store.js` — `POST /trial` (insert at ~line 132-136; `res.json` at ~line 140). Existing `createNotification` import at line 8 and usage examples at lines 243, 444, 494.

### Frontend (no change, for verification only)
- `components/layout/AppLayout.tsx` — `new-notification` handler (~line 60-93), toast fallback renders any type.
</canonical_refs>

<specifics>
## Specific Ideas

- Mirror the existing admin-notification style already used for orders (`new_order` at `store.js:243`): `{ type, title (vi), message (vi), link: '/admin/...' }` with no `userId`.
</specifics>

<deferred>
## Deferred Ideas

- End-user welcome / trial-activated notifications — out of scope this milestone (admin-only). See REQUIREMENTS.md NOTIF-V2-01.
</deferred>

---

*Phase: 01-realtime-admin-notifications*
*Context gathered: 2026-06-18 during /gsd-new-project*
