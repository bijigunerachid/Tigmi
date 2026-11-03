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

| Workspace             | Package             | Role                                              |
| --------------------- | ------------------- | ------------------------------------------------- |
| `apps/api`            | `@tigmi/api`        | REST API                                          |
| `apps/web`            | `@tigmi/web`        | React web app                                     |
| `apps/mobile`         | —                   | Expo app, created in Phase 8                      |
| `packages/validation` | `@tigmi/validation` | Zod request schemas shared by API, web and mobile |

Root holds tooling shared by all workspaces: ESLint, Prettier, Playwright, Prisma (`prisma/`,
`prisma.config.js`) and Docker Compose. A single git-ignored `.env` at the root configures everything.

## API (`apps/api/src`)

```
server.js            process entry: validate env → logger → Prisma → listen → graceful shutdown
app.js               createApp({ env, prisma, logger, security }): middleware order + routers (no globals)
config/env.js        Zod schema for environment variables (fails fast, never prints values)
config/logger.js     Pino logger with redaction of credentials
config/database.js   Prisma client with the node-postgres driver adapter
config/security.js   token lifetimes, lockout, rate limits, cookie names (overridable in tests)
middleware/          authenticate (Bearer + live session check), household-access (membership +
                     permission), validateBody (Zod), rate-limit, errors
modules/<name>/      one folder per feature: <name>.routes.js, .controller.js, .service.js
modules/auth/        + password.js (Argon2id), tokens.js (JWT, opaque tokens), cookies.js
modules/audit/       audit.service.js: append-only audit log writer
modules/mail/        mail.service.js (SMTP, sent off the request path), templates.js (fr/ar, RTL)
modules/households/  permissions.js (RBAC map), household-lock.js, households + members services
modules/invitations/ invitations.service.js (invite, list, revoke, preview, accept), routes
modules/users/       users.serializer.js: the only public shape of a user
utils/errors.js      AppError (status + stable code + optional headers) and helpers
openapi.yaml         OpenAPI 3.1 description of every endpoint (kept in sync in each step)
```

**Dependency injection by function arguments.** `createApp` receives `env`, `prisma` and `logger`;
modules receive what they need through factory functions. Tests build an app against the test
database (or an unreachable one) without mocking modules.

**Middleware order:** request id + logging → Helmet → CORS (allow-list) → JSON body (100 kB max)
→ cookie parser → `/api/v1/health` → global rate limit → feature routers (route-level rate limit →
validation → authentication → controller) → 404 → error handler.

**Layers.** Routes wire middleware; controllers translate HTTP (cookies, status codes, web vs
mobile); services hold business rules and talk to Prisma. Shared request schemas live in
`packages/validation` (`@tigmi/validation`) so the web and mobile forms apply the same rules.

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

