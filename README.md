# Tigmi

> Votre maison, intelligemment organisée. — _Your home, intelligently organized._

Tigmi is a bilingual (French / Arabic with full RTL) family home management platform: finances,
budgets, bills, shopping lists, tasks, calendar and home inventory, shared by a household.
It has a responsive web app, an Expo mobile app (Phase 8) and one shared REST API.

**Status:** Phase 2 — Authentication (API: register with email verification, login, sessions, logout, password reset). See [docs/roadmap.md](docs/roadmap.md).

## Stack

| Part        | Technology                                                         |
| ----------- | ------------------------------------------------------------------ |
| Web         | React 19, Vite 8, Tailwind CSS 4, TanStack Query (JavaScript only) |
| API         | Node.js 24, Express 5, Zod, Pino, Prisma 7, PostgreSQL 17          |
| Tests       | Jest + Supertest (API), Vitest + Testing Library (web), Playwright |
| Local infra | Docker Compose: PostgreSQL + Mailpit (fake email inbox)            |

## Requirements

- Node.js **24** (see `.nvmrc`) and npm 11
- Docker Desktop (running)
- Git

## First-time setup (Windows PowerShell)

Run these from the project folder (`C:\Users\hp\Desktop\Tigmi`):

```powershell
# 1. Create your local settings file, then open it and replace every "changeme"
#    with the same strong password (letters and digits only).
Copy-Item .env.example .env
notepad .env

# 2. Install dependencies (also generates the Prisma client)
npm ci

# 3. Start PostgreSQL and Mailpit; waits until both are healthy
npm run services:up

# 4. Apply database migrations
npm run db:deploy

# 5. Install the browser used by end-to-end tests (once)
npx playwright install chromium
```

Expected: step 3 ends with `Container tigmi-postgres-1  Healthy` and `Container tigmi-mailpit-1  Healthy`.

> Create `.env` with `Copy-Item` (or an editor), not `Set-Content`: Windows PowerShell 5.1 adds an
> invisible BOM character that can corrupt the first variable.

## Daily development

```powershell
npm run services:up   # if Docker services are not running
npm run dev           # API on http://localhost:4000, web on http://localhost:5180
```

Open http://localhost:5180 — the **État du système** card should show **API: Opérationnelle** and
**Base de données: Connectée**. Stop with `Ctrl+C`.

| URL                                 | What                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| http://localhost:5180               | Web app (calls the API through `/api`)                                |
| http://localhost:4000/api/v1/health | API health check (JSON)                                               |
| http://localhost:8025               | Mailpit inbox: every email the API sends in dev (verification, reset) |

## Scripts

| Command                          | What it does                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`                    | API + web with auto-reload                                                           |
| `npm run services:up/down`       | Start / stop Docker services (data is kept in a Docker volume)                       |
| `npm run db:migrate -- --name x` | Create + apply a migration after editing `schema.prisma`, then regenerate the client |
| `npm run db:deploy`              | Apply existing migrations                                                            |
| `npm run lint`                   | ESLint                                                                               |
| `npm run format`                 | Prettier (write); `format:check` to only check                                       |
| `npm test`                       | API unit + integration tests (real `tigmi_test` DB) + web tests                      |
| `npm run test:e2e`               | Playwright: real API + web, desktop 1366px and phone 390px                           |
| `npm run build`                  | Production build of the web app                                                      |
| `npm run audit`                  | Blocking audit of production dependencies; `audit:all` = all                         |
| `npm run check`                  | lint + format + tests + build + audit (run before every commit)                      |

## Project layout

```
apps/api      Express REST API (/api/v1)      apps/web   React web app
prisma/       schema + migrations            e2e/       Playwright tests
docker/       container init scripts         docs/      roadmap, architecture, security
```

More: [architecture](docs/architecture.md) · [security](docs/security.md) · [roadmap](docs/roadmap.md) · [API contract (OpenAPI)](apps/api/openapi.yaml)

## Troubleshooting

- **`Invalid environment configuration`** when starting the API: the message lists the variables to
  fix in `.env` (compare with `.env.example`).
- **Port already in use**: change `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` in `.env`
  (and the matching URLs).
- **Database shows "Indisponible"**: Docker is not running or services are stopped → `npm run services:up`.
- **Changed `POSTGRES_PASSWORD` after the first start?** Postgres keeps the original password in its
  volume. Reset local data with `docker compose down -v` (deletes all local data), then `npm run services:up`.
