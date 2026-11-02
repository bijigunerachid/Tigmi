# Tigmi — Roadmap

> "Your home, intelligently organized."
> Bilingual (French / Arabic + RTL) family home management platform: web app, Android/iOS app, one shared API.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (with how it was verified)

---

## 0. Discovery — environment findings (2026-11-02)

| Tool    | Version found                           | Notes                                                 |
| ------- | --------------------------------------- | ----------------------------------------------------- |
| Node.js | 24.22.1 (LTS line)                      | Pinned via `.nvmrc` + `engines`                       |
| npm     | 11.21.0                                 | npm workspaces (no pnpm/yarn needed)                  |
| Git     | 2.47.1                                  | Repository not yet initialised                        |
| Docker  | 27.5.1, Compose v2.32.4, daemon running | Used for PostgreSQL, Mailpit, later production images |

Working folder `C:\Users\hp\Desktop\Tigmi` was empty → the repository root **is** this folder (the `darflow/` tree from the brief, renamed Tigmi, lives directly here).

---

## 1. Key technical decisions

| Area              | Decision                                                                                                                                            | Why                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Monorepo          | npm workspaces: `apps/web`, `apps/api`, `apps/mobile`, `packages/shared`, `packages/validation`                                                     | Built into npm; no extra tooling                                                                          |
| Shared validation | Zod schemas in `packages/validation`, used by API **and** web/mobile forms                                                                          | One source of truth for rules and error codes                                                             |
| API               | Express 5 (async errors handled natively), ES modules, `/api/v1`                                                                                    | Stable, simple, matches the brief                                                                         |
| ORM               | **Prisma 7.10.1 (stable)** — not 8.x, whose `latest` tag is still a release candidate                                                               | Stable-only rule                                                                                          |
| Database          | PostgreSQL 17 in Docker; separate `tigmi_test` database for integration tests                                                                       | Integration tests hit a real DB                                                                           |
| Money             | `Decimal(12,2)` in DB, serialised as **strings** in JSON, formatted with `Intl.NumberFormat`                                                        | No floating-point rounding errors                                                                         |
| IDs               | UUID v7-style `uuid()` primary keys                                                                                                                 | Not guessable, index-friendly                                                                             |
| Access token      | JWT, 15 min, kept **in memory** on web, SecureStore on mobile                                                                                       | Short-lived, not readable from storage by XSS                                                             |
| Refresh token     | Opaque random token, stored **hashed** in a `Session` row, rotated on every use, **reuse detection** revokes the whole session family               | Stolen tokens become useless quickly                                                                      |
| Web cookies       | Refresh token in `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`                                                                | JS can never read it                                                                                      |
| CSRF              | SameSite=Strict + double-submit CSRF token header on cookie-authenticated endpoints                                                                 | Defence in depth                                                                                          |
| Passwords         | Argon2id (OWASP parameters), breach-length rules, account lockout + rate limiting                                                                   | Brute-force protection                                                                                    |
| Authorization     | Permission map (`role → permissions[]`) + `requireHouseholdPermission('transactions:write')` middleware; household membership always loaded from DB | New roles = data change, not code rewrite                                                                 |
| Email             | **Mailpit** (local fake SMTP inbox in Docker) for development; real provider chosen before launch                                                   | No paid service needed yet                                                                                |
| Web UI            | React 19 + Vite + Tailwind 4 (logical properties `ms-/me-/ps-/pe-` for RTL) + Heroicons, own design-system components                               | No UI kit, per brief                                                                                      |
| i18n              | i18next, `fr` + `ar`, `dir`/`lang` set on `<html>`, Inter + Noto Sans Arabic                                                                        | RTL is first-class from Phase 3                                                                           |
| Tests — API       | Jest + Supertest (unit + integration against real Postgres)                                                                                         | Per brief                                                                                                 |
| Tests — web       | **Vitest** + React Testing Library                                                                                                                  | Jest-compatible API but native to Vite/ESM; Jest+Vite+ESM needs fragile transforms (documented deviation) |
| Tests — E2E       | **Playwright** (desktop 1366px + phone 390px projects, also used for screenshots)                                                                   | User journeys + layout checks                                                                             |
| Quality gates     | ESLint (flat config), Prettier, `npm audit`, GitHub Actions CI                                                                                      | Same checks locally and in CI                                                                             |
| Versions          | Every dependency pinned exactly (`save-exact=true` in `.npmrc`)                                                                                     | Reproducible installs                                                                                     |