| Method | Path                               | Auth                                | Response                                                                                      |
| ------ | ---------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/health`                   | none                                | 200 `{status:"ok",database:"up"}` · 503 `{status:"degraded",database:"down"}`                 |
| POST   | `/api/v1/auth/register`            | none                                | 202 `check_email` (verification or "account exists" email)                                    |
| POST   | `/api/v1/auth/verify-email`        | emailed token                       | 204                                                                                           |
| POST   | `/api/v1/auth/resend-verification` | none                                | 202 `check_email`                                                                             |
| POST   | `/api/v1/auth/forgot-password`     | none                                | 202 `check_email`                                                                             |
| POST   | `/api/v1/auth/reset-password`      | emailed token                       | 204 (all sessions revoked)                                                                    |
| POST   | `/api/v1/auth/login`               | none                                | 200 user + access token (+ cookies on web / refresh token on mobile); 403 if email unverified |
| POST   | `/api/v1/auth/refresh`             | cookie + CSRF header, or body token | 200 rotated tokens                                                                            |
| POST   | `/api/v1/auth/logout`              | Bearer                              | 204                                                                                           |
| GET    | `/api/v1/auth/me`                  | Bearer                              | 200 user                                                                                      |

| POST | `/api/v1/households` | Bearer | 201 household (creator = OWNER) |
| GET | `/api/v1/households` | Bearer | 200 my households (`myRole`, `permissions`, `memberCount`) |
| GET/PATCH/DELETE | `/api/v1/households/:householdId` | Bearer + permission | 200 / 200 / 204 |
| GET | `/api/v1/households/:householdId/members` | Bearer + `members:read` | 200 members |
| PATCH/DELETE | `/api/v1/households/:householdId/members/:memberId` | Bearer + hierarchy | 200 / 204 |
| POST/GET | `/api/v1/households/:householdId/invitations` | Bearer + `members:invite` | 201 invitation (emailed) / 200 outstanding |
| DELETE | `/api/v1/households/:householdId/invitations/:invitationId` | Bearer + `members:invite` | 204 cancelled |
| POST | `/api/v1/invitations/preview` | emailed token | 200 household name, inviter, role |
| POST | `/api/v1/invitations/accept` | Bearer (invited email) + token | 200 household with new role |

Full contract: [`apps/api/openapi.yaml`](../apps/api/openapi.yaml).

### Household authorization (RBAC)

Every `/households/:householdId/...` route is guarded by
`can(PERMISSION)` (`middleware/household-access.js`):

1. the id in the URL is untrusted → the membership of the **authenticated** user is read from the
   database (never from the request body or token);
2. not a member (or malformed / unknown id) → `404 HOUSEHOLD_NOT_FOUND` — the API never confirms
   that someone else's household exists;
3. member without the permission → `403 FORBIDDEN`;
4. otherwise `req.household = { id, role, memberId }` and the controller runs.

Routes ask for **permissions**, never roles. The map lives in `modules/households/permissions.js`:

| Permission         | OWNER | ADMIN | MEMBER |
| ------------------ | :---: | :---: | :----: |
| `household:read`   |   ✓   |   ✓   |   ✓    |
| `household:update` |   ✓   |       |        |
| `household:delete` |   ✓   |       |        |
| `members:read`     |   ✓   |   ✓   |   ✓    |
| `members:manage`   |   ✓   |   ✓   |        |
| `members:invite`   |   ✓   |   ✓   |        |

On top of permissions, a **hierarchy rule** applies to changing or removing someone: owners may
manage anyone; everyone else only members ranked strictly below them, and may only assign lower
roles (an ADMIN manages MEMBERs but cannot create admins or touch owners). Anyone may leave.
Several owners are allowed (co-owners); the **last owner** can never be demoted, removed or leave.

Membership changes run in a transaction that first locks the household row
(`SELECT … FOR UPDATE`) and re-reads the actor's role, so concurrent changes are serialised and
stale roles cannot be used (tested: two owners demoting each other at once always leaves one owner).

Later modules add their permissions (e.g. `transactions:write`) to the same map.

### Invitations

```
OWNER/ADMIN ── POST invitations {email, role} ──► invitations row (token SHA-256, 7 days)
                                              └─► email: /invitations/accept#token=…
invitee ── POST /invitations/preview {token} ──► "Amina invites you to Dar Benali" (no account needed)
        ── sign up with that email + verify ──► login
        ── POST /invitations/accept {token} ──► membership with the invited role
```

Accept requires the signed-in account's email to equal the invited address; sign-in requires
a verified email, so this proves inbox ownership. Invites, cancellations and accepts lock the
household row like member changes do (member cap and single use stay consistent).

### Authentication flow

```
register ──► user (unverified) + email link /verify-email#token=… (token SHA-256 in user_tokens)
verify-email ──► email verified ──► login allowed

login ──► session row (1 per device, 30-day absolute expiry)
      ──► access JWT (15 min, HS256, claims sub + sid)
      ──► refresh token (random 256-bit; DB stores SHA-256)
                     web: HttpOnly cookie tigmi_rt (path /api/v1/auth) + readable tigmi_csrf
                     mobile (X-Client-Type: mobile): in the body → Expo SecureStore

every request ──► Bearer JWT verified ──► session loaded: active? ──► req.auth

forgot-password ──► email link /reset-password#token=… (1 h, single use)
reset-password ──► new hash, email verified, lockout cleared, ALL sessions revoked

refresh ──► token found & unused ──► mark used (compare-and-swap) + issue new one
        └─► token already used: <10 s ago → 409 retry · older → revoke whole session (theft)
