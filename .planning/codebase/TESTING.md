# Testing Patterns

**Analysis Date:** 2026-06-18

> **Honest status: there is NO automated testing in this repository.**
>
> Verified:
> - **No test runner** in `package.json` dependencies — no `jest`, `vitest`, `mocha`, `ava`, `node:test` usage, no `@testing-library/*`, no `playwright`/`cypress`.
> - **No test files** — `git ls-files` matching `*.test.*` / `*.spec.*` returns nothing across the whole repo.
> - **No `test` npm script** — `package.json` scripts are only `dev`, `build`, `preview`, `backend`, `api`.
> - **No coverage tooling**, no CI test workflow.
>
> Everything below describes what *currently* substitutes for tests and what *would* be needed to introduce them. Do not assume any test infrastructure exists.

## Test Framework

**Runner:** None.

**Assertion Library:** None.

**Run Commands:** None. The only scripts are:

```bash
npm run dev        # vite          — frontend dev server (port 80)
npm run build      # vite build    — production frontend bundle → dist/
npm run preview    # vite preview  — preview the built bundle
npm run backend    # node server/index.js — Express + Socket.IO API
npm run api        # node server/index.js — alias of backend
```

## What Exists Instead of Tests

Validation today is **entirely manual / runtime**, via four mechanisms:

**1. `npm run build` as a type/compile gate.**
TypeScript (`tsconfig.json`, `noEmit: true`) gives compile-time checking for the frontend; `vite build` will fail on type errors. This is the closest thing to an automated check. The backend is plain JS (no type checking).

**2. Manual DB inspection script — `scripts/check-db.js`.**
Run directly with Node (not wired to npm):

```bash
node scripts/check-db.js
```

It connects via the shared `query()` helper (`server/db.js`) and prints the state of core tables (users, apps, licenses) with Vietnamese, emoji-tagged console output (`✓`, `⚠️`). Used to confirm the DB is reachable and seeded before manual testing — a smoke check, not an assertion suite.

**3. Sample-data seeding — `scripts/seed-sample-data.js`.**
Run directly with Node:

```bash
node scripts/seed-sample-data.js
```

Populates the database so flows (login, store, licenses) can be exercised by hand against a running `npm run backend` + `npm run dev`.

**4. A manual verification checklist — `docs/FLOW_VERIFICATION.md`.**
A Vietnamese document that maps each required flow (Admin license management, User register/login/renew, Client activation) to the implementing module and endpoint, with hand-ticked `[x]` checkboxes per requirement (e.g. it enumerates `server/modules/admin.js` endpoints and confirms the `XXXX-XXXX-XXXX` key-generation logic). This is **documentation of intended behavior reviewed manually**, not executable tests.

## How a Developer Currently Validates a Change

There is no harness, so the practical loop is manual:

1. `npm run build` to catch frontend TypeScript/compile errors.
2. Start the backend: `npm run backend` (requires a reachable MySQL and an RSA keypair in `keys/` — the server `process.exit(1)`s on startup without the private key, see `server/config/keys.js`).
3. Seed/inspect data: `node scripts/seed-sample-data.js`, then `node scripts/check-db.js`.
4. Start the frontend: `npm run dev` and click through admin/user/store flows in the browser.
5. Read backend `console.log`/`console.error` and `morgan('combined')` HTTP logs to confirm behavior and diagnose failures.
6. For desktop-client licensing endpoints (`/activate`, `/check-in`, `/version`, `/download`), exercise them with a manual HTTP client (signed with the HMAC `X-Request-Signature`/`X-Request-Timestamp` headers) per `docs/FLOW_VERIFICATION.md`.
7. Cross-check against the checklists in `docs/FLOW_VERIFICATION.md`.

## Test File Organization

Not applicable — no test files exist. If introduced, the conventions in CONVENTIONS.md (PascalCase components, kebab-case server modules) imply co-located tests would read naturally as `*.test.ts(x)` / `*.test.js` next to the file under test, or a top-level `tests/` mirror of `server/modules/` and `components/`.

## Mocking

Not applicable — no mocking framework or fixtures exist. Note for future work: backend handlers import the live `query()` from `server/db.js` directly (no dependency injection, no repository layer), so unit-testing a handler in isolation would require either module mocking (e.g. `vi.mock('../db.js')`) or a real/throwaway test database.

## Fixtures and Factories

The only test-data tooling is the imperative seeder `scripts/seed-sample-data.js`. There are no reusable factory/fixture helpers.

## Coverage

**Requirements:** None enforced. No coverage tooling installed or configured.

## Test Types

- **Unit tests:** None.
- **Integration tests:** None (the manual flow runs through a real stack instead).
- **E2E tests:** None (browser flows are walked through by hand).

## Recommended Path to Introduce Automated Testing

Given the stack — Node ESM + Express 4 backend, React 19 + Vite 6 + TypeScript frontend — the lowest-friction setup is:

**1. Frontend + shared TS — Vitest.**
- Already aligned with Vite/TS; native ESM, fast, Jest-compatible API. Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- Add script: `"test": "vitest"` (and `"test:run": "vitest run"` for CI).
- First targets (pure, high-value, no DB): `services/api.ts` (`decodeToken`, `getCurrentUser` expiry handling, `getAssetUrl`, the `apiCall` error-throw contract with a mocked `fetch`), `lib/utils.ts` `cn()`, and `components/ui/*` primitive rendering/variants.

**2. Backend — Vitest (single runner for the repo) or Node's built-in `node:test`.**
- Vitest keeps one toolchain; `node --test` needs zero deps and runs ESM natively.
- Pure-logic targets first: the license key generator (`XXXX-XXXX-XXXX`), `signUserToken`/JWT helpers, the HMAC signature logic in `server/middleware/verifySignature.js`, and the rate limiter in `server/middleware/rateLimiter.js`.
- For route handlers: `supertest` against the `express` app, with `query()` (`server/db.js`) either mocked or pointed at a disposable MySQL schema. Because handlers inline SQL and import `db.js` directly, expect to either add a thin seam for injection or run against a real test DB.

**3. API-contract guardrails.**
The error shape (`{ error: '<snake_case_code>' }`) and HTTP-status conventions are an implicit contract between `services/api.ts` and `server/modules/*.js`. A small set of `supertest` integration tests asserting status + `error` code per endpoint would catch the highest-impact regressions first.

**4. CI.**
Add a workflow running `npm run build` (type gate) + `npm test`. There is currently no CI test stage.

---

*Testing analysis: 2026-06-18*