Schema additions beyond the brief (needed for real behaviour): `Session` (refresh tokens/devices), `PasswordResetToken`, `EmailVerificationToken`, `BillPayment` (payment history), `EventAttendee` (assign events to members), `NotificationPreference`, `User.emailVerifiedAt`, `User.theme`.

---

## 2. Phases and steps

Each step = one branch, reviewed and merged by you before the next starts.

### Phase 1 — Foundation

- [x] `docs/roadmap` — this plan (bootstrap commit on `main`)
- [x] `feature/foundation` — npm workspaces, exact pins + 14-day version rule, ESLint/Prettier, Docker Compose (Postgres 17 + `tigmi_test` + Mailpit), Zod env validation + `.env.example`, Express 5 skeleton (`GET /api/v1/health` checks DB, error format, request ids, Helmet, CORS, log redaction, graceful shutdown), Prisma 7 configured (`prisma-client-js` + pg adapter; first migration arrives with the first models in `feature/auth-core`), Vite web app showing system status (loading/success/degraded/error), Jest + Vitest + Playwright (+ axe) wired with real tests, GitHub Actions CI, README + architecture + security docs

### Phase 2 — Authentication & households

- [x] `feature/auth-core` — `users`/`sessions`/`refresh_tokens`/`audit_logs` + first migration, shared `@tigmi/validation` package, register, login (Argon2id, generic errors, timing equalised, lockout), refresh rotation with reuse detection + multi-tab grace, logout, `GET /auth/me` with live session check, web cookies (HttpOnly/SameSite=Strict) + CSRF double-submit, mobile body tokens, per-route rate limits, audit log, OpenAPI spec
- [x] `feature/auth-email` — `user_tokens` table + migration; registration no longer reveals existing accounts (identical `202`, "account exists" email) and no longer signs in; sign-in requires a verified email; verify / resend / forgot / reset endpoints with single-use hashed tokens in URL fragments; reset revokes all sessions, verifies email, clears lockout and sends a "password changed" notice; per-account email cooldown; French + Arabic (RTL) HTML/text emails via nodemailer (Mailpit locally and in CI); OpenAPI updated
- [x] `feature/households` — `households` + `household_members` + migration; create/list/get/update/delete (delete requires the exact name); permission map + `can(permission)` middleware (404 for non-members, 403 for missing permission); member list, role changes and removal/leave with hierarchy rules, co-owners and a race-safe last-owner rule (row lock); ISO currency / IANA time zone validation; audit log; OpenAPI updated
- [ ] `feature/invitations` — invite by email, accept, expiry, single-use, no self-invite
- [ ] `feature/web-auth` — login/register/reset/accept-invite screens, session handling, household switcher (minimal styling)

### Phase 3 — Design system, layout, i18n/RTL, dashboard

- [ ] `feature/design-system` — tokens, fonts, all base components (Button … ConfirmDialog), reduced-motion
- [ ] `feature/app-shell-i18n` — collapsible sidebar, top bar, mobile bottom nav, fr/ar, RTL, language persistence
- [ ] `feature/dashboard` — `GET /households/:id/dashboard` aggregates + widgets + charts (fills in as modules land)

### Phase 4 — Finance

- [ ] `feature/categories-transactions` — system + custom categories, transactions CRUD, search/filter/sort/pagination, table/cards
- [ ] `feature/budgets` — monthly/category budgets computed from transactions (no duplicated data), alerts, month comparison
- [ ] `feature/bills` — bills, recurrence, payments history, overdue/upcoming
- [ ] `feature/finance-reports` — monthly/annual reports and analytics charts

### Phase 5 — Family organisation

- [ ] `feature/shopping` — lists, items, purchase flow, totals, completion %, mobile-first
- [ ] `feature/tasks` — tasks, assignment, priority/status, recurrence, weekly overview, stats
- [ ] `feature/calendar` — month/week/day views, events, attendees, birthdays/appointments