```

## Database

- PostgreSQL 17 (Docker). Databases: `tigmi` (development) and `tigmi_test` (integration + E2E tests,
  created by `docker/postgres/init/01-create-test-database.sql`).
- Prisma 7 with the **`prisma-client-js`** generator. Prisma 7's newer `prisma-client` generator
  emits TypeScript files, which this JavaScript-only project (and Jest without a build step) cannot
  load. `prisma-client-js` is marked "legacy"; migration path: switch when Node runs TypeScript
  natively and stably, or if Prisma 8 removes it.
- Interactive transactions use explicit limits (`config/database.js`: wait 5 s, run 10 s).
  Prefer single atomic statements (nested writes) where possible: registration used to hold a
  transaction open across round trips and hit Prisma's 5 s default under load (`P2028`).
- Prisma 7 needs a **driver adapter** (`@prisma/adapter-pg` + `pg`); the connection URL lives in
  `prisma.config.js`, not in `schema.prisma`.
- Migrations: `npm run db:migrate -- --name <change>` runs `prisma migrate dev`, then the
  `postdb:migrate` hook runs `prisma generate` (Prisma 7's `migrate dev` no longer regenerates the
  client itself). Never chain extra commands inside `db:migrate`: npm appends `-- args` to the
  last command, so `--name` would go to the wrong one (found the hard way in Phase 2).
- Tables so far: `users`, `sessions`, `refresh_tokens`, `user_tokens`, `households`,
  `household_members`, `invitations`, `audit_logs` (snake_case names via `@map`).
- Conventions: UUIDv7 primary keys (time-ordered, index-friendly), `timestamptz` columns, `Decimal(12,2)` for money (serialised as strings),
  `createdAt`/`updatedAt` on every table, explicit `onDelete` on every relation.

## Web (`apps/web/src`)

```
main.jsx              entry: i18n + providers + App
app/App.jsx           route tree (React Router 8): guest pages, emailed-link pages, signed-in pages
app/providers.jsx     TanStack Query + AuthProvider
lib/api-client.js     fetch wrapper + session: in-memory access token, single-flight refresh, retry
lib/i18n.js           i18next (fr now, ar in Phase 3), errorMessage() / validationMessage()
lib/forms.js          maps API VALIDATION_ERROR details onto react-hook-form fields
lib/safe-redirect.js  ?next= only accepts in-app paths (no open redirect)
hooks/useLinkToken.js reads #token= from emailed links, then removes it from the address bar
components/ui/        design system (see docs/design-system.md)
dev/UiGallery.jsx     component gallery at /dev/ui — development builds only
components/layout/    AuthLayout (centered card), AppLayout (top bar, sign out)
features/auth/        AuthProvider, guards, login/register/check-email/verify/forgot/reset pages
features/households/  households list + create, household page (members, invite, pending)
features/invitations/ accept-invitation page (preview, sign in/up, accept)
locales/fr/           translation.json (every string + every API/validation code)
test/                 setup + render helpers (real routes in StrictMode, fake API)
```

### Routes

| Path                                                                        | Who                                         | Page                  |
| --------------------------------------------------------------------------- | ------------------------------------------- | --------------------- |
| `/login`, `/register`, `/check-email`, `/forgot-password`                   | signed out (signed-in users are redirected) | auth forms            |
| `/verify-email#token`, `/reset-password#token`, `/invitations/accept#token` | anyone                                      | emailed links         |
| `/`, `/households/:id`                                                      | signed in (others go to `/login?next=…`)    | households            |
| `/status`                                                                   | anyone                                      | API / database status |

### Session in the browser

- The **access token** lives only in a module variable (never localStorage, never a readable
  cookie); a reload loses it on purpose.
- On page load, `AuthProvider` calls `refreshSession()`: `POST /auth/refresh` with the HttpOnly
  cookie + `X-CSRF-Token` (read from the `tigmi_csrf` cookie). No CSRF cookie means no call.
- `apiRequest()` adds `Authorization`; on `401 INVALID_ACCESS_TOKEN` it refreshes **once** and
  retries. Concurrent callers share **one** refresh (single-flight) so the server never sees a
  rotated token reused; `409 REFRESH_IN_PROGRESS` (another tab) is retried with back-off.
  `SESSION_REVOKED` ends the session without refreshing.
- Signing out clears the query cache and notifies other tabs (`BroadcastChannel`).
- Pitfall found in this step: `x ??= (async () => { try {…} finally { x = null } })()` caches a
  settled promise forever when the async body returns before its first `await`; use
  `.finally()` on the promise instead (regression test in `lib/api-client.test.js`).

### App shell and languages

- `AuthLayout`: brand panel + form on desktop, compact header on phones, language switch on
  every page. `AppLayout`: collapsible sidebar on desktop (state remembered), frosted top bar
  and floating bottom bar on phones. Every entry points to a real page (households, each
  household, last opened household); the account menu holds language and sign-out.
- Languages: French and Arabic (`locales/fr`, `locales/ar`, same keys — a test fails if one
  is missing or a `{{placeholder}}` differs). Choice order: saved choice on this device →
  browser language → French; after sign-in the account language applies unless the device
  has an explicit choice. Accounts are created in the language shown when submitting the
  sign-up form (so emails match). Numbers and dates use `fr-MA` / `ar-MA` (Latin digits).
- Saving the language to the account (`PATCH /users/me`) arrives with `feature/settings`.

### Forms, validation and text

- Forms use **react-hook-form** with the **same Zod schemas as the API** (`@tigmi/validation`),
  so rules match exactly; validation messages are codes translated by i18next.
- Every user-facing string and every API error code has a French translation; Arabic + RTL is a
  translation file and a switcher away (Phase 3). Components already use logical CSS properties
  (`ms-/me-/ps-/pe-/start/end`) and `rtl:` variants for directional icons.
- Server state lives in **TanStack Query**; client errors (4xx) are not retried, network/5xx are.
- Accessibility: real labels, `aria-invalid`/`aria-describedby` on fields, `role="alert"` for
  errors, focus moved to the page heading after navigation, skip link, 44px touch targets.

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
