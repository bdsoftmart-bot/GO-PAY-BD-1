import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { checkDatabaseHealth, execute, query } from '../database/pool';
import { createAdminNotification, getPlatformSettings } from '../services/platformService';
import { DEFAULT_PUBLIC_SETTINGS, fromPaisa, genId, isValidEmail, sanitizeText } from '../utils/helpers';

import { env } from '../config/env';

const router = Router();

// Health check — verifies server + MySQL status without exposing credentials
router.get('/health', async (_req, res) => {
  const db = await checkDatabaseHealth();
  const status = db.connected ? 'ok' : db.configured ? 'degraded' : 'standby';
  const healthy = db.connected || (!env.isProd && !db.configured);
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status,
    database: db.connected ? 'connected' : db.configured ? 'disconnected' : 'not_configured',
    timestamp: new Date().toISOString(),
  });
});

// Public platform settings (never exposes admin secrets)
router.get('/public/settings', async (_req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json({ success: true, data: settings });
  } catch {
    res.json({ success: true, data: DEFAULT_PUBLIC_SETTINGS });
  }
});

// Public catalog products
router.get('/public/catalog', async (_req, res, next) => {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT id, sku, name, category, description, price_paisa, commission_eligible, is_active
       FROM catalog_products
       WHERE is_active = 1
       ORDER BY price_paisa ASC`
    );
    res.json({
      success: true,
      data: rows.map((p) => {
        const price = fromPaisa(p.price_paisa);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          description: p.description || '',
          price,
          unit_price: price,
          commission_eligible: Boolean(p.commission_eligible),
          is_active: Boolean(p.is_active),
        };
      }),
    });
  } catch (err: any) {
    if (err?.status === 503) {
      res.json({ success: true, data: [] });
      return;
    }
    next(err);
  }
});

// Public referral link click tracker
router.post('/public/referral-click', async (req, res, next) => {
  try {
    const code = sanitizeText(req.body?.code || req.body?.referral_code, 64).toUpperCase();
    if (!code) {
      res.status(400).json({ success: false, message: 'Referral code is required.' });
      return;
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT referral_code, username, full_name FROM public_referrals WHERE UPPER(referral_code) = ? LIMIT 1`,
      [code]
    );
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Referral code not found.' });
      return;
    }

    await execute(
      `UPDATE public_referrals SET clicks = clicks + 1, updated_at = UTC_TIMESTAMP() WHERE referral_code = ?`,
      [rows[0].referral_code]
    );

    res.json({
      success: true,
      data: {
        referral_code: rows[0].referral_code,
        sponsor_username: rows[0].username,
        sponsor_name: rows[0].full_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Public contact inquiry form
router.post('/public/contact', async (req, res, next) => {
  try {
    const name = sanitizeText(req.body?.name, 160);
    const email = sanitizeText(req.body?.email, 190).toLowerCase();
    const phone = sanitizeText(req.body?.phone, 32);
    const subject = sanitizeText(req.body?.subject || 'General Inquiry', 200);
    const message = sanitizeText(req.body?.message, 2500);

    if (!name || !isValidEmail(email) || message.length < 5) {
      res.status(400).json({
        success: false,
        message: 'Please provide your name, a valid email address, and a message.',
      });
      return;
    }

    const id = genId('cmsg');
    await execute(
      `INSERT INTO contact_messages (id, name, email, phone, subject, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'new', UTC_TIMESTAMP())`,
      [id, name, email, phone || null, subject, message]
    );

    await createAdminNotification(null, {
      type: 'contact',
      title: `New Contact Message: ${subject}`,
      message: `${name} (${email}) sent an inquiry.`,
      link: '/admin/support',
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been submitted. Our support team will reply shortly.',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
