---
phase: 01-realtime-admin-notifications
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/modules/auth.js
  - server/modules/store.js
autonomous: true
requirements: [NOTIF-01, NOTIF-02, NOTIF-03]

must_haves:
  truths:
    - "When a user completes registration, connected admins receive a `new-notification` and a `new_user` row is persisted in the notifications table."
    - "When a user activates a trial, connected admins receive a `new-notification` naming the user and the app, and a `trial_started` row is persisted."
    - "If notification creation/emission fails, the register and trial requests still return their normal success response and the failure is logged."
    - "The register handler integrates createNotification via dynamic import, so the server starts without an auth.js <-> notifications.js circular-import error."
  artifacts:
    - path: "server/modules/auth.js"
      provides: "Admin new_user notification on successful registration, fired via dynamic import, non-blocking"
      contains: "await import('./notifications.js')"
    - path: "server/modules/store.js"
      provides: "Admin trial_started notification on trial activation, non-blocking"
      contains: "trial_started"
  key_links:
    - from: "server/modules/auth.js POST /register"
      to: "server/modules/notifications.js createNotification"
      via: "dynamic await import('./notifications.js')"
      pattern: "import\\(['\"]\\./notifications\\.js['\"]\\)"
    - from: "server/modules/store.js POST /trial"
      to: "server/modules/notifications.js createNotification"
      via: "static import (already present at line 8)"
      pattern: "createNotification\\(\\{[\\s\\S]*trial_started"
---

<objective>
Fire a real-time, persisted admin notification at two existing backend integration points — when a new user finishes registration (`server/modules/auth.js` `POST /register`) and when a user activates a trial license (`server/modules/store.js` `POST /trial`) — by reusing the existing `createNotification({ type, title, message, link, userId })` helper (DB persist + Socket.IO emit to admins). Both call sites must be non-blocking: a notification failure logs and never alters the HTTP response.

Purpose: Give admins timely, accurate, persisted visibility into user registrations and trial activations without changing any auth/store success behavior or adding new files, dependencies, or migrations (NOTIF-01, NOTIF-02, NOTIF-03).

Output: Two modified backend files. No frontend change — `components/layout/AppLayout.tsx` already listens to `new-notification` and renders unknown notification types via a `toast.info` fallback + unread-badge update.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-realtime-admin-notifications/01-CONTEXT.md
@CLAUDE.md
@.planning/codebase/CONVENTIONS.md

@server/modules/notifications.js
@server/modules/auth.js
@server/modules/store.js

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase. Use these directly — no exploration needed. -->

From server/modules/notifications.js (line 184):
```js
// Persists a row in `notifications` AND emits Socket.IO 'new-notification'.
// userId defaults to null. userId === null => emitToAdmins('new-notification', ...).
// Internally try/catch-wrapped: on failure it logs and returns null (it never throws),
// but a *programming* error before the call (e.g. a bad reference) still could — so
// both call sites below MUST add their own non-blocking wrapper regardless.
export const createNotification = async ({ type, title, message, link, userId = null }) => { ... }
```

Existing admin-notification analog — server/modules/store.js (line 243, inside the create-order handler):
```js
createNotification({
    type: 'new_order',
    title: 'Đơn hàng mới',
    message: `${order.user_name || order.user_email} đã đặt mua ${displayName} - ${new Intl.NumberFormat('vi-VN').format(totalPrice)}đ`,
    link: '/admin/orders'
})
```
Note: this analog is fire-and-forget (no `await`, no `userId`). `createNotification` swallows its own errors, but per NOTIF-03 the new call sites still add an explicit non-blocking wrapper for safety.

DB access — server/db.js:
```js
// query(sql, params) returns ONLY { rows } (no insertId / affectedRows). Always use ?-placeholders.
export const query = async (sql, params) => ({ rows })
```

