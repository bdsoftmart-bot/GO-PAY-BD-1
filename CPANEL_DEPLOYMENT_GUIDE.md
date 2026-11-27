# GO PAY BD — cPanel Node.js + MySQL Production Deployment Guide

This beginner-friendly guide walks you through deploying **GO PAY BD** on cPanel hosting (Shared or VPS with **Setup Node.js App** and **MySQL Databases**), completely independent of Firebase and Vercel.

---

## Step 1: Verify cPanel Requirements
Before starting, confirm your cPanel account has:
- **Setup Node.js App** (Node.js **20.x** or **22.x** recommended)
- **MySQL Databases** + **phpMyAdmin**
- **SSL/TLS Status** (AutoSSL / Let's Encrypt)
- **File Manager** or **Git Version Control** / SSH access

---

## Step 2: Create the MySQL Database & User in cPanel
1. Log into **cPanel** → click **MySQL Databases**.
2. Under **Create New Database**, enter a name (e.g., `gopaybd_prod`) and click **Create Database**.
   - Note the full database name with your cPanel prefix, e.g. `cpaneluser_gopaybd_prod`.
3. Scroll to **MySQL Users → Add New User**:
   - Enter a username (e.g., `gopaybd_app`) and generate a strong password.
   - Save the full username (e.g., `cpaneluser_gopaybd_app`) and password securely.
4. Scroll to **Add User To Database**:
   - Select your new user and your new database → click **Add**.
   - Check **ALL PRIVILEGES** → click **Make Changes**.

---

## Step 3: Import the Database Schema & Seed
1. Open **cPanel → phpMyAdmin**.
2. Click your newly created database in the left sidebar.
3. Click the **Import** tab:
   - First upload and run `database/schema.sql`.
   - Next upload and run `database/seed.sql`.
4. Confirm 28 tables were created (`users`, `wallets`, `deposits`, `withdrawals`, `orders`, `invoices`, `platform_settings`, `sessions`, etc.).

> **Note:** Both `schema.sql` and `seed.sql` are safe to run again (`CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`) and will never delete or overwrite your data.

---

## Step 4: Upload Your Application Files
1. Create a folder outside `public_html` (recommended), for example: `/home/YOUR_CPANEL_USER/gopaybd`.
2. Upload the project files via **Git Version Control**, **SFTP**, or a `.zip` archive in **File Manager**:
   - Include: `server.ts`, `app.cjs`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/`, `server/`, `public/`, `database/`, `scripts/`.
   - **Do NOT upload** `node_modules/`, `.env`, `dist/`, or `uploads/`.

---

## Step 5: Configure the Node.js Application in cPanel
1. Go to **cPanel → Setup Node.js App** → click **Create Application**.
2. Fill in the fields:
   - **Node.js version**: `20.x` or `22.x`
   - **Application mode**: `Production`
   - **Application root**: `gopaybd` (path to the folder you uploaded)
   - **Application URL**: Select your domain (e.g., `gopaybd.store`)
   - **Application startup file**: `app.cjs`
3. Click **Create**.

---

## Step 6: Add Environment Variables in cPanel
In the **Setup Node.js App** page, scroll to **Environment variables** and add each variable (or create a `.env` file with `0600` permissions in your application root):

| Variable | Example Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://gopaybd.store` |
| `FRONTEND_URL` | `https://gopaybd.store` |
| `ALLOWED_ORIGINS` | `https://gopaybd.store,https://www.gopaybd.store` |
| `COOKIE_SAME_SITE` | `lax` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `cpaneluser_gopaybd_prod` |
| `DB_USER` | `cpaneluser_gopaybd_app` |
| `DB_PASSWORD` | `your_strong_mysql_password` |
| `SESSION_SECRET` | *(required: generate a 64-character random hex string via `openssl rand -hex 32`)* |
| `ADMIN_PASSWORD` | *(set your strong Admin Control Center password)* |
| `UPLOAD_DIR` | `uploads` |

> **Security Notes:**
> - **Persistent `SESSION_SECRET`:** In production (`NODE_ENV=production`), the server refuses to start if `SESSION_SECRET` is missing, shorter than 32 characters, or uses a placeholder value.
> - **Strict Origin Allowlist:** `ALLOWED_ORIGINS` / `APP_URL` / `FRONTEND_URL` control CORS and CSRF origin verification in production. Always include both `https://gopaybd.store` and `https://www.gopaybd.store` if both hostnames serve traffic.
> - **Protected Uploads:** Deposit screenshots (`/uploads/deposits/*`) and support attachments (`/uploads/support/*`) require an active authenticated owner or admin session; only profile avatars (`/uploads/avatars/*`) are public.
> - **Optional Google Sign-In:** Only if you want "Continue with Google" for regular users, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL=https://gopaybd.store/auth/google/callback`. Leave blank to use Email/Password only.

Click **Save** after adding environment variables.

---

## Step 7: Install Dependencies & Build for Production
> **Important cPanel Build Note:** Build tools such as `esbuild`, `tailwindcss`, `autoprefixer`, and `typescript` are listed under `devDependencies` in `package.json` (alongside `vite` in `dependencies`). When **Application mode** is set to `Production`, cPanel's **Run NPM Install** button sets `NODE_ENV=production` and skips `devDependencies`, which will cause `npm run build` (`vite build && npm run build:server`) to fail unless build dependencies are installed first.

1. Open cPanel **Terminal** (or SSH), activate the Node.js virtual environment shown at the top of **Setup Node.js App**, and install **all dependencies including `devDependencies`** before building:
   ```bash
   npm ci --include=dev
   ```
   *(Or use `npm install --include=dev` if `npm ci` is unavailable in your npm version.)*
2. Run the production build:
   ```bash
   npm run build
   ```
   This builds both the React frontend (`dist/`) and the production Express bundle (`dist-server/server.mjs`). Verify both `dist/index.html` and `dist-server/server.mjs` exist.
   *(Optional: after verifying the build succeeds, you can remove dev-only packages with `npm prune --omit=dev` — `npm start` / `app.cjs` only needs runtime dependencies to run `dist-server/server.mjs`.)*
3. Create the writable uploads directory:
   ```bash
   mkdir -p uploads/deposits uploads/support uploads/avatars
   chmod 755 uploads uploads/deposits uploads/support uploads/avatars
   ```
4. Return to **Setup Node.js App** (confirm **Application startup file** is `app.cjs`, matching `npm start` -> `node app.cjs`) and click **Restart**.

---

## Step 8: Enable HTTPS (AutoSSL)
1. Open **cPanel → SSL/TLS Status**.
2. Select your domain and click **Run AutoSSL**.
3. Wait until a green padlock appears for `gopaybd.store` and `www.gopaybd.store`.

---

## Step 9: Post-Deployment Verification Checklist
1. Open `https://gopaybd.store/api/health` — confirm HTTP `200` and JSON response shows `"status": "ok"` and `"database": "connected"`.
2. Open `https://gopaybd.store/` — verify landing page, language toggle (EN/বাংলা), and zero public hints to `/admin`.
3. Register a test user account → verify wallet balance, referral code, deposit submission + screenshot upload (and confirm unauthenticated requests to `/uploads/deposits/<file>` return `401`).
4. Open `https://gopaybd.store/admin` directly → unlock using your `ADMIN_PASSWORD` → verify pending deposit approval, balance/commission editor, and dynamic Security Deposit (`৳825` / `৳1,825`) controls under **Website Settings**.
5. Refresh deep routes (e.g., `/dashboard/wallet`, `/admin/users`) — verify SPA routing returns the app, and `/api/unknown` returns JSON `404`.

---

## Troubleshooting
- **Startup fails immediately in production**: Check `stderr.log` — confirm `SESSION_SECRET` is set (32+ chars), MySQL credentials (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) are valid, and `npm run build` created `dist/` and `dist-server/server.mjs`.
- **503 Service Unavailable on `/api/health` or `/api/*`**: Double-check `DB_HOST` (`localhost` or `127.0.0.1`), `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and ensure the MySQL user was granted **ALL PRIVILEGES** to the database.
- **403 Origin / CSRF Error on POST requests**: Confirm the browser URL matches one of `APP_URL`, `FRONTEND_URL`, or `ALLOWED_ORIGINS` (e.g. include both `https://gopaybd.store` and `https://www.gopaybd.store`).
- **Uploads not showing**: Confirm `UPLOAD_DIR=uploads` exists with `755` permissions and that your session cookie is active when viewing deposit screenshots or support attachments.
- **Session not persisting**: Ensure HTTPS is active (AutoSSL), `APP_URL` starts with `https://`, and `COOKIE_SAME_SITE=lax`.
