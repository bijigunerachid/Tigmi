# Security

Security is built in from the first commit. This file records what is in place, what is planned,
and every accepted risk with a review date.

## Platform (Phase 1)

| Area              | Measure                                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets           | Only in git-ignored `.env`; `.env.example` holds placeholders. Local DB password and JWT secret are random. CI generates a fresh JWT secret per run.                                               |
| Config validation | Zod validates all env vars at startup. Production rejects example passwords/secrets, non-HTTPS origins and `COOKIE_SECURE=false`. Error messages list variable **names only**, never values.       |
| Network exposure  | Docker ports bound to `127.0.0.1` (database not reachable from the LAN).                                                                                                                           |
| HTTP headers      | Helmet (CSP, `nosniff`, HSTS, frame protections, …); `X-Powered-By` removed.                                                                                                                       |
| CORS              | Explicit allow-list (`CORS_ORIGINS`), credentials only for listed origins.                                                                                                                         |
| Input             | JSON bodies capped at 100 kB; malformed JSON → `400 INVALID_JSON`. Every body validated by a shared Zod schema; **unknown fields are rejected** (no mass assignment, e.g. a self-assigned `role`). |
| Error handling    | Clients get a stable `code` + generic message; stack traces and internals only in server logs.                                                                                                     |
| Logging           | Pino redacts `Authorization`, cookies, `Set-Cookie`, CSRF header, and any `password`/`token` fields (tested). Incoming `X-Request-Id` accepted only if it matches `^[\w-]{8,64}$`.                 |
| Health endpoint   | Reveals only `up`/`down`; never versions, hostnames or error text. `Cache-Control: no-store`.                                                                                                      |
| Tests vs. data    | Test helpers refuse databases whose name does not end in `_test`.                                                                                                                                  |
| Supply chain      | Exact version pins + lockfile + `npm ci`; 14-day minimum package age; dependency install scripts not approved; GitHub Actions pinned to commit SHAs; CI permissions `contents: read`.              |
| Child processes   | Test setup runs the Prisma CLI via `node` directly (no shell).                                                                                                                                     |

## Authentication (Phase 2 — `feature/auth-core`)

| Threat                      | Defence                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen password database    | Argon2id (m=19 MiB, t=2, p=1 — OWASP). Hashes with older parameters are upgraded on next login.                                                                                                                                                                  |
| Weak passwords              | 12–128 characters, any Unicode (French/Arabic passphrases), must differ from the email. No forced character classes (NIST SP 800-63B).                                                                                                                           |
| Online guessing             | Per-IP rate limits (login 10/15 min, register 5/h, refresh 60/15 min, global 300/min) + account lock for 15 min after 5 consecutive failures (atomic counter).                                                                                                   |
| Account discovery via login | Same `401 INVALID_CREDENTIALS` for unknown email and wrong password; unknown emails still run one Argon2 verification so timing matches.                                                                                                                         |
| XSS stealing tokens         | Refresh token only in an `HttpOnly` cookie (path `/api/v1/auth`); access token lives 15 min and is kept in memory by the web app. A cookie-based refresh never returns the refresh token in the body.                                                            |
| CSRF                        | Cookies are `SameSite=Strict`; cookie-based `/auth/refresh` also requires `X-CSRF-Token` equal to the `tigmi_csrf` cookie (double-submit, constant-time compare). All other endpoints use the `Authorization` header, which browsers never attach automatically. |
| Stolen refresh token        | Stored only as SHA-256; rotated on every use (compare-and-swap, one winner). Re-use of a rotated token revokes the **whole session** and is audited (`auth.refresh_token_reuse`). 10 s grace → `409 REFRESH_IN_PROGRESS` for two tabs refreshing at once.        |
| Logout / lost device        | Sessions are checked in the database on **every** authenticated request, so logout and revocation take effect immediately (not after the 15-min token expiry). Sessions have an absolute 30-day lifetime that rotation never extends.                            |
| JWT attacks                 | HS256 only (`alg: none` and other algorithms rejected), issuer + audience + expiry verified, 32+ byte secret enforced at startup.                                                                                                                                |
| Data leaks in responses     | Users are serialised through an allow-list (`toPublicUser`) — password hash and lockout fields can never leak. Auth responses send `Cache-Control: no-store`.                                                                                                    |
| Forensics                   | Append-only `audit_logs`: register, login, failed login (reason), account locked, logout, token reuse — with IP, never with secrets.                                                                                                                             |

