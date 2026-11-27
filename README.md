# GO PAY BD — Digital Wallet & Referral Ledger Platform

**Tagline:** Manage. Earn. Connect.  
**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Node.js + Express + MySQL

---

## Architecture Overview

- **Frontend:** React 19 SPA (`src/`) built with Vite (`dist/`)
- **Backend API & SSR/Static Server:** Express + TypeScript (`server.ts`, `server/`) bundled into `dist-server/server.mjs` and started via `app.cjs`
- **Database:** MySQL 8.0+ / MariaDB 10.6+ (`database/schema.sql`, `database/seed.sql`) with integer paisa accounting (`100 paisa = 1.00 BDT`), row-level wallet locking, and idempotent startup schema upgrades
- **Authentication & Security:**
  - `HttpOnly`, `Secure` (HTTPS/prod), `SameSite=lax` session cookies backed by MySQL `sessions`
  - Strict production CORS allowlist (`APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`) and multi-layer CSRF protection (`Origin`/`Referer` verification + custom header guard)
  - Role-based Admin Control Center (`/admin`) with database-persisted rotating password vault (`admin_security_vault`) and brute-force lockout protection
  - Protected deposit screenshot & support attachments (`/uploads/deposits/*`, `/uploads/support/*`) accessible only to authenticated admins or the owning user

---

## Environment Configuration

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

Key production requirements (`NODE_ENV=production`):
- `APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` (e.g. `https://gopaybd.store,https://www.gopaybd.store`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (MySQL must be reachable on startup in production)
- `SESSION_SECRET` (required, minimum 32 random characters; server refuses to boot without a persistent secret in production)
- `ADMIN_PASSWORD` (fallback admin login password if no rotated passcode exists in `admin_security_vault`)
- `COOKIE_SAME_SITE=lax`

---

## Local Development

```bash
npm install
npm run dev
```

Runs Express + Vite middleware on `http://localhost:3000`. In development without MySQL credentials configured, the server starts in standby mode (`/api/health` returns standby status). When `DB_NAME` & `DB_USER` are set, startup automatically initializes `database/schema.sql`, runs safe column upgrades, and seeds `database/seed.sql`.

---

## Production Build & Startup

> **Build Dependencies Note:** Tools like `esbuild`, `tailwindcss`, `autoprefixer`, and `typescript` live in `devDependencies` (while `vite` is in `dependencies`). Make sure dev/build dependencies are installed (`npm ci --include=dev` or `npm install --include=dev`) before running `npm run build` — a production-only `npm install --omit=dev` (or `NODE_ENV=production npm install`) will omit `esbuild` and cause the server bundle step to fail.

```bash
npm ci --include=dev
npm run build
npm start
```

- `npm run build` compiles `dist/` (Vite client) and `dist-server/server.mjs` (esbuild Express server).
- `npm start` executes `node app.cjs`, which boots `dist-server/server.mjs` (compatible with cPanel Phusion Passenger and standard Node.js process managers).

---

## Deployment & Migration Guides

- **cPanel Deployment:** [`CPANEL_DEPLOYMENT_GUIDE.md`](./CPANEL_DEPLOYMENT_GUIDE.md)
- **Firestore → MySQL Migration:** [`DATABASE_MIGRATION_GUIDE.md`](./DATABASE_MIGRATION_GUIDE.md)
- **Domain Cutover (Vercel → cPanel):** [`DOMAIN_MIGRATION_GUIDE.md`](./DOMAIN_MIGRATION_GUIDE.md)
