import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../database/pool';
import { requireUser } from '../middleware/auth';
import {
  depositScreenshotUpload,
  profileAvatarUpload,
  supportAttachmentUpload,
  toPublicUploadUrl,
} from '../middleware/upload';
import {
  createAdminNotification,
  createUserNotification,
  getPlatformSettings,
  insertWalletTransaction,
  nextInvoiceNumber,
} from '../services/platformService';
import {
  computeSecurityDepositRequirement,
  fromPaisa,
  genCode,
  genId,
  hashPassword,
  isValidAccountNumber,
  isValidBdPhone,
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
  normalizeTrxKey,
  sanitizeText,
  toIso,
  toPaisa,
  verifyPassword,
} from '../utils/helpers';

const router = Router();
router.use(requireUser);

// ============================================================================
// Dashboard Overview + 6-Month Analytics
// ============================================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [
      walletRows,
      pendingDepRows,
      refCountRows,
      orderStatRows,
      recentTx,
      recentDeps,
      recentWds,
      recentOrds,
      recentComms,
      depMonthly,
      wdMonthly,
      commMonthly,
    ] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]),
      query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM deposits WHERE user_id = ? AND status IN ('pending','processing')`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT
           SUM(CASE WHEN level = 1 THEN 1 ELSE 0 END) AS l1,
           SUM(CASE WHEN level = 2 THEN 1 ELSE 0 END) AS l2
         FROM referrals WHERE referrer_user_id = ?`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount_paisa), 0) AS vol
         FROM orders WHERE user_id = ? AND status IN ('completed','processing','pending')`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT o.*,
                COALESCE(
                  (SELECT c.status FROM commissions c WHERE c.order_id = o.id ORDER BY c.created_at DESC LIMIT 1),
                  'none'
                ) AS commission_status
         FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 10`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT c.*, o.order_uid, eu.username AS earner_username, eu.full_name AS earner_name
         FROM commissions c
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN users eu ON eu.id = c.earner_user_id
         WHERE c.earner_user_id = ?
         ORDER BY c.created_at DESC LIMIT 10`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COALESCE(SUM(amount_paisa), 0) AS total
         FROM deposits WHERE user_id = ? AND status = 'approved'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
         GROUP BY ym`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COALESCE(SUM(net_amount_paisa), 0) AS total
         FROM withdrawals WHERE user_id = ? AND status = 'paid'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
         GROUP BY ym`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COALESCE(SUM(commission_amount_paisa), 0) AS total
         FROM commissions WHERE earner_user_id = ? AND status = 'credited'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
         GROUP BY ym`,
        [userId]
      ),
    ]);

    const [pendingCommRow] = await query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(commission_amount_paisa), 0) AS total
       FROM commissions WHERE earner_user_id = ? AND status IN ('pending','approved')`,
      [userId]
    );
    const wallet = mapWallet(walletRows[0] || { user_id: userId }, {
      pendingCommissionPaisa: pendingCommRow?.total,
    });

    // Build 6-month chart buckets
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const depMap = new Map(depMonthly.map((r) => [String(r.ym), fromPaisa(r.total)]));
    const wdMap = new Map(wdMonthly.map((r) => [String(r.ym), fromPaisa(r.total)]));
    const commMap = new Map(commMonthly.map((r) => [String(r.ym), fromPaisa(r.total)]));

    const analytics: Array<{ month: string; deposits: number; withdrawals: number; commissions: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      analytics.push({
        month: `${monthNames[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        deposits: depMap.get(ym) || 0,
        withdrawals: wdMap.get(ym) || 0,
        commissions: commMap.get(ym) || 0,
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          total_balance: wallet.total_balance,
          available_balance: wallet.available_balance,
          pending_balance: wallet.pending_balance,
          pending_deposits: fromPaisa(pendingDepRows[0]?.total),
          total_deposits: wallet.total_deposited,
          total_withdrawals: wallet.total_withdrawn,
          total_earnings: wallet.total_commission,
          total_commission: wallet.total_commission,
          direct_referrals: Number(refCountRows[0]?.l1 || 0),
          level2_referrals: Number(refCountRows[0]?.l2 || 0),
          total_orders: Number(orderStatRows[0]?.cnt || 0),
          total_order_value: fromPaisa(orderStatRows[0]?.vol),
        },
        wallet,
        analytics,
        recent: {
          transactions: recentTx.map(mapTransaction),
          deposits: recentDeps.map(mapDeposit),
          withdrawals: recentWds.map(mapWithdrawal),
          orders: recentOrds.map(mapOrder),
          commissions: recentComms.map(mapCommission),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Wallet & Ledger Transactions
// ============================================================================
router.get('/wallet', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [walletRows, recentRows, pendingCommRows, activePmRows, settings] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]),
      query<RowDataPacket[]>(
        'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(commission_amount_paisa), 0) AS total
         FROM commissions WHERE earner_user_id = ? AND status IN ('pending','approved')`,
        [userId]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM payment_methods WHERE user_id = ? AND status = 'active'`,
        [userId]
      ),
      getPlatformSettings(),
    ]);

    const linkedCount = Number(activePmRows[0]?.cnt || 0);
    const reqDeposit = computeSecurityDepositRequirement(linkedCount, settings);
    const walletMapped = mapWallet(walletRows[0] || { user_id: userId }, {
      pendingCommissionPaisa: pendingCommRows[0]?.total,
    });

    res.json({
      success: true,
      data: {
        ...walletMapped,
        wallet: walletMapped,
        recent_transactions: recentRows.map(mapTransaction),
        security_deposit_enabled: reqDeposit.enabled,
        security_deposit_1_account: Number(settings.security_deposit_1_account || 825),
        security_deposit_2_accounts: Number(settings.security_deposit_2_accounts || 1825),
        security_deposit_extra_account: Number(settings.security_deposit_extra_account || 1000),
        linked_accounts_count: linkedCount,
        next_account_number: reqDeposit.nextSlot,
        required_security_deposit: reqDeposit.requiredBdt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/wallet/transactions', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const whereParts: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    const typeFilter = sanitizeText(req.query.type || req.query.tx_type, 64);
    if (typeFilter && typeFilter !== 'all') {
      whereParts.push('type = ?');
      params.push(typeFilter);
    }
    const statusFilter = sanitizeText(req.query.status, 32);
    if (statusFilter && statusFilter !== 'all') {
      whereParts.push('status = ?');
      params.push(statusFilter);
    }
    const methodFilter = sanitizeText(req.query.payment_method, 64);
    if (methodFilter && methodFilter !== 'all') {
      whereParts.push('payment_method = ?');
      params.push(methodFilter);
    }
    const dirFilter = sanitizeText(req.query.direction, 16);
    if (dirFilter === 'credit' || dirFilter === 'debit') {
      whereParts.push('direction = ?');
      params.push(dirFilter);
    }
    const minAmtRaw = req.query.min_amount !== undefined && req.query.min_amount !== '' ? Number(req.query.min_amount) : null;
    if (minAmtRaw !== null && Number.isFinite(minAmtRaw)) {
      whereParts.push('amount_paisa >= ?');
      params.push(toPaisa(minAmtRaw));
    }
    const maxAmtRaw = req.query.max_amount !== undefined && req.query.max_amount !== '' ? Number(req.query.max_amount) : null;
    if (maxAmtRaw !== null && Number.isFinite(maxAmtRaw)) {
      whereParts.push('amount_paisa <= ?');
      params.push(toPaisa(maxAmtRaw));
    }
    const search = sanitizeText(req.query.search, 120);
    if (search) {
      whereParts.push('(tx_uid LIKE ? OR description LIKE ? OR reference_id LIKE ? OR sender_number LIKE ? OR receiver_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    const dateFrom = sanitizeText(req.query.date_from, 20);
    if (dateFrom) {
      whereParts.push('DATE(created_at) >= ?');
      params.push(dateFrom);
    }
    const dateTo = sanitizeText(req.query.date_to, 20);
    if (dateTo) {
      whereParts.push('DATE(created_at) <= ?');
      params.push(dateTo);
    }

    const whereSql = whereParts.join(' AND ');
    const [countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM wallet_transactions WHERE ${whereSql}`, params),
      query<RowDataPacket[]>(
        `SELECT * FROM wallet_transactions WHERE ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = Number(countRows[0]?.cnt || 0);
    res.json({
      success: true,
      data: {
        items: rows.map(mapTransaction),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Deposits (with duplicate TrxID lock & multer screenshot upload)
// ============================================================================
router.get('/deposit-methods', async (_req, res, next) => {
  try {
    const [rows, settings] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT * FROM payment_settings WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC`
      ),
      getPlatformSettings(),
    ]);

    const depEnabled = settings.deposit_enabled !== 'false';
    const minDep = Number(settings.min_deposit || 100);
    const maxDep = Number(settings.max_deposit || 500000);

    res.json({
      success: true,
      data: {
        methods: rows.map(mapPaymentSetting),
        deposit_enabled: depEnabled,
        global_min_deposit: minDep,
        global_max_deposit: maxDep,
        min_deposit: minDep,
        max_deposit: maxDep,
        rules: {
          deposit_enabled: depEnabled,
          min_deposit: minDep,
          max_deposit: maxDep,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/deposits', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const status = sanitizeText(req.query.status, 32);
    const params: any[] = [userId];
    let sql = 'SELECT * FROM deposits WHERE user_id = ?';
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows.map(mapDeposit) });
  } catch (err) {
    next(err);
  }
});

router.post('/deposits', depositScreenshotUpload.single('screenshot'), async (req, res, next) => {
  try {
    const user = req.user!;
    const settings = await getPlatformSettings();
    if (settings.deposit_enabled === 'false') {
      res.status(403).json({ success: false, message: 'Deposits are temporarily disabled.' });
      return;
    }

    const paymentSettingId = sanitizeText(req.body?.payment_setting_id, 128);
    const amount = Number(req.body?.amount);
    const senderNumber = sanitizeText(req.body?.sender_number, 64);
    const rawTrx = sanitizeText(req.body?.transaction_id, 120);
    const note = sanitizeText(req.body?.note, 500);

    const minDep = Number(settings.min_deposit || 100);
    const maxDep = Number(settings.max_deposit || 500000);

    if (!Number.isFinite(amount) || amount < minDep || amount > maxDep) {
      res.status(400).json({
        success: false,
        message: `Deposit amount must be between ৳${minDep} and ৳${maxDep}.`,
      });
      return;
    }
    if (senderNumber.length < 6) {
      res.status(400).json({ success: false, message: 'Please enter a valid sender number.' });
      return;
    }
    const trxKey = normalizeTrxKey(rawTrx);
    if (trxKey.length < 4) {
      res.status(400).json({ success: false, message: 'Please enter a valid Transaction ID (TrxID).' });
      return;
    }

    const amountPaisa = toPaisa(amount);
    const screenshotUrl = toPublicUploadUrl('deposits', req.file?.filename);

    const created = await withTransaction(async (conn) => {
      let paymentMethod = sanitizeText(req.body?.payment_method, 64) || 'bKash';
      let receiverNumber = sanitizeText(req.body?.receiver_number || req.body?.receiving_number, 64);
      let accountType = 'personal';

      if (paymentSettingId) {
        const [psRows] = await conn.execute<RowDataPacket[]>(
          'SELECT * FROM payment_settings WHERE id = ? AND is_active = 1 LIMIT 1',
          [paymentSettingId]
        );
        if (!psRows.length) {
          throw Object.assign(new Error('Selected receiving payment channel is no longer active.'), { status: 400 });
        }
        const ps = psRows[0];
        paymentMethod = ps.method_type;
        receiverNumber = ps.account_number;
        accountType = ps.account_type || 'personal';
        if (amountPaisa < Number(ps.min_deposit_paisa || 0) || amountPaisa > Number(ps.max_deposit_paisa || 500000000)) {
          throw Object.assign(
            new Error(
              `Amount for ${ps.method_type} must be between ৳${fromPaisa(ps.min_deposit_paisa)} and ৳${fromPaisa(ps.max_deposit_paisa)}.`
            ),
            { status: 400 }
          );
        }
      }

      // Enforce global unique Transaction ID lock
      const [existingLock] = await conn.execute<RowDataPacket[]>(
        'SELECT transaction_id FROM deposit_transaction_locks WHERE transaction_id = ? LIMIT 1 FOR UPDATE',
        [trxKey]
      );
      if (existingLock.length > 0) {
        throw Object.assign(
          new Error('This Transaction ID (TrxID) has already been submitted. Duplicate claims are blocked.'),
          { status: 409 }
        );
      }

      const depId = genId('dep');
      const depositUid = genCode('DEP', 7);

      await conn.execute(
        `INSERT INTO deposit_transaction_locks (transaction_id, deposit_id, user_id, created_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP())`,
        [trxKey, depId, user.id]
      );

      await conn.execute(
        `INSERT INTO deposits
           (id, deposit_uid, user_id, payment_method, payment_setting_id, account_type,
            amount_paisa, sender_number, receiver_number, transaction_id, screenshot_url, note,
            status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          depId,
          depositUid,
          user.id,
          paymentMethod,
          paymentSettingId || null,
          accountType,
          amountPaisa,
          senderNumber,
          receiverNumber || 'Official Account',
          trxKey,
          screenshotUrl,
          note,
        ]
      );

      await createAdminNotification(conn, {
        type: 'deposit',
        title: `New Deposit Request: ৳${amount.toFixed(2)}`,
        message: `${user.full_name} (@${user.username}) submitted ${paymentMethod} TrxID ${trxKey} from ${senderNumber}.`,
        link: '/admin/deposits',
      });

      const [depRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM deposits WHERE id = ?', [depId]);
      return depRows[0];
    });

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted and queued for verification.',
      data: mapDeposit(created),
    });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        success: false,
        message: 'This Transaction ID (TrxID) has already been submitted.',
      });
      return;
    }
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Saved Payment Methods (Enforces Dynamic Tiered Security Deposit ৳825 / ৳1,825)
// ============================================================================
router.get('/payment-methods', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM payment_methods WHERE user_id = ? AND status != 'deleted' ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows.map(mapPaymentMethod) });
  } catch (err) {
    next(err);
  }
});

router.post('/payment-methods', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const methodType = sanitizeText(req.body?.method_name || req.body?.method_type, 64);
    const accountLabel = sanitizeText(req.body?.account_label || `${methodType} Wallet`, 160);
    const accountNumber = sanitizeText(req.body?.account_number, 64);
    const accountHolderName = sanitizeText(req.body?.account_holder_name || req.user!.full_name, 160);
    const accountType = sanitizeText(req.body?.account_type || 'personal', 32);
    const bankName = sanitizeText(req.body?.bank_name, 160);
    const branchName = sanitizeText(req.body?.branch_name, 160);
    const routingNumber = sanitizeText(req.body?.routing_number, 64);
    const notes = sanitizeText(req.body?.notes, 500);
    const verificationStatus = sanitizeText(req.body?.verification_status || 'active', 32) || 'active';
    const rawPinHash = sanitizeText(req.body?.pin_hash, 255);
    const rawPinPlain = sanitizeText(req.body?.pin, 16);
    const pinHash = rawPinHash || (rawPinPlain ? await hashPassword(rawPinPlain) : null);
    const isDefaultReq = Boolean(req.body?.is_default);

    if (!methodType || !accountNumber || !isValidAccountNumber(methodType, accountNumber)) {
      res.status(400).json({
        success: false,
        message: 'Please enter a valid payment method and account number.',
      });
      return;
    }

    const created = await withTransaction(async (conn) => {
      const settings = await getPlatformSettings(conn);
      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      const wallet = walletRows[0] || { total_deposited_paisa: 0, balance_paisa: 0 };

      const [existingRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id, account_number, method_type FROM payment_methods WHERE user_id = ? AND status = 'active'`,
        [userId]
      );

      const dup = existingRows.find(
        (r) => String(r.account_number) === accountNumber && String(r.method_type).toLowerCase() === methodType.toLowerCase()
      );
      if (dup) {
        throw Object.assign(new Error('This wallet account number is already linked to your profile.'), { status: 409 });
      }

      // Dynamic tiered Security Deposit (জামানত) verification
      const reqDeposit = computeSecurityDepositRequirement(existingRows.length, settings);
      const qualifyingDepositPaisa = Math.max(
        Number(wallet.total_deposited_paisa || 0),
        Number(wallet.balance_paisa || 0)
      );
      if (reqDeposit.enabled && qualifyingDepositPaisa < reqDeposit.requiredPaisa) {
        const shortfallBdt = fromPaisa(reqDeposit.requiredPaisa - qualifyingDepositPaisa);
        throw Object.assign(
          new Error(
            `নিরাপত্তা জামানত প্রয়োজন: ${reqDeposit.nextSlot} নং ওয়ালেট অ্যাকাউন্ট যুক্ত করতে ন্যূনতম ৳${reqDeposit.requiredBdt.toLocaleString()} ডিপোজিট থাকতে হবে। আপনার আরও ৳${shortfallBdt.toLocaleString()} ডিপোজিট প্রয়োজন। (Security deposit of ৳${reqDeposit.requiredBdt} required for account #${reqDeposit.nextSlot}.)`
          ),
          { status: 403 }
        );
      }

      const makeDefault = isDefaultReq || existingRows.length === 0;
      if (makeDefault) {
        await conn.execute('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [userId]);
      }

      const pmId = genId('pm');
      await conn.execute(
        `INSERT INTO payment_methods
           (id, user_id, method_type, account_label, account_number, account_holder_name, account_type,
            bank_name, branch_name, routing_number, notes, is_default, verification_status, pin_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          pmId,
          userId,
          methodType,
          accountLabel,
          accountNumber,
          accountHolderName,
          accountType,
          bankName || null,
          branchName || null,
          routingNumber || null,
          notes || null,
          makeDefault ? 1 : 0,
          verificationStatus,
          pinHash,
        ]
      );

      const [fresh] = await conn.execute<RowDataPacket[]>('SELECT * FROM payment_methods WHERE id = ?', [pmId]);
      return fresh[0];
    });

    res.status(201).json({
      success: true,
      message: 'Payment method linked successfully.',
      data: mapPaymentMethod(created),
    });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.post('/payment-methods/:id/default', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    await withTransaction(async (conn) => {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM payment_methods WHERE id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
        [id, userId]
      );
      if (!rows.length) {
        throw Object.assign(new Error('Payment method not found.'), { status: 404 });
      }
      await conn.execute('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [userId]);
      await conn.execute('UPDATE payment_methods SET is_default = 1, updated_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    });
    res.json({ success: true, message: 'Default withdrawal method updated.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.put('/payment-methods/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    const existing = await query<RowDataPacket[]>(
      `SELECT * FROM payment_methods WHERE id = ? AND user_id = ? AND status != 'deleted' LIMIT 1`,
      [id, userId]
    );
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Payment method not found.' });
      return;
    }
    const cur = existing[0];
    const methodType = sanitizeText(req.body?.method_name || req.body?.method_type || cur.method_type, 64);
    const accountLabel = sanitizeText(req.body?.account_label || cur.account_label, 160);
    const accountNumber = sanitizeText(req.body?.account_number || cur.account_number, 64);
    const accountHolderName = sanitizeText(req.body?.account_holder_name || cur.account_holder_name, 160);
    const accountType = sanitizeText(req.body?.account_type || cur.account_type, 32);
    const notes = req.body?.notes !== undefined ? sanitizeText(req.body.notes, 500) : cur.notes;
    const verificationStatus = req.body?.verification_status !== undefined
      ? sanitizeText(req.body.verification_status, 32)
      : cur.verification_status || 'active';
    const rawPinHash = sanitizeText(req.body?.pin_hash, 255);
    const nextPinHash = rawPinHash || cur.pin_hash || null;

    if (!isValidAccountNumber(methodType, accountNumber)) {
      res.status(400).json({ success: false, message: 'Invalid account number.' });
      return;
    }

    await execute(
      `UPDATE payment_methods
       SET method_type = ?, account_label = ?, account_number = ?, account_holder_name = ?, account_type = ?,
           notes = ?, verification_status = ?, pin_hash = ?, updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND user_id = ?`,
      [methodType, accountLabel, accountNumber, accountHolderName, accountType, notes || null, verificationStatus, nextPinHash, id, userId]
    );
    const [fresh] = await query<RowDataPacket[]>('SELECT * FROM payment_methods WHERE id = ? LIMIT 1', [id]);
    res.json({ success: true, message: 'Payment method updated.', data: fresh ? mapPaymentMethod(fresh) : null });
  } catch (err) {
    next(err);
  }
});

router.delete('/payment-methods/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    const result = await execute(
      `UPDATE payment_methods SET status = 'deleted', is_default = 0, updated_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Payment method not found.' });
      return;
    }
    res.json({ success: true, message: 'Payment method removed.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Withdrawals (Atomic Balance Reservation + Fee Calculation + Safe Cancel)
// ============================================================================
router.get('/withdrawal-rules', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [settings, walletRows, methodRows] = await Promise.all([
      getPlatformSettings(),
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]),
      query<RowDataPacket[]>(
        `SELECT DISTINCT method_type FROM payment_settings WHERE is_active = 1 AND withdrawal_enabled = 1 ORDER BY display_order ASC`
      ),
    ]);
    const dailyLimit = Number(settings.daily_withdrawal_limit || 100000);
    const weeklyLimit = Number(settings.weekly_withdrawal_limit || dailyLimit * 5);
    const supportedMethods = methodRows.length
      ? methodRows.map((r) => String(r.method_type))
      : ['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank Transfer', 'Card'];

    res.json({
      success: true,
      data: {
        withdrawal_enabled: settings.withdrawal_enabled !== 'false',
        min_withdrawal: Number(settings.min_withdrawal || 300),
        max_withdrawal: Number(settings.max_withdrawal || 200000),
        withdrawal_fee_type: settings.withdrawal_fee_type || 'percentage',
        withdrawal_fee: Number(settings.withdrawal_fee || 1.5),
        daily_withdrawal_limit: dailyLimit,
        daily_limit: dailyLimit,
        weekly_limit: weeklyLimit,
        processing_time: settings.withdrawal_processing_time || '15–60 minutes',
        supported_methods: supportedMethods,
        wallet: mapWallet(walletRows[0] || { user_id: userId }),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/withdrawals', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    res.json({ success: true, data: rows.map(mapWithdrawal) });
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals', async (req, res, next) => {
  try {
    const user = req.user!;
    const amount = Number(req.body?.amount);
    const paymentMethodId = sanitizeText(req.body?.payment_method_id, 128);

    const created = await withTransaction(async (conn) => {
      const settings = await getPlatformSettings(conn);
      if (settings.withdrawal_enabled === 'false') {
        throw Object.assign(new Error('Withdrawals are temporarily paused.'), { status: 403 });
      }

      const minWd = Number(settings.min_withdrawal || 300);
      const maxWd = Number(settings.max_withdrawal || 200000);
      const dailyLimit = Number(settings.daily_withdrawal_limit || 100000);

      if (!Number.isFinite(amount) || amount < minWd || amount > maxWd) {
        throw Object.assign(new Error(`Withdrawal amount must be between ৳${minWd} and ৳${maxWd}.`), { status: 400 });
      }

      let methodType = sanitizeText(req.body?.payment_method, 64);
      let accountNumber = sanitizeText(req.body?.account_number, 64);
      let accountHolderName = sanitizeText(req.body?.account_holder_name || user.full_name, 160);
      let accountType = sanitizeText(req.body?.account_type || 'personal', 32);

      if (paymentMethodId) {
        const [pmRows] = await conn.execute<RowDataPacket[]>(
          `SELECT * FROM payment_methods WHERE id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
          [paymentMethodId, user.id]
        );
        if (!pmRows.length) {
          throw Object.assign(new Error('Selected withdrawal account not found.'), { status: 404 });
        }
        methodType = pmRows[0].method_type;
        accountNumber = pmRows[0].account_number;
        accountHolderName = pmRows[0].account_holder_name;
        accountType = pmRows[0].account_type;
      }

      if (!methodType || !accountNumber) {
        throw Object.assign(new Error('Please select a saved withdrawal account.'), { status: 400 });
      }

      const amountPaisa = toPaisa(amount);

      // Check daily withdrawal limit
      const [todayRows] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount_paisa), 0) AS total
         FROM withdrawals
         WHERE user_id = ? AND status IN ('pending','processing','approved','paid') AND DATE(created_at) = UTC_DATE()`,
        [user.id]
      );
      if (Number(todayRows[0]?.total || 0) + amountPaisa > toPaisa(dailyLimit)) {
        throw Object.assign(
          new Error(`Daily withdrawal limit of ৳${dailyLimit.toLocaleString()} exceeded.`),
          { status: 400 }
        );
      }

      // Lock wallet row FOR UPDATE to prevent double-spend / negative balance
      const [wRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [user.id]
      );
      if (!wRows.length) {
        throw Object.assign(new Error('Wallet not found.'), { status: 404 });
      }
      const wallet = wRows[0];
      const balanceBefore = Number(wallet.balance_paisa);
      if (balanceBefore < amountPaisa) {
        throw Object.assign(new Error('Insufficient available wallet balance for this withdrawal.'), { status: 400 });
      }

      const feeType = settings.withdrawal_fee_type || 'percentage';
      const feeVal = Math.max(0, Number(settings.withdrawal_fee || 0));
      const feePaisa =
        feeType === 'fixed'
          ? toPaisa(feeVal)
          : Math.round((amountPaisa * feeVal) / 100);
      const netAmountPaisa = Math.max(0, amountPaisa - feePaisa);
      if (netAmountPaisa <= 0) {
        throw Object.assign(new Error('Withdrawal net payout must be greater than zero after fees.'), { status: 400 });
      }

      const balanceAfter = balanceBefore - amountPaisa;
      const lockedAfter = Number(wallet.locked_balance_paisa) + amountPaisa;

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, locked_balance_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [balanceAfter, lockedAfter, user.id]
      );

      const wdId = genId('wd');
      const wdUid = genCode('WDR', 7);

      await conn.execute(
        `INSERT INTO withdrawals
           (id, withdrawal_uid, user_id, payment_method_id, payment_method, account_number,
            account_holder_name, account_type, amount_paisa, fee_paisa, net_amount_paisa,
            status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          wdId,
          wdUid,
          user.id,
          paymentMethodId || null,
          methodType,
          accountNumber,
          accountHolderName,
          accountType,
          amountPaisa,
          feePaisa,
          netAmountPaisa,
        ]
      );

      await insertWalletTransaction(conn, {
        userId: user.id,
        type: 'withdrawal_request',
        direction: 'debit',
        amountPaisa,
        balanceBeforePaisa: balanceBefore,
        balanceAfterPaisa: balanceAfter,
        referenceType: 'withdrawal',
        referenceId: wdUid,
        paymentMethod: methodType,
        receiverNumber: accountNumber,
        description: `Withdrawal reserved (${wdUid}) to ${methodType} ${accountNumber}`,
        status: 'pending',
      });

      await createAdminNotification(conn, {
        type: 'withdrawal',
        title: `Withdrawal Request: ৳${amount.toFixed(2)}`,
        message: `${user.full_name} (@${user.username}) requested ৳${fromPaisa(netAmountPaisa)} net payout to ${methodType} ${accountNumber}.`,
        link: '/admin/withdrawals',
      });

      const [fresh] = await conn.execute<RowDataPacket[]>('SELECT * FROM withdrawals WHERE id = ?', [wdId]);
      return fresh[0];
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted and funds reserved safely.',
      data: mapWithdrawal(created),
    });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

router.post('/withdrawals/:id/cancel', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);

    await withTransaction(async (conn) => {
      const [wdRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM withdrawals WHERE id = ? AND user_id = ? FOR UPDATE',
        [id, userId]
      );
      if (!wdRows.length) {
        throw Object.assign(new Error('Withdrawal request not found.'), { status: 404 });
      }
      const wd = wdRows[0];
      if (wd.status !== 'pending') {
        throw Object.assign(new Error('Only pending withdrawal requests can be cancelled.'), { status: 400 });
      }

      const [wRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      const wallet = wRows[0];
      const amt = Number(wd.amount_paisa);
      const balanceBefore = Number(wallet.balance_paisa);
      const balanceAfter = balanceBefore + amt;
      const lockedAfter = Math.max(0, Number(wallet.locked_balance_paisa) - amt);

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, locked_balance_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [balanceAfter, lockedAfter, userId]
      );
      await conn.execute(
        `UPDATE withdrawals SET status = 'cancelled', updated_at = UTC_TIMESTAMP() WHERE id = ?`,
        [id]
      );

      await insertWalletTransaction(conn, {
        userId,
        type: 'withdrawal_cancelled',
        direction: 'credit',
        amountPaisa: amt,
        balanceBeforePaisa: balanceBefore,
        balanceAfterPaisa: balanceAfter,
        referenceType: 'withdrawal',
        referenceId: wd.withdrawal_uid,
        paymentMethod: wd.payment_method,
        receiverNumber: wd.account_number,
        description: `Cancelled withdrawal ${wd.withdrawal_uid} refunded to available balance`,
        status: 'completed',
      });
    });

    res.json({ success: true, message: 'Withdrawal cancelled and funds returned to your available balance.' });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Referrals & Commission Earnings
// ============================================================================
router.get('/referrals/summary', async (req, res, next) => {
  try {
    const user = req.user!;
    const [refStats, commStats, clickRows, settings] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT
           SUM(CASE WHEN r.level = 1 THEN 1 ELSE 0 END) AS l1,
           SUM(CASE WHEN r.level = 2 THEN 1 ELSE 0 END) AS l2,
           SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS active_cnt
         FROM referrals r
         INNER JOIN users u ON u.id = r.referred_user_id
         WHERE r.referrer_user_id = ?`,
        [user.id]
      ),
      query<RowDataPacket[]>(
        `SELECT
           COUNT(DISTINCT order_id) AS ref_orders,
           COALESCE(SUM(CASE WHEN status = 'credited' THEN commission_amount_paisa ELSE 0 END), 0) AS credited,
           COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN commission_amount_paisa ELSE 0 END), 0) AS pending
         FROM commissions
         WHERE earner_user_id = ?`,
        [user.id]
      ),
      query<RowDataPacket[]>(
        'SELECT clicks FROM public_referrals WHERE user_id = ? LIMIT 1',
        [user.id]
      ),
      getPlatformSettings(),
    ]);

    const l1 = Number(refStats[0]?.l1 || 0);
    const l2 = Number(refStats[0]?.l2 || 0);
    const clicks = Number(clickRows[0]?.clicks || 0);
    const conversionRate = clicks > 0 ? Number(((l1 / clicks) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      data: {
        referral_code: user.referral_code,
        total_level_1: l1,
        total_direct: l1,
        total_level_2: l2,
        active_referrals: Number(refStats[0]?.active_cnt || 0),
        referral_orders: Number(commStats[0]?.ref_orders || 0),
        referral_earnings: fromPaisa(commStats[0]?.credited),
        pending_earnings: fromPaisa(commStats[0]?.pending),
        clicks_count: clicks,
        conversion_rate: conversionRate,
        commission_type: settings.commission_type || 'percentage',
        level_1_rate: settings.level_1_commission || '7',
        level_2_rate: settings.level_2_commission || '3',
        min_qualifying_order: Number(settings.min_qualifying_order || 100),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/referrals', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      `SELECT
         r.id, r.level, r.created_at AS joined_at,
         u.uid AS user_uid, u.full_name, u.username, u.status AS user_status,
         (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'completed') AS order_count,
         (SELECT COALESCE(SUM(c.commission_amount_paisa), 0)
            FROM commissions c
            WHERE c.earner_user_id = r.referrer_user_id AND c.source_user_id = u.id AND c.status = 'credited') AS comm_paisa
       FROM referrals r
       INNER JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        user_uid: r.user_uid,
        full_name: r.full_name,
        username: r.username,
        level: Number(r.level),
        order_count: Number(r.order_count || 0),
        commission_generated: fromPaisa(r.comm_paisa),
        user_status: r.user_status,
        joined_at: toIso(r.joined_at),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/referrals/earnings', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      `SELECT c.*, o.order_uid, su.username AS source_username, su.full_name AS source_name
       FROM commissions c
       LEFT JOIN orders o ON o.id = c.order_id
       LEFT JOIN users su ON su.id = c.source_user_id
       WHERE c.earner_user_id = ?
       ORDER BY c.created_at DESC LIMIT 200`,
      [userId]
    );
    res.json({ success: true, data: rows.map(mapCommission) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Orders & Sequential Invoices + 2-Level Referral Commission Engine
// ============================================================================
router.get('/orders', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      `SELECT o.*, i.id AS invoice_id, i.invoice_number,
              COALESCE(
                (SELECT c.status FROM commissions c WHERE c.order_id = o.id ORDER BY c.created_at DESC LIMIT 1),
                'none'
              ) AS commission_status
       FROM orders o
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC LIMIT 100`,
      [userId]
    );
    res.json({ success: true, data: rows.map(mapOrder) });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    const rows = await query<RowDataPacket[]>(
      `SELECT o.*, i.id AS invoice_id, i.invoice_number,
              COALESCE(
                (SELECT c.status FROM commissions c WHERE c.order_id = o.id ORDER BY c.created_at DESC LIMIT 1),
                'none'
              ) AS commission_status
       FROM orders o
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE o.id = ? AND o.user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }
    const orderRow = rows[0];
    const [invRows, commRows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT i.*, u.uid AS customer_uid, o.order_uid, o.payment_source AS payment_method
         FROM invoices i
         INNER JOIN users u ON u.id = i.user_id
         LEFT JOIN orders o ON o.id = i.order_id
         WHERE i.order_id = ? LIMIT 1`,
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
         WHERE c.order_id = ?`,
        [id]
      ),
    ]);
    res.json({
      success: true,
      data: {
        order: mapOrder(orderRow),
        items: [
          {
            id: orderRow.id,
            item_name: orderRow.product_name,
            quantity: Number(orderRow.quantity || 1),
            unit_price: fromPaisa(orderRow.unit_price_paisa),
            line_total: fromPaisa(orderRow.subtotal_paisa),
          },
        ],
        invoice: invRows[0] ? mapInvoice(invRows[0]) : null,
        commissions: commRows.map(mapCommission),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/orders', async (req, res, next) => {
  try {
    const user = req.user!;
    const productId = sanitizeText(req.body?.product_id, 128);
    const quantity = Math.max(1, Math.min(50, Math.floor(Number(req.body?.quantity) || 1)));
    const notes = sanitizeText(req.body?.notes, 500);

    if (!productId) {
      res.status(400).json({ success: false, message: 'Please select a service or product.' });
      return;
    }

    const result = await withTransaction(async (conn) => {
      const settings = await getPlatformSettings(conn);

      const [prodRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM catalog_products WHERE id = ? AND is_active = 1 LIMIT 1',
        [productId]
      );
      if (!prodRows.length) {
        throw Object.assign(new Error('Selected product or service is not available.'), { status: 404 });
      }
      const product = prodRows[0];

      const unitPricePaisa = Number(product.price_paisa);
      const subtotalPaisa = unitPricePaisa * quantity;
      const totalPaisa = subtotalPaisa;

      // Lock user wallet FOR UPDATE
      const [wRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [user.id]
      );
      const wallet = wRows[0];
      if (!wallet || Number(wallet.balance_paisa) < totalPaisa) {
        throw Object.assign(new Error('Insufficient wallet balance. Please deposit funds first.'), { status: 400 });
      }

      const balBefore = Number(wallet.balance_paisa);
      const balAfter = balBefore - totalPaisa;
      const spentAfter = Number(wallet.total_spent_paisa) + totalPaisa;

      await conn.execute(
        `UPDATE wallets SET balance_paisa = ?, total_spent_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
        [balAfter, spentAfter, user.id]
      );

      const orderId = genId('ord');
      const orderUid = genCode('ORD', 7);
      const invoiceId = genId('inv');
      const invoiceNumber = await nextInvoiceNumber(conn, settings.invoice_prefix || 'GPBD-INV');

      await conn.execute(
        `INSERT INTO orders
           (id, order_uid, user_id, product_id, product_name, quantity, unit_price_paisa,
            subtotal_paisa, discount_paisa, fee_paisa, total_amount_paisa, payment_source, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'wallet', 'completed', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [orderId, orderUid, user.id, product.id, product.name, quantity, unitPricePaisa, subtotalPaisa, totalPaisa, notes]
      );

      const itemsJson = JSON.stringify([
        {
          sku: product.sku,
          name: product.name,
          quantity,
          unit_price: fromPaisa(unitPricePaisa),
          subtotal: fromPaisa(subtotalPaisa),
        },
      ]);

      await conn.execute(
        `INSERT INTO invoices
           (id, invoice_number, order_id, user_id, customer_name, customer_email, customer_phone,
            items_json, subtotal_paisa, discount_paisa, fee_paisa, total_paisa, payment_status, issued_at, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'paid', UTC_TIMESTAMP(), ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          invoiceId,
          invoiceNumber,
          orderId,
          user.id,
          user.full_name,
          user.email,
          user.phone,
          itemsJson,
          subtotalPaisa,
          totalPaisa,
          notes,
        ]
      );

      await insertWalletTransaction(conn, {
        userId: user.id,
        type: 'order_payment',
        direction: 'debit',
        amountPaisa: totalPaisa,
        balanceBeforePaisa: balBefore,
        balanceAfterPaisa: balAfter,
        referenceType: 'order',
        referenceId: orderUid,
        paymentMethod: 'wallet',
        description: `Order ${orderUid}: ${product.name} (x${quantity})`,
        status: 'completed',
      });

      // 2-Level Referral Commission Engine (strictly order-based)
      const commEnabled = settings.commission_enabled !== 'false' && settings.referral_enabled !== 'false';
      const minQualifyingPaisa = toPaisa(Number(settings.min_qualifying_order || 100));
      const commCapPaisa = toPaisa(Number(settings.commission_cap || 50000));
      const autoCredit = (settings.commission_approval_mode || 'auto') === 'auto';
      const commType = settings.commission_type || 'percentage';

      if (commEnabled && Boolean(product.commission_eligible) && totalPaisa >= minQualifyingPaisa) {
        const [refRows] = await conn.execute<RowDataPacket[]>(
          `SELECT referrer_user_id, level FROM referrals WHERE referred_user_id = ? AND level IN (1, 2) ORDER BY level ASC`,
          [user.id]
        );

        for (const ref of refRows) {
          const earnerId = String(ref.referrer_user_id);
          if (earnerId === user.id) continue;

          const level = Number(ref.level);
          const rateVal = Number(level === 1 ? settings.level_1_commission || 7 : settings.level_2_commission || 3);
          if (rateVal <= 0) continue;

          let commPaisa =
            commType === 'fixed'
              ? toPaisa(rateVal)
              : Math.round((totalPaisa * rateVal) / 100);
          if (commCapPaisa > 0 && commPaisa > commCapPaisa) {
            commPaisa = commCapPaisa;
          }
          if (commPaisa <= 0) continue;

          const commId = genId('com');
          const commUid = genCode('COM', 7);

          await conn.execute(
            `INSERT INTO commissions
               (id, commission_uid, earner_user_id, source_user_id, order_id, level, rate_percent,
                base_amount_paisa, commission_amount_paisa, status, note, credited_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
            [
              commId,
              commUid,
              earnerId,
              user.id,
              orderId,
              level,
              rateVal,
              totalPaisa,
              commPaisa,
              autoCredit ? 'credited' : 'pending',
              `Level ${level} commission from order ${orderUid}`,
              autoCredit ? new Date() : null,
            ]
          );

          if (autoCredit) {
            const [ewRows] = await conn.execute<RowDataPacket[]>(
              'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
              [earnerId]
            );
            if (ewRows.length) {
              const eBalBefore = Number(ewRows[0].balance_paisa);
              const eBalAfter = eBalBefore + commPaisa;
              const eCommTotal = Number(ewRows[0].total_commission_paisa) + commPaisa;
              await conn.execute(
                `UPDATE wallets SET balance_paisa = ?, total_commission_paisa = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?`,
                [eBalAfter, eCommTotal, earnerId]
              );
              await insertWalletTransaction(conn, {
                userId: earnerId,
                type: 'referral_commission',
                direction: 'credit',
                amountPaisa: commPaisa,
                balanceBeforePaisa: eBalBefore,
                balanceAfterPaisa: eBalAfter,
                referenceType: 'commission',
                referenceId: commUid,
                description: `Level ${level} commission from @${user.username}'s order ${orderUid}`,
                status: 'completed',
              });
            }
          }

          await createUserNotification(conn, {
            userId: earnerId,
            type: 'commission',
            title: autoCredit
              ? `Commission Credited: ৳${fromPaisa(commPaisa)}`
              : `New Pending Commission: ৳${fromPaisa(commPaisa)}`,
            message: `Earned Level ${level} commission from order ${orderUid} by @${user.username}.`,
            link: '/dashboard/earnings',
          });
        }
      }

      const [freshOrder] = await conn.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [orderId]);
      const [freshInv] = await conn.execute<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      return { order: freshOrder[0], invoice: freshInv[0] };
    });

    res.status(201).json({
      success: true,
      message: 'Order placed and invoice generated successfully.',
      data: {
        order: mapOrder({ ...result.order, invoice_id: result.invoice.id, invoice_number: result.invoice.invoice_number }),
        invoice: mapInvoice(result.invoice),
      },
    });
  } catch (err: any) {
    if (err?.status) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
});

// ============================================================================
// Invoices
// ============================================================================
router.get('/invoices', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      `SELECT i.*, u.uid AS customer_uid, o.order_uid, o.payment_source AS payment_method
       FROM invoices i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.user_id = ?
       ORDER BY i.issued_at DESC LIMIT 100`,
      [userId]
    );
    res.json({ success: true, data: rows.map(mapInvoice) });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    const rows = await query<RowDataPacket[]>(
      `SELECT i.*, u.uid AS customer_uid, o.order_uid, o.payment_source AS payment_method
       FROM invoices i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.id = ? AND i.user_id = ?
       LIMIT 1`,
      [id, userId]
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

// ============================================================================
// Notifications
// ============================================================================
router.get('/notifications', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    const unread = rows.filter((n) => !n.is_read).length;
    res.json({
      success: true,
      data: {
        unread_count: unread,
        items: rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link || null,
          is_read: Boolean(n.is_read),
          created_at: toIso(n.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.body?.id, 128);
    if (id) {
      await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    } else {
      await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    }
    res.json({ success: true, message: 'Notifications updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/notifications/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    await execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true, message: 'Notification removed.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Support Desk (Tickets + Replies + Multer Attachment)
// ============================================================================
router.get('/support', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100',
      [userId]
    );
    res.json({
      success: true,
      data: rows.map((t) => ({
        id: t.id,
        ticket_uid: t.ticket_uid,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        created_at: toIso(t.created_at),
        updated_at: toIso(t.updated_at),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/support', supportAttachmentUpload.single('attachment'), async (req, res, next) => {
  try {
    const user = req.user!;
    const subject = sanitizeText(req.body?.subject, 200);
    const category = sanitizeText(req.body?.category || 'general', 64);
    const priorityRaw = sanitizeText(req.body?.priority || 'medium', 16);
    const priority = ['low', 'medium', 'high', 'urgent'].includes(priorityRaw) ? priorityRaw : 'medium';
    const description = sanitizeText(req.body?.description, 3000);

    if (subject.length < 3 || description.length < 5) {
      res.status(400).json({ success: false, message: 'Subject and description are required.' });
      return;
    }

    const attachmentUrl = toPublicUploadUrl('support', req.file?.filename);
    const ticketId = genId('tkt');
    const ticketUid = genCode('SUP', 6);

    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO support_tickets (id, ticket_uid, user_id, subject, category, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [ticketId, ticketUid, user.id, subject, category, priority]
      );
      await conn.execute(
        `INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, sender_name, message, attachment_url, created_at)
         VALUES (?, ?, 'user', ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [genId('smsg'), ticketId, user.id, user.full_name, description, attachmentUrl]
      );
      await createAdminNotification(conn, {
        type: 'support',
        title: `New Support Ticket ${ticketUid}`,
        message: `${user.full_name} (@${user.username}): ${subject}`,
        link: '/admin/support',
      });
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created.',
      data: { id: ticketId, ticket_uid: ticketUid },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/support/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = sanitizeText(req.params.id, 128);
    const tickets = await query<RowDataPacket[]>(
      'SELECT * FROM support_tickets WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!tickets.length) {
      res.status(404).json({ success: false, message: 'Support ticket not found.' });
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
          created_at: toIso(tickets[0].created_at),
          updated_at: toIso(tickets[0].updated_at),
        },
        messages: msgs.map((m) => ({
          id: m.id,
          sender_type: m.sender_type,
          sender_name: m.sender_name,
          message: m.message,
          attachment_url: m.attachment_url || null,
          created_at: toIso(m.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/support/:id/messages', supportAttachmentUpload.single('attachment'), async (req, res, next) => {
  try {
    const user = req.user!;
    const id = sanitizeText(req.params.id, 128);
    const message = sanitizeText(req.body?.message, 3000);
    if (!message) {
      res.status(400).json({ success: false, message: 'Message cannot be empty.' });
      return;
    }

    const tickets = await query<RowDataPacket[]>(
      'SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ? LIMIT 1',
      [id, user.id]
    );
    if (!tickets.length) {
      res.status(404).json({ success: false, message: 'Support ticket not found.' });
      return;
    }
    if (tickets[0].status === 'closed') {
      res.status(400).json({ success: false, message: 'This ticket is closed.' });
      return;
    }

    const attachmentUrl = toPublicUploadUrl('support', req.file?.filename);
    await execute(
      `INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, sender_name, message, attachment_url, created_at)
       VALUES (?, ?, 'user', ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [genId('smsg'), id, user.id, user.full_name, message, attachmentUrl]
    );
    await execute('UPDATE support_tickets SET updated_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Reply sent.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Profile, Avatar Upload & Password Change
// ============================================================================
router.get('/profile', async (req, res, next) => {
  try {
    const user = req.user!;
    const logs = await query<RowDataPacket[]>(
      `SELECT id, ip_address, success, created_at
       FROM login_logs
       WHERE actor_type = 'user' AND actor_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [user.id]
    );
    res.json({
      success: true,
      data: {
        user: mapUserPublic(user),
        profile: {
          avatar_url: user.avatar_url || null,
          address: user.address || '',
          city: user.city || '',
          preferred_language: user.preferred_language || 'en',
          notification_email: Boolean(user.notification_email),
          notification_inapp: Boolean(user.notification_inapp),
        },
        login_history: logs.map((l) => ({
          id: l.id,
          ip_address: l.ip_address,
          success: Boolean(l.success),
          created_at: toIso(l.created_at),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const user = req.user!;
    const fullName = req.body?.full_name !== undefined ? sanitizeText(req.body.full_name, 160) : user.full_name;
    const email = req.body?.email !== undefined ? sanitizeText(req.body.email, 190).toLowerCase() : user.email;
    const phone = req.body?.phone !== undefined ? sanitizeText(req.body.phone, 32) : user.phone;
    const address = req.body?.address !== undefined ? sanitizeText(req.body.address, 255) : user.address;
    const city = req.body?.city !== undefined ? sanitizeText(req.body.city, 120) : user.city;
    const prefLang =
      req.body?.preferred_language === 'bn'
        ? 'bn'
        : req.body?.preferred_language === 'en'
        ? 'en'
        : user.preferred_language;
    const notifEmail =
      req.body?.notification_email !== undefined ? (req.body.notification_email ? 1 : 0) : user.notification_email;
    const notifInapp =
      req.body?.notification_inapp !== undefined ? (req.body.notification_inapp ? 1 : 0) : user.notification_inapp;

    const sensitiveChanged = email !== user.email || phone !== user.phone;
    if (sensitiveChanged) {
      if (!isValidEmail(email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
      }
      if (phone && !isValidBdPhone(phone)) {
        res.status(400).json({ success: false, message: 'Invalid Bangladesh phone number.' });
        return;
      }
      const [uRow] = await query<RowDataPacket[]>('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [user.id]);
      if (uRow?.password_hash) {
        const currentPw = String(req.body?.current_password || '');
        const ok = await verifyPassword(currentPw, uRow.password_hash);
        if (!ok) {
          res.status(400).json({
            success: false,
            message: 'Current password is required to update email or phone number.',
          });
          return;
        }
      }
    }

    await execute(
      `UPDATE users
       SET full_name = ?, email = ?, phone = ?, address = ?, city = ?,
           preferred_language = ?, notification_email = ?, notification_inapp = ?, updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [fullName, email, phone, address, city, prefLang, notifEmail, notifInapp, user.id]
    );

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'That email address is already in use.' });
      return;
    }
    next(err);
  }
});

router.post('/profile/avatar', profileAvatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please upload a valid JPG, PNG, or WEBP image.' });
      return;
    }
    const avatarUrl = toPublicUploadUrl('avatars', req.file.filename);
    await execute('UPDATE users SET avatar_url = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [
      avatarUrl,
      req.user!.id,
    ]);
    res.json({ success: true, message: 'Profile photo updated.', data: { avatar_url: avatarUrl } });
  } catch (err) {
    next(err);
  }
});

router.post('/profile/change-password', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
      return;
    }

    const rows = await query<RowDataPacket[]>('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (rows[0].password_hash) {
      const ok = await verifyPassword(currentPassword, rows[0].password_hash);
      if (!ok) {
        res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        return;
      }
    }

    const newHash = await hashPassword(newPassword);
    await execute(
      `UPDATE users SET password_hash = ?, password_reset_required = 0, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
      [newHash, userId]
    );
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