### Phase 6 — Inventory & settings

- [ ] `feature/inventory` — items by room, warranty, value, search/filter
- [ ] `feature/settings` — profile, password, language, theme, household settings, notification prefs, sessions/devices

### Phase 7 — Background work

- [ ] `feature/jobs` — job runner (pg-boss on the same Postgres, no Redis): bill reminders, overdue marking, recurring tasks/bills generation, invitation/token cleanup
- [ ] `feature/notifications` — in-app notifications + email notifications honouring preferences

### Phase 8 — Mobile (Expo)

- [ ] `feature/mobile-foundation` — Expo Router, SecureStore auth, API client, i18n + RTL
- [ ] `feature/mobile-core` — dashboard, transactions, shopping, tasks
- [ ] `feature/mobile-more` — bills, calendar, members, notifications (push), settings

### Phase 9 — Billing

- Not in scope unless you decide otherwise (see open decision B).

### Phase 10 — Production readiness

- [ ] `feature/production` — production Dockerfiles, reverse proxy/TLS notes, automated `pg_dump` backups + tested restore, OpenAPI/Swagger completeness, security review (OWASP ASVS), performance pass, deployment docs, CONTRIBUTING.md, "What's next" section

---

## 3. Open decisions (yours)

- ~~**A. Repository host**~~ — decided 2026-11-02: GitHub (`bijigunerachid/Tigmi`).
- ~~**B. Billing**~~ — decided 2026-11-02: no billing for now (recommended default accepted); revisit before launch.
- **C. Production email provider** — decide before Phase 10 (Mailpit covers development).

---

## 4. Verification log

| Step                 | Date       | How verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `feature/foundation` | 2026-11-02 | Clean `npm ci`; lint 0 problems; Prettier clean; API 16/16 (Jest, real `tigmi_test`); web 4/4 (Vitest); build OK (257 kB JS / 80 kB gzip, no dev React); prod audit 0 vulnerabilities; E2E 6/6 (Playwright, 1366px + 390px, axe WCAG A/AA clean, no horizontal overflow); `npm run dev` serves web + API via proxy; tests proven by breaking health service and 503 handling (each caused 1 failure)                                                                                                                                                                                                                                       |
| `feature/auth-core`  | 2026-11-02 | Clean `npm ci`; lint 0; Prettier clean; API 62/62 (Jest; 22 auth integration tests on real `tigmi_test`); web 4/4; build OK; prod audit 0 vulnerabilities (dev-only findings unchanged at 24, see security.md); E2E 7/7 + 1 intentional skip (new HTTP journey through the Vite proxy with a real cookie jar); `prisma migrate status` up to date; tests proven by disabling reuse detection, the CSRF check and the lockout (each caused 1 failure)                                                                                                                                                                                       |
| `feature/auth-email` | 2026-11-02 | Clean `npm ci`; lint 0; Prettier clean; API 84/84 (Jest; 18 new email-flow tests on real `tigmi_test` + real SMTP delivery to Mailpit with Arabic text); web 4/4; build OK; prod audit 0 vulnerabilities (dev-only findings unchanged at 24); E2E 7/7 + 1 intentional skip (journey now reads real emails from Mailpit: register → verify → login → refresh → logout → forgot → reset → login); migrations up to date; emails screenshotted fr/ar at 390px + 1366px (RTL logo and footer contrast fixed); tests proven by making links reusable, keeping sessions after reset, and re-introducing `409 EMAIL_TAKEN` (each caused failures) |
| `feature/households` | 2026-11-02 | `npm install` from the lockfile (local `npm ci` was blocked by a running dev server locking native files; CI runs `npm ci`); lint 0; Prettier clean; API 111/111 (27 new household tests incl. role × action matrix and a concurrency test); web 4/4; build OK; prod audit 0 vulnerabilities; E2E 8/8 + 2 intentional skips (new two-user household journey with real sign-ups); migrations up to date; tests proven by letting non-members in, disabling the rank rule, the last-owner rule, and the row lock (concurrency test failed 5/5 without the lock, passed 5/5 with it)                                                          |
