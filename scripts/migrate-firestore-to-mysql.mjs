#!/usr/bin/env node
/**
 * GO PAY BD — Idempotent Firestore JSON -> MySQL Production Migration Script
 *
 * Usage:
 *   node scripts/migrate-firestore-to-mysql.mjs ./firebase-export/firestore-dump.json
 *
 * Expects .env configured with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 * - Safe to run multiple times (uses INSERT IGNORE / ON DUPLICATE KEY UPDATE).
 * - Preserves all original document IDs, user balances, deposits, withdrawals, orders,
 *   invoices, referrals, commissions, support tickets, logs, and platform settings.
 * - Marks migrated users without bcrypt password hashes with password_reset_required = 1
 *   because Firebase Auth does not export plaintext passwords.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('Usage: node scripts/migrate-firestore-to-mysql.mjs <path-to-firestore-export.json>');
  process.exit(1);
}

const resolvedDump = path.resolve(process.cwd(), dumpPath);
if (!fs.existsSync(resolvedDump)) {
  console.error(`File not found: ${resolvedDump}`);
  process.exit(1);
}

if (!process.env.DB_NAME || !process.env.DB_USER) {
  console.error('Missing DB_NAME or DB_USER in environment/.env.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(resolvedDump, 'utf8'));

function toPaisa(val) {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toNullablePaisa(val, fallbackVal) {
  if (val !== null && val !== undefined) {
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (fallbackVal !== null && fallbackVal !== undefined) {
    const n = Number(fallbackVal);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

function parseDateValue(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    const secs = val._seconds ?? val.seconds;
    if (typeof secs === 'number') {
      return new Date(secs * 1000);
    }
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMysqlDate(val) {
  const d = parseDateValue(val) || new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toNullableMysqlDate(val) {
  const d = parseDateValue(val);
  return d ? d.toISOString().slice(0, 19).replace('T', ' ') : null;
}

function toNullableMysqlDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  const d = parseDateValue(val);
  return d ? d.toISOString().slice(0, 10) : null;
}

function toJsonString(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}

function listOf(collectionName) {
  const col = raw[collectionName];
  if (!col) return [];
  if (Array.isArray(col)) return col;
  return Object.entries(col).map(([id, doc]) => ({ id, ...doc }));
}

function stringifySettingValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return JSON.stringify(val);
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    timezone: 'Z',
  });

  const stats = {};
  const count = (k) => {
    stats[k] = (stats[k] || 0) + 1;
  };

  let maxParsedInvoiceSeq = 1000;

  try {
    await conn.beginTransaction();

    // 1. Platform Settings (supports flat key/value docs AND nested 'global' doc)
    for (const doc of listOf('platform_settings')) {
      const explicitKey = doc.key || doc.setting_key;
      const hasExplicitValue =
        Object.prototype.hasOwnProperty.call(doc, 'value') ||
        Object.prototype.hasOwnProperty.call(doc, 'setting_value');

      if (doc.id === 'global' || (!explicitKey && !hasExplicitValue)) {
        for (const [k, v] of Object.entries(doc)) {
          if (['id', 'created_at', 'updated_at'].includes(k) || v === undefined) continue;
          await conn.execute(
            `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
             VALUES (?, ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [String(k), stringifySettingValue(v)]
          );
          count('platform_settings');
        }
      } else {
        const key = explicitKey || doc.id;
        const val = doc.value ?? doc.setting_value ?? '';
        if (!key) continue;
        await conn.execute(
          `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
           VALUES (?, ?, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [String(key), stringifySettingValue(val)]
        );
        count('platform_settings');
      }
    }

    // 2. Admin Roles, Admins, Security Vault
    for (const role of listOf('admin_roles')) {
      const roleId = Number(role.id);
      if (!Number.isFinite(roleId)) continue;
      await conn.execute(
        `INSERT IGNORE INTO admin_roles (id, slug, name, description, permissions_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          roleId,
          role.slug || `role_${roleId}`,
          role.name || 'Admin Role',
          role.description || '',
          toJsonString(role.permissions_json ?? role.permissions ?? [], '[]'),
          toMysqlDate(role.created_at),
        ]
      );
      count('admin_roles');
    }

    for (const adm of listOf('admins')) {
      if (!adm.id || !adm.email) continue;
      await conn.execute(
        `INSERT IGNORE INTO admins
           (id, admin_uid, full_name, email, password_hash, pin_hash, role_id, status,
            failed_attempts, locked_until, last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adm.id,
          adm.admin_uid || `ADM-${String(adm.id).slice(0, 6).toUpperCase()}`,
          adm.full_name || 'Administrator',
          String(adm.email).toLowerCase(),
          adm.password_hash || '',
          adm.pin_hash || null,
          Number(adm.role_id || 1),
          adm.status === 'suspended' ? 'suspended' : 'active',
          Number(adm.failed_attempts || 0),
          toNullableMysqlDate(adm.locked_until),
          toNullableMysqlDate(adm.last_login_at),
          toMysqlDate(adm.created_at),
          toMysqlDate(adm.updated_at),
        ]
      );
      count('admins');
    }

    for (const vault of listOf('admin_security_vault')) {
      if (!vault.id || !vault.passcode_salt || !vault.passcode_hash) continue;
      await conn.execute(
        `INSERT INTO admin_security_vault
           (id, passcode_salt, passcode_hash, failed_attempts, locked_until, updated_by_uid, updated_by_email, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           passcode_salt = VALUES(passcode_salt),
           passcode_hash = VALUES(passcode_hash),
           updated_by_uid = VALUES(updated_by_uid),
           updated_by_email = VALUES(updated_by_email)`,
        [
          vault.id,
          vault.passcode_salt,
          vault.passcode_hash,
          Number(vault.failed_attempts || 0),
          toNullableMysqlDate(vault.locked_until),
          vault.updated_by_uid || null,
          vault.updated_by_email || null,
          toMysqlDate(vault.updated_at),
        ]
      );
      count('admin_security_vault');
    }

    // 3. Payment Settings
    for (const ps of listOf('payment_settings')) {
      await conn.execute(
        `INSERT IGNORE INTO payment_settings
           (id, method_type, account_title, account_number, account_type, bank_name, branch_name, routing_number,
            instructions, min_deposit_paisa, max_deposit_paisa, is_active, withdrawal_enabled, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ps.id,
          ps.method_type || ps.method_name || 'bKash',
          ps.account_title || ps.account_holder_name || 'Official Account',
          ps.account_number || ps.receiving_number || '',
          ps.account_type || 'personal',
          ps.bank_name || null,
          ps.branch_name || null,
          ps.routing_number || null,
          ps.instructions || '',
          ps.min_deposit_paisa ?? toPaisa(ps.min_deposit ?? 100),
          ps.max_deposit_paisa ?? toPaisa(ps.max_deposit ?? 500000),
          ps.is_active === false || ps.is_active === 0 || ps.deposit_enabled === false ? 0 : 1,
          ps.withdrawal_enabled === false || ps.withdrawal_enabled === 0 ? 0 : 1,
          Number(ps.display_order || 0),
          toMysqlDate(ps.created_at),
          toMysqlDate(ps.updated_at),
        ]
      );
      count('payment_settings');
    }

    // 4. Catalog Products
    for (const prod of listOf('catalog_products')) {
      await conn.execute(
        `INSERT IGNORE INTO catalog_products
           (id, sku, name, category, description, price_paisa, commission_eligible, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prod.id,
          prod.sku || `SKU-${String(prod.id).slice(0, 8).toUpperCase()}`,
          prod.name || 'Service',
          prod.category || 'digital',
          prod.description || '',
          prod.price_paisa ?? toPaisa(prod.price ?? prod.unit_price ?? 0),
          prod.commission_eligible === false || prod.commission_eligible === 0 ? 0 : 1,
          prod.is_active === false || prod.is_active === 0 ? 0 : 1,
          toMysqlDate(prod.created_at),
          toMysqlDate(prod.updated_at),
        ]
      );
      count('catalog_products');
    }

    // 5. Users (preserve IDs, flag password_reset_required = 1 when no bcrypt hash present)
    for (const u of listOf('users')) {
      const hasBcrypt = typeof u.password_hash === 'string' && /^\$2[aby]\$/.test(u.password_hash);
      await conn.execute(
        `INSERT IGNORE INTO users
           (id, uid, full_name, username, email, phone, password_hash, password_reset_required,
            google_id, referral_code, referred_by, sponsor_username, status, role, preferred_language,
            avatar_url, address, city, notification_email, notification_inapp, admin_note,
            failed_attempts, locked_until, last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id,
          u.uid || `GPBD-${String(u.id).slice(0, 6).toUpperCase()}`,
          u.full_name || u.username || 'Member',
          String(u.username || u.email?.split('@')[0] || u.id).toLowerCase(),
          String(u.email || `${u.id}@migrated.local`).toLowerCase(),
          u.phone || '',
          hasBcrypt ? u.password_hash : null,
          hasBcrypt ? (u.password_reset_required ? 1 : 0) : 1,
          u.google_id || null,
          String(u.referral_code || String(u.id).slice(0, 8)).toUpperCase(),
          u.referred_by || null,
          u.sponsor_username || null,
          ['active', 'suspended', 'pending'].includes(u.status) ? u.status : 'active',
          u.role || 'user',
          u.preferred_language || 'en',
          u.avatar_url || null,
          u.address || '',
          u.city || '',
          u.notification_email === false ? 0 : 1,
          u.notification_inapp === false ? 0 : 1,
          u.admin_note || null,
          Number(u.failed_attempts || 0),
          toNullableMysqlDate(u.locked_until),
          toNullableMysqlDate(u.last_login_at),
          toMysqlDate(u.created_at),
          toMysqlDate(u.updated_at),
        ]
      );
      count('users');
    }

    // 6. Wallets (preserve exact balances in paisa)
    for (const w of listOf('wallets')) {
      const userId = w.user_id || w.id;
      await conn.execute(
        `INSERT INTO wallets
           (user_id, balance_paisa, locked_balance_paisa, total_deposited_paisa,
            total_withdrawn_paisa, total_commission_paisa, total_spent_paisa, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           balance_paisa = VALUES(balance_paisa),
           locked_balance_paisa = VALUES(locked_balance_paisa),
           total_deposited_paisa = VALUES(total_deposited_paisa),
           total_withdrawn_paisa = VALUES(total_withdrawn_paisa),
           total_commission_paisa = VALUES(total_commission_paisa),
           total_spent_paisa = VALUES(total_spent_paisa)`,
        [
          userId,
          w.balance_paisa ?? toPaisa(w.balance ?? w.available_balance ?? 0),
          w.locked_balance_paisa ?? toPaisa(w.locked_balance ?? w.pending_balance ?? w.pending_withdrawal ?? 0),
          w.total_deposited_paisa ?? toPaisa(w.total_deposited ?? w.total_deposits ?? 0),
          w.total_withdrawn_paisa ?? toPaisa(w.total_withdrawn ?? w.total_withdrawals ?? 0),
          w.total_commission_paisa ?? toPaisa(w.total_commission ?? w.total_earnings ?? 0),
          w.total_spent_paisa ?? toPaisa(w.total_spent ?? 0),
          toMysqlDate(w.updated_at),
        ]
      );
      count('wallets');
    }

    // 7. Public Referrals & Referrals
    for (const pr of listOf('public_referrals')) {
      await conn.execute(
        `INSERT IGNORE INTO public_referrals (referral_code, user_id, username, full_name, clicks, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(pr.referral_code || pr.id).toUpperCase(),
          pr.user_id,
          pr.username || '',
          pr.full_name || '',
          Number(pr.clicks || 0),
          toMysqlDate(pr.updated_at),
        ]
      );
      count('public_referrals');
    }

    for (const r of listOf('referrals')) {
      await conn.execute(
        `INSERT IGNORE INTO referrals (id, referrer_user_id, referred_user_id, level, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, r.referrer_user_id, r.referred_user_id, Number(r.level || 1), r.status || 'active', toMysqlDate(r.created_at)]
      );
      count('referrals');
    }

    // 8. Deposits + TrxID Locks
    for (const d of listOf('deposits')) {
      const trx = String(d.transaction_id || '').toUpperCase();
      await conn.execute(
        `INSERT IGNORE INTO deposits
           (id, deposit_uid, user_id, payment_method, payment_setting_id, account_type, amount_paisa,
            sender_number, receiver_number, transaction_id, screenshot_url, note, status, admin_note,
            processing_eta, reviewed_by, reviewed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id,
          d.deposit_uid || `DEP-${String(d.id).slice(0, 7)}`,
          d.user_id,
          d.payment_method || 'bKash',
          d.payment_setting_id || null,
          d.account_type || 'personal',
          d.amount_paisa ?? toPaisa(d.amount ?? 0),
          d.sender_number || '',
          d.receiver_number || d.receiving_number || '',
          trx,
          d.screenshot_url || d.screenshot_path || null,
          d.note || d.user_note || '',
          ['pending', 'processing', 'approved', 'rejected'].includes(d.status) ? d.status : 'pending',
          d.admin_note || d.rejection_reason || '',
          d.processing_eta || null,
          d.reviewed_by || null,
          toNullableMysqlDate(d.reviewed_at || d.processed_at),
          toMysqlDate(d.created_at),
          toMysqlDate(d.updated_at),
        ]
      );
      if (trx && d.status !== 'rejected') {
        await conn.execute(
          `INSERT IGNORE INTO deposit_transaction_locks (transaction_id, deposit_id, user_id, created_at)
           VALUES (?, ?, ?, ?)`,
          [trx, d.id, d.user_id, toMysqlDate(d.created_at)]
        );
      }
      count('deposits');
    }

    // 9. Payment Methods
    for (const pm of listOf('payment_methods')) {
      await conn.execute(
        `INSERT IGNORE INTO payment_methods
           (id, user_id, method_type, account_label, account_number, account_holder_name, account_type,
            bank_name, branch_name, routing_number, notes, is_default, verification_status, pin_hash,
            status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pm.id,
          pm.user_id,
          pm.method_type || pm.method_name || 'bKash',
          pm.account_label || 'Wallet',
          pm.account_number || '',
          pm.account_holder_name || '',
          pm.account_type || 'personal',
          pm.bank_name || null,
          pm.branch_name || null,
          pm.routing_number || null,
          pm.notes || null,
          pm.is_default ? 1 : 0,
          pm.verification_status || 'active',
          pm.pin_hash || null,
          ['active', 'inactive', 'deleted'].includes(pm.status) ? pm.status : 'active',
          toMysqlDate(pm.created_at),
          toMysqlDate(pm.updated_at),
        ]
      );
      count('payment_methods');
    }

    // 10. Withdrawals
    for (const w of listOf('withdrawals')) {
      await conn.execute(
        `INSERT IGNORE INTO withdrawals
           (id, withdrawal_uid, user_id, payment_method_id, payment_method, account_number,
            account_holder_name, account_type, amount_paisa, fee_paisa, net_amount_paisa, paid_amount_paisa,
            status, payout_reference, admin_note, reviewed_by, reviewed_at, paid_at, payment_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.id,
          w.withdrawal_uid || `WDR-${String(w.id).slice(0, 7)}`,
          w.user_id,
          w.payment_method_id || null,
          w.payment_method || 'bKash',
          w.account_number || '',
          w.account_holder_name || '',
          w.account_type || 'personal',
          w.amount_paisa ?? toPaisa(w.amount ?? 0),
          w.fee_paisa ?? toPaisa(w.fee ?? 0),
          w.net_amount_paisa ?? toPaisa(w.net_amount ?? 0),
          toNullablePaisa(w.paid_amount_paisa, w.paid_amount),
          ['pending', 'processing', 'approved', 'paid', 'rejected', 'cancelled'].includes(w.status) ? w.status : 'pending',
          w.payout_reference || w.payout_tx_id || '',
          w.admin_note || w.rejection_reason || '',
          w.reviewed_by || null,
          toNullableMysqlDate(w.reviewed_at),
          toNullableMysqlDate(w.paid_at),
          toNullableMysqlDateOnly(w.payment_date),
          toMysqlDate(w.created_at),
          toMysqlDate(w.updated_at),
        ]
      );
      count('withdrawals');
    }

    // 11. Orders & Invoices
    for (const o of listOf('orders')) {
      await conn.execute(
        `INSERT IGNORE INTO orders
           (id, order_uid, user_id, product_id, product_name, quantity, unit_price_paisa,
            subtotal_paisa, discount_paisa, fee_paisa, total_amount_paisa, payment_source, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.id,
          o.order_uid || o.order_number || `ORD-${String(o.id).slice(0, 7)}`,
          o.user_id,
          o.product_id || null,
          o.product_name || 'Service',
          Number(o.quantity || 1),
          o.unit_price_paisa ?? toPaisa(o.unit_price ?? 0),
          o.subtotal_paisa ?? toPaisa(o.subtotal ?? 0),
          o.discount_paisa ?? toPaisa(o.discount ?? 0),
          o.fee_paisa ?? toPaisa(o.fee ?? 0),
          o.total_amount_paisa ?? toPaisa(o.total_amount ?? o.total ?? 0),
          o.payment_source || 'wallet',
          ['pending', 'processing', 'completed', 'cancelled', 'refunded'].includes(o.status || o.order_status)
            ? o.status || o.order_status
            : 'completed',
          o.notes || o.admin_note || '',
          toMysqlDate(o.created_at),
          toMysqlDate(o.updated_at),
        ]
      );
      count('orders');
    }

    for (const inv of listOf('invoices')) {
      const invNumber = inv.invoice_number || `GPBD-INV-${String(inv.id).slice(0, 6).toUpperCase()}`;
      const match = String(invNumber).match(/(\d+)$/);
      if (match) {
        const parsedSeq = Number(match[1]);
        if (Number.isFinite(parsedSeq) && parsedSeq > maxParsedInvoiceSeq) {
          maxParsedInvoiceSeq = parsedSeq;
        }
      }
      const payStatus = ['paid', 'unpaid', 'refunded'].includes(inv.payment_status) ? inv.payment_status : 'paid';
      const invStatus = ['draft', 'issued', 'paid', 'void'].includes(inv.invoice_status)
        ? inv.invoice_status
        : payStatus === 'paid'
        ? 'paid'
        : 'issued';
      await conn.execute(
        `INSERT IGNORE INTO invoices
           (id, invoice_number, order_id, user_id, customer_name, customer_email, customer_phone,
            items_json, subtotal_paisa, discount_paisa, fee_paisa, tax_paisa, total_paisa,
            payment_status, invoice_status, issued_at, due_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.id,
          invNumber,
          inv.order_id,
          inv.user_id,
          inv.customer_name || '',
          inv.customer_email || '',
          inv.customer_phone || inv.customer_contact || '',
          typeof inv.items_json === 'string' ? inv.items_json : JSON.stringify(inv.items || []),
          inv.subtotal_paisa ?? toPaisa(inv.subtotal ?? 0),
          inv.discount_paisa ?? toPaisa(inv.discount ?? 0),
          inv.fee_paisa ?? toPaisa(inv.fee ?? 0),
          inv.tax_paisa ?? toPaisa(inv.tax ?? 0),
          inv.total_paisa ?? toPaisa(inv.total ?? 0),
          payStatus,
          invStatus,
          toMysqlDate(inv.issued_at || inv.invoice_date || inv.created_at),
          toNullableMysqlDateOnly(inv.due_date),
          inv.notes || '',
          toMysqlDate(inv.created_at),
          toMysqlDate(inv.updated_at),
        ]
      );
      count('invoices');
    }

    // 12. Commissions & Wallet Transactions
    for (const c of listOf('commissions')) {
      await conn.execute(
        `INSERT IGNORE INTO commissions
           (id, commission_uid, earner_user_id, source_user_id, order_id, level, rate_percent,
            base_amount_paisa, commission_amount_paisa, status, note, credited_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.commission_uid || `COM-${String(c.id).slice(0, 7)}`,
          c.earner_user_id,
          c.source_user_id || c.earner_user_id,
          c.order_id || null,
          Number(c.level || c.referral_level || 1),
          Number(c.rate_percent || c.rate_value || 0),
          c.base_amount_paisa ?? toPaisa(c.base_amount ?? c.order_amount ?? 0),
          c.commission_amount_paisa ?? toPaisa(c.commission_amount ?? 0),
          ['pending', 'approved', 'credited', 'reversed', 'cancelled'].includes(c.status) ? c.status : 'credited',
          c.note || c.admin_note || '',
          toNullableMysqlDate(c.credited_at),
          toMysqlDate(c.created_at),
          toMysqlDate(c.updated_at),
        ]
      );
      count('commissions');
    }

    for (const tx of listOf('wallet_transactions')) {
      await conn.execute(
        `INSERT IGNORE INTO wallet_transactions
           (id, tx_uid, user_id, type, direction, amount_paisa, balance_before_paisa, balance_after_paisa,
            reference_type, reference_id, payment_method, sender_number, receiver_number, description, status, created_by_admin_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id,
          tx.tx_uid || `TXN-${String(tx.id).slice(0, 8)}`,
          tx.user_id,
          tx.type || tx.tx_type || 'adjustment',
          tx.direction === 'debit' ? 'debit' : 'credit',
          tx.amount_paisa ?? toPaisa(tx.amount ?? 0),
          tx.balance_before_paisa ?? toPaisa(tx.balance_before ?? tx.previous_balance ?? 0),
          tx.balance_after_paisa ?? toPaisa(tx.balance_after ?? tx.new_balance ?? 0),
          tx.reference_type || null,
          tx.reference_id || null,
          tx.payment_method || null,
          tx.sender_number || null,
          tx.receiver_number || tx.receiving_number || null,
          tx.description || '',
          tx.status || 'completed',
          tx.created_by_admin_id || null,
          toMysqlDate(tx.created_at),
        ]
      );
      count('wallet_transactions');
    }

    // 13. Notifications, Support, Audit, Login & Contact Logs
    for (const n of listOf('notifications')) {
      await conn.execute(
        `INSERT IGNORE INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [n.id, n.user_id, n.type || 'system', n.title || 'Notification', n.message || '', n.link || null, n.is_read ? 1 : 0, toMysqlDate(n.created_at)]
      );
      count('notifications');
    }

    for (const an of listOf('admin_notifications')) {
      await conn.execute(
        `INSERT IGNORE INTO admin_notifications (id, type, title, message, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [an.id, an.type || 'system', an.title || 'Admin Alert', an.message || '', an.link || null, an.is_read ? 1 : 0, toMysqlDate(an.created_at)]
      );
      count('admin_notifications');
    }

    for (const t of listOf('support_tickets')) {
      await conn.execute(
        `INSERT IGNORE INTO support_tickets
           (id, ticket_uid, user_id, subject, category, priority, status, assigned_admin_id, internal_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          t.ticket_uid || `TKT-${String(t.id).slice(0, 7)}`,
          t.user_id,
          t.subject || 'Support Request',
          t.category || 'general',
          ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
          ['open', 'in_progress', 'answered', 'resolved', 'closed'].includes(t.status) ? t.status : 'open',
          t.assigned_admin_id || null,
          t.internal_note || null,
          toMysqlDate(t.created_at),
          toMysqlDate(t.updated_at),
        ]
      );
      count('support_tickets');
    }

    for (const m of listOf('support_messages')) {
      await conn.execute(
        `INSERT IGNORE INTO support_messages
           (id, ticket_id, sender_type, sender_id, sender_name, message, attachment_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.ticket_id,
          m.sender_type === 'admin' ? 'admin' : 'user',
          m.sender_id || '',
          m.sender_name || (m.sender_type === 'admin' ? 'Support Team' : 'Member'),
          m.message || '',
          m.attachment_url || null,
          toMysqlDate(m.created_at),
        ]
      );
      count('support_messages');
    }

    for (const al of listOf('audit_logs')) {
      await conn.execute(
        `INSERT IGNORE INTO audit_logs
           (id, actor_type, actor_id, actor_name, action, entity_type, entity_id, old_values, new_values, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          al.id,
          al.actor_type || 'system',
          al.actor_id || null,
          al.actor_name || 'System',
          al.action || 'migrated_event',
          al.entity_type || 'system',
          al.entity_id || null,
          toJsonString(al.old_values, null),
          toJsonString(al.new_values, null),
          al.ip_address || null,
          toMysqlDate(al.created_at),
        ]
      );
      count('audit_logs');
    }

    for (const ll of listOf('login_logs')) {
      await conn.execute(
        `INSERT IGNORE INTO login_logs
           (id, actor_type, actor_id, identifier, success, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ll.id,
          ll.actor_type === 'admin' ? 'admin' : 'user',
          ll.actor_id || null,
          ll.identifier || '',
          ll.success ? 1 : 0,
          ll.ip_address || null,
          ll.user_agent || null,
          toMysqlDate(ll.created_at),
        ]
      );
      count('login_logs');
    }

    for (const cm of listOf('contact_messages')) {
      await conn.execute(
        `INSERT IGNORE INTO contact_messages
           (id, name, email, phone, subject, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cm.id,
          cm.name || 'Visitor',
          cm.email || '',
          cm.phone || null,
          cm.subject || 'Contact Inquiry',
          cm.message || '',
          cm.status || 'new',
          toMysqlDate(cm.created_at),
        ]
      );
      count('contact_messages');
    }

    // 14. Sync invoice_seq counter so future generated GPBD-INV-XXXXXX numbers never collide
    const [maxDbRows] = await conn.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM invoices
       WHERE invoice_number REGEXP '[0-9]+$'`
    );
    const dbMaxSeq = Number(maxDbRows?.[0]?.max_seq || 0);
    const nextCounterFloor = Math.max(1000, maxParsedInvoiceSeq, Number.isFinite(dbMaxSeq) ? dbMaxSeq : 0);
    await conn.execute(
      `INSERT INTO counters (counter_key, current_value, updated_at)
       VALUES ('invoice_seq', ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE current_value = GREATEST(current_value, VALUES(current_value)), updated_at = UTC_TIMESTAMP()`,
      [nextCounterFloor]
    );
    stats.invoice_seq_floor = nextCounterFloor;

    await conn.commit();
    console.log('Migration complete! Summary of imported records:');
    console.table(stats);
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed and rolled back cleanly:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
