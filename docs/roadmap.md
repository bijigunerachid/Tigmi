# Tigmi — Roadmap

> "Your home, intelligently organized."
> Bilingual (French / Arabic + RTL) family home management platform: web app, Android/iOS app, one shared API.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (with how it was verified)

---

## 0. Discovery — environment findings (2026-11-02)

| Tool | Version found | Notes |
|---|---|---|
| Node.js | 24.22.1 (LTS line) | Pinned via `.nvmrc` + `engines` |
| npm | 11.21.0 | npm workspaces (no pnpm/yarn needed) |
| Git | 2.47.1 | Repository not yet initialised |
| Docker | 27.5.1, Compose v2.32.4, daemon running | Used for PostgreSQL, Mailpit, later production images |

Working folder `C:\Users\hp\Desktop\Tigmi` was empty → the repository root **is** this folder (the `darflow/` tree from the brief, renamed Tigmi, lives directly here).

---

## 1. Key technical decisions

| Area | Decision | Why |
|---|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `apps/mobile`, `packages/shared`, `packages/validation` | Built into npm; no extra tooling |
| Shared validation | Zod schemas in `packages/validation`, used by API **and** web/mobile forms | One source of truth for rules and error codes |
| API | Express 5 (async errors handled natively), ES modules, `/api/v1` | Stable, simple, matches the brief |
| ORM | **Prisma 7.10.1 (stable)** — not 8.x, whose `latest` tag is still a release candidate | Stable-only rule |
| Database | PostgreSQL 17 in Docker; separate `tigmi_test` database for integration tests | Integration tests hit a real DB |
| Money | `Decimal(12,2)` in DB, serialised as **strings** in JSON, formatted with `Intl.NumberFormat` | No floating-point rounding errors |
| IDs | UUID v7-style `uuid()` primary keys | Not guessable, index-friendly |
| Access token | JWT, 15 min, kept **in memory** on web, SecureStore on mobile | Short-lived, not readable from storage by XSS |
| Refresh token | Opaque random token, stored **hashed** in a `Session` row, rotated on every use, **reuse detection** revokes the whole session family | Stolen tokens become useless quickly |
| Web cookies | Refresh token in `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth` | JS can never read it |
| CSRF | SameSite=Strict + double-submit CSRF token header on cookie-authenticated endpoints | Defence in depth |
| Passwords | Argon2id (OWASP parameters), breach-length rules, account lockout + rate limiting | Brute-force protection |
| Authorization | Permission map (`role → permissions[]`) + `requireHouseholdPermission('transactions:write')` middleware; household membership always loaded from DB | New roles = data change, not code rewrite |
| Email | **Mailpit** (local fake SMTP inbox in Docker) for development; real provider chosen before launch | No paid service needed yet |
| Web UI | React 19 + Vite + Tailwind 4 (logical properties `ms-/me-/ps-/pe-` for RTL) + Heroicons, own design-system components | No UI kit, per brief |
| i18n | i18next, `fr` + `ar`, `dir`/`lang` set on `<html>`, Inter + Noto Sans Arabic | RTL is first-class from Phase 3 |
| Tests — API | Jest + Supertest (unit + integration against real Postgres) | Per brief |
| Tests — web | **Vitest** + React Testing Library | Jest-compatible API but native to Vite/ESM; Jest+Vite+ESM needs fragile transforms (documented deviation) |
| Tests — E2E | **Playwright** (desktop 1366px + phone 390px projects, also used for screenshots) | User journeys + layout checks |
| Quality gates | ESLint (flat config), Prettier, `npm audit`, GitHub Actions CI | Same checks locally and in CI |
| Versions | Every dependency pinned exactly (`save-exact=true` in `.npmrc`) | Reproducible installs |

Schema additions beyond the brief (needed for real behaviour): `Session` (refresh tokens/devices), `PasswordResetToken`, `EmailVerificationToken`, `BillPayment` (payment history), `EventAttendee` (assign events to members), `NotificationPreference`, `User.emailVerifiedAt`, `User.theme`.

---

## 2. Phases and steps

Each step = one branch, reviewed and merged by you before the next starts.

### Phase 1 — Foundation
- [ ] `docs/roadmap` — this plan (bootstrap commit on `main`)
- [ ] `feature/foundation` — workspaces, `.npmrc`, `.nvmrc`, ESLint/Prettier, Docker Compose (Postgres + test DB + Mailpit), env validation (Zod) with `.env.example`, Express app skeleton (`/api/v1/health` checks DB), Prisma init + first migration, Vite web app showing API health, test runners wired (1 real test each), CI workflow, README + `docs/architecture.md` + `docs/security.md`

### Phase 2 — Authentication & households
- [ ] `feature/auth-core` — User/Session models, register, login, refresh rotation + reuse detection, logout, `GET /auth/me`, rate limiting, lockout, Helmet, CORS, CSRF, error format, audit log
- [ ] `feature/auth-email` — email verification, forgot/reset password (via Mailpit)
- [ ] `feature/households` — households CRUD, RBAC permission map + middleware, members list/role change/remove
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

- **A. Repository host** — GitHub (recommended, CI included) or other? Need the remote URL.
- **B. Billing** — Tigmi free / self-hosted (recommended for now, no billing code) vs paid subscriptions later (Stripe).
- **C. Production email provider** — decide before Phase 10 (Mailpit covers development).

---

## 4. Verification log

| Step | Date | How verified |
|---|---|---|
| — | — | — |
