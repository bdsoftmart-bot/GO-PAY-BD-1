import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, query, withTransaction } from '../database/pool';
import {
  ADMIN_COOKIE_NAME,
  adminLoginRateLimiter,
  clearSessionCookie,
  createDbSession,
  deleteDbSessionByRawToken,
  recordAuditLog,
  recordLoginLog,
  requireAdmin,
  requirePermission,
  resolveAdminFromRequest,
  setSessionCookie,
} from '../middleware/auth';
import {
  createUserNotification,
  getPlatformSettings,
  insertWalletTransaction,
} from '../services/platformService';
import {
  createVaultPasscodeHash,
  fromPaisa,
  genCode,
  genId,
  hashPassword,
  isValidEmail,
  mapCommission,
  mapDeposit,
  mapInvoice,
  mapOrder,
  mapPaymentMethod,
  mapPaymentSetting,
  mapTransaction,
  mapUserPublic,
  mapWallet,
  mapWithdrawal,
  parsePermissions,
  sanitizeText,
  timingSafeStringEqual,
  toIso,
  toPaisa,
  verifyPassword,
  verifyVaultPasscode,
} from '../utils/helpers';

const router = Router();
const PRIMARY_ADMIN_ID = 'admin_primary';

async function ensurePrimaryAdminAccount(): Promise<any> {
  const rows = await query<RowDataPacket[]>(
    `SELECT a.*, r.slug AS role_slug, r.name AS role_name, r.permissions_json
     FROM admins a
     INNER JOIN admin_roles r ON r.id = a.role_id
     WHERE a.id = ? LIMIT 1`,
    [PRIMARY_ADMIN_ID]
  );
  if (rows.length > 0) return rows[0];

  const dummyHash = await hashPassword(genId('adm_init_pw'));
  await execute(
    `INSERT IGNORE INTO admins (id, admin_uid, full_name, email, password_hash, role_id, status, created_at, updated_at)
     VALUES (?, 'ADM-0001', 'GO PAY BD Control Admin', 'admin@gopaybd.local', ?, 1, 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [PRIMARY_ADMIN_ID, dummyHash]
  );

  const fresh = await query<RowDataPacket[]>(
    `SELECT a.*, r.slug AS role_slug, r.name AS role_name, r.permissions_json
     FROM admins a
     INNER JOIN admin_roles r ON r.id = a.role_id
     WHERE a.id = ? LIMIT 1`,
    [PRIMARY_ADMIN_ID]
  );
  return fresh[0];
}

// ============================================================================
// Admin Status, First-Run Setup (if ADMIN_PASSWORD unset), Login, Logout, Me
// ============================================================================
router.get('/status', async (_req, res, next) => {
  try {
    const vaultRows = await query<RowDataPacket[]>(
      `SELECT id FROM admin_security_vault WHERE id = 'master' LIMIT 1`
    );
    const hasVault = vaultRows.length > 0;
    const hasEnv = env.adminPassword.trim().length > 0;
    res.json({
      success: true,
      data: {
        setup_required: !hasVault && !hasEnv,
        has_admin: hasVault || hasEnv,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/setup', adminLoginRateLimiter, async (req, res, next) => {
  try {
    const vaultRows = await query<RowDataPacket[]>(
      `SELECT id FROM admin_security_vault WHERE id = 'master' LIMIT 1`
    );
    if (vaultRows.length > 0 || env.adminPassword.trim().length > 0) {
      res.status(403).json({
        success: false,
        message: 'Admin password is already configured. Please unlock using your password.',
      });
      return;
    }

    const password = String(req.body?.password || '').trim();
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Initial Admin Password must be at least 8 characters long.',
      });
      return;
    }

    const { salt, hash } = createVaultPasscodeHash(password);
    await execute(
      `INSERT INTO admin_security_vault (id, passcode_salt, passcode_hash, failed_attempts, updated_by_uid, updated_at)
       VALUES ('master', ?, ?, 0, ?, UTC_TIMESTAMP())`,
      [salt, hash, PRIMARY_ADMIN_ID]
    );

    const adminRow = await ensurePrimaryAdminAccount();
    await execute('UPDATE admins SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [adminRow.id]);

    const rawToken = await createDbSession(req, 'admin', adminRow.id);
    setSessionCookie(req, res, ADMIN_COOKIE_NAME, rawToken);
    await recordLoginLog(req, 'admin', adminRow.id, 'initial_setup', true);

    res.status(201).json({
      success: true,
      message: 'Admin Control Center password initialized.',
      data: {
        admin: {
          id: adminRow.id,
          admin_uid: adminRow.admin_uid,
          full_name: adminRow.full_name,
          email: adminRow.email,
          role_id: Number(adminRow.role_id),
          role_slug: adminRow.role_slug,
          role_name: adminRow.role_name,
          permissions: parsePermissions(adminRow.permissions_json),
        },
        session_token: rawToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', adminLoginRateLimiter, async (req, res, next) => {
  try {
    const email = sanitizeText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || req.body?.passcode || '').trim();

    if (!password) {
      res.status(400).json({ success: false, message: 'Admin password is required.' });
      return;
    }

    // Mode A: Individual staff email + password login
    if (email) {
      const staffRows = await query<RowDataPacket[]>(
        `SELECT a.*, r.slug AS role_slug, r.name AS role_name, r.permissions_json
         FROM admins a
         INNER JOIN admin_roles r ON r.id = a.role_id
         WHERE LOWER(a.email) = ? LIMIT 1`,
        [email]
      );
      if (!staffRows.length) {
        await recordLoginLog(req, 'admin', null, email, false);
        res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
        return;
      }
      const staff = staffRows[0];
      if (staff.status !== 'active') {
        res.status(403).json({ success: false, message: 'This administrator account is suspended.' });
        return;
      }
      if (staff.locked_until && new Date(staff.locked_until).getTime() > Date.now()) {
        res.status(429).json({ success: false, message: 'Account locked due to failed attempts. Wait 15 minutes.' });
        return;
      }

      const ok = await verifyPassword(password, staff.password_hash);
      if (!ok) {
        const nextAttempts = Number(staff.failed_attempts || 0) + 1;
        await execute(
          `UPDATE admins SET failed_attempts = ?, locked_until = IF(?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), locked_until) WHERE id = ?`,
          [nextAttempts, nextAttempts >= 5 ? 1 : 0, staff.id]
        );
        await recordLoginLog(req, 'admin', staff.id, email, false);
        res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
        return;
      }

      await execute('UPDATE admins SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [
        staff.id,
      ]);
      const rawToken = await createDbSession(req, 'admin', staff.id);
      setSessionCookie(req, res, ADMIN_COOKIE_NAME, rawToken);
      await recordLoginLog(req, 'admin', staff.id, email, true);

      res.json({
        success: true,
        message: 'Control Center unlocked.',
        data: {
          admin: {
            id: staff.id,
            admin_uid: staff.admin_uid,
            full_name: staff.full_name,
            email: staff.email,
            role_id: Number(staff.role_id),
            role_slug: staff.role_slug,
            role_name: staff.role_name,
            permissions: parsePermissions(staff.permissions_json),
          },
          session_token: rawToken,
        },
      });
      return;
    }

    // Mode B: Shared Control Center Admin Password (multi-staff access)
    const vaultRows = await query<RowDataPacket[]>(
      `SELECT * FROM admin_security_vault WHERE id = 'master' LIMIT 1`
    );
    const vault = vaultRows[0] || null;
    const hasEnvPassword = env.adminPassword.trim().length > 0;

    if (!vault && !hasEnvPassword) {
      res.status(400).json({
        success: false,
        code: 'SETUP_REQUIRED',
        message: 'No Admin Password is set yet. Please complete the initial setup.',
      });
      return;
    }

    if (vault?.locked_until && new Date(vault.locked_until).getTime() > Date.now()) {
      res.status(429).json({
        success: false,
        message: 'Control Center temporarily locked for 15 minutes after repeated failed attempts.',
      });
      return;
    }

    let valid = false;
    if (vault) {
      valid = verifyVaultPasscode(password, vault.passcode_salt, vault.passcode_hash);
    } else if (hasEnvPassword) {
      valid = timingSafeStringEqual(password, env.adminPassword.trim());
    }

    if (!valid) {
      if (vault) {
        const nextAttempts = Number(vault.failed_attempts || 0) + 1;
        await execute(
          `UPDATE admin_security_vault
           SET failed_attempts = ?, locked_until = IF(?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), locked_until)
           WHERE id = 'master'`,
          [nextAttempts, nextAttempts >= 5 ? 1 : 0]
        );
      }
      await recordLoginLog(req, 'admin', PRIMARY_ADMIN_ID, 'control_center_password', false);
      res.status(401).json({
        success: false,
        message: 'ভুল অ্যাডমিন পাসওয়ার্ড। সঠিক পাসওয়ার্ড দিন। (Incorrect admin password.)',
      });
      return;
    }

    if (vault) {
      await execute(
        `UPDATE admin_security_vault SET failed_attempts = 0, locked_until = NULL WHERE id = 'master'`
      );
    }

    const adminRow = await ensurePrimaryAdminAccount();
    await execute('UPDATE admins SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [adminRow.id]);

    const rawToken = await createDbSession(req, 'admin', adminRow.id);
    setSessionCookie(req, res, ADMIN_COOKIE_NAME, rawToken);
    await recordLoginLog(req, 'admin', adminRow.id, 'control_center_password', true);

    res.json({
      success: true,
      message: 'Control Center unlocked successfully.',
      data: {
        admin: {
          id: adminRow.id,
          admin_uid: adminRow.admin_uid,
          full_name: adminRow.full_name,
          email: adminRow.email,
          role_id: Number(adminRow.role_id),
          role_slug: adminRow.role_slug,
          role_name: adminRow.role_name,
          permissions: parsePermissions(adminRow.permissions_json),
        },
        session_token: rawToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    const rawCookie = req.cookies?.[ADMIN_COOKIE_NAME];
    const headerToken = typeof req.headers['x-admin-session'] === 'string' ? req.headers['x-admin-session'] : undefined;
    await deleteDbSessionByRawToken(rawCookie || headerToken);
    clearSessionCookie(req, res, ADMIN_COOKIE_NAME);
    res.json({ success: true, message: 'Signed out of Control Center.' });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', async (req, res, next) => {
  try {
    const admin = await resolveAdminFromRequest(req);
    if (!admin) {
      res.status(401).json({ success: false, message: 'Not authenticated as administrator.' });
      return;
    }
    const notifRows = await query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM admin_notifications WHERE is_read = 0'
    );
    res.json({
      success: true,
      data: {
        admin,
        unread_notifications: Number(notifRows[0]?.cnt || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// All routes below require authenticated active admin session
router.use(requireAdmin);

// ============================================================================
// Admin Security Vault Rotation
// ============================================================================
router.post('/security/credentials', requirePermission('settings'), async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.current_password || '').trim();
    const newPassword = String(req.body?.new_password || '').trim();

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New Admin Password must be at least 8 characters.' });
      return;
    }

    const vaultRows = await query<RowDataPacket[]>(
      `SELECT * FROM admin_security_vault WHERE id = 'master' LIMIT 1`
    );
    const vault = vaultRows[0] || null;
    let verified = false;
    if (vault) {
      verified = verifyVaultPasscode(currentPassword, vault.passcode_salt, vault.passcode_hash);
    } else if (env.adminPassword.trim()) {
      verified = timingSafeStringEqual(currentPassword, env.adminPassword.trim());
    }

    if (!verified) {
      res.status(400).json({ success: false, message: 'Current Admin Password is incorrect.' });
      return;
    }

    const { salt, hash } = createVaultPasscodeHash(newPassword);
    await execute(
      `INSERT INTO admin_security_vault (id, passcode_salt, passcode_hash, failed_attempts, locked_until, updated_by_uid, updated_by_email, updated_at)
       VALUES ('master', ?, ?, 0, NULL, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         passcode_salt = VALUES(passcode_salt),
         passcode_hash = VALUES(passcode_hash),
         failed_attempts = 0,
         locked_until = NULL,
         updated_by_uid = VALUES(updated_by_uid),
         updated_by_email = VALUES(updated_by_email),
         updated_at = UTC_TIMESTAMP()`,
      [salt, hash, req.admin!.id, req.admin!.email]
    );

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'admin_password_rotated',
      entityType: 'admin_security_vault',
      entityId: 'master',
      newValues: { rotated: true },
    });

    res.json({ success: true, message: 'Admin Control Center password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Executive Dashboard & 14-Day Charts
// ============================================================================
router.get('/dashboard', requirePermission('dashboard'), async (_req, res, next) => {
  try {
    const [
      userStats,
      depStats,
      wdStats,
      ordStats,
      commStats,
      pendingDeps,
      pendingWds,
      depDaily,
      wdDaily,
      ordDaily,
    ] = await Promise.all([
      query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended_users,
          SUM(CASE WHEN created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS new_today
        FROM users
      `),
      query<RowDataPacket[]>(`
        SELECT
          COALESCE(SUM(amount_paisa), 0) AS total_deposits,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_paisa ELSE 0 END), 0) AS approved_deposits,
          COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN amount_paisa ELSE 0 END), 0) AS pending_deposits,
          SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending_count
        FROM deposits
      `),
      query<RowDataPacket[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' THEN net_amount_paisa ELSE 0 END), 0) AS paid_withdrawals,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN fee_paisa ELSE 0 END), 0) AS withdrawal_fees,
          COALESCE(SUM(CASE WHEN status IN ('pending','processing','approved') THEN amount_paisa ELSE 0 END), 0) AS pending_withdrawals,
          SUM(CASE WHEN status IN ('pending','processing','approved') THEN 1 ELSE 0 END) AS pending_count
        FROM withdrawals
      `),
      query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount_paisa ELSE 0 END), 0) AS completed_vol
        FROM orders
      `),
      query<RowDataPacket[]>(`
        SELECT
          COALESCE(SUM(commission_amount_paisa), 0) AS total_comm,
          COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_paisa ELSE 0 END), 0) AS paid_comm,
          COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN commission_amount_paisa ELSE 0 END), 0) AS pending_comm
        FROM commissions
      `),
      query<RowDataPacket[]>(`
        SELECT d.*, u.full_name, u.username, u.uid AS user_uid
        FROM deposits d
        INNER JOIN users u ON u.id = d.user_id
        WHERE d.status IN ('pending','processing')
        ORDER BY d.created_at DESC LIMIT 8
      `),
      query<RowDataPacket[]>(`
        SELECT w.*, u.full_name, u.username, u.uid AS user_uid
        FROM withdrawals w
        INNER JOIN users u ON u.id = w.user_id
        WHERE w.status IN ('pending','processing','approved')
        ORDER BY w.created_at DESC LIMIT 8
      `),
      query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(amount_paisa), 0) AS total
        FROM deposits WHERE status = 'approved' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
        GROUP BY d
      `),
      query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(net_amount_paisa), 0) AS total
        FROM withdrawals WHERE status = 'paid' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
        GROUP BY d
      `),
      query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(total_amount_paisa), 0) AS total
        FROM orders WHERE status = 'completed' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
        GROUP BY d
      `),
    ]);

    const orderVol = Number(ordStats[0]?.completed_vol || 0);
    const wdFees = Number(wdStats[0]?.withdrawal_fees || 0);
    const paidComm = Number(commStats[0]?.paid_comm || 0);
    const revenuePaisa = Math.max(0, orderVol + wdFees - paidComm);

    const depMap = new Map(depDaily.map((r) => [String(r.d), fromPaisa(r.total)]));
    const wdMap = new Map(wdDaily.map((r) => [String(r.d), fromPaisa(r.total)]));
    const ordMap = new Map(ordDaily.map((r) => [String(r.d), fromPaisa(r.total)]));

    const charts: Array<{ date: string; deposits: number; withdrawals: number; orders: number; revenue: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000);
      const iso = dt.toISOString().slice(0, 10);
      const ordVal = ordMap.get(iso) || 0;
      charts.push({
        date: iso.slice(5),
        deposits: depMap.get(iso) || 0,
        withdrawals: wdMap.get(iso) || 0,
        orders: ordVal,
        revenue: ordVal,
      });
    }

    res.json({
      success: true,
      data: {
        metrics: {
          platform_revenue: fromPaisa(revenuePaisa),
          total_deposits: fromPaisa(depStats[0]?.total_deposits),
          total_approved_deposits: fromPaisa(depStats[0]?.approved_deposits),
          pending_deposits: fromPaisa(depStats[0]?.pending_deposits),
          pending_deposits_count: Number(depStats[0]?.pending_count || 0),
          paid_withdrawals: fromPaisa(wdStats[0]?.paid_withdrawals),
          pending_withdrawals: fromPaisa(wdStats[0]?.pending_withdrawals),
          pending_withdrawals_count: Number(wdStats[0]?.pending_count || 0),
          total_users: Number(userStats[0]?.total_users || 0),
          active_users: Number(userStats[0]?.active_users || 0),
          suspended_users: Number(userStats[0]?.suspended_users || 0),
          new_users_today: Number(userStats[0]?.new_today || 0),
          total_orders: Number(ordStats[0]?.total_orders || 0),
          completed_orders: Number(ordStats[0]?.completed_orders || 0),
          total_commission: fromPaisa(commStats[0]?.total_comm),
          paid_commission: fromPaisa(paidComm),
          pending_commission: fromPaisa(commStats[0]?.pending_comm),
        },
        charts,
        queues: {
          pending_deposits: pendingDeps.map(mapDeposit),
          pending_withdrawals: pendingWds.map(mapWithdrawal),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Users Inspection, Edit, Balance Adjust, Direct Wallet Control & Commission Grant
// ============================================================================
router.get('/users', requirePermission('users'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.uid LIKE ? OR u.referral_code LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('u.status = ?');
      params.push(status);
    }
    const minBal = req.query.min_balance !== undefined && req.query.min_balance !== '' ? Number(req.query.min_balance) : null;
    if (minBal !== null && Number.isFinite(minBal)) {
      where.push('COALESCE(w.balance_paisa, 0) >= ?');
      params.push(toPaisa(minBal));
    }
    const dateFrom = sanitizeText(req.query.date_from, 20);
    if (dateFrom) {
      where.push('DATE(u.created_at) >= ?');
      params.push(dateFrom);
    }

    const whereSql = where.join(' AND ');
    const [countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM users u LEFT JOIN wallets w ON w.user_id = u.id WHERE ${whereSql}`,
        params
      ),
      query<RowDataPacket[]>(
        `SELECT u.*,
                COALESCE(w.balance_paisa, 0) AS balance_paisa,
                COALESCE(w.locked_balance_paisa, 0) AS locked_balance_paisa,
                COALESCE(w.total_deposited_paisa, 0) AS total_deposited_paisa,
                COALESCE(w.total_withdrawn_paisa, 0) AS total_withdrawn_paisa,
                COALESCE(w.total_commission_paisa, 0) AS total_commission_paisa
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         WHERE ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = Number(countRows[0]?.cnt || 0);
    res.json({
      success: true,
      data: {
        items: rows.map((u) => ({
          ...mapUserPublic(u),
          wallet_balance: fromPaisa(u.balance_paisa),
          locked_balance: fromPaisa(u.locked_balance_paisa),
          total_deposited: fromPaisa(u.total_deposited_paisa),
          total_withdrawn: fromPaisa(u.total_withdrawn_paisa),
          total_commission: fromPaisa(u.total_commission_paisa),
        })),
        pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', requirePermission('users'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const users = await query<RowDataPacket[]>(
      `SELECT u.*, su.uid AS sponsor_uid
       FROM users u
       LEFT JOIN users su ON su.id = u.referred_by
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    if (!users.length) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const [walletRows, pendingCommRows, deps, wds, ords, comms, txs, pms, refs, loginLogs, auditLogs] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [id]),
      query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(commission_amount_paisa), 0) AS total
         FROM commissions WHERE earner_user_id = ? AND status IN ('pending','approved')`,
        [id]
      ),
      query<RowDataPacket[]>(
        `SELECT d.*, adm.full_name AS reviewed_by_name
         FROM deposits d
         LEFT JOIN admins adm ON adm.id = d.reviewed_by
         WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT 50`,
        [id]
      ),
      query<RowDataPacket[]>('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [id]),
      query<RowDataPacket[]>(
        `SELECT o.*, i.id AS invoice_id, i.invoice_number,
                COALESCE(
                  (SELECT c.status FROM commissions c WHERE c.order_id = o.id ORDER BY c.created_at DESC LIMIT 1),
                  'none'
                ) AS commission_status
         FROM orders o
         LEFT JOIN invoices i ON i.order_id = o.id
         WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50`,
        [id]
      ),
      query<RowDataPacket[]>(
        `SELECT c.*, o.order_uid,
                eu.username AS earner_username, eu.full_name AS earner_name,
                su.username AS source_username, su.full_name AS source_name
         FROM commissions c
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN users eu ON eu.id = c.earner_user_id
         LEFT JOIN users su ON su.id = c.source_user_id
         WHERE c.earner_user_id = ? ORDER BY c.created_at DESC LIMIT 50`,
        [id]
      ),
      query<RowDataPacket[]>('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [id]),
      query<RowDataPacket[]>(`SELECT * FROM payment_methods WHERE user_id = ? AND status != 'deleted'`, [id]),
      query<RowDataPacket[]>(
        `SELECT r.*, u.uid AS user_uid, u.full_name, u.username, u.status AS user_status
         FROM referrals r INNER JOIN users u ON u.id = r.referred_user_id
         WHERE r.referrer_user_id = ? ORDER BY r.created_at DESC`,
        [id]
      ),
      query<RowDataPacket[]>(
        `SELECT id, ip_address, success, created_at
         FROM login_logs WHERE actor_type = 'user' AND actor_id = ?
         ORDER BY created_at DESC LIMIT 30`,
        [id]
      ),
      query<RowDataPacket[]>(
        `SELECT id, actor_name, action, entity_type, entity_id, old_values, new_values, ip_address, created_at
         FROM audit_logs WHERE entity_id = ? OR (entity_type IN ('user','wallet') AND entity_id = ?)
         ORDER BY created_at DESC LIMIT 30`,
        [id, id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        user: {
          ...mapUserPublic(users[0]),
          address: users[0].address || '',
          city: users[0].city || '',
        },
        wallet: mapWallet(walletRows[0] || { user_id: id }, {
          pendingCommissionPaisa: pendingCommRows[0]?.total,
        }),
        deposits: deps.map(mapDeposit),
        withdrawals: wds.map(mapWithdrawal),
        orders: ords.map(mapOrder),
        commissions: comms.map(mapCommission),
        transactions: txs.map(mapTransaction),
        payment_methods: pms.map(mapPaymentMethod),
        referrals: refs.map((r) => ({
          id: r.id,
          user_uid: r.user_uid,
          full_name: r.full_name,
          username: r.username,
          level: Number(r.level),
          status: r.user_status,
          user_status: r.user_status,
          created_at: toIso(r.created_at),
        })),
        activity_logs: loginLogs.map((l) => ({
          id: l.id,
          ip_address: l.ip_address,
          success: Boolean(l.success),
          created_at: toIso(l.created_at),
        })),
        audit_logs: auditLogs.map((a) => ({
          id: a.id,
          actor_name: a.actor_name,
          action: a.action,
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          old_values: a.old_values,
          new_values: a.new_values,
          ip_address: a.ip_address,
          created_at: toIso(a.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', requirePermission('users'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const existing = await query<RowDataPacket[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    const cur = existing[0];
    const fullName = req.body?.full_name !== undefined ? sanitizeText(req.body.full_name, 160) : cur.full_name;
    const email = req.body?.email !== undefined ? sanitizeText(req.body.email, 190).toLowerCase() : cur.email;
    const phone = req.body?.phone !== undefined ? sanitizeText(req.body.phone, 32) : cur.phone;
    const adminNote = req.body?.admin_note !== undefined ? sanitizeText(req.body.admin_note, 1000) : cur.admin_note || '';
    const statusRaw = req.body?.status !== undefined ? sanitizeText(req.body.status, 32) : cur.status;
    const status = ['active', 'suspended', 'pending'].includes(statusRaw) ? statusRaw : cur.status;
    const newPassword = req.body?.new_password ? String(req.body.new_password) : '';

    if (email !== cur.email && !isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    if (newPassword && newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New user password must be at least 8 characters.' });
      return;
    }

    if (newPassword) {
      const pwHash = await hashPassword(newPassword);
      await execute(
        `UPDATE users SET full_name = ?, email = ?, phone = ?, status = ?, admin_note = ?, password_hash = ?, password_reset_required = 0, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [fullName, email, phone, status, adminNote, pwHash, id]
      );
    } else {
      await execute(
        `UPDATE users SET full_name = ?, email = ?, phone = ?, status = ?, admin_note = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [fullName, email, phone, status, adminNote, id]
      );
    }

    if (status === 'suspended') {
      await execute(`DELETE FROM sessions WHERE actor_type = 'user' AND actor_id = ?`, [id]);
    }

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'user_updated',
      entityType: 'user',
      entityId: id,
      oldValues: { full_name: cur.full_name, email: cur.email, phone: cur.phone, status: cur.status, admin_note: cur.admin_note || '' },
      newValues: { full_name: fullName, email, phone, status, admin_note: adminNote, password_reset: Boolean(newPassword) },
    });

    res.json({ success: true, message: 'User account updated successfully.' });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'That email address is already registered to another user.' });
      return;
    }
    next(err);
  }
});

router.post('/users/:id/reset-password', requirePermission('users'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const newPassword = String(req.body?.new_password || '');
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      return;
    }

    const existing = await query<RowDataPacket[]>('SELECT id, uid FROM users WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const pwHash = await hashPassword(newPassword);
    await execute(
      `UPDATE users
       SET password_hash = ?, password_reset_required = 0, failed_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [pwHash, id]
    );
    await execute(`DELETE FROM sessions WHERE actor_type = 'user' AND actor_id = ?`, [id]);

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'user_password_reset_by_admin',
      entityType: 'user',
      entityId: id,
      newValues: { password_reset: true, sessions_revoked: true },
    });

    res.json({ success: true, message: 'User password reset and active sessions revoked.' });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/balance-adjust', requirePermission('wallets'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const directionRaw = sanitizeText(req.body?.direction || 'credit', 16);
    const amount = Number(req.body?.amount);
    const asCommission = Boolean(req.body?.as_commission);
    const reason = sanitizeText(req.body?.reason || 'Admin balance adjustment', 400);

    if (!['credit', 'debit', 'set'].includes(directionRaw) || !Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ success: false, message: 'Provide a valid direction (credit/debit/set) and non-negative amount.' });
      return;
    }

    const updated = await withTransaction(async (conn) => {
      const [uRows] = await conn.execute<RowDataPacket[]>('SELECT id, full_name, username FROM users WHERE id = ? LIMIT 1', [id]);
      if (!uRows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

      const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [id]);
      if (!wRows.length) throw Object.assign(new Error('Wallet not found.'), { status: 404 });
      const wallet = wRows[0];

      const before = Number(wallet.balance_paisa);
      const amtPaisa = toPaisa(amount);
      let after = before;
      let ledgerDir: 'credit' | 'debit' = 'credit';
      let deltaPaisa = amtPaisa;

      if (directionRaw === 'credit') {
        after = before + amtPaisa;
        ledgerDir = 'credit';
      } else if (directionRaw === 'debit') {
        if (before < amtPaisa) {
          throw Object.assign(new Error('Cannot debit more than user available balance.'), { status: 400 });
        }
        after = before - amtPaisa;
        ledgerDir = 'debit';
      } else {
        after = amtPaisa;
        deltaPaisa = Math.abs(after - before);
        ledgerDir = after >= before ? 'credit' : 'debit';
      }

      let nextTotalComm = Number(wallet.total_commission_paisa);
      if (asCommission) {
        nextTotalComm =
          ledgerDir === 'credit'
            ? nextTotalComm + deltaPaisa
            : Math.max(0, nextTotalComm - deltaPaisa);
      }

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [after, nextTotalComm, id]
      );

      await insertWalletTransaction(conn, {
        userId: id,
        type: asCommission ? 'admin_commission_adjustment' : 'admin_adjustment',
        direction: ledgerDir,
        amountPaisa: deltaPaisa,
        balanceBeforePaisa: before,
        balanceAfterPaisa: after,
        referenceType: 'admin_adjustment',
        referenceId: req.admin!.admin_uid,
        description: reason,
        status: 'completed',
        createdByAdminId: req.admin!.id,
      });

      if (asCommission && deltaPaisa > 0) {
        await conn.execute(
          `INSERT INTO commissions
             (id, commission_uid, earner_user_id, source_user_id, order_id, level, rate_percent,
              base_amount_paisa, commission_amount_paisa, status, note, credited_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, 1, 0, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          [
            genId('com'),
            genCode('COM', 7),
            id,
            id,
            deltaPaisa,
            deltaPaisa,
            ledgerDir === 'credit' ? 'credited' : 'reversed',
            reason,
          ]
        );
      }

      await createUserNotification(conn, {
        userId: id,
        type: 'wallet',
        title: ledgerDir === 'credit' ? 'Wallet Balance Credited' : 'Wallet Balance Adjusted',
        message: `${reason} · New Balance: ৳${fromPaisa(after).toFixed(2)}`,
        link: '/dashboard/wallet',
      });

      const [fresh] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ?', [id]);
      return { before, after, wallet: fresh[0] };
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'wallet_balance_adjusted',
      entityType: 'wallet',
      entityId: id,
      oldValues: { balance: fromPaisa(updated.before) },
      newValues: { balance: fromPaisa(updated.after), direction: directionRaw, as_commission: asCommission, reason },
    });

    res.json({
      success: true,
      message: `Wallet updated to ৳${fromPaisa(updated.after).toFixed(2)}.`,
      data: mapWallet(updated.wallet),
    });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.put('/users/:id/wallet-direct', requirePermission('wallets'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const reason = sanitizeText(req.body?.reason || 'Admin direct wallet override', 400);

    const updated = await withTransaction(async (conn) => {
      const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [id]);
      if (!wRows.length) throw Object.assign(new Error('Wallet not found.'), { status: 404 });
      const cur = wRows[0];

      const balVal = req.body?.available_balance ?? req.body?.balance;
      const lockedVal = req.body?.pending_withdrawal ?? req.body?.locked_balance;
      const depVal = req.body?.total_deposits ?? req.body?.total_deposited;
      const wdVal = req.body?.total_withdrawals ?? req.body?.total_withdrawn;
      const commVal = req.body?.total_commission ?? req.body?.total_earnings;

      const nextBal = balVal !== undefined ? Math.max(0, toPaisa(balVal)) : Number(cur.balance_paisa);
      const nextLocked = lockedVal !== undefined ? Math.max(0, toPaisa(lockedVal)) : Number(cur.locked_balance_paisa);
      const nextDep = depVal !== undefined ? Math.max(0, toPaisa(depVal)) : Number(cur.total_deposited_paisa);
      const nextWd = wdVal !== undefined ? Math.max(0, toPaisa(wdVal)) : Number(cur.total_withdrawn_paisa);
      const nextComm = commVal !== undefined ? Math.max(0, toPaisa(commVal)) : Number(cur.total_commission_paisa);

      await conn.execute(
        `UPDATE wallets
         SET balance_paisa = ?, locked_balance_paisa = ?, total_deposited_paisa = ?,
             total_withdrawn_paisa = ?, total_commission_paisa = ?, updated_at = UTC_TIMESTAMP()
         WHERE user_id = ?`,
        [nextBal, nextLocked, nextDep, nextWd, nextComm, id]
      );

      if (nextBal !== Number(cur.balance_paisa)) {
        const diff = Math.abs(nextBal - Number(cur.balance_paisa));
        await insertWalletTransaction(conn, {
          userId: id,
          type: 'admin_adjustment',
          direction: nextBal >= Number(cur.balance_paisa) ? 'credit' : 'debit',
          amountPaisa: diff,
          balanceBeforePaisa: Number(cur.balance_paisa),
          balanceAfterPaisa: nextBal,
          referenceType: 'wallet_direct',
          referenceId: req.admin!.admin_uid,
          description: reason,
          status: 'completed',
          createdByAdminId: req.admin!.id,
        });
      }

      const [fresh] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ?', [id]);
      return { oldWallet: cur, newWallet: fresh[0] };
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'wallet_direct_updated',
      entityType: 'wallet',
      entityId: id,
      oldValues: mapWallet(updated.oldWallet),
      newValues: { ...mapWallet(updated.newWallet), reason },
    });

    res.json({ success: true, message: 'Wallet figures saved successfully.', data: mapWallet(updated.newWallet) });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.post('/users/:id/commission-adjust', requirePermission('wallets'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const amount = Number(req.body?.amount);
    const action = sanitizeText(req.body?.action || 'grant', 24);
    const level = Math.max(1, Math.min(2, Number(req.body?.referral_level || req.body?.level || 1)));
    const reqStatus = sanitizeText(req.body?.status || '', 24).toLowerCase();
    const isPending = reqStatus === 'pending' || req.body?.credit_wallet === false;
    const isDebit = action === 'deduct' || action === 'reverse';
    const note = sanitizeText(req.body?.admin_note || req.body?.note || 'Admin commission grant', 400);

    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ success: false, message: 'Commission amount must be greater than zero.' });
      return;
    }

    const amtPaisa = toPaisa(amount);

    await withTransaction(async (conn) => {
      const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [id]);
      if (!wRows.length) throw Object.assign(new Error('Wallet not found.'), { status: 404 });
      const wallet = wRows[0];

      const commId = genId('com');
      const commUid = genCode('COM', 7);
      const commStatus = isDebit ? 'reversed' : isPending ? 'pending' : 'credited';

      await conn.execute(
        `INSERT INTO commissions
           (id, commission_uid, earner_user_id, source_user_id, order_id, level, rate_percent,
            base_amount_paisa, commission_amount_paisa, status, note, credited_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          commId,
          commUid,
          id,
          id,
          level,
          amtPaisa,
          amtPaisa,
          commStatus,
          note,
          commStatus === 'credited' ? new Date() : null,
        ]
      );

      if (!isPending || isDebit) {
        const balBefore = Number(wallet.balance_paisa);
        const balAfter = isDebit ? Math.max(0, balBefore - amtPaisa) : balBefore + amtPaisa;
        const nextTotalComm = isDebit
          ? Math.max(0, Number(wallet.total_commission_paisa) - amtPaisa)
          : Number(wallet.total_commission_paisa) + amtPaisa;

        await conn.execute(
          `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
          [balAfter, nextTotalComm, id]
        );

        await insertWalletTransaction(conn, {
          userId: id,
          type: 'admin_commission_adjustment',
          direction: isDebit ? 'debit' : 'credit',
          amountPaisa: amtPaisa,
          balanceBeforePaisa: balBefore,
          balanceAfterPaisa: balAfter,
          referenceType: 'commission',
          referenceId: commUid,
          description: note,
          status: 'completed',
          createdByAdminId: req.admin!.id,
        });
      }
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'commission_manual_adjust',
      entityType: 'user',
      entityId: id,
      newValues: { action, level, status: isDebit ? 'reversed' : isPending ? 'pending' : 'credited', amount, note },
    });

    res.json({ success: true, message: 'User commission updated successfully.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Deposits Verification Queue (Transactional Approval & Rejection)
// ============================================================================
router.get('/deposits', requirePermission('deposits'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where: string[] = ['1=1'];
    const params: any[] = [];
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('d.status = ?');
      params.push(status);
    }
    const method = sanitizeText(req.query.payment_method || req.query.method, 64);
    if (method && method !== 'all') {
      where.push('d.payment_method = ?');
      params.push(method);
    }
    const dateFrom = sanitizeText(req.query.date_from, 20);
    if (dateFrom) {
      where.push('DATE(d.created_at) >= ?');
      params.push(dateFrom);
    }
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push(
        '(d.deposit_uid LIKE ? OR d.transaction_id LIKE ? OR d.sender_number LIKE ? OR d.receiver_number LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)'
      );
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    const whereSql = where.join(' AND ');
    const [countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM deposits d INNER JOIN users u ON u.id = d.user_id WHERE ${whereSql}`,
        params
      ),
      query<RowDataPacket[]>(
        `SELECT d.*, u.full_name, u.username, u.uid AS user_uid, u.email,
                adm.full_name AS reviewed_by_name
         FROM deposits d
         INNER JOIN users u ON u.id = d.user_id
         LEFT JOIN admins adm ON adm.id = d.reviewed_by
         WHERE ${whereSql}
         ORDER BY d.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = Number(countRows[0]?.cnt || 0);
    res.json({
      success: true,
      data: {
        items: rows.map(mapDeposit),
        pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/deposits/:id/processing', requirePermission('deposits'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const etaRaw = sanitizeText(req.body?.eta_hours || '', 24);
    const processingEta =
      etaRaw === '12'
        ? 'Within 12 Hours'
        : etaRaw === '24'
        ? 'Within 24 Hours'
        : etaRaw === '12-24'
        ? 'Within 12–24 Hours'
        : sanitizeText(req.body?.processing_eta || 'Within 12–24 Hours', 120);
    const noteInput = sanitizeText(req.body?.admin_note || '', 500);
    const note = noteInput || `Payment verification in progress (${processingEta}).`;

    const existing = await query<RowDataPacket[]>('SELECT * FROM deposits WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Deposit not found.' });
      return;
    }
    const cur = existing[0];
    if (cur.status !== 'pending' && cur.status !== 'processing') {
      res.status(400).json({ success: false, message: 'Only pending or processing deposits can update processing ETA.' });
      return;
    }

    await execute(
      `UPDATE deposits SET status = 'processing', admin_note = ?, processing_eta = ?, reviewed_by = ?, updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [note, processingEta, req.admin!.id, id]
    );

    await createUserNotification(null, {
      userId: cur.user_id,
      type: 'deposit',
      title: `Deposit Processing (${cur.deposit_uid})`,
      message: `${note} (${processingEta})`,
      link: '/dashboard/deposit',
    });

    res.json({ success: true, message: `Deposit marked as processing (${processingEta}).` });
  } catch (err) {
    next(err);
  }
});

