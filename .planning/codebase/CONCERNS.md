# Codebase Concerns

**Analysis Date:** 2026-06-18

This document is an evidence-based audit of technical debt, bugs, security exposure, performance, and fragile areas in the `keymaster-ai` / phanmemauto.com codebase. Every item below was verified against actual source; file paths and line numbers are cited. Findings are tagged with **Severity** (Critical / High / Medium / Low) and **Area** (Security / Reliability / Performance / Maintainability / Testing).

## Severity Summary

| # | Concern | Severity | Area |
|---|---------|----------|------|
| 1 | `query()` returns only `{ rows }` — `result.insertId` / `result.affectedRows` are always `undefined` | High | Reliability |
| 2 | Order approval & package creation are not transactional (partial-license / orphaned-data risk) | High | Reliability |
| 3 | Zero automated tests, no CI | High | Testing |
| 4 | JWT stored in `localStorage` (XSS-stealable) | High | Security |
| 5 | HMAC signing secret has an insecure hardcoded default | High | Security |
| 6 | Schedulers & rate limiter are in-memory (not restart-safe, not cluster-safe) | High | Reliability |
| 7 | `e.message` leaked to clients in ~80 places (information disclosure) | Medium | Security |
| 8 | Money math done in JS floats (`unit_price * quantity`) | Medium | Reliability |
| 9 | SMTP / bank credentials stored plaintext in DB `settings` | Medium | Security |
| 10 | `genKey` license-key generator duplicated 3× | Medium | Maintainability |
| 11 | Correlated subquery `COUNT(*)` per row in admin listings (N+1-style) | Medium | Performance |
| 12 | Catch-all `/:filename` route ordering / collision risk | Medium | Reliability |
| 13 | Helmet CSP disabled on the API + Gemini key baked into client bundle | Medium | Security |
| 14 | Public unauthenticated payment/bank endpoint | Low | Security |
| 15 | `pg` dependency declared but unused; single mixed `package.json` | Low | Maintainability |
| 16 | `multer@1.4.5-lts.1` (deprecated 1.x line) | Low | Security |
| 17 | Notification cleanup runs opportunistically, not scheduled | Low | Reliability |
| 18 | Duplicated S3 client setup (`app-attachments.js` vs `idrive-e2.js`) | Low | Maintainability |
| 19 | `RS256` 30-day token + activation race (TOCTOU) on device cap | Low | Security |
| 20 | No structured logging / error tracking; heavy `console.log` instrumentation | Low | Maintainability |

---

## Tech Debt

**`query()` return shape mismatch — `insertId` / `affectedRows` silently undefined:**
- Issue: `server/db.js:14-17` defines `query()` to return **only** `{ rows }` (it discards the second element of the `mysql2` result tuple). Several callers read `result.insertId` and `result.affectedRows`, which are therefore always `undefined`. The codebase works around this elsewhere by issuing a follow-up `SELECT LAST_INSERT_ID() as id` (e.g. `server/modules/store.js:222`, `:611`, `:734`; `server/modules/app-versions.js:189`; `server/modules/app-attachments.js:124`; `server/modules/support.js:60`, `:113`, `:258`) — but the following sites do NOT and are buggy:
  - `server/modules/notifications.js:193` and `:214` — `createNotification()` returns `result.insertId` (always `undefined`) and emits a Socket.IO payload with `id: undefined`.
  - `server/modules/notifications.js:161-162` — `cleanupOldNotifications()` guards on `result.affectedRows > 0`, which is always falsy, so the "Cleaned up N old notifications" log never fires (the DELETE still runs, but observability is broken).
  - `server/modules/announcements.js:135` — `res.json({ id: result.insertId, ... })` returns `{ id: undefined }` to the client after creating an announcement.
  - `server/modules/support.js:386` — FAQ creation returns `{ id: undefined }`.
