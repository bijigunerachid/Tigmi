# Security

Security is built in from the first commit. This file records what is in place, what is planned,
and every accepted risk with a review date.

## In place (Phase 1)

| Area              | Measure                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets           | Only in git-ignored `.env`; `.env.example` holds placeholders. Local DB password is random.                                                                                                             |
| Config validation | Zod validates all env vars at startup; production rejects the example password and non-HTTPS origins. Error messages list variable **names only**, never values.                                        |
| Network exposure  | Docker ports bound to `127.0.0.1` (database not reachable from the LAN).                                                                                                                                |
| HTTP headers      | Helmet (CSP, `nosniff`, HSTS, frame protections, …); `X-Powered-By` removed.                                                                                                                            |
| CORS              | Explicit allow-list (`CORS_ORIGINS`), credentials only for listed origins.                                                                                                                              |
| Input limits      | JSON bodies capped at 100 kB; malformed JSON → `400 INVALID_JSON`.                                                                                                                                      |
| Error handling    | Clients get a stable `code` + generic message; stack traces and internals only in server logs.                                                                                                          |
| Logging           | Pino redacts `Authorization`, cookies, `Set-Cookie`, CSRF header, and any `password`/`token` fields. Incoming `X-Request-Id` accepted only if it matches `^[\w-]{8,64}$` (blocks log/header injection). |
| Health endpoint   | Reveals only `up`/`down`; never versions, hostnames or error text. `Cache-Control: no-store`.                                                                                                           |
| Tests vs. data    | Test helpers refuse databases whose name does not end in `_test`.                                                                                                                                       |
| Supply chain      | Exact version pins + lockfile + `npm ci`; 14-day minimum package age; dependency install scripts not approved; GitHub Actions pinned to commit SHAs; CI permissions `contents: read`.                   |
| Child processes   | Test setup runs the Prisma CLI via `node` directly (no shell).                                                                                                                                          |

## Planned (by phase)

- **Phase 2 (auth):** Argon2id hashing, short-lived JWT access tokens (memory only on web), opaque
  refresh tokens stored hashed with rotation + reuse detection, `HttpOnly; Secure; SameSite=Strict`
  cookies scoped to `/api/v1/auth`, CSRF double-submit token, rate limiting + account lockout,
  server-side household membership + permission checks on every request, audit log, email
  verification and password reset with single-use hashed tokens.
- **Phase 10:** OWASP ASVS review, TLS at the reverse proxy, backups encrypted at rest, restore drill.

## Dependency audit policy

- `npm run audit` (CI gate): `npm audit --omit=dev --audit-level=moderate` — anything shipped to
  users must have **zero** moderate+ vulnerabilities.
- `npm run audit:all` reports development tooling too; findings are reviewed and recorded below.

## Accepted risks

| Date       | Finding                                                                                                                           | Scope                  | Why accepted                                                                                                                                                                                                                     | Review                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-11-02 | 21 moderate + 3 low via `minimatch` <11.0.1 (ReDoS), `glob` ≤14.0.1 (AbortSignal bypass), `deepmerge` 4.3.1 (prototype pollution) | Dev only: ESLint, Jest | Only process glob patterns and config written by us, never user input; not shipped. Fixes exist only in new majors released 2026-10-27+ (younger than our 14-day rule) and forcing them into ESLint/Jest risks breaking tooling. | 2026-11-16: retry with `overrides` once fixes are ≥14 days old, or upgrade ESLint/Jest when they adopt them |
