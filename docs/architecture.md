# Architecture

## Overview

```
 Browser ──► Vite dev server :5180 ──/api proxy──► Express API :4000 ──► PostgreSQL :5432
 (React)        (production: one reverse proxy, same origin)    │
                                                               └──► Mailpit :1025 (dev email)
 Expo app (Phase 8) ─────────────── HTTPS ──────────────────────► same API
```

The web app and API are served from **one origin** (Vite proxy in development, a reverse proxy in
production). This keeps authentication cookies `SameSite=Strict` and avoids cross-site cookie issues.

## Monorepo

npm workspaces (`package.json` → `workspaces`):

| Workspace     | Package      | Role                                                                          |
| ------------- | ------------ | ----------------------------------------------------------------------------- |
| `apps/api`    | `@tigmi/api` | REST API                                                                      |
| `apps/web`    | `@tigmi/web` | React web app                                                                 |
| `apps/mobile` | —            | Expo app, created in Phase 8                                                  |
| `packages/*`  | —            | Shared Zod schemas/constants, created when first shared code exists (Phase 2) |

Root holds tooling shared by all workspaces: ESLint, Prettier, Playwright, Prisma (`prisma/`,
`prisma.config.js`) and Docker Compose. A single git-ignored `.env` at the root configures everything.

## API (`apps/api/src`)

```
server.js            process entry: validate env → logger → Prisma → listen → graceful shutdown
app.js               createApp({ env, prisma, logger }): middleware order + routers (no globals)
config/env.js        Zod schema for environment variables (fails fast, never prints values)
config/logger.js     Pino logger with redaction of credentials
config/database.js   Prisma client with the node-postgres driver adapter
middleware/          cross-cutting middleware (error handler, later auth/RBAC/validation)
modules/<name>/      one folder per feature: <name>.routes.js, .controller.js, .service.js, .schemas.js
utils/errors.js      AppError (status + stable code)
```

**Dependency injection by function arguments.** `createApp` receives `env`, `prisma` and `logger`;
modules receive what they need through factory functions. Tests build an app against the test
database (or an unreachable one) without mocking modules.

**Middleware order:** request id + logging → Helmet → CORS (allow-list) → JSON body (100 kB max)
→ `/api/v1` routers → 404 → error handler.

### Response format

```jsonc
// success
{ "data": { ... } }                       // lists will add "meta": { page, pageSize, total }
// error
{ "error": { "code": "NOT_FOUND", "message": "...", "details": [...], "requestId": "uuid" } }
```

`code` is stable and machine-readable; the web/mobile apps translate it (fr/ar). `requestId` is also
returned in the `X-Request-Id` header and appears in server logs, so a user-reported error can be traced.

### Endpoints so far

| Method | Path             | Auth | Response                                                                      |
| ------ | ---------------- | ---- | ----------------------------------------------------------------------------- |
| GET    | `/api/v1/health` | none | 200 `{status:"ok",database:"up"}` · 503 `{status:"degraded",database:"down"}` |

## Database

- PostgreSQL 17 (Docker). Databases: `tigmi` (development) and `tigmi_test` (integration + E2E tests,
  created by `docker/postgres/init/01-create-test-database.sql`).
- Prisma 7 with the **`prisma-client-js`** generator. Prisma 7's newer `prisma-client` generator
  emits TypeScript files, which this JavaScript-only project (and Jest without a build step) cannot
  load. `prisma-client-js` is marked "legacy"; migration path: switch when Node runs TypeScript
  natively and stably, or if Prisma 8 removes it.
- Prisma 7 needs a **driver adapter** (`@prisma/adapter-pg` + `pg`); the connection URL lives in
  `prisma.config.js`, not in `schema.prisma`.
- Conventions (from Phase 2): UUID primary keys, `Decimal(12,2)` for money (serialised as strings),
  `createdAt`/`updatedAt` on every table, explicit `onDelete` on every relation.

## Web (`apps/web/src`)

```
main.jsx           entry: providers + App
app/               App shell and providers (TanStack Query)
lib/api-client.js  fetch wrapper: /api/v1 prefix, cookies, ApiError { status, code, requestId }
features/<name>/   feature folders (components, API calls, tests side by side)
test/setup.js      Vitest + Testing Library setup
```

- Server state lives in **TanStack Query** (caching, retries, refetch). No global store needed yet.
- Tailwind 4 tokens in `index.css` (`@theme`); full design system in Phase 3. UI strings are French
  for now and move into i18next (fr/ar) in Phase 3.

## Testing strategy

| Level       | Tool                     | Where                        | Database                       |
| ----------- | ------------------------ | ---------------------------- | ------------------------------ |
| Unit (API)  | Jest                     | `apps/api/tests/unit`        | none                           |
| Integration | Jest + Supertest         | `apps/api/tests/integration` | real `tigmi_test`              |
| Component   | Vitest + Testing Library | `apps/web/src/**/*.test.jsx` | none (fetch stubbed)           |
| End-to-end  | Playwright (+ axe-core)  | `e2e/`                       | real `tigmi_test` via real API |

- Jest runs native ES modules (`--experimental-vm-modules`, no Babel).
- The test helper **refuses any database whose name does not end in `_test`**.
- Jest global setup applies migrations to the test database before tests run.
- Playwright starts its own API (port 4100) and web server (port 5190) so it never collides with
  dev servers, and runs every test at **1366px desktop** and **390px phone**, including an
  automatic WCAG 2 A/AA scan and a horizontal-overflow check.

## Dependency policy

- Every version is pinned exactly (`.npmrc: save-exact=true`), `package-lock.json` committed, CI uses `npm ci`.
- New dependencies: newest **stable** version published **at least 14 days ago** (avoids pre-releases
  and freshly-compromised packages). Exception: official PostgreSQL patch images (security fixes).
- npm 11 blocks dependency install scripts by default; none are needed (Prisma client is generated
  by the root `postinstall`).
- GitHub Actions are pinned to commit SHAs.
- `NODE_ENV` is never set in `.env`: Vite reads that file, and `NODE_ENV=development` there made
  production builds ship development React (found and fixed in Phase 1; CI now checks the bundle).