- Files: `server/db.js`, `server/modules/notifications.js`, `server/modules/announcements.js`, `server/modules/support.js`
- Impact: New notifications/announcements/FAQs return a null id; realtime notification payloads carry `id: undefined`, which can break client-side dedupe/mark-read. Inconsistent: half the codebase pattern uses a `LAST_INSERT_ID()` round-trip, the other half assumes `insertId`.
- Fix approach: Change `query()` to return `{ rows, insertId, affectedRows }` by destructuring the full `mysql2` result (`const [rows, fields] = ...` plus reading `rows.insertId`/`rows.affectedRows` from the OkPacket on writes), then standardize all callers and drop the redundant `SELECT LAST_INSERT_ID()` queries.

**`genKey` license-key generator duplicated three times:**
- Issue: The same UUID-v4-style generator is copy-pasted in `server/modules/admin.js:25-31`, `server/modules/store.js:83-89`, and a third inline copy nested inside the order-approval handler at `server/modules/store.js:360-366`.
- Files: `server/modules/admin.js`, `server/modules/store.js`
- Impact: Three sources of truth for license-key format/entropy. A change (e.g. collision-safety, format) must be made in three places. Uses `Math.random()` (not cryptographically strong) — acceptable for opaque keys but inconsistent with `crypto.randomBytes` used for verification tokens in `server/services/email.js:60-62`.
- Fix approach: Extract a single `generateLicenseKey()` into a shared util (e.g. `server/services/license.js`) using `crypto.randomUUID()`; import everywhere.

**Single shared `package.json` mixing frontend + backend; unused `pg`:**
- Issue: One root `package.json` declares React/Vite/Radix (frontend) and Express/mysql2/nodemailer/aws-sdk (backend) together. `pg` (`package.json:49`) is declared but the app uses MySQL only (`server/db.js` imports `mysql2/promise`); the only Postgres residue is the `{ rows }` return shape.
- Files: `package.json`, `server/db.js`
- Impact: Frontend `npm install` pulls the entire backend dep tree (and vice-versa); larger install surface; `pg` is dead weight and a misleading signal about the datastore.
- Fix approach: Remove `pg`. Longer term, split into workspace packages (frontend/backend) or at least document the split; consider separate lockfiles or npm workspaces.

**Duplicated S3 client construction:**
- Issue: `server/services/idrive-e2.js` already centralizes the S3 client and presign helpers, but `server/modules/app-attachments.js:14-15,56-65` builds its own `S3Client` and presigned-URL logic.
- Files: `server/services/idrive-e2.js`, `server/modules/app-attachments.js`
- Impact: Two configurations of the same storage backend can drift (region, endpoint, path-style).
- Fix approach: Have `app-attachments.js` consume the shared helpers from `idrive-e2.js`.

**No structured logging / observability:**
- Issue: Diagnostics are emoji-prefixed `console.log`/`console.error` scattered through every module plus `morgan('combined')` in `server/index.js:76`. No log levels, no aggregation, no error tracking (Sentry/etc.).
- Files: all `server/modules/*.js`, `server/services/*.js`
- Impact: Hard to triage production incidents; noisy logs; some logs leak partial identifiers (license prefixes, device-id prefixes) — low sensitivity but worth noting.
- Fix approach: Introduce a leveled logger (pino/winston) and an error-tracking integration.

---

## Known Bugs / Latent Defects

