# GO PAY BD — Safe Domain Migration Guide (Vercel → cPanel)

Follow these steps to switch your custom domain (e.g., `gopaybd.store`) from Vercel to cPanel with near-zero downtime and a clean rollback plan.

---

## 1. Keep Vercel Live as Your Rollback Safety Net
- **Do NOT delete your Vercel project or Firebase database** until your cPanel site has run smoothly for at least 7–14 days.
- First deploy and test GO PAY BD on a temporary staging subdomain on cPanel (e.g., `staging.gopaybd.store`), verifying `/api/health`, login, deposits, withdrawals, uploads, and `/admin`.

---

## 2. Lower DNS TTL 24 Hours Before Cutover
In your domain registrar or Cloudflare DNS panel:
- Lower the TTL on your root `@` (`A` / `CNAME`) and `www` records to **300 seconds (5 minutes)**. This makes the cutover propagate quickly and allows instant rollback if needed.

---

## 3. Add Your Domain in cPanel
1. In **cPanel → Domains**, confirm `gopaybd.store` is attached to your hosting account.
2. In **cPanel → Setup Node.js App**, assign your application URL to `gopaybd.store`, update `APP_URL=https://gopaybd.store`, `FRONTEND_URL=https://gopaybd.store`, `ALLOWED_ORIGINS=https://gopaybd.store,https://www.gopaybd.store`, and `COOKIE_SAME_SITE=lax`, then restart the app.
3. Note your cPanel server's **Shared/Dedicated IPv4 Address** (shown in the right sidebar of cPanel).

---

## 4. Point DNS to cPanel
In your DNS provider (Namecheap, GoDaddy, Cloudflare, etc.):
1. Update the `@` (root domain) **A Record** from Vercel's IP (`76.76.21.21`) to your **cPanel IPv4 Address**.
2. Update the `www` **CNAME** (or **A Record**) to point to `gopaybd.store` (or your cPanel IPv4 Address).
3. If using **Cloudflare**, set SSL/TLS mode to **Full (Strict)** once AutoSSL is issued on cPanel.

---

## 5. Issue SSL Certificate & Verify Cutover
1. Once DNS resolves to your cPanel IP (usually 5–30 minutes), open **cPanel → SSL/TLS Status** and click **Run AutoSSL**.
2. Visit:
   - `https://gopaybd.store/api/health` → verify `"database": "connected"`
   - `https://gopaybd.store/` → verify landing page & login
   - `https://gopaybd.store/admin` → verify Control Center login with your `ADMIN_PASSWORD`
3. If you enabled optional Google Sign-In, update **Authorized redirect URIs** in Google Cloud Console to:
   - `https://gopaybd.store/auth/google/callback`

---

## 6. Emergency Rollback Plan
If anything unexpected occurs during cutover:
1. Change the `@` A record back to `76.76.21.21` (Vercel) in your DNS panel.
2. Because TTL was set to 300 seconds and Vercel was not deleted, traffic safely reverts within minutes while you diagnose cPanel logs (`stderr.log`).
