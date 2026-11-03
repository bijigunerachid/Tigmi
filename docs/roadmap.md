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
- [x] `feature/invitations` — `invitations` table + migration; invite by email (owners: ADMIN/MEMBER, admins: MEMBER), list, cancel; public preview; accept only by the invited (verified) address; single-use hashed tokens, 7-day expiry, re-invite replaces the link, per-address cooldown, member cap; French/Arabic invitation emails; names reject control characters; household lock shared with member changes; OpenAPI updated (accept takes the token in the body — documented deviation from `/invitations/:id/accept`)
- [x] `feature/web-auth` — React Router 8 + react-hook-form + shared Zod schemas; i18next introduced now (French; Arabic/RTL in Phase 3) so no screen is rewritten later; sign up, check email, verify, sign in (with "resend" for unverified accounts), forgot/reset password, accept invitation (preview, sign in/up and come back, wrong-account warning), households list/create, household page (members, invite, pending invitations with cancel), /status; in-memory access token with single-flight refresh, multi-tab sign-out, open-redirect protection, tokens removed from the address bar; base UI components with logical properties; `no-shadow` lint rule; test-only `RATE_LIMIT_SCALE` (refused in production)

### Phase 3 — Design system, layout, i18n/RTL, dashboard

- [x] `feature/design-system` — tokens (brief colours + semantic surfaces/lines/ink, radii, shadows, motion with reduced-motion, z-index scale), self-hosted Inter + Noto Sans Arabic (unicode-range subsets), components: Button/ButtonLink, Field/TextField/PasswordField/TextArea/DatePicker, SelectField, Card/CardHeader, Badge, Alert, Modal/Drawer/ConfirmDialog (native <dialog>), Dropdown, Tooltip, Tabs, DataTable (table + phone cards), Pagination, Toast, Skeleton, LoadingSpinner, EmptyState; existing pages moved onto them (confirm before cancelling an invitation, toasts); dev-only gallery at /dev/ui; Playwright now browses in fr-FR / Africa/Casablanca; docs/design-system.md; premium pass: brand mark, motion system (strong ease-out curves, press feedback, page transitions via View Transitions, staggered reveals, reduced-motion), glass navigation, rim light, two-panel sign-in, redesigned household screens with avatars
- [x] `feature/app-shell-i18n` — done together with the premium UI pass on the `feature/design-system` branch (at the product owner's request): collapsible sidebar, phone top + bottom bars, account menu, complete Arabic translation with RTL layout, language switch remembered per device and applied from the account, `ar-MA`/`fr-MA` formats, translation-completeness test
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

- [ ] `feature/production` — route-level code splitting (web bundle is 566 kB / 173 kB gzip since `feature/web-auth`; Vite warns above 500 kB), production Dockerfiles, reverse proxy/TLS notes, automated `pg_dump` backups + tested restore, OpenAPI/Swagger completeness, security review (OWASP ASVS), performance pass, deployment docs, CONTRIBUTING.md, "What's next" section

---

## 3. Open decisions (yours)

- **D. Feature proposals** — ten ideas in [`proposals.md`](proposals.md) (living home dashboard,
  shopping run mode, budget envelopes, fair chores, bill autopilot, Moroccan calendar, quick add,
  warranty vault, weekly recap, mobile widgets). None is built; approve or decline each.

- ~~**A. Repository host**~~ — decided 2026-11-02: GitHub (`bijigunerachid/Tigmi`).
- ~~**B. Billing**~~ — decided 2026-11-02: no billing for now (recommended default accepted); revisit before launch.
- **C. Production email provider** — decide before Phase 10 (Mailpit covers development).

---

## 4. Verification log

| Step                                                               | Date       | How verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `feature/foundation`                                               | 2026-11-02 | Clean `npm ci`; lint 0 problems; Prettier clean; API 16/16 (Jest, real `tigmi_test`); web 4/4 (Vitest); build OK (257 kB JS / 80 kB gzip, no dev React); prod audit 0 vulnerabilities; E2E 6/6 (Playwright, 1366px + 390px, axe WCAG A/AA clean, no horizontal overflow); `npm run dev` serves web + API via proxy; tests proven by breaking health service and 503 handling (each caused 1 failure)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `feature/auth-core`                                                | 2026-11-02 | Clean `npm ci`; lint 0; Prettier clean; API 62/62 (Jest; 22 auth integration tests on real `tigmi_test`); web 4/4; build OK; prod audit 0 vulnerabilities (dev-only findings unchanged at 24, see security.md); E2E 7/7 + 1 intentional skip (new HTTP journey through the Vite proxy with a real cookie jar); `prisma migrate status` up to date; tests proven by disabling reuse detection, the CSRF check and the lockout (each caused 1 failure)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `feature/auth-email`                                               | 2026-11-02 | Clean `npm ci`; lint 0; Prettier clean; API 84/84 (Jest; 18 new email-flow tests on real `tigmi_test` + real SMTP delivery to Mailpit with Arabic text); web 4/4; build OK; prod audit 0 vulnerabilities (dev-only findings unchanged at 24); E2E 7/7 + 1 intentional skip (journey now reads real emails from Mailpit: register → verify → login → refresh → logout → forgot → reset → login); migrations up to date; emails screenshotted fr/ar at 390px + 1366px (RTL logo and footer contrast fixed); tests proven by making links reusable, keeping sessions after reset, and re-introducing `409 EMAIL_TAKEN` (each caused failures)                                                                                                                                                                                                                                                                         |
| `feature/households`                                               | 2026-11-02 | `npm install` from the lockfile (local `npm ci` was blocked by a running dev server locking native files; CI runs `npm ci`); lint 0; Prettier clean; API 111/111 (27 new household tests incl. role × action matrix and a concurrency test); web 4/4; build OK; prod audit 0 vulnerabilities; E2E 8/8 + 2 intentional skips (new two-user household journey with real sign-ups); migrations up to date; tests proven by letting non-members in, disabling the rank rule, the last-owner rule, and the row lock (concurrency test failed 5/5 without the lock, passed 5/5 with it)                                                                                                                                                                                                                                                                                                                                  |
| `feature/invitations`                                              | 2026-11-03 | Existing install matching the lockfile (dev server running locally; CI runs `npm ci`); lint 0; Prettier clean; API 134/134 (16 new invitation tests incl. simultaneous accepts, plus name-validation tests); web 4/4; build OK; prod audit 0 vulnerabilities; E2E 9/9 + 3 intentional skips (new journey: invite a person without an account → preview → sign up → verify → accept); migrations up to date; invitation emails screenshotted fr/ar at 390px + 1366px; tests proven by removing the email match, the single-use check, the role rule and the existing-member check                                                                                                                                                                                                                                                                                                                                   |
| `feature/web-auth`                                                 | 2026-11-03 | Existing install matching the lockfile (dev server running locally; CI runs `npm ci`); lint 0 (new `no-shadow` rule); Prettier clean; API 135/135; web 46/46 (Vitest: API client session logic, open-redirect guard, every auth and household page rendered through the real routes in StrictMode); build OK (566 kB JS, Vite size warning recorded for Phase 10); prod audit 0 vulnerabilities; E2E 15/15 + 3 intentional skips (new browser journeys at 1366px and 390px: sign up → verify from Mailpit → sign in → create household → invite; invitee without account signs up and joins; forgot/reset; reload keeps the session; axe WCAG A/AA and no sideways scroll on every page); screenshots reviewed; tests proven by reinstating the stale-refresh bug, accepting any redirect, leaving tokens in the URL and verifying twice                                                                           |
| `feature/design-system`                                            | 2026-11-03 | Existing install matching the lockfile (dev server running locally; CI runs `npm ci`); lint 0; Prettier clean; API 135/135; web 65/65 (19 new component tests: dialogs, menu, tabs incl. RTL, tooltip, table, pagination, toast, fields); build OK, gallery confirmed absent from the production bundle; prod audit 0 vulnerabilities; E2E 29/29 + 3 intentional skips (14 new real-browser design-system checks at 1366px and 390px: axe, no sideways scroll, fonts loaded, dialog focus containment and return, confirm starts on Cancel, drawer edge, keyboard menu/tabs, table/cards, toast region); screenshots reviewed (pagination label layout fixed); tests proven by removing Cancel-first focus, menu focus return, RTL tab direction and aria-sort                                                                                                                                                     |
| premium UI + `feature/app-shell-i18n` (on `feature/design-system`) | 2026-11-03 | Existing install matching the lockfile (dev server running locally; CI runs `npm ci`); lint 0; Prettier clean (local `.claude/` tooling ignored); API 135/135 (registration now one atomic write; transaction limits 5 s/10 s after a P2028 under load); web 72/72 (translation completeness + placeholders, Arabic plurals, RTL document switch, account language at submit time); build OK (604 kB JS / 185 kB gzip — splitting stays in Phase 10); prod audit 0; E2E 33/33 + 3 intentional skips (new Arabic journeys: RTL layout, Arabic email, sidebar on the right, axe, no sideways scroll; global warm-up); measured: endless aurora doubled E2E time → made static; screenshots fr/ar at 1366px and 390px reviewed (grid blowout, sidebar email overflow and toast/bottom-bar overlap fixed); tests proven by removing <html dir> sync, deleting an Arabic string and capturing the language at page load |
