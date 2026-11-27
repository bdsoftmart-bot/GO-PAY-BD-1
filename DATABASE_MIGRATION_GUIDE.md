# GO PAY BD — Firestore to MySQL Data Migration Guide

This guide explains how to safely export your existing Firebase Firestore collections and import them into your new cPanel MySQL database with zero data loss.

---

## 1. Before You Begin
- **Keep your old Firebase project untouched** as a read-only backup until your cPanel production site is 100% verified.
- Complete **Steps 2 & 3** of `CPANEL_DEPLOYMENT_GUIDE.md` so all 28 MySQL tables already exist.
- Never commit exported JSON files or `serviceAccountKey.json` into Git (`.gitignore` already blocks them).

---

## 2. Export Data from Your Old Firestore Database
On your local machine (or temporary Node environment):
1. In Firebase Console → **Project Settings → Service Accounts** → click **Generate New Private Key** and save as `serviceAccountKey.json` in a temporary local folder (outside your deployed app).
2. Run this one-off export script using Node.js (`npm i firebase-admin` in that temporary folder):
   ```js
   import fs from 'fs';
   import admin from 'firebase-admin';

   const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
   const db = admin.firestore();

   const collections = [
     'platform_settings',
     'admin_roles',
     'admins',
     'admin_security_vault',
     'payment_settings',
     'catalog_products',
     'users',
     'wallets',
     'public_referrals',
     'referrals',
     'deposits',
     'payment_methods',
     'withdrawals',
     'orders',
     'invoices',
     'commissions',
     'wallet_transactions',
     'notifications',
     'admin_notifications',
     'support_tickets',
     'support_messages',
     'audit_logs',
     'login_logs',
     'contact_messages',
   ];

   const dump = {};
   for (const name of collections) {
     const snap = await db.collection(name).get();
     dump[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
     console.log(`Exported ${name}: ${dump[name].length} records`);
   }

   fs.writeFileSync('./firestore-dump.json', JSON.stringify(dump, null, 2));
   console.log('Saved firestore-dump.json');
   ```

---

## 3. Import Exported Data into cPanel MySQL
1. Upload `firestore-dump.json` securely via SFTP to `/home/YOUR_CPANEL_USER/gopaybd/firebase-export/firestore-dump.json`.
2. In cPanel **Terminal** inside your `gopaybd` folder (with `.env` configured), run:
   ```bash
   npm run migrate:firestore ./firebase-export/firestore-dump.json
   ```
3. The script runs inside a single MySQL transaction (`BEGIN` / `COMMIT` / `ROLLBACK`), preserves all original user IDs, wallet balances (in exact paisa), deposits, withdrawals, orders, invoices, referrals, commissions, support tickets, logs, and both flat and nested `platform_settings/global` entries, synchronizes the `invoice_seq` counter to prevent duplicate invoice numbers, and is **idempotent** (safe to re-run).
4. Once complete, **delete** `firebase-export/firestore-dump.json` and `serviceAccountKey.json` from the server.

---

## 4. Existing User Password Reactivation
Because Firebase Authentication never exports plaintext passwords:
- Migrated users are automatically marked with `password_reset_required = 1` in MySQL.
- Their **wallet balance, transaction history, deposits, withdrawals, and referrals are 100% preserved**.
- When an existing user tries to log in for the first time after migration, the app displays a friendly notice guiding them to reset their password (or an admin can set a temporary password directly inside **Admin Panel → Users → Inspect User → Edit Account**).
- All newly registered users authenticate natively with `bcryptjs` password hashes stored in MySQL.

---

## 5. Verify Data Integrity After Import
In **phpMyAdmin**, run a quick verification query:
```sql
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT ROUND(SUM(balance_paisa) / 100, 2) FROM wallets) AS total_wallet_bdt,
  (SELECT COUNT(*) FROM deposits) AS total_deposits,
  (SELECT COUNT(*) FROM withdrawals) AS total_withdrawals,
  (SELECT COUNT(*) FROM orders) AS total_orders;
```
Confirm the totals match your old Firebase records before switching DNS traffic.