Token shape (req.user) attached by requireAuth: { id, role, email } — no full_name. The trial handler must look up full_name/email from the users table.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fire admin new_user notification on successful registration (NOTIF-01, NOTIF-03)</name>
  <files>server/modules/auth.js</files>
  <read_first>
    - server/modules/auth.js — the `POST /register` handler (lines 14-76): user INSERT at 29-33, the `getSettings()` call at 36, the three response branches at 40-71, catch at 72-74. The notification must fire AFTER the INSERT (line 33) and BEFORE the branch logic begins (line 35/36) so it runs for all three branches.
    - server/modules/notifications.js — `createNotification` signature/behavior (line 184).
    - server/modules/store.js — the `new_order` analog call at lines 243-248 (exact object-literal style to mirror: vi `title`, vi `message`, `link: '/admin/...'`, no `userId`).
    - CLAUDE.md "Gotchas" + 01-CONTEXT.md — the auth.js <-> notifications.js circular-import rule (MUST use dynamic import, never a top-level static import).
  </read_first>
  <action>
    Do NOT add any top-level `import` for notifications.js to this file. Adding a static `import { createNotification } from './notifications.js'` would create a circular import (notifications.js statically imports `requireAuth`/`requireAdmin` from auth.js), which under native ESM yields `undefined` named imports / a startup crash.

    In `server/modules/auth.js`, inside the `POST /register` handler, insert a non-blocking notification block AFTER the user INSERT completes (after line 33, the `await query('INSERT INTO users...')`) and BEFORE the `const settings = await getSettings()` line (line 36). Placing it here guarantees it runs for all three response branches (verification-email-sent, auto-verify-not-required, auto-verify-no-SMTP).

    Use a dynamic import wrapped in try/catch so a failure logs and never alters the response or throws. `email` and `fullName` are already destructured from `req.body` at line 16. Match backend style: ESM, no semicolons, 2-space indent, single quotes, Vietnamese user-facing strings.

    Insert exactly this block (indentation = 4 spaces to match the surrounding handler body):

    ```js
    // Notify admins of the new registration (non-blocking — must never break register)
    try {
      const { createNotification } = await import('./notifications.js')
      await createNotification({
        type: 'new_user',
        title: 'Người dùng mới đăng ký',
        message: `${fullName} (${email}) vừa tạo tài khoản mới`,
        link: '/admin/members'
      })
    } catch (notifyError) {
      console.error('Failed to create new_user notification:', notifyError)
    }
    ```

    Leave the existing INSERT, `getSettings()`, all three response branches, and the outer catch block (lines 72-74) unchanged.
  </action>
  <verify>
    <automated>MISSING — no test runner exists in this repo (see CONCERNS.md #3). Practical gate: `npm run build` (TypeScript build gate) succeeds, AND grep verification below passes. The executor must also confirm the server starts without a circular-import error: `node server/index.js` boots and logs its normal startup lines (no "createNotification is not a function" / undefined-import error).</automated>
  </verify>
  <acceptance_criteria>
    - `server/modules/auth.js` contains the literal `await import('./notifications.js')` exactly once (dynamic import). grep: `await import\('\./notifications\.js'\)`
    - `server/modules/auth.js` does NOT contain a top-level static `import ... from './notifications.js'`. grep (must return ZERO matches): `^import .*notifications\.js`
    - `server/modules/auth.js` contains `type: 'new_user'` and `link: '/admin/members'`. grep: `new_user` and `'/admin/members'`
    - The notification block is wrapped in try/catch and logs via `console.error('Failed to create new_user notification:'`. grep: `Failed to create new_user notification:`
    - The notification block appears AFTER the `INSERT INTO users` query and BEFORE `const settings = await getSettings()` (verify by reading lines ~33-40).
    - `npm run build` exits 0; `node server/index.js` starts without an undefined-import / circular-import error.
  </acceptance_criteria>
  <done>
    Completing registration persists a `new_user` row in `notifications` and emits `new-notification` to admins; if `createNotification` fails the register response is unchanged and the error is logged; the server starts with no circular-import error.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Fire admin trial_started notification on trial activation (NOTIF-02, NOTIF-03)</name>
  <files>server/modules/store.js</files>
  <read_first>
    - server/modules/store.js — the `POST /trial` handler (lines 91-150): `appCheck` query at 101-106 (`appCheck.rows[0].name` is the app name), trial-license INSERT at 132-136, the `console.log` at 138, and `res.json({...})` at 140-145. The notification must fire AFTER the console.log (line 138) and BEFORE `res.json` (line 140).
    - store.js line 8 — `import { createNotification } from './notifications.js'` is ALREADY present; call it directly (no circular issue here, no dynamic import needed).
    - server/modules/store.js — the `new_order` analog at lines 243-248 for the exact object-literal call style to mirror.
    - server/modules/notifications.js — `createNotification` signature (line 184).
    - CONVENTIONS.md "Database Access" — `query(sql, params)` returns `{ rows }`; always parameterized with `?`.
  </read_first>
  <action>
    In `server/modules/store.js`, inside the `POST /trial` handler, insert a non-blocking notification block AFTER the existing `console.log('🎁 Trial license created ...')` (line 138) and BEFORE `res.json({...})` (line 140).

    The JWT token only carries `req.user.id`/`req.user.email` (no full name), so look up the user's `full_name`/`email` with a parameterized query. The app name is already available from the earlier app check as `appCheck.rows[0].name`. Capture a display name that prefers `full_name`, then `email`, then the token email as a final fallback.

    Use the already-imported `createNotification` (do NOT add another import). Wrap in try/catch so a notification failure logs and the trial request still returns its normal success response. Match backend style: ESM, no semicolons, 2-space indent (this file's handler bodies use 4-space indentation — match the surrounding lines), single quotes, Vietnamese user-facing strings.

    Insert exactly this block (indentation = 8 spaces to match the surrounding handler body, e.g. the `console.log` above it):

    ```js
        // Notify admins of the trial activation (non-blocking — must never break trial creation)
        try {
            const userInfo = await query('SELECT full_name, email FROM users WHERE id = ?', [userId])
            const userName = userInfo.rows[0]?.full_name || userInfo.rows[0]?.email || req.user.email
            const appName = appCheck.rows[0].name
            await createNotification({
                type: 'trial_started',
                title: 'Dùng thử mới',
                message: `${userName} vừa kích hoạt dùng thử ${appName}`,
                link: '/admin/members'
            })
        } catch (notifyError) {
            console.error('Failed to create trial_started notification:', notifyError)
        }
    ```

    Leave the trial INSERT, the `console.log`, the `res.json` success response, and the outer catch block (lines 146-149) unchanged.
  </action>
  <verify>
    <automated>MISSING — no test runner exists in this repo (see CONCERNS.md #3). Practical gate: `npm run build` succeeds AND the grep verification below passes.</automated>
  </verify>
  <acceptance_criteria>
    - `server/modules/store.js` contains `type: 'trial_started'` and `link: '/admin/members'`. grep: `trial_started` and (a second) `'/admin/members'`
    - The block looks up the user via a parameterized query: grep `SELECT full_name, email FROM users WHERE id = \?`
    - The block references the app name via `appCheck.rows[0].name`. grep: `appCheck\.rows\[0\]\.name`
    - The block is wrapped in try/catch and logs via `console.error('Failed to create trial_started notification:'`. grep: `Failed to create trial_started notification:`
    - No new top-level import was added (store.js still has exactly one `import { createNotification } from './notifications.js'` at line 8). grep count for `from './notifications.js'` must equal 1.
    - The notification block appears AFTER the `console.log('🎁 Trial license created` line and BEFORE the `res.json({` of the trial handler (verify by reading lines ~138-145).
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>
    Activating a trial persists a `trial_started` row in `notifications` and emits `new-notification` to admins naming the user and the app; if `createNotification` (or the user lookup) fails, the trial response is unchanged and the error is logged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> /register | Untrusted `email`, `fullName` from the public registration request body cross into the notification message. |
| client -> /trial | Authenticated user id/email (JWT) cross in; `full_name`/`email`/app name are read from the DB (trusted store). |
| server -> admin Socket.IO room | Notification payload is emitted only to the JWT-verified admin room (see `server/socket.js` admin join). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering / Injection | `createNotification` INSERT with user-supplied `fullName`/`email` | mitigate | Values flow through `createNotification`, which uses parameterized `?` SQL (notifications.js:186-190). No string concatenation into SQL at either call site — no SQL injection. (NOTIF inherits the existing parameterized helper.) |
| T-01-02 | Information disclosure | Notification payload contains a user's name/email | accept | Payload is emitted only to the JWT-verified admin room (`emitToAdmins`), never to the registering/trialing user or other users. Admins are already authorized to see member PII. No new public surface. |
| T-01-03 | Denial of service | A failing notification aborts the register/trial request | mitigate | Both call sites are wrapped in try/catch (NOTIF-03); a notification failure logs and the original success response is returned unchanged. The dynamic import in auth.js is also inside the try/catch. |
| T-01-04 | Elevation of privilege | Circular import yields an undefined `createNotification` and crashes server startup | mitigate | auth.js uses dynamic `await import('./notifications.js')` (never a top-level static import), avoiding the auth.js <-> notifications.js cycle; store.js's existing static import is non-circular. |
| T-01-05 | Cross-site scripting (stored, via admin render) | `fullName`/`email` rendered in the admin notification UI | accept | Low risk: admin UI surfaces the message via `toast.info` (text, not raw HTML) and the unread badge; no `dangerouslySetInnerHTML` for notification messages. No new sink introduced by this phase; pre-existing rich-text XSS (CONCERNS #4) is out of scope. |

No high-severity threats introduced: no auth/authorization change, no new endpoint, no new dependency, no new SQL outside the existing parameterized helper.
</threat_model>

<verification>
Phase-level checks (all must pass):
1. `npm run build` exits 0 (TypeScript build gate — no frontend changes, so this confirms nothing broke).
2. `node server/index.js` starts cleanly with no circular-import / undefined-import error (proves the dynamic-import requirement is satisfied — Success Criterion 4).
3. grep `await import\('\./notifications\.js'\)` in server/modules/auth.js returns exactly 1 match; grep `^import .*notifications\.js` in auth.js returns 0 matches.
4. grep `type: 'new_user'` in auth.js and `type: 'trial_started'` in store.js each return a match; both reference `link: '/admin/members'`.
5. Both new blocks are inside a try/catch with a `console.error('Failed to create ... notification:'` log (NOTIF-03).
6. Manual (optional, where a running stack + admin socket is available): register a new user -> connected admin receives a `new-notification` toast + unread badge increments, and a `new_user` row exists in `notifications` (`SELECT * FROM notifications WHERE type='new_user' ORDER BY id DESC LIMIT 1`). Activate a trial -> admin receives a `new-notification` naming the user + app, and a `trial_started` row exists.
</verification>

<success_criteria>
- [ ] Registration fires an admin `new_user` notification (persisted + emitted) for all three register response branches (NOTIF-01).
- [ ] Trial activation fires an admin `trial_started` notification naming the user and app (persisted + emitted) (NOTIF-02).
- [ ] Both notifications are non-blocking: a failure logs via `console.error` and the register/trial request returns its normal success response (NOTIF-03).
- [ ] auth.js uses a dynamic `await import('./notifications.js')` (no top-level static import); server starts with no circular-import error.
- [ ] No new files, dependencies, or DB migrations; only `server/modules/auth.js` and `server/modules/store.js` changed.
- [ ] `npm run build` exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/01-realtime-admin-notifications/01-01-SUMMARY.md`.
</output>
