# Security Summary

- **Strict Production CORS & Origin Verification**: Configured an explicit origin allowlist (`APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`) in `server/config/env.ts` and `server/middleware/auth.ts`. Untrusted origins no longer receive `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials`.
- **Multi-Layer CSRF & Cookie Protection**: Hardened `csrfProtection` so mutating API requests with an untrusted `Origin` or `Referer` are rejected with HTTP `403` even when `X-Requested-With` is present, and headerless cross-origin form POSTs without trusted origin headers are also blocked. Session cookies (`HttpOnly`, `Secure` in production/HTTPS, configurable `SameSite` defaulting to `lax`) are backed by persistent MySQL `sessions`.
- **Mandatory Production `SESSION_SECRET` & Fail-Fast DB Boot**: When `NODE_ENV=production`, the application throws immediately if `SESSION_SECRET` is unset, shorter than 32 characters, or uses a placeholder value, and exits cleanly (`process.exit(1)`) if MySQL is unconfigured or unreachable on startup. `/api/health` returns HTTP `503` whenever the database is unavailable in production or configured-but-unreachable in development.
- **Authenticated Sensitive File Access & Path Confinement**: Protected `/uploads/deposits/*` and `/uploads/support/*` behind active admin or DB-verified owning user authentication (`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`), while keeping path traversal confined inside the configured upload root.
- **cPanel Startup & Dependency Audit**: Updated `package.json` `"start"` to `"node app.cjs"`, verified `tsc --noEmit` and Vite + esbuild production compilation, and confirmed `0` known vulnerabilities across 377 packages via `bun audit`.

## PoC Verification

Verified against the compiled production artifacts (`dist/`, `dist-server/server.mjs`, `app.cjs`):

1. **Missing/Placeholder `SESSION_SECRET` Rejection**:
   - `NODE_ENV=production SESSION_SECRET="" node dist-server/server.mjs` -> exits with code `1` and clear configuration error.
   - `NODE_ENV=production SESSION_SECRET="replace_with_a_long_random_secret_123456" node dist-server/server.mjs` -> exits with code `1`.
2. **Production DB Fail-Fast via `app.cjs`**:
   - `NODE_ENV=production DB_NAME="" DB_USER="" node app.cjs` (with valid 64-char `SESSION_SECRET`) -> exits with code `1` without logging the session secret.
3. **CORS & CSRF Enforcement**:
   - `GET /api/health` with `Origin: https://evil.com` -> no `Access-Control-Allow-Origin` header returned.
   - `GET /api/health` with `Origin: https://gopaybd.store` -> exact `Access-Control-Allow-Origin: https://gopaybd.store` and `Access-Control-Allow-Credentials: true`.
   - `POST /api/public/contact` with `Origin: https://evil.com` + `X-Requested-With: XMLHttpRequest` -> HTTP `403`.
   - `POST /api/public/contact` with `Referer: https://evil.com/attack` + `X-Requested-With: XMLHttpRequest` -> HTTP `403`.
   - `POST /api/public/contact` with no `Origin`, `Referer`, or `X-Requested-With` -> HTTP `403`.
4. **Protected Upload & Health Guards**:
   - `GET /uploads/deposits/test.png` and `GET /uploads/support/test.png` unauthenticated -> HTTP `401`; traversal `..%2Fpackage.json` blocked.
   - `GET /api/unknown` -> JSON `404`.
   - `GET /api/health` with configured-but-unreachable MySQL -> HTTP `503` (`success: false`).