router.post('/deposits/:id/approve', requirePermission('deposits'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const adminNote = sanitizeText(req.body?.admin_note || 'Verified and approved', 500);

    const dep = await withTransaction(async (conn) => {
      const [depRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM deposits WHERE id = ? FOR UPDATE', [id]);
      if (!depRows.length) throw Object.assign(new Error('Deposit not found.'), { status: 404 });
      const d = depRows[0];
      if (d.status !== 'pending' && d.status !== 'processing') {
        throw Object.assign(new Error('This deposit has already been finalized.'), { status: 400 });
      }

      const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
        d.user_id,
      ]);
      const wallet = wRows[0];
      const amtPaisa = Number(d.amount_paisa);
      const balBefore = Number(wallet.balance_paisa);
      const balAfter = balBefore + amtPaisa;
      const totalDepAfter = Number(wallet.total_deposited_paisa) + amtPaisa;

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, total_deposited_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [balAfter, totalDepAfter, d.user_id]
      );

      await conn.execute(
        `UPDATE deposits SET status = 'approved', admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [adminNote, req.admin!.id, id]
      );

      await insertWalletTransaction(conn, {
        userId: d.user_id,
        type: 'deposit',
        direction: 'credit',
        amountPaisa: amtPaisa,
        balanceBeforePaisa: balBefore,
        balanceAfterPaisa: balAfter,
        referenceType: 'deposit',
        referenceId: d.deposit_uid,
        paymentMethod: d.payment_method,
        senderNumber: d.sender_number,
        receiverNumber: d.receiver_number,
        description: `Approved ${d.payment_method} deposit (${d.transaction_id})`,
        status: 'completed',
        createdByAdminId: req.admin!.id,
      });

      await createUserNotification(conn, {
        userId: d.user_id,
        type: 'deposit',
        title: `Deposit Approved: ৳${fromPaisa(amtPaisa).toFixed(2)}`,
        message: `Your ${d.payment_method} deposit (TrxID: ${d.transaction_id}) has been verified and credited to your wallet.`,
        link: '/dashboard/wallet',
      });

      return d;
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'deposit_approved',
      entityType: 'deposit',
      entityId: id,
      newValues: { amount: fromPaisa(dep.amount_paisa), trx_id: dep.transaction_id, admin_note: adminNote },
    });

    res.json({ success: true, message: 'Deposit approved and user wallet credited.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.post('/deposits/:id/reject', requirePermission('deposits'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const adminNote = sanitizeText(req.body?.reason || req.body?.admin_note || 'Payment verification failed', 500);

    const dep = await withTransaction(async (conn) => {
      const [depRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM deposits WHERE id = ? FOR UPDATE', [id]);
      if (!depRows.length) throw Object.assign(new Error('Deposit not found.'), { status: 404 });
      const d = depRows[0];
      if (d.status !== 'pending' && d.status !== 'processing') {
        throw Object.assign(new Error('This deposit has already been finalized.'), { status: 400 });
      }

      await conn.execute(
        `UPDATE deposits SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [adminNote, req.admin!.id, id]
      );
      await conn.execute('DELETE FROM deposit_transaction_locks WHERE deposit_id = ?', [id]);

      await createUserNotification(conn, {
        userId: d.user_id,
        type: 'deposit',
        title: `Deposit Rejected (${d.deposit_uid})`,
        message: `Your deposit of ৳${fromPaisa(d.amount_paisa).toFixed(2)} was rejected. Reason: ${adminNote}`,
        link: '/dashboard/deposit',
      });

      return d;
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'deposit_rejected',
      entityType: 'deposit',
      entityId: id,
      newValues: { trx_id: dep.transaction_id, admin_note: adminNote },
    });

    res.json({ success: true, message: 'Deposit rejected.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Withdrawals Payout Queue (Transactional Approve, Paid, Reject+Refund)
// ============================================================================
router.get('/withdrawals', requirePermission('withdrawals'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where: string[] = ['1=1'];
    const params: any[] = [];
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('w.status = ?');
      params.push(status);
    }
    const method = sanitizeText(req.query.payment_method || req.query.method, 64);
    if (method && method !== 'all') {
      where.push('w.payment_method = ?');
      params.push(method);
    }
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push('(w.withdrawal_uid LIKE ? OR w.account_number LIKE ? OR w.payout_reference LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    const whereSql = where.join(' AND ');
    const [countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM withdrawals w INNER JOIN users u ON u.id = w.user_id WHERE ${whereSql}`,
        params
      ),
      query<RowDataPacket[]>(
        `SELECT w.*, u.full_name, u.username, u.uid AS user_uid, u.email
         FROM withdrawals w
         INNER JOIN users u ON u.id = w.user_id
         WHERE ${whereSql}
         ORDER BY w.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = Number(countRows[0]?.cnt || 0);
    res.json({
      success: true,
      data: {
        items: rows.map(mapWithdrawal),
        pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals/:id/approve', requirePermission('withdrawals'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const targetStatus = req.body?.status === 'processing' ? 'processing' : 'approved';
    const adminNote = sanitizeText(
      req.body?.admin_note || (targetStatus === 'processing' ? 'Withdrawal in processing' : 'Approved for payout'),
      500
    );
    const allowedFrom = targetStatus === 'processing' ? "('pending')" : "('pending', 'processing')";
    const result = await execute(
      `UPDATE withdrawals SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND status IN ${allowedFrom}`,
      [targetStatus, adminNote, req.admin!.id, id]
    );
    if (result.affectedRows === 0) {
      res.status(400).json({ success: false, message: 'Withdrawal cannot transition to this status from its current state.' });
      return;
    }
    res.json({
      success: true,
      message: targetStatus === 'processing' ? 'Withdrawal marked as processing.' : 'Withdrawal approved and ready for payout.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals/:id/paid', requirePermission('withdrawals'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const payoutRef = sanitizeText(req.body?.payout_tx_id || req.body?.payout_reference || req.body?.transaction_id || '', 128);
    const adminNote = sanitizeText(req.body?.admin_note || 'Payout settled', 500);
    const paidAmountInput = req.body?.paid_amount !== undefined && req.body?.paid_amount !== '' ? Number(req.body.paid_amount) : null;
    const paymentDateRaw = sanitizeText(req.body?.payment_date || '', 20);
    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDateRaw) ? paymentDateRaw : new Date().toISOString().slice(0, 10);

    const wd = await withTransaction(async (conn) => {
      const [wdRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [id]);
      if (!wdRows.length) throw Object.assign(new Error('Withdrawal not found.'), { status: 404 });
      const w = wdRows[0];
      if (!['pending', 'processing', 'approved'].includes(w.status)) {
        throw Object.assign(new Error('This withdrawal has already been finalized.'), { status: 400 });
      }

      const [walletRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
        w.user_id,
      ]);
      const wallet = walletRows[0];
      const amt = Number(w.amount_paisa);
      const paidPaisa =
        paidAmountInput !== null && Number.isFinite(paidAmountInput) && paidAmountInput > 0
          ? toPaisa(paidAmountInput)
          : Number(w.net_amount_paisa);
      const lockedAfter = Math.max(0, Number(wallet.locked_balance_paisa) - amt);
      const withdrawnAfter = Number(wallet.total_withdrawn_paisa) + paidPaisa;

      await conn.execute(
        `UPDATE wallets SET locked_balance_paisa = ?, total_withdrawn_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [lockedAfter, withdrawnAfter, w.user_id]
      );

      await conn.execute(
        `UPDATE withdrawals
         SET status = 'paid', paid_amount_paisa = ?, payout_reference = ?, admin_note = ?, reviewed_by = ?,
             reviewed_at = COALESCE(reviewed_at, UTC_TIMESTAMP()), paid_at = UTC_TIMESTAMP(), payment_date = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [paidPaisa, payoutRef, adminNote, req.admin!.id, paymentDate, id]
      );

      await conn.execute(
        `UPDATE wallet_transactions SET status = 'completed' WHERE reference_type = 'withdrawal' AND reference_id = ?`,
        [w.withdrawal_uid]
      );

      await createUserNotification(conn, {
        userId: w.user_id,
        type: 'withdrawal',
        title: `Withdrawal Paid: ৳${fromPaisa(paidPaisa).toFixed(2)}`,
        message: `Payout sent to ${w.payment_method} ${w.account_number}.${payoutRef ? ` Ref: ${payoutRef}` : ''}`,
        link: '/dashboard/withdraw',
      });

      return w;
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'withdrawal_paid',
      entityType: 'withdrawal',
      entityId: id,
      newValues: { net_amount: fromPaisa(wd.net_amount_paisa), payout_reference: payoutRef, payment_date: paymentDate },
    });

    res.json({ success: true, message: 'Withdrawal marked as paid.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.post('/withdrawals/:id/reject', requirePermission('withdrawals'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const adminNote = sanitizeText(req.body?.reason || req.body?.admin_note || 'Withdrawal rejected and refunded', 500);

    const wd = await withTransaction(async (conn) => {
      const [wdRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [id]);
      if (!wdRows.length) throw Object.assign(new Error('Withdrawal not found.'), { status: 404 });
      const w = wdRows[0];
      if (!['pending', 'processing', 'approved'].includes(w.status)) {
        throw Object.assign(new Error('This withdrawal has already been finalized.'), { status: 400 });
      }

      const [walletRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
        w.user_id,
      ]);
      const wallet = walletRows[0];
      const amt = Number(w.amount_paisa);
      const balBefore = Number(wallet.balance_paisa);
      const balAfter = balBefore + amt;
      const lockedAfter = Math.max(0, Number(wallet.locked_balance_paisa) - amt);

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, locked_balance_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [balAfter, lockedAfter, w.user_id]
      );
      await conn.execute(
        `UPDATE withdrawals SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [adminNote, req.admin!.id, id]
      );

      await insertWalletTransaction(conn, {
        userId: w.user_id,
        type: 'withdrawal_refund',
        direction: 'credit',
        amountPaisa: amt,
        balanceBeforePaisa: balBefore,
        balanceAfterPaisa: balAfter,
        referenceType: 'withdrawal',
        referenceId: w.withdrawal_uid,
        paymentMethod: w.payment_method,
        receiverNumber: w.account_number,
        description: `Rejected withdrawal ${w.withdrawal_uid} refunded: ${adminNote}`,
        status: 'completed',
        createdByAdminId: req.admin!.id,
      });

      await createUserNotification(conn, {
        userId: w.user_id,
        type: 'withdrawal',
        title: `Withdrawal Rejected & Refunded`,
        message: `Your withdrawal ${w.withdrawal_uid} (৳${fromPaisa(amt).toFixed(2)}) was refunded to your wallet. Reason: ${adminNote}`,
        link: '/dashboard/wallet',
      });

      return w;
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'withdrawal_rejected',
      entityType: 'withdrawal',
      entityId: id,
      newValues: { refunded_amount: fromPaisa(wd.amount_paisa), admin_note: adminNote },
    });

    res.json({ success: true, message: 'Withdrawal rejected and reserved funds returned to user wallet.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Orders, Commissions, Referrals, Transactions, Wallets
// ============================================================================
router.get('/orders', requirePermission('orders'), async (req, res, next) => {
  try {
    const where: string[] = ['1=1'];
    const params: any[] = [];
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('o.status = ?');
      params.push(status);
    }
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push('(o.order_uid LIKE ? OR o.product_name LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT o.*, u.full_name, u.username, u.uid AS user_uid, i.id AS invoice_id, i.invoice_number,
              COALESCE(
                (SELECT c.status FROM commissions c WHERE c.order_id = o.id ORDER BY c.created_at DESC LIMIT 1),
                'none'
              ) AS commission_status
       FROM orders o
       INNER JOIN users u ON u.id = o.user_id
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE ${where.join(' AND ')}
       ORDER BY o.created_at DESC LIMIT 200`,
      params
    );
    res.json({ success: true, data: rows.map(mapOrder) });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/status', requirePermission('orders'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const nextStatus = sanitizeText(req.body?.status || req.body?.order_status, 32);
    const adminNote = req.body?.admin_note !== undefined ? sanitizeText(req.body.admin_note, 500) : null;
    if (!['pending', 'processing', 'completed', 'cancelled', 'refunded'].includes(nextStatus)) {
      res.status(400).json({ success: false, message: 'Invalid order status.' });
      return;
    }

    await withTransaction(async (conn) => {
      const [oRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!oRows.length) throw Object.assign(new Error('Order not found.'), { status: 404 });
      const ord = oRows[0];

      if ((nextStatus === 'refunded' || nextStatus === 'cancelled') && ord.status !== 'refunded' && ord.status !== 'cancelled') {
        const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
          ord.user_id,
        ]);
        const wallet = wRows[0];
        const refundAmt = Number(ord.total_amount_paisa);
        const balBefore = Number(wallet.balance_paisa);
        const balAfter = balBefore + refundAmt;

        await conn.execute(
          `UPDATE wallets SET balance_paisa = ?, total_spent_paisa = GREATEST(0, total_spent_paisa - ?), updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
          [balAfter, refundAmt, ord.user_id]
        );

        await insertWalletTransaction(conn, {
          userId: ord.user_id,
          type: 'order_refund',
          direction: 'credit',
          amountPaisa: refundAmt,
          balanceBeforePaisa: balBefore,
          balanceAfterPaisa: balAfter,
          referenceType: 'order',
          referenceId: ord.order_uid,
          description: `Refund for ${nextStatus} order ${ord.order_uid}`,
          status: 'completed',
          createdByAdminId: req.admin!.id,
        });

        await conn.execute(
          `UPDATE invoices SET payment_status = 'refunded', invoice_status = 'void', updated_at = UTC_TIMESTAMP() WHERE order_id = ?`,
          [id]
        );

        // Reverse any associated referral commissions on refund/cancellation
        const [commRows] = await conn.execute<RowDataPacket[]>(
          `SELECT * FROM commissions WHERE order_id = ? AND status IN ('pending', 'approved', 'credited') FOR UPDATE`,
          [id]
        );
        for (const c of commRows) {
          const commAmt = Number(c.commission_amount_paisa);
          if (c.status === 'credited') {
            const [ewRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
              c.earner_user_id,
            ]);
            if (ewRows.length) {
              const eBalBefore = Number(ewRows[0].balance_paisa);
              const eBalAfter = Math.max(0, eBalBefore - commAmt);
              await conn.execute(
                `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = GREATEST(0, total_commission_paisa - ?), updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
                [eBalAfter, commAmt, c.earner_user_id]
              );
              await insertWalletTransaction(conn, {
                userId: c.earner_user_id,
                type: 'commission_reversal',
                direction: 'debit',
                amountPaisa: commAmt,
                balanceBeforePaisa: eBalBefore,
                balanceAfterPaisa: eBalAfter,
                referenceType: 'commission',
                referenceId: c.commission_uid,
                description: `Commission reversed due to ${nextStatus} order ${ord.order_uid}`,
                status: 'completed',
                createdByAdminId: req.admin!.id,
              });
            }
          }
          await conn.execute(`UPDATE commissions SET status = 'reversed', updated_at = UTC_TIMESTAMP() WHERE id = ?`, [
            c.id,
          ]);
        }
      }

      if (adminNote !== null) {
        await conn.execute('UPDATE orders SET status = ?, notes = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [
          nextStatus,
          adminNote,
          id,
        ]);
      } else {
        await conn.execute('UPDATE orders SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [nextStatus, id]);
      }
    });

    res.json({ success: true, message: `Order status updated to ${nextStatus}.` });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.get('/commissions', requirePermission('commissions'), async (req, res, next) => {
  try {
    const where: string[] = ['1=1'];
    const params: any[] = [];
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('c.status = ?');
      params.push(status);
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT c.*, o.order_uid,
              eu.full_name AS earner_name, eu.username AS earner_username,
              su.full_name AS source_name, su.username AS source_username
       FROM commissions c
       LEFT JOIN orders o ON o.id = c.order_id
       LEFT JOIN users eu ON eu.id = c.earner_user_id
       LEFT JOIN users su ON su.id = c.source_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC LIMIT 250`,
      params
    );
    res.json({ success: true, data: rows.map(mapCommission) });
  } catch (err) {
    next(err);
  }
});

router.post('/commissions/:id/action', requirePermission('commissions'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const action = sanitizeText(req.body?.action, 32);

    await withTransaction(async (conn) => {
      const [cRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM commissions WHERE id = ? FOR UPDATE', [id]);
      if (!cRows.length) throw Object.assign(new Error('Commission record not found.'), { status: 404 });
      const c = cRows[0];
      const amt = Number(c.commission_amount_paisa);

      if ((action === 'credit' || action === 'approve') && c.status !== 'credited') {
        const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
          c.earner_user_id,
        ]);
        const wallet = wRows[0];
        const balBefore = Number(wallet.balance_paisa);
        const balAfter = balBefore + amt;

        await conn.execute(
          `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = total_commission_paisa + ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
          [balAfter, amt, c.earner_user_id]
        );
        await conn.execute(
          `UPDATE commissions SET status = 'credited', credited_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?`,
          [id]
        );
        await insertWalletTransaction(conn, {
          userId: c.earner_user_id,
          type: 'referral_commission',
          direction: 'credit',
          amountPaisa: amt,
          balanceBeforePaisa: balBefore,
          balanceAfterPaisa: balAfter,
          referenceType: 'commission',
          referenceId: c.commission_uid,
          description: `Commission ${c.commission_uid} approved & credited`,
          status: 'completed',
          createdByAdminId: req.admin!.id,
        });
      } else if (action === 'reverse' || action === 'cancel') {
        if (c.status === 'credited') {
          const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
            c.earner_user_id,
          ]);
          const wallet = wRows[0];
          const balBefore = Number(wallet.balance_paisa);
          const balAfter = Math.max(0, balBefore - amt);

          await conn.execute(
            `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = GREATEST(0, total_commission_paisa - ?), updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
            [balAfter, amt, c.earner_user_id]
          );
          await insertWalletTransaction(conn, {
            userId: c.earner_user_id,
            type: 'commission_reversal',
            direction: 'debit',
            amountPaisa: amt,
            balanceBeforePaisa: balBefore,
            balanceAfterPaisa: balAfter,
            referenceType: 'commission',
            referenceId: c.commission_uid,
            description: `Commission ${c.commission_uid} reversed by admin`,
            status: 'completed',
            createdByAdminId: req.admin!.id,
          });
        }
        await conn.execute(
          `UPDATE commissions SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
          [action === 'cancel' ? 'cancelled' : 'reversed', id]
        );
      } else {
        throw Object.assign(new Error('Unsupported commission action.'), { status: 400 });
      }
    });

    res.json({ success: true, message: 'Commission updated successfully.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.put('/commissions/:id', requirePermission('commissions'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const newAmt = Number(req.body?.commission_amount ?? req.body?.amount);
    const note = sanitizeText(req.body?.admin_note || req.body?.note || '', 400);
    if (!Number.isFinite(newAmt) || newAmt < 0) {
      res.status(400).json({ success: false, message: 'Valid commission amount is required.' });
      return;
    }

    const newPaisa = toPaisa(newAmt);
    await withTransaction(async (conn) => {
      const [cRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM commissions WHERE id = ? FOR UPDATE', [id]);
      if (!cRows.length) throw Object.assign(new Error('Commission not found.'), { status: 404 });
      const c = cRows[0];
      const delta = newPaisa - Number(c.commission_amount_paisa);

      await conn.execute(
        `UPDATE commissions SET commission_amount_paisa = ?, note = COALESCE(NULLIF(?, ''), note), updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [newPaisa, note, id]
      );

      if (c.status === 'credited' && delta !== 0) {
        const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [
          c.earner_user_id,
        ]);
        const wallet = wRows[0];
        const balBefore = Number(wallet.balance_paisa);
        const balAfter = Math.max(0, balBefore + delta);
        const nextTotalComm = Math.max(0, Number(wallet.total_commission_paisa) + delta);

        await conn.execute(
          `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
          [balAfter, nextTotalComm, c.earner_user_id]
        );
        await insertWalletTransaction(conn, {
          userId: c.earner_user_id,
          type: 'admin_commission_adjustment',
          direction: delta >= 0 ? 'credit' : 'debit',
          amountPaisa: Math.abs(delta),
          balanceBeforePaisa: balBefore,
          balanceAfterPaisa: balAfter,
          referenceType: 'commission',
          referenceId: c.commission_uid,
          description: note || `Admin edited commission ${c.commission_uid}`,
          status: 'completed',
          createdByAdminId: req.admin!.id,
        });
      }
    });

    res.json({ success: true, message: 'Commission amount updated.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.get('/referrals', requirePermission('referrals'), async (_req, res, next) => {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT r.*,
              ru.full_name AS referrer_name, ru.username AS referrer_username, ru.uid AS referrer_uid, ru.referral_code AS referral_code,
              tu.full_name AS referred_name, tu.username AS referred_username, tu.uid AS referred_uid, tu.status AS referred_status,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = tu.id AND o.status = 'completed') AS completed_orders
       FROM referrals r
       INNER JOIN users ru ON ru.id = r.referrer_user_id
       INNER JOIN users tu ON tu.id = r.referred_user_id
       ORDER BY r.created_at DESC LIMIT 250`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        level: Number(r.level),
        referral_code: r.referral_code,
        referrer_name: r.referrer_name,
        referrer_username: r.referrer_username,
        referrer_uid: r.referrer_uid,
        referred_name: r.referred_name,
        referred_username: r.referred_username,
        referred_uid: r.referred_uid,
        completed_orders: Number(r.completed_orders || 0),
        status: r.referred_status,
        referred_status: r.referred_status,
        created_at: toIso(r.created_at),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', requirePermission('transactions'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where: string[] = ['1=1'];
    const params: any[] = [];
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push('(t.tx_uid LIKE ? OR t.reference_id LIKE ? OR t.description LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    const type = sanitizeText(req.query.type, 64);
    if (type && type !== 'all') {
      where.push('t.type = ?');
      params.push(type);
    }
    const status = sanitizeText(req.query.status, 32);
    if (status && status !== 'all') {
      where.push('t.status = ?');
      params.push(status);
    }
    const dateFrom = sanitizeText(req.query.date_from, 20);
    if (dateFrom) {
      where.push('DATE(t.created_at) >= ?');
      params.push(dateFrom);
    }
    const dateTo = sanitizeText(req.query.date_to, 20);
    if (dateTo) {
      where.push('DATE(t.created_at) <= ?');
      params.push(dateTo);
    }

    const whereSql = where.join(' AND ');
    const [countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM wallet_transactions t INNER JOIN users u ON u.id = t.user_id WHERE ${whereSql}`,
        params
      ),
      query<RowDataPacket[]>(
        `SELECT t.*, u.full_name, u.username, u.uid AS user_uid
         FROM wallet_transactions t
         INNER JOIN users u ON u.id = t.user_id
         WHERE ${whereSql}
         ORDER BY t.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = Number(countRows[0]?.cnt || 0);
    res.json({
      success: true,
      data: {
        items: rows.map(mapTransaction),
        pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/wallets', requirePermission('wallets'), async (_req, res, next) => {
  try {
    const [rows, aggRows, commAggRows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT w.*, u.uid, u.full_name, u.username, u.email, u.status
         FROM wallets w
         INNER JOIN users u ON u.id = w.user_id
         ORDER BY w.balance_paisa DESC LIMIT 250`
      ),
      query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(balance_paisa), 0) AS total_available,
           COALESCE(SUM(locked_balance_paisa), 0) AS total_pending_withdrawal,
           COALESCE(SUM(total_deposited_paisa), 0) AS total_deposits
         FROM wallets`
      ),
      query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(commission_amount_paisa), 0) AS total_pending_commission
         FROM commissions WHERE status IN ('pending','approved')`
      ),
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          total_available: fromPaisa(aggRows[0]?.total_available),
          total_pending_withdrawal: fromPaisa(aggRows[0]?.total_pending_withdrawal),
          total_pending_commission: fromPaisa(commAggRows[0]?.total_pending_commission),
          total_deposits: fromPaisa(aggRows[0]?.total_deposits),
        },
        items: rows.map((r) => ({
          ...mapWallet(r),
          id: r.user_id,
          uid: r.uid,
          user_uid: r.uid,
          full_name: r.full_name,
          username: r.username,
          email: r.email,
          status: r.status,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Payment Receiving Channels CRUD & User Payment Methods
// ============================================================================
router.get('/payment-settings', requirePermission('payment_settings'), async (_req, res, next) => {
  try {
    const rows = await query<RowDataPacket[]>('SELECT * FROM payment_settings ORDER BY display_order ASC, created_at ASC');
    res.json({ success: true, data: rows.map(mapPaymentSetting) });
  } catch (err) {
    next(err);
  }
});

router.post('/payment-settings', requirePermission('payment_settings'), async (req, res, next) => {
  try {
    const id = genId('pay');
    const methodType = sanitizeText(req.body?.method_name || req.body?.method_type, 64);
    const accountTitle = sanitizeText(req.body?.account_holder_name || req.body?.account_title, 160);
    const accountNumber = sanitizeText(req.body?.receiving_number || req.body?.account_number, 64);
    const accountType = sanitizeText(req.body?.account_type || 'personal', 32);
    const bankName = sanitizeText(req.body?.bank_name, 160);
    const branchName = sanitizeText(req.body?.branch_name, 160);
    const routingNumber = sanitizeText(req.body?.routing_number, 64);
    const instructions = sanitizeText(req.body?.instructions, 1000);
    const minDep = toPaisa(Number(req.body?.min_deposit || 100));
    const maxDep = toPaisa(Number(req.body?.max_deposit || 500000));
    const isActive = (req.body?.deposit_enabled ?? req.body?.is_active) !== false ? 1 : 0;
    const withdrawalEnabled = req.body?.withdrawal_enabled !== false ? 1 : 0;
    const displayOrder = Number(req.body?.display_order || 0);

    if (!methodType || !accountTitle || !accountNumber) {
      res.status(400).json({ success: false, message: 'Method type, title, and account number are required.' });
      return;
    }

    await execute(
      `INSERT INTO payment_settings
         (id, method_type, account_title, account_number, account_type, bank_name, branch_name, routing_number,
          instructions, min_deposit_paisa, max_deposit_paisa, is_active, withdrawal_enabled, display_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [
        id,
        methodType,
        accountTitle,
        accountNumber,
        accountType,
        bankName || null,
        branchName || null,
        routingNumber || null,
        instructions,
        minDep,
        maxDep,
        isActive,
        withdrawalEnabled,
        displayOrder,
      ]
    );

    const rows = await query<RowDataPacket[]>('SELECT * FROM payment_settings WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Receiving payment channel added.', data: mapPaymentSetting(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/payment-settings/:id', requirePermission('payment_settings'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const existing = await query<RowDataPacket[]>('SELECT * FROM payment_settings WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Payment channel not found.' });
      return;
    }
    const cur = existing[0];
    const depFlag = req.body?.deposit_enabled ?? req.body?.is_active;
    await execute(
      `UPDATE payment_settings
       SET method_type = ?, account_title = ?, account_number = ?, account_type = ?,
           bank_name = ?, branch_name = ?, routing_number = ?, instructions = ?,
           min_deposit_paisa = ?, max_deposit_paisa = ?, is_active = ?, withdrawal_enabled = ?, display_order = ?, updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [
        sanitizeText(req.body?.method_name ?? req.body?.method_type ?? cur.method_type, 64),
        sanitizeText(req.body?.account_holder_name ?? req.body?.account_title ?? cur.account_title, 160),
        sanitizeText(req.body?.receiving_number ?? req.body?.account_number ?? cur.account_number, 64),
        sanitizeText(req.body?.account_type ?? cur.account_type, 32),
        sanitizeText(req.body?.bank_name ?? cur.bank_name, 160) || null,
        sanitizeText(req.body?.branch_name ?? cur.branch_name, 160) || null,
        sanitizeText(req.body?.routing_number ?? cur.routing_number, 64) || null,
        sanitizeText(req.body?.instructions ?? cur.instructions, 1000),
        req.body?.min_deposit !== undefined ? toPaisa(req.body.min_deposit) : Number(cur.min_deposit_paisa),
        req.body?.max_deposit !== undefined ? toPaisa(req.body.max_deposit) : Number(cur.max_deposit_paisa),
        depFlag !== undefined ? (depFlag ? 1 : 0) : Number(cur.is_active),
        req.body?.withdrawal_enabled !== undefined
          ? req.body.withdrawal_enabled
            ? 1
            : 0
          : Number(cur.withdrawal_enabled ?? 1),
        req.body?.display_order !== undefined ? Number(req.body.display_order) : Number(cur.display_order),
        id,
      ]
    );
    res.json({ success: true, message: 'Payment channel updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/payment-settings/:id', requirePermission('payment_settings'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    await execute('DELETE FROM payment_settings WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payment channel deleted.' });
  } catch (err) {
    next(err);
  }
});

router.get('/payment-methods', requirePermission('payment_settings'), async (_req, res, next) => {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT pm.*, u.full_name, u.username, u.uid AS user_uid
       FROM payment_methods pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.status != 'deleted'
       ORDER BY pm.created_at DESC LIMIT 250`
    );
    res.json({ success: true, data: rows.map(mapPaymentMethod) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Invoices
// ============================================================================
router.get('/invoices', requirePermission('invoices'), async (req, res, next) => {
  try {
    const where: string[] = ['1=1'];
    const params: any[] = [];
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      where.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ? OR u.uid LIKE ? OR o.order_uid LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT i.*, u.uid AS customer_uid, o.order_uid, o.payment_source AS payment_method
       FROM invoices i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.issued_at DESC LIMIT 200`,
      params
    );
    res.json({ success: true, data: rows.map(mapInvoice) });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices/:id', requirePermission('invoices'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const rows = await query<RowDataPacket[]>(
      `SELECT i.*, u.uid AS customer_uid, o.order_uid, o.payment_source AS payment_method
       FROM invoices i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Invoice not found.' });
      return;
    }
    const mapped = mapInvoice(rows[0]);
    res.json({ success: true, data: { invoice: mapped, items: mapped.items } });
  } catch (err) {
    next(err);
  }
});

router.put('/invoices/:id', requirePermission('invoices'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const invStatusRaw = sanitizeText(req.body?.invoice_status || '', 32).toLowerCase();
    const payStatusRaw = sanitizeText(req.body?.payment_status || '', 32).toLowerCase();
    const dueDateRaw = sanitizeText(req.body?.due_date || '', 20);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null;
    const notes = sanitizeText(req.body?.notes, 1000);

    const mappedPaymentStatus =
      payStatusRaw && ['paid', 'unpaid', 'refunded'].includes(payStatusRaw)
        ? payStatusRaw
        : invStatusRaw === 'void'
        ? 'refunded'
        : invStatusRaw === 'draft' || invStatusRaw === 'issued'
        ? 'unpaid'
        : invStatusRaw === 'paid'
        ? 'paid'
        : '';
    const mappedInvoiceStatus = ['draft', 'issued', 'paid', 'void'].includes(invStatusRaw) ? invStatusRaw : '';

    await execute(
      `UPDATE invoices
       SET payment_status = IF(? != '', ?, payment_status),
           invoice_status = IF(? != '', ?, invoice_status),
           due_date = COALESCE(?, due_date),
           notes = ?,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [mappedPaymentStatus, mappedPaymentStatus, mappedInvoiceStatus, mappedInvoiceStatus, dueDate, notes, id]
    );
    res.json({ success: true, message: 'Invoice updated.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Financial Reports, Sender/Receiving Number Analytics & Global Payment Search
// ============================================================================
router.get('/reports', requirePermission('reports'), async (req, res, next) => {
  try {
    const period = sanitizeText(req.query.period || 'all', 24);
    const dateFrom = sanitizeText(req.query.date_from, 20);
    const dateTo = sanitizeText(req.query.date_to, 20);

    let dateCond = '1=1';
    const dateParams: any[] = [];
    if (period === 'daily') {
      dateCond = 'DATE(created_at) = UTC_DATE()';
    } else if (period === 'weekly') {
      dateCond = 'created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)';
    } else if (period === 'monthly') {
      dateCond = 'created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)';
    } else if (period === 'yearly') {
      dateCond = 'created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 365 DAY)';
    } else if (period === 'custom' && dateFrom && dateTo) {
      dateCond = 'DATE(created_at) BETWEEN ? AND ?';
      dateParams.push(dateFrom, dateTo);
    }

    const [depSum, wdSum, ordSum, commSum, walletLiab, senderRows, receiverRows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(amount_paisa), 0) AS total_dep,
           COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_paisa ELSE 0 END), 0) AS approved_dep,
           COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN amount_paisa ELSE 0 END), 0) AS pending_dep,
           COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_paisa ELSE 0 END), 0) AS rejected_dep
         FROM deposits WHERE ${dateCond}`,
        dateParams
      ),
      query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(amount_paisa), 0) AS total_wd,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN net_amount_paisa ELSE 0 END), 0) AS paid_wd,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN fee_paisa ELSE 0 END), 0) AS wd_fees
         FROM withdrawals WHERE ${dateCond}`,
        dateParams
      ),
      query<RowDataPacket[]>(
        `SELECT
           COUNT(CASE WHEN status = 'completed' THEN 1 END) AS total_orders,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount_paisa ELSE 0 END), 0) AS order_vol,
           COALESCE(SUM(CASE WHEN status = 'refunded' THEN total_amount_paisa ELSE 0 END), 0) AS refunds
         FROM orders WHERE ${dateCond}`,
        dateParams
      ),
      query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(commission_amount_paisa), 0) AS total_comm,
           COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_paisa ELSE 0 END), 0) AS paid_comm,
           COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN commission_amount_paisa ELSE 0 END), 0) AS uncredited_comm
         FROM commissions WHERE ${dateCond}`,
        dateParams
      ),
      query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(balance_paisa), 0) AS wallet_liab,
           COALESCE(SUM(locked_balance_paisa), 0) AS pending_liab
         FROM wallets`
      ),
      query<RowDataPacket[]>(
        `SELECT
           sender_number,
           COUNT(*) AS total_requests,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
           SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending_count,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
           COALESCE(SUM(amount_paisa), 0) AS total_submitted,
           COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_paisa ELSE 0 END), 0) AS total_approved,
           MIN(created_at) AS first_tx_date,
           MAX(created_at) AS last_tx_date
         FROM deposits
         WHERE ${dateCond}
         GROUP BY sender_number
         ORDER BY total_approved DESC LIMIT 200`,
        dateParams
      ),
      query<RowDataPacket[]>(
        `SELECT
           receiver_number AS receiving_number,
           payment_method,
           COUNT(*) AS total_deposits,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_deposits,
           SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending_deposits,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_deposits,
           COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_paisa ELSE 0 END), 0) AS total_received,
           MIN(created_at) AS first_used,
           MAX(created_at) AS last_used
         FROM deposits
         WHERE ${dateCond}
         GROUP BY receiver_number, payment_method
         ORDER BY total_received DESC LIMIT 200`,
        dateParams
      ),
    ]);

    const approvedDep = Number(depSum[0]?.approved_dep || 0);
    const paidWd = Number(wdSum[0]?.paid_wd || 0);
    const orderVol = Number(ordSum[0]?.order_vol || 0);
    const wdFees = Number(wdSum[0]?.wd_fees || 0);
    const paidComm = Number(commSum[0]?.paid_comm || 0);

    res.json({
      success: true,
      data: {
        cash_flow: {
          money_received: fromPaisa(approvedDep),
          money_paid: fromPaisa(paidWd),
          net_cash_flow: fromPaisa(approvedDep - paidWd),
          user_wallet_liabilities: fromPaisa(walletLiab[0]?.wallet_liab),
          pending_liabilities: fromPaisa(walletLiab[0]?.pending_liab),
          commission_liability: fromPaisa(commSum[0]?.uncredited_comm),
        },
        financial_summary: {
          total_deposits: fromPaisa(depSum[0]?.total_dep),
          total_approved_deposits: fromPaisa(approvedDep),
          total_pending_deposits: fromPaisa(depSum[0]?.pending_dep),
          total_rejected_deposits: fromPaisa(depSum[0]?.rejected_dep),
          total_withdrawals: fromPaisa(wdSum[0]?.total_wd),
          total_paid_withdrawals: fromPaisa(paidWd),
          total_orders: Number(ordSum[0]?.total_orders || 0),
          total_order_volume: fromPaisa(orderVol),
          total_refunds: fromPaisa(ordSum[0]?.refunds),
          total_commission: fromPaisa(commSum[0]?.total_comm),
          total_commission_paid: fromPaisa(paidComm),
          total_platform_revenue: fromPaisa(Math.max(0, orderVol + wdFees - paidComm)),
        },
        sender_number_report: senderRows.map((r) => ({
          sender_number: r.sender_number,
          total_requests: Number(r.total_requests),
          approved_count: Number(r.approved_count),
          pending_count: Number(r.pending_count),
          rejected_count: Number(r.rejected_count),
          total_submitted: fromPaisa(r.total_submitted),
          total_approved: fromPaisa(r.total_approved),
          first_tx_date: toIso(r.first_tx_date),
          last_tx_date: toIso(r.last_tx_date),
        })),
        receiving_number_report: receiverRows.map((r) => ({
          receiving_number: r.receiving_number,
          payment_method: r.payment_method,
          total_deposits: Number(r.total_deposits),
          approved_deposits: Number(r.approved_deposits),
          pending_deposits: Number(r.pending_deposits),
          rejected_deposits: Number(r.rejected_deposits),
          total_received: fromPaisa(r.total_received),
          first_used: toIso(r.first_used),
          last_used: toIso(r.last_used),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/payment-search', requirePermission('reports'), async (req, res, next) => {
  try {
    const q = sanitizeText(req.query.q, 120);
    const sender = sanitizeText(req.query.sender, 64);
    const receiver = sanitizeText(req.query.receiver, 64);

    if (sender) {
      const deps = await query<RowDataPacket[]>(
        `SELECT d.*, u.full_name, u.username, u.uid AS user_uid
         FROM deposits d INNER JOIN users u ON u.id = d.user_id
         WHERE d.sender_number = ? ORDER BY d.created_at DESC LIMIT 200`,
        [sender]
      );
      res.json({ success: true, data: { deposits: deps.map(mapDeposit), transactions: [] } });
      return;
    }

    if (receiver) {
      const deps = await query<RowDataPacket[]>(
        `SELECT d.*, u.full_name, u.username, u.uid AS user_uid
         FROM deposits d INNER JOIN users u ON u.id = d.user_id
         WHERE d.receiver_number = ? ORDER BY d.created_at DESC LIMIT 200`,
        [receiver]
      );
      res.json({ success: true, data: { deposits: deps.map(mapDeposit), transactions: [] } });
      return;
    }

    const like = `%${q}%`;
    const [deps, txs] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT d.*, u.full_name, u.username, u.uid AS user_uid
         FROM deposits d INNER JOIN users u ON u.id = d.user_id
         WHERE d.transaction_id LIKE ? OR d.sender_number LIKE ? OR d.receiver_number LIKE ?
            OR d.deposit_uid LIKE ? OR u.username LIKE ? OR u.uid LIKE ?
         ORDER BY d.created_at DESC LIMIT 100`,
        [like, like, like, like, like, like]
      ),
      query<RowDataPacket[]>(
        `SELECT t.*, u.full_name, u.username, u.uid AS user_uid
         FROM wallet_transactions t INNER JOIN users u ON u.id = t.user_id
         WHERE t.tx_uid LIKE ? OR t.reference_id LIKE ? OR t.sender_number LIKE ?
            OR t.receiver_number LIKE ? OR u.username LIKE ? OR u.uid LIKE ?
         ORDER BY t.created_at DESC LIMIT 100`,
        [like, like, like, like, like, like]
      ),
    ]);

    res.json({
      success: true,
      data: {
        deposits: deps.map(mapDeposit),
        transactions: txs.map(mapTransaction),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Admin Notifications & Member Broadcast
// ============================================================================
router.get('/notifications', requirePermission('notifications'), async (_req, res, next) => {
  try {
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100'
    );
    res.json({
      success: true,
      data: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link || null,
        is_read: Boolean(n.is_read),
        created_at: toIso(n.created_at),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read', requirePermission('notifications'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.body?.id, 128);
    if (id) {
      await execute('UPDATE admin_notifications SET is_read = 1 WHERE id = ?', [id]);
    } else {
      await execute('UPDATE admin_notifications SET is_read = 1');
    }
    res.json({ success: true, message: 'Admin notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/broadcast', requirePermission('notifications'), async (req, res, next) => {
  try {
    const title = sanitizeText(req.body?.title, 200);
    const message = sanitizeText(req.body?.message, 2000);
    const targetUserId = sanitizeText(req.body?.user_id, 128);

    if (!title || !message) {
      res.status(400).json({ success: false, message: 'Title and message are required.' });
      return;
    }

    if (targetUserId) {
      await createUserNotification(null, { userId: targetUserId, type: 'announcement', title, message });
    } else {
      const users = await query<RowDataPacket[]>(`SELECT id FROM users WHERE status = 'active'`);
      for (const u of users) {
        await createUserNotification(null, { userId: u.id, type: 'announcement', title, message });
      }
    }
    res.json({ success: true, message: 'Announcement dispatched successfully.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Admin Support Desk
// ============================================================================
router.get('/support', requirePermission('support'), async (_req, res, next) => {
  try {
    const tickets = await query<RowDataPacket[]>(
      `SELECT t.*, u.full_name, u.username, u.uid AS user_uid, u.email
       FROM support_tickets t
       INNER JOIN users u ON u.id = t.user_id
       ORDER BY t.updated_at DESC LIMIT 200`
    );
    res.json({
      success: true,
      data: tickets.map((t) => ({
        ...t,
        user_name: t.full_name,
        user_email: t.email,
        internal_note: t.internal_note || '',
        created_at: toIso(t.created_at),
        updated_at: toIso(t.updated_at),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/support/contacts', requirePermission('support'), async (_req, res, next) => {
  try {
    const contacts = await query<RowDataPacket[]>('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100');
    res.json({
      success: true,
      data: contacts.map((c) => ({ ...c, created_at: toIso(c.created_at) })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/support/:id', requirePermission('support'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const tickets = await query<RowDataPacket[]>(
      `SELECT t.*, u.full_name, u.username, u.uid AS user_uid, u.email
       FROM support_tickets t INNER JOIN users u ON u.id = t.user_id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    if (!tickets.length) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }
    const msgs = await query<RowDataPacket[]>(
      'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json({
      success: true,
      data: {
        ticket: {
          ...tickets[0],
          user_name: tickets[0].full_name,
          user_email: tickets[0].email,
          internal_note: tickets[0].internal_note || '',
          created_at: toIso(tickets[0].created_at),
          updated_at: toIso(tickets[0].updated_at),
        },
        messages: msgs.map((m) => ({ ...m, created_at: toIso(m.created_at) })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/support/:id/reply', requirePermission('support'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    const message = sanitizeText(req.body?.message, 3000);
    const status = sanitizeText(req.body?.status, 32);
    const internalNote = req.body?.internal_note !== undefined ? sanitizeText(req.body.internal_note, 2000) : null;

    const tickets = await query<RowDataPacket[]>('SELECT * FROM support_tickets WHERE id = ? LIMIT 1', [id]);
    if (!tickets.length) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }
    const ticket = tickets[0];

    if (message) {
      await execute(
        `INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, sender_name, message, created_at)
         VALUES (?, ?, 'admin', ?, ?, ?, UTC_TIMESTAMP())`,
        [genId('smsg'), id, req.admin!.id, req.admin!.full_name, message]
      );
      await createUserNotification(null, {
        userId: ticket.user_id,
        type: 'support',
        title: `Support Reply: ${ticket.ticket_uid}`,
        message: `GO PAY BD Support replied to "${ticket.subject}".`,
        link: '/dashboard/support',
      });
    }

    const nextStatus = ['open', 'in_progress', 'answered', 'resolved', 'closed'].includes(status)
      ? status
      : message
      ? 'answered'
      : 'in_progress';
    await execute(
      'UPDATE support_tickets SET status = ?, internal_note = COALESCE(?, internal_note), assigned_admin_id = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [nextStatus, internalNote, req.admin!.id, id]
    );

    res.json({ success: true, message: 'Support ticket updated.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Staff & RBAC Management
// ============================================================================
router.get('/staff', requirePermission('staff'), async (_req, res, next) => {
  try {
    const [roles, staff] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM admin_roles ORDER BY id ASC'),
      query<RowDataPacket[]>(
        `SELECT a.id, a.admin_uid, a.full_name, a.email, a.role_id, a.status, a.last_login_at, a.created_at,
                r.name AS role_name, r.slug AS role_slug
         FROM admins a
         INNER JOIN admin_roles r ON r.id = a.role_id
         ORDER BY a.created_at ASC`
      ),
    ]);
    res.json({
      success: true,
      data: {
        roles: roles.map((r) => ({
          id: Number(r.id),
          slug: r.slug,
          name: r.name,
          description: r.description,
          permissions: parsePermissions(r.permissions_json),
        })),
        staff: staff.map((s) => ({
          id: s.id,
          admin_uid: s.admin_uid,
          full_name: s.full_name,
          email: s.email,
          role_id: Number(s.role_id),
          role_name: s.role_name,
          role_slug: s.role_slug,
          status: s.status,
          last_login_at: toIso(s.last_login_at),
          created_at: toIso(s.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/staff', requirePermission('staff'), async (req, res, next) => {
  try {
    const fullName = sanitizeText(req.body?.full_name, 160);
    const email = sanitizeText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || '');
    const pin = sanitizeText(req.body?.pin, 16);
    const roleId = Number(req.body?.role_id || 2);

    if (!fullName || !isValidEmail(email) || password.length < 8) {
      res.status(400).json({ success: false, message: 'Name, valid email, and password (8+ chars) are required.' });
      return;
    }

    const pwHash = await hashPassword(password);
    const pinHash = pin ? await hashPassword(pin) : null;
    const id = genId('adm');
    const adminUid = genCode('ADM', 4);

    await execute(
      `INSERT INTO admins (id, admin_uid, full_name, email, password_hash, pin_hash, role_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [id, adminUid, fullName, email, pwHash, pinHash, roleId]
    );

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'staff_created',
      entityType: 'admin',
      entityId: id,
      newValues: { full_name: fullName, email, role_id: roleId },
    });

    res.status(201).json({ success: true, message: 'Admin staff account created.' });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'A staff account with this email already exists.' });
      return;
    }
    next(err);
  }
});

router.put('/staff/:id', requirePermission('staff'), async (req, res, next) => {
  try {
    const id = sanitizeText(req.params.id, 128);
    if (id === PRIMARY_ADMIN_ID && req.body?.status === 'suspended') {
      res.status(400).json({ success: false, message: 'Cannot suspend the primary administrator account.' });
      return;
    }
    const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
    await execute('UPDATE admins SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [status, id]);
    if (status === 'suspended') {
      await execute(`DELETE FROM sessions WHERE actor_type = 'admin' AND actor_id = ?`, [id]);
    }
    res.json({ success: true, message: `Staff account ${status}.` });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Immutable Audit & Login History Logs
// ============================================================================
router.get('/audit-logs', requirePermission('audit'), async (_req, res, next) => {
  try {
    const [auditRows, loginRows] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'),
      query<RowDataPacket[]>('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 200'),
    ]);
    const mappedAudits = auditRows.map((a) => ({
      id: a.id,
      actor_type: a.actor_type,
      actor_name: a.actor_name,
      admin_name: a.actor_name,
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      old_values: a.old_values,
      new_values: a.new_values,
      ip_address: a.ip_address,
      created_at: toIso(a.created_at),
    }));
    res.json({
      success: true,
      data: {
        audit_logs: mappedAudits,
        activity_logs: mappedAudits.filter((a) => a.actor_type === 'admin'),
        login_logs: loginRows.map((l) => ({
          id: l.id,
          actor_type: l.actor_type,
          identifier: l.identifier,
          success: Boolean(l.success),
          ip_address: l.ip_address,
          created_at: toIso(l.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Dynamic Platform Settings (including Security Deposit Tiers ৳825 / ৳1,825)
// ============================================================================
router.get('/settings', requirePermission('settings'), async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', requirePermission('settings'), async (req, res, next) => {
  try {
    const incoming = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ success: false, message: 'Settings object is required.' });
      return;
    }

    await withTransaction(async (conn) => {
      for (const [key, val] of Object.entries(incoming)) {
        const cleanKey = sanitizeText(key, 120).replace(/[^a-zA-Z0-9_]/g, '');
        if (!cleanKey) continue;
        const cleanVal = sanitizeText(val, 2000);
        await conn.execute(
          `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
           VALUES (?, ?, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = UTC_TIMESTAMP()`,
          [cleanKey, cleanVal]
        );
      }
    });

    await recordAuditLog({
      req,
      actorType: 'admin',
      actorId: req.admin!.id,
      actorName: req.admin!.full_name,
      action: 'platform_settings_updated',
      entityType: 'platform_settings',
      entityId: 'global',
      newValues: incoming,
    });

    const fresh = await getPlatformSettings();
    res.json({ success: true, message: 'Platform settings saved successfully.', data: fresh });
  } catch (err) {
    next(err);
  }
});

export default router;
