import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, query, withTransaction } from '../database/pool';
import {
  USER_COOKIE_NAME,
  authRateLimiter,
  clearSessionCookie,
  createDbSession,
  deleteDbSessionByRawToken,
  getCookieSameSite,
  isSecureRequest,
  recordLoginLog,
  resolveUserFromRequest,
  setSessionCookie,
} from '../middleware/auth';
import {
  createAdminNotification,
  createUserNotification,
  getPlatformSettings,
} from '../services/platformService';
import {
  genCode,
  genId,
  genReferralCode,
  hashPassword,
  hashToken,
  isValidBdPhone,
  isValidEmail,
  mapUserPublic,
  mapWallet,
  sanitizeText,
  verifyPassword,
} from '../utils/helpers';

const router = Router();
const GOOGLE_STATE_COOKIE = 'gpbd_google_oauth_state';

function getGoogleRedirectUri(req: Request): string {
  if (env.googleCallbackUrl) return env.googleCallbackUrl;
  const base = env.appUrl || `${isSecureRequest(req) ? 'https' : 'http'}://${req.headers.host}`;
  return `${base.replace(/\/+$/, '')}/auth/google/callback`;
}

// ============================================================================
// Register (Email + Password, transactional Wallet + 2-level Referral Creation)
// ============================================================================
router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    if (settings.registration_enabled === 'false') {
      res.status(403).json({
        success: false,
        message: 'New member registrations are temporarily paused.',
      });
      return;
    }

    const fullName = sanitizeText(req.body?.full_name, 160);
    const rawUsername = sanitizeText(req.body?.username, 64).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const email = sanitizeText(req.body?.email, 190).toLowerCase();
    const phone = sanitizeText(req.body?.phone, 32);
    const password = String(req.body?.password || '');
    const confirmPassword = req.body?.confirm_password;
    const referralCodeInput = sanitizeText(req.body?.referral_code, 64).toUpperCase();

    if (fullName.length < 2) {
      res.status(400).json({ success: false, message: 'Please enter your full name.' });
      return;
    }
    if (rawUsername.length < 3 || rawUsername.length > 32) {
      res.status(400).json({ success: false, message: 'Username must be between 3 and 32 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }
    if (!isValidBdPhone(phone)) {
      res.status(400).json({ success: false, message: 'Please provide a valid Bangladesh mobile number (01XXXXXXXXX).' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (confirmPassword !== undefined && password !== String(confirmPassword)) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const created = await withTransaction(async (conn) => {
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`,
        [email, rawUsername]
      );
      if (existing.length > 0) {
        if (String(existing[0].email).toLowerCase() === email) {
          throw Object.assign(new Error('An account with this email address already exists.'), { status: 409 });
        }
        throw Object.assign(new Error('This username is already taken. Please choose another.'), { status: 409 });
      }

      // Resolve optional Level 1 & Level 2 sponsor
      let sponsorId: string | null = null;
      let sponsorUsername: string | null = null;
      let level2SponsorId: string | null = null;

      if (referralCodeInput && settings.referral_enabled !== 'false') {
        const [sponsors] = await conn.execute<RowDataPacket[]>(
          `SELECT id, username, referred_by FROM users WHERE UPPER(referral_code) = ? OR UPPER(username) = ? LIMIT 1`,
          [referralCodeInput, referralCodeInput]
        );
        if (sponsors.length > 0) {
          sponsorId = sponsors[0].id;
          sponsorUsername = sponsors[0].username;
          if (sponsors[0].referred_by) {
            level2SponsorId = sponsors[0].referred_by;
          }
        }
      }

      const userId = genId('usr');
      const uid = genCode('GPBD', 6);
      const myReferralCode = genReferralCode(rawUsername);

      await conn.execute(
        `INSERT INTO users
           (id, uid, full_name, username, email, phone, password_hash, password_reset_required,
            referral_code, referred_by, sponsor_username, status, role, preferred_language,
            last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', 'user', 'en', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          userId,
          uid,
          fullName,
          rawUsername,
          email,
          phone,
          passwordHash,
          myReferralCode,
          sponsorId,
          sponsorUsername,
        ]
      );

      await conn.execute(
        `INSERT INTO wallets
           (user_id, balance_paisa, locked_balance_paisa, total_deposited_paisa, total_withdrawn_paisa,
            total_commission_paisa, total_spent_paisa, updated_at)
         VALUES (?, 0, 0, 0, 0, 0, 0, UTC_TIMESTAMP())`,
        [userId]
      );

      await conn.execute(
        `INSERT INTO public_referrals (referral_code, user_id, username, full_name, clicks, updated_at)
         VALUES (?, ?, ?, ?, 0, UTC_TIMESTAMP())`,
        [myReferralCode, userId, rawUsername, fullName]
      );

      if (sponsorId) {
        await conn.execute(
          `INSERT IGNORE INTO referrals (id, referrer_user_id, referred_user_id, level, status, created_at)
           VALUES (?, ?, ?, 1, 'active', UTC_TIMESTAMP())`,
          [genId('ref'), sponsorId, userId]
        );
        await createUserNotification(conn, {
          userId: sponsorId,
          type: 'referral',
          title: 'New Direct Referral Joined!',
          message: `${fullName} (@${rawUsername}) registered using your referral code.`,
          link: '/referrals',
        });
      }

      if (level2SponsorId && level2SponsorId !== sponsorId && level2SponsorId !== userId) {
        await conn.execute(
          `INSERT IGNORE INTO referrals (id, referrer_user_id, referred_user_id, level, status, created_at)
           VALUES (?, ?, ?, 2, 'active', UTC_TIMESTAMP())`,
          [genId('ref'), level2SponsorId, userId]
        );
      }

      await createUserNotification(conn, {
        userId,
        type: 'system',
        title: 'Welcome to GO PAY BD!',
        message: 'Your verified member account and wallet ledger are ready.',
        link: '/dashboard',
      });

      await createAdminNotification(conn, {
        type: 'user',
        title: 'New Member Registered',
        message: `${fullName} (@${rawUsername} · ${uid}) joined GO PAY BD.`,
        link: `/admin/users/${userId}`,
      });

      const [uRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [userId]);
      const [wRows] = await conn.execute<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ?', [userId]);
      return { user: uRows[0], wallet: wRows[0] };
    });

    const rawToken = await createDbSession(req, 'user', created.user.id);
    setSessionCookie(req, res, USER_COOKIE_NAME, rawToken);
    await recordLoginLog(req, 'user', created.user.id, email, true);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: mapUserPublic(created.user),
        wallet: mapWallet(created.wallet),
        unread_notifications: 1,
        session_token: rawToken,
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
// Login (Email / Username / Phone + Password with lockout & migration handling)
// ============================================================================
router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const identifier = sanitizeText(req.body?.identifier || req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ success: false, message: 'Email/username and password are required.' });
      return;
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM users
       WHERE LOWER(email) = ? OR LOWER(username) = ? OR phone = ?
       LIMIT 1`,
      [identifier, identifier, identifier]
    );

    if (!rows.length) {
      await recordLoginLog(req, 'user', null, identifier, false);
      res.status(401).json({ success: false, message: 'Invalid email/username or password.' });
      return;
    }

    const user = rows[0];

    if (user.status === 'suspended') {
      await recordLoginLog(req, 'user', user.id, identifier, false);
      res.status(403).json({
        success: false,
        message: 'This account has been suspended. Please contact GO PAY BD support.',
      });
      return;
    }

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      await recordLoginLog(req, 'user', user.id, identifier, false);
      res.status(429).json({
        success: false,
        message: 'Too many failed login attempts. Please wait 15 minutes or reset your password.',
      });
      return;
    }

    // Handle users migrated from Firebase Auth who need a one-time password reset
    if (Number(user.password_reset_required) === 1 || !user.password_hash) {
      res.status(403).json({
        success: false,
        code: 'PASSWORD_RESET_REQUIRED',
        message:
          'We upgraded our security system. Please use "Forgot Password" to set a fresh password for your account — all your wallet balance and history are safely preserved.',
      });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const nextAttempts = Number(user.failed_attempts || 0) + 1;
      const shouldLock = nextAttempts >= 5;
      await execute(
        `UPDATE users
         SET failed_attempts = ?,
             locked_until = IF(?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), locked_until)
         WHERE id = ?`,
        [nextAttempts, shouldLock ? 1 : 0, user.id]
      );
      await recordLoginLog(req, 'user', user.id, identifier, false);
      res.status(401).json({
        success: false,
        message: shouldLock
          ? 'Account temporarily locked for 15 minutes due to multiple failed attempts.'
          : 'Invalid email/username or password.',
      });
      return;
    }

    await execute(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?`,
      [user.id]
    );

    const [walletRows, notifRows] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [user.id]),
      query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [user.id]),
    ]);

    const rawToken = await createDbSession(req, 'user', user.id);
    setSessionCookie(req, res, USER_COOKIE_NAME, rawToken);
    await recordLoginLog(req, 'user', user.id, identifier, true);

    res.json({
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: mapUserPublic(user),
        wallet: mapWallet(walletRows[0] || { user_id: user.id }),
        unread_notifications: Number(notifRows[0]?.cnt || 0),
        session_token: rawToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Logout & Session Hydration (/api/auth/me)
// ============================================================================
router.post('/logout', async (req, res, next) => {
  try {
    const rawCookie = req.cookies?.[USER_COOKIE_NAME];
    const headerToken = typeof req.headers['x-user-session'] === 'string' ? req.headers['x-user-session'] : undefined;
    await deleteDbSessionByRawToken(rawCookie || headerToken);
    clearSessionCookie(req, res, USER_COOKIE_NAME);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }
    if (user.status === 'suspended') {
      clearSessionCookie(req, res, USER_COOKIE_NAME);
      res.status(403).json({ success: false, message: 'Account suspended.' });
      return;
    }

    const [walletRows, notifRows] = await Promise.all([
      query<RowDataPacket[]>('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [user.id]),
      query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [user.id]),
    ]);

    res.json({
      success: true,
      data: {
        user: mapUserPublic(user),
        wallet: mapWallet(walletRows[0] || { user_id: user.id }),
        unread_notifications: Number(notifRows[0]?.cnt || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Forgot Password & Reset Password (secure hashed one-time token)
// ============================================================================
router.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const email = sanitizeText(req.body?.email, 190).toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      return;
    }

    const rows = await query<RowDataPacket[]>('SELECT id, email, full_name FROM users WHERE LOWER(email) = ? LIMIT 1', [
      email,
    ]);

    if (rows.length > 0) {
      const user = rows[0];
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawResetToken);

      await execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [
        user.id,
      ]);

      await execute(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE), UTC_TIMESTAMP())`,
        [genId('prt'), user.id, tokenHash]
      );

      // Note: Do NOT log rawResetToken or return it in production HTTP responses.
      // When SMTP is configured on cPanel, integrate mail dispatch here.
      await createAdminNotification(null, {
        type: 'security',
        title: 'Password Reset Requested',
        message: `Member ${user.full_name} (${user.email}) requested a password reset.`,
        link: `/admin/users/${user.id}`,
      });
    }

    // Always return non-enumerating response
    res.json({
      success: true,
      message:
        'If an account exists for that email, a password reset link/instructions have been issued. You may also contact support if you do not receive an email.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authRateLimiter, async (req, res, next) => {
  try {
    const token = sanitizeText(req.body?.token, 128);
    const newPassword = String(req.body?.new_password || req.body?.password || '');
    const confirmPassword = req.body?.confirm_password;

    if (!token || token.length < 16) {
      res.status(400).json({ success: false, message: 'A valid password reset token is required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      return;
    }
    if (confirmPassword !== undefined && newPassword !== String(confirmPassword)) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    const tokenHash = hashToken(token);
    const newHash = await hashPassword(newPassword);

    await withTransaction(async (conn) => {
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
         LIMIT 1 FOR UPDATE`,
        [tokenHash]
      );
      if (!rows.length) {
        throw Object.assign(new Error('Reset link is invalid or has expired. Please request a new one.'), { status: 400 });
      }

      const prt = rows[0];
      await conn.execute(
        `UPDATE users
         SET password_hash = ?, password_reset_required = 0, failed_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [newHash, prt.user_id]
      );
      await conn.execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [prt.id]);
      await conn.execute(`DELETE FROM sessions WHERE actor_type = 'user' AND actor_id = ?`, [prt.user_id]);
    });

    res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
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
// Optional Server-Side Google OAuth (for Regular Users)
// ============================================================================
router.get('/google/status', (_req, res) => {
  res.json({
    success: true,
    data: {
      enabled: env.googleOAuthConfigured,
    },
  });
});

router.get('/google/url', (req, res) => {
  if (!env.googleOAuthConfigured) {
    res.status(503).json({
      success: false,
      message: 'Google Sign-In is not configured on this server. Please sign in using Email & Password.',
    });
    return;
  }

  const referralCode = sanitizeText(req.query.ref, 64).toUpperCase();
  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = Buffer.from(JSON.stringify({ n: nonce, ref: referralCode })).toString('base64url');
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(statePayload).digest('hex');
  const signedState = `${statePayload}.${sig}`;

  const secure = isSecureRequest(req);
  res.cookie(GOOGLE_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure,
    sameSite: getCookieSameSite(secure),
    path: '/',
    maxAge: 10 * 60 * 1000,
  });

  const redirectUri = getGoogleRedirectUri(req);
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: signedState,
    prompt: 'select_account',
  });

  res.json({
    success: true,
    data: {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    },
  });
});

export async function handleGoogleOAuthCallback(req: Request, res: Response): Promise<void> {
  const sendPopupHtml = (ok: boolean, payload: Record<string, unknown>) => {
    const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    res.status(ok ? 200 : 400).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html>
<head><title>GO PAY BD Authentication</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;text-align:center;color:#0F172A;">
  <p>${ok ? 'Authentication successful! Closing window...' : 'Authentication could not be completed.'}</p>
  <script>
    (function() {
      var data = ${safeJson};
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(data, '*');
        window.close();
      } else {
        window.location.href = ${ok ? "'/dashboard'" : "'/login'"};
      }
    })();
  </script>
</body>
</html>`);
  };

  try {
    if (!env.googleOAuthConfigured) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'Google OAuth is not configured.' });
      return;
    }

    const code = sanitizeText(req.query.code, 512);
    const state = sanitizeText(req.query.state, 512);
    if (!code || !state || !state.includes('.')) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'Invalid OAuth callback parameters.' });
      return;
    }

    const [statePayload, sig] = state.split('.');
    const expectedSig = crypto.createHmac('sha256', env.sessionSecret).update(statePayload).digest('hex');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'OAuth state verification failed.' });
      return;
    }

    const parsedState = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf8'));
    const cookieNonce = req.cookies?.[GOOGLE_STATE_COOKIE];
    if (cookieNonce && cookieNonce !== parsedState.n) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'OAuth session mismatch.' });
      return;
    }
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/' });

    const redirectUri = getGoogleRedirectUri(req);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'Failed to exchange Google OAuth code.' });
      return;
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile: any = await profileRes.json();
    const email = sanitizeText(profile?.email, 190).toLowerCase();
    const googleSub = sanitizeText(profile?.sub, 190);
    const fullName = sanitizeText(profile?.name || email.split('@')[0], 160);
    const picture = sanitizeText(profile?.picture, 500);

    if (!email || !googleSub) {
      sendPopupHtml(false, { type: 'OAUTH_AUTH_ERROR', message: 'Google account did not provide an email.' });
      return;
    }

    const userRecord = await withTransaction(async (conn) => {
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT * FROM users WHERE google_id = ? OR LOWER(email) = ? LIMIT 1`,
        [googleSub, email]
      );

      if (existing.length > 0) {
        const u = existing[0];
        if (u.status === 'suspended') {
          throw new Error('Your account is suspended.');
        }
        await conn.execute(
          `UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), last_login_at = UTC_TIMESTAMP() WHERE id = ?`,
          [googleSub, picture || null, u.id]
        );
        return u;
      }

      const settings = await getPlatformSettings(conn);
      if (settings.registration_enabled === 'false') {
        throw new Error('New registrations are temporarily paused.');
      }

      const userId = genId('usr');
      const uid = genCode('GPBD', 6);
      const baseUsername = email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 16) || 'member';
      const username = `${baseUsername}${crypto.randomInt(100, 999)}`;
      const myReferralCode = genReferralCode(username);

      let sponsorId: string | null = null;
      let sponsorUsername: string | null = null;
      let level2SponsorId: string | null = null;
      const refCode = sanitizeText(parsedState.ref, 64).toUpperCase();
      if (refCode) {
        const [sponsors] = await conn.execute<RowDataPacket[]>(
          `SELECT id, username, referred_by FROM users WHERE UPPER(referral_code) = ? LIMIT 1`,
          [refCode]
        );
        if (sponsors.length > 0) {
          sponsorId = sponsors[0].id;
          sponsorUsername = sponsors[0].username;
          level2SponsorId = sponsors[0].referred_by || null;
        }
      }

      await conn.execute(
        `INSERT INTO users
           (id, uid, full_name, username, email, phone, password_hash, password_reset_required,
            google_id, referral_code, referred_by, sponsor_username, status, role, avatar_url,
            last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '', NULL, 0, ?, ?, ?, ?, 'active', 'user', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [userId, uid, fullName, username, email, googleSub, myReferralCode, sponsorId, sponsorUsername, picture || null]
      );

      await conn.execute(
        `INSERT INTO wallets (user_id, balance_paisa, locked_balance_paisa, total_deposited_paisa, total_withdrawn_paisa, total_commission_paisa, total_spent_paisa, updated_at)
         VALUES (?, 0, 0, 0, 0, 0, 0, UTC_TIMESTAMP())`,
        [userId]
      );

      await conn.execute(
        `INSERT INTO public_referrals (referral_code, user_id, username, full_name, clicks, updated_at)
         VALUES (?, ?, ?, ?, 0, UTC_TIMESTAMP())`,
        [myReferralCode, userId, username, fullName]
      );

      if (sponsorId) {
        await conn.execute(
          `INSERT IGNORE INTO referrals (id, referrer_user_id, referred_user_id, level, status, created_at)
           VALUES (?, ?, ?, 1, 'active', UTC_TIMESTAMP())`,
          [genId('ref'), sponsorId, userId]
        );
      }
      if (level2SponsorId && level2SponsorId !== sponsorId) {
        await conn.execute(
          `INSERT IGNORE INTO referrals (id, referrer_user_id, referred_user_id, level, status, created_at)
           VALUES (?, ?, ?, 2, 'active', UTC_TIMESTAMP())`,
          [genId('ref'), level2SponsorId, userId]
        );
      }

      const [fresh] = await conn.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [userId]);
      return fresh[0];
    });

    const rawToken = await createDbSession(req, 'user', userRecord.id);
    setSessionCookie(req, res, USER_COOKIE_NAME, rawToken);
    await recordLoginLog(req, 'user', userRecord.id, email, true);

    sendPopupHtml(true, { type: 'OAUTH_AUTH_SUCCESS', session_token: rawToken });
  } catch (err: any) {
    sendPopupHtml(false, {
      type: 'OAUTH_AUTH_ERROR',
      message: err?.message || 'Google authentication failed.',
    });
  }
}

export default router;