**Realtime notification id is `undefined`:**
- Symptoms: `createNotification()` (`server/modules/notifications.js:184-219`) emits `new-notification` with `id: result.insertId`, which is `undefined` (see Tech Debt #1). The persisted row gets a real auto-increment id, but the realtime push does not — so the in-memory and persisted views disagree until refetch.
- Files: `server/modules/notifications.js`
- Trigger: Any new order, order approve/reject, or expiring-license notification.
- Workaround: Client refetch via `GET /api/notifications` reconciles state.

**Order approval / package creation are not atomic:**
- Symptoms: `server/modules/store.js:345-457` (approve) issues N license `INSERT`s in nested loops (package × quantity) followed by a separate `UPDATE purchase_orders SET status='paid'`. There is **no transaction** — `getClient()`/`beginTransaction`/`COMMIT` are not used anywhere in the codebase (verified: no matches in `server/modules/*.js`). If the process crashes or a query fails mid-loop, some licenses exist while the order stays `pending` (or vice-versa). Package create/update (`store.js:704-797`) similarly inserts the package then loops `package_items` non-transactionally.
- Files: `server/modules/store.js`
- Trigger: DB error / restart during multi-license approval.
- Workaround: Manual admin cleanup.
- Fix approach: Wrap the approval (and package writes) in a single transaction via `server/db.js` `getClient()` → `conn.beginTransaction()` / `commit()` / `rollback()`.

---

## Security Considerations

**JWT in `localStorage` (XSS token theft):**
- Risk: User auth tokens are stored at `localStorage['auth_token']` (`services/api.ts:33,36,40`) and base64-decoded client-side (`services/api.ts:53` `atob(parts[1])`). Any XSS (e.g. via the TinyMCE-authored announcements rendered as HTML) can exfiltrate the 7-day HS256 token.
- Files: `services/api.ts`, `server/modules/auth.js:9-12` (7-day expiry)
- Current mitigation: None for the storage location; tokens expire in 7 days.
- Recommendations: Move to `HttpOnly`, `Secure`, `SameSite` cookies; add CSP (currently disabled, see below); sanitize all admin-authored rich text before rendering.

**HMAC signing secret has an insecure default:**
- Risk: `server/middleware/verifySignature.js:21` falls back to the literal `'your-super-secret-key-change-this-in-production'` if `LICENSE_SIGNING_SECRET` is unset. If deployed without the env var, every desktop client request signature is forgeable.
- Files: `server/middleware/verifySignature.js`
- Current mitigation: Comment instructing operators to set the env var.
- Recommendations: Fail-fast on startup if `LICENSE_SIGNING_SECRET` is missing (mirror the `process.exit(1)` pattern used for the RSA key in `server/config/keys.js:39-42`).

**Replay window on signed endpoints + non-distributed rate limiting:**
- Risk: `verifySignature.js:38-89` accepts any request whose timestamp is within ±5 minutes — there is **no nonce / used-signature cache**, so a captured `/activate` or `/check-in` request can be replayed for up to ~5 minutes. The custom limiter (`server/middleware/rateLimiter.js`) is an in-process `Map` (`:17`), explicitly noted as not Redis-backed; it is lost on restart and not shared across PM2 cluster workers, and it **fails open** on error (`:203-207` calls `next()`).
- Files: `server/middleware/verifySignature.js`, `server/middleware/rateLimiter.js`, mounted in `server/modules/activate.js:13`, `server/modules/check-in.js`
- Current mitigation: Timestamp window + timing-safe compare; per-IP/device/license counters.
- Recommendations: Add a short-lived seen-signature/nonce store (Redis) to block replays; back rate limiting with Redis for multi-instance correctness; reconsider fail-open.

**`e.message` returned to clients (information disclosure):**
- Risk: ~80 occurrences across 11 files return raw exception text to the client, e.g. `server/modules/store.js` (19 sites: `:48`, `:74`, `:148`, `:176`, ...), `server/modules/support.js` (14), `server/modules/admin.js` (11), `server/modules/app-versions.js` (9), `server/modules/announcements.js` (8), plus `download.js`, `notifications.js`, `app-attachments.js`, `settings.js:83`, `auth.js:178`. Also `server/index.js:176` returns `e.message` from the direct-download catch-all.
- Files: see above (counted via grep `message: e.message` / `error: e.message`)
- Impact: SQL errors, file paths, and internal details can leak to API consumers, aiding attackers.
- Fix approach: Centralized Express error middleware that logs server-side and returns a generic `{ error: 'server_error' }`; reserve detailed messages for non-sensitive validation cases only.

**SMTP & bank credentials stored plaintext in DB `settings`:**
- Risk: `server/sql/migrations/004_add_email_verification.sql:11-25` creates the `settings` key/value table and seeds `smtp_pass` etc. as plain strings; values are written verbatim by `server/modules/settings.js:55-60` and read verbatim by `server/services/email.js:13-37`. SMTP password is masked on read (`settings.js:31-32`) but stored plaintext at rest. Bank info is likewise plaintext.
- Files: `server/modules/settings.js`, `server/services/email.js`, `server/sql/migrations/004_add_email_verification.sql`
- Current mitigation: Read-masking of `smtp_pass` in the admin API only.
- Recommendations: Encrypt secrets at rest (app-level encryption with a key from env), or move SMTP creds to env vars like the rest of the infra secrets.

**Public, unauthenticated payment/bank endpoint:**
- Risk: `GET /api/admin/settings/payment` (`server/modules/settings.js:9-22`) is mounted under the admin settings router but has **no auth guard** — it returns `bank_name`, `bank_code`, `bank_account`, `bank_holder` to anyone. This is intentional (checkout screen needs it) but exposes the receiving bank account publicly.
- Files: `server/modules/settings.js`
- Current mitigation: Only bank-display fields are selected (no secrets).
- Recommendations: Acceptable if bank info is meant to be public; otherwise gate behind auth.

**Helmet CSP disabled + Gemini key in client bundle:**
- Risk: `server/index.js:72-75` disables `contentSecurityPolicy` and `crossOriginResourcePolicy` on the API. Separately, `vite.config.ts:14-17` injects `GEMINI_API_KEY` into the client bundle as `process.env.API_KEY`/`process.env.GEMINI_API_KEY` — meaning the Gemini key ships to every browser and is fully extractable.
- Files: `server/index.js`, `vite.config.ts`, `services/geminiService.ts`
- Current mitigation: CSP is "delegated to the frontend" per comment, but no CSP was found in the SPA either.
- Recommendations: Add CSP at the SPA/Nginx layer; proxy Gemini calls through the backend so the key never reaches the client (or restrict the key by HTTP referrer + quota).

**RSA private key on disk; hard `process.exit(1)` if missing:**
- Risk: `server/config/keys.js:20-43` reads the RSA private key from disk and calls `process.exit(1)` if absent. This is correct fail-fast behavior, but the key lives as a file on the VPS (`keys/private.pem`); compromise of the host yields the license-signing key.
- Files: `server/config/keys.js`
- Current mitigation: `.pem` files git-ignored (`keys/.gitignore`).
- Recommendations: Restrict file perms; consider a secrets manager / KMS; have a key-rotation plan (all issued 30-day RS256 tokens depend on a single static key).

**Activation device-cap race (TOCTOU) and long-lived tokens:**
- Risk: `server/modules/activate.js:57-75` counts active activations then inserts — a check-then-act race could momentarily exceed `max_devices` under concurrent requests. The `UNIQUE KEY uniq_activation (license_id, device_id)` (`server/sql/schema.sql:39`) prevents duplicate device rows but not over-count across distinct devices. Issued tokens are RS256 valid for 30 days (`activate.js:101`) and re-rolled on check-in.
- Files: `server/modules/activate.js`, `server/sql/schema.sql`
- Current mitigation: Unique constraint; rate limiting.
- Recommendations: Enforce the cap in a transaction (`SELECT ... FOR UPDATE`) or via DB constraint; consider shorter token TTL given the rolling check-in renewal.

**`multer@1.4.5-lts.1` (deprecated major):**
- Risk: `package.json:46` pins multer 1.x; the 1.x line is deprecated and has had advisories. Used for receipts, icons, releases, attachments.
- Files: `package.json`, all upload handlers
- Recommendations: Plan migration to multer 2.x and audit upload size/type validation per route.

---

## Performance Bottlenecks

**Correlated subquery `COUNT(*)` per row in admin listings:**
- Problem: Admin list endpoints run a `(SELECT COUNT(*) ...)` correlated subquery for every returned row:
  - `server/modules/admin.js:68` — licenses-per-user count in the users list.
  - `server/modules/admin.js:133-134` — version_count and license_count per app.
  - `server/modules/admin.js:273` — active_devices per license in the licenses list.
- Files: `server/modules/admin.js`
- Cause: Per-row subqueries scale O(rows × subquery cost); on large tables these become slow, especially `activations`/`licenses` which lack supporting indexes beyond the unique keys.
- Improvement path: Replace with `LEFT JOIN ... GROUP BY` aggregations; add indexes on `activations(license_id, status)`, `licenses(user_id)`, `licenses(app_id)`, `app_versions(app_id)`.

**Missing indexes on hot/foreign-key columns:**
- Problem: `server/sql/schema.sql` defines FKs (which create implicit indexes on `license_id` etc.) and unique keys on `licenses.license_key` and `activations(license_id, device_id)` — good for activation lookup. But there is no explicit index supporting `licenses(user_id)` / `licenses(app_id)` filtering used heavily in `download.js`, `store.js`, and the scheduler join, nor on `notifications(user_id, is_read)` used by every notification query.
- Files: `server/sql/schema.sql`, later migrations
- Cause: Schema authored without query-pattern-driven indexing.
- Improvement path: Add composite indexes matching the dominant WHERE/ORDER patterns.

**Direct-download catch-all does dynamic import per request:**
- Problem: `server/index.js:125-181` `app.get('/:filename')` performs `await import('./db.js')` on every matching request rather than importing once at module top.
- Files: `server/index.js`
- Cause: Lazy import inside the handler.
- Improvement path: Import `query` at the top of the file (it is already a singleton pool).

---

## Fragile Areas

**Catch-all `/:filename` route ordering / collision risk:**
- Files: `server/index.js:125-181`
- Why fragile: A bare `/:filename` route is registered after the API routers but before the static handlers. It only acts on `.zip`/`.exe` (guarded at `:128`) and calls `next()` otherwise, but any future top-level route or filename collision is order-sensitive. It returns `e.message` to clients (`:176`) and 302-redirects to whatever `download_url` is stored (open-redirect-ish if that column were ever attacker-controlled).
- Safe modification: Move these to an explicit prefixed route (e.g. `/dl/:filename`) or keep it strictly last; validate `download_url` is an allow-listed host before redirecting.
- Test coverage: None.

**In-memory schedulers do not survive restart and are not cluster-safe:**
- Files: `server/services/license-scheduler.js`, `server/middleware/rateLimiter.js:67`
- Why fragile: `license-scheduler.js:11` keeps `lastCheckDate` in a module variable and schedules via `setTimeout`→`setInterval` (`:104-112`). On PM2 restart the timer resets (a restart near 03:00 UTC could skip or double-run the day's check); under PM2 **cluster mode** every worker runs its own scheduler, so each expiring license could be notified once per worker — duplicate-send risk. The 20-day "already notified" guard (`license-scheduler.js:39-45`) mitigates duplicates across days but not concurrent same-tick runs across workers. The `setInterval(cleanupOldEntries, ...)` in `rateLimiter.js:67` is likewise per-process.
- Safe modification: Use an external cron (system cron / a single dedicated worker) or a DB-backed job lock; ensure the scheduler runs on exactly one instance.
- Test coverage: None.

**Notification cleanup is opportunistic, not scheduled:**
- Files: `server/modules/notifications.js:170-179,212`
- Why fragile: `maybeCleanup()` only runs when a new notification is *created* and at most hourly (`lastCleanup` guard). If no notifications are created for a long stretch, old rows accumulate; and because it depends on the broken `affectedRows` check (`:161`) the cleanup log is misleading. There is no real schedule.
- Safe modification: Move cleanup into the (single-instance) scheduler or an external cron.
- Test coverage: None.

**Money handled as JS floats:**
- Files: `server/modules/store.js:214` (`const totalPrice = unit_price * (quantity || 1)`), `:246` (formatting), package sum aggregations `store.js:633-635,686-688`
- Why fragile: Prices are `DECIMAL(10,2)` in the DB (`server/sql/migrations/005_add_support_and_store.sql:40-60`, `012_add_packages.sql:14-20`) but arithmetic happens in JavaScript where `unit_price` arrives as a string/number from `req.body` and is multiplied with floating-point semantics, then re-inserted. For VND (integer-dong) amounts this is usually safe, but any fractional pricing or large totals risk rounding drift, and `unit_price` is taken from the client request body (`store.js:185`) with no server-side validation against the catalog price.
- Safe modification: Validate/derive `unit_price` server-side from `app_pricing`/`packages` (never trust the client), compute totals in integer minor units, and round explicitly.
- Test coverage: None — and this is a payment path.

**Manual bank-transfer + receipt-upload approval flow:**
- Files: `server/modules/store.js:182-262` (create order + receipt), `:345-457` (manual approve → license generation)
- Why fragile: Entirely manual. An admin eyeballs an uploaded receipt image and approves; license generation is the non-transactional loop described above. No payment-gateway verification, no idempotency on approve (double-approve is blocked only by the `status !== 'pending'` check at `:356-358`, which is itself not transaction-guarded).
- Safe modification: Make approve idempotent and transactional; consider a payment gateway or at least an audit log of admin actions.
- Test coverage: None.

**Circular-import risk: `auth.js` ↔ `notifications.js`:**
- Files: `server/modules/auth.js`, `server/modules/notifications.js`
- Why fragile: `notifications.js:3` imports `{ requireAuth, requireAdmin }` from `auth.js`. `auth.js` does not currently import `notifications.js`, so there is no cycle today — but if auth flows are ever extended to emit notifications (e.g. "new login" alerts) by importing `createNotification` from `notifications.js`, a circular ESM dependency would form. With native ESM this typically yields `undefined` named imports at module-init time rather than a clear error.
- Safe modification: If auth ever needs to notify, import `createNotification` lazily (dynamic `import()`) or extract the guards into a separate `middleware/auth.js` that both modules import.
- Test coverage: None.

---

## Test Coverage Gaps

**No automated tests anywhere, no CI:**
- What's not tested: Everything. There is no test runner (`jest`/`vitest`/`mocha`), no `*.test.*`/`*.spec.*` files, and no `test` script in `package.json` (only `dev`, `build`, `preview`, `backend`, `api`). No `.github/workflows` or other CI config exists.
- Files: repo-wide; `package.json:6-12`
- Risk: High-value, high-risk paths run with zero regression protection — license activation/check-in (`activate.js`, `check-in.js`), the money/order approval flow (`store.js`), JWT/HMAC verification (`auth.js`, `verifySignature.js`), and the download-token logic (`download.js`).
- Priority: High. Prioritize unit tests for `verifySignature.js`, `rateLimiter.js`, `genKey`/license generation, and the order-approval transaction; add integration tests for `/activate` and `/check-in`; add a CI workflow running typecheck + tests.

**Specific untested critical units:**
- `server/middleware/verifySignature.js` — signature/replay logic, no tests.
- `server/middleware/rateLimiter.js` — window/block math, no tests.
- `server/modules/activate.js` / `check-in.js` — device-cap, trial anti-abuse, token issuance, no tests.
- `server/modules/store.js` approval — license generation correctness, no tests.
- Risk: Silent regressions in licensing or billing.
- Priority: High.

---

## Dependencies at Risk

**`pg` (unused):**
- Risk: Declared (`package.json:49`) but never imported; the app uses `mysql2`.
- Impact: Dead dependency, misleading.
- Migration plan: Remove from `package.json`.

**`multer@1.4.5-lts.1`:**
- Risk: 1.x line is deprecated.
- Impact: Upload handling for receipts/icons/releases/attachments.
- Migration plan: Upgrade to multer 2.x; re-audit per-route size/MIME validation.

---

*Concerns audit: 2026-06-18*