## Email flows (Phase 2 — `feature/auth-email`)

| Threat                                | Defence                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account discovery via register/forgot | `register`, `resend-verification` and `forgot-password` always answer `202 { status: "check_email" }`. Existing emails get an "account exists" notice instead of an error. Password is hashed on every register so timing matches; emails are sent off the request path. |
| Someone registers _your_ email        | Accounts cannot sign in until the email is verified (`403 EMAIL_NOT_VERIFIED`, only shown after a correct password). The real owner can reset the password from their inbox, which signs everyone else out.                                                              |
| Stolen / leaked email links           | Tokens are 256-bit random, stored only as SHA-256, single-use (compare-and-swap), short-lived (verify 24 h, reset 1 h); a new link invalidates the previous one; tokens travel in the URL **fragment** (`#token=`), never sent to servers or in `Referer`.               |
| Token confusion                       | Every token has a `purpose`; a reset token is rejected by `verify-email` and vice versa.                                                                                                                                                                                 |
| Account takeover via reset            | Reset revokes **all** sessions, clears lockout, and emails a "password changed" notice with a way back in. A rejected new password does not burn the link.                                                                                                               |
| Email bombing                         | At most one verification/reset email per account per minute + 5 requests/hour per IP.                                                                                                                                                                                    |
| HTML injection in emails              | Names are HTML-escaped; subjects are fixed strings (no header injection). Covered by a test with a hostile name.                                                                                                                                                         |
| SMTP outage                           | Never fails the user's request (logged); emails in flight are flushed on graceful shutdown. Durable retries arrive with the Phase 7 job queue.                                                                                                                           |
| Credentials in transit                | Production refuses to start without SMTP credentials and forces TLS (`requireTLS` or implicit TLS).                                                                                                                                                                      |

## Planned

- **feature/households:** server-side household membership + permission checks on every request.
- **feature/settings:** list/revoke sessions per device, "sign out everywhere", change password.
- **Phase 10:** OWASP ASVS review, TLS at the reverse proxy, JWT key rotation (`kid`), shared
  rate-limit store, backups encrypted at rest, restore drill.

## Dependency audit policy

- `npm run audit` (CI gate): `npm audit --omit=dev --audit-level=moderate` — anything shipped to
  users must have **zero** moderate+ vulnerabilities.
- `npm run audit:all` reports development tooling too; findings are reviewed and recorded below.

## Accepted risks

| Date       | Finding                                                                                                                           | Why accepted                                                                                                                                                                                | Review                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2026-11-02 | 21 moderate + 3 low via `minimatch` <11.0.1 (ReDoS), `glob` ≤14.0.1 (AbortSignal bypass), `deepmerge` 4.3.1 (prototype pollution) | Dev only (ESLint, Jest): process glob patterns and config written by us, never user input; not shipped. Fixes exist only in new majors released 2026-10-27+ (younger than our 14-day rule). | 2026-11-16: retry `overrides` or upgrade ESLint/Jest |
| 2026-11-02 | `ACCOUNT_LOCKED` reveals an account exists, and an attacker can lock a victim out for 15 min                                      | Standard trade-off of account lockout; lock is short and auto-expires, and per-IP rate limits slow mass locking. Password reset also lifts the lock.                                        | Phase 10 ASVS review                                 |
| 2026-11-02 | Rate limits are kept in memory                                                                                                    | Correct for a single API instance; counters reset on restart. Must move to a shared store (PostgreSQL) before running more than one instance.                                               | Phase 10 (before horizontal scaling)                 |
| 2026-11-02 | No breached-password check (e.g. Have I Been Pwned)                                                                               | Requires an external service call on registration; length policy + lockout cover the basics.                                                                                                | `feature/settings` (with change password)            |

### Resolved

| Date       | Finding                                               | Resolution                                                                               |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-11-02 | Registration answered `409 EMAIL_TAKEN` (enumeration) | `feature/auth-email`: identical `202` answers + "account exists" email; verified sign-in |
