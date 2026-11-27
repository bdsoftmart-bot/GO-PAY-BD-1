import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { query, execute } from '../database/pool';
import { genId, generateSessionToken, getClientIp, hashToken, parsePermissions } from '../utils/helpers';

export const USER_COOKIE_NAME = 'gpbd_user_session';
export const ADMIN_COOKIE_NAME = 'gpbd_admin_session';

export interface AuthUser {
  id: string;
  uid: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  referral_code: string;
  referred_by: string | null;
  sponsor_username: string | null;
  status: string;
  role: string;
  preferred_language: string;
  avatar_url: string | null;
  address: string;
  city: string;
  notification_email: number;
  notification_inapp: number;
  last_login_at: Date | null;
  created_at: Date;
}

export interface AuthAdmin {
  id: string;
  admin_uid: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  permissions: string[];
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      admin?: AuthAdmin;
      sessionTokenHash?: string;
    }
  }
}

export function isSecureRequest(req: Request): boolean {
  if (env.isProd) return true;
  if (req.secure) return true;
  if (req.headers['x-forwarded-proto'] === 'https') return true;
  return false;
}

export function getCookieSameSite(secure: boolean): 'lax' | 'strict' | 'none' {
  if (env.cookieSameSite === 'none') {
    return secure ? 'none' : 'lax';
  }
  return env.cookieSameSite;
}

export function setSessionCookie(req: Request, res: Response, cookieName: string, rawToken: string): void {
  const secure = isSecureRequest(req);
  const maxAgeMs = env.sessionTtlDays * 24 * 60 * 60 * 1000;
  res.cookie(cookieName, rawToken, {
    httpOnly: true,
    secure,
    sameSite: getCookieSameSite(secure),
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(req: Request, res: Response, cookieName: string): void {
  const secure = isSecureRequest(req);
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure,
    sameSite: getCookieSameSite(secure),
    path: '/',
  });
}

export async function createDbSession(
  req: Request,
  actorType: 'user' | 'admin',
  actorId: string
): Promise<string> {
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const id = genId('sess');
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 250);

  await execute(
    `INSERT INTO sessions (id, token_hash, actor_type, actor_id, ip_address, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY), UTC_TIMESTAMP())`,
    [id, tokenHash, actorType, actorId, ip, ua, env.sessionTtlDays]
  );

  return rawToken;
}

export async function deleteDbSessionByRawToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

function extractToken(
  req: Request,
  cookieName: string,
  headerName: string,
  allowQueryToken = false
): string | null {
  const cookieToken = req.cookies?.[cookieName];
  if (typeof cookieToken === 'string' && cookieToken.length >= 32) {
    return cookieToken;
  }
  const customHeader = req.headers[headerName];
  if (typeof customHeader === 'string' && customHeader.length >= 32) {
    return customHeader.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length >= 32) return token;
  }
  if (allowQueryToken && typeof req.query?.token === 'string' && req.query.token.trim().length >= 32) {
    return req.query.token.trim();
  }
  return null;
}

export async function resolveUserFromRequest(
  req: Request,
  options?: { allowQueryToken?: boolean }
): Promise<AuthUser | null> {
  const rawToken = extractToken(req, USER_COOKIE_NAME, 'x-user-session', Boolean(options?.allowQueryToken));
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const rows = await query<RowDataPacket[]>(
    `SELECT u.*
     FROM sessions s
     INNER JOIN users u ON u.id = s.actor_id
     WHERE s.token_hash = ?
       AND s.actor_type = 'user'
       AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) return null;
  req.sessionTokenHash = tokenHash;
  return rows[0] as unknown as AuthUser;
}

export async function resolveAdminFromRequest(
  req: Request,
  options?: { allowQueryToken?: boolean }
): Promise<AuthAdmin | null> {
  const rawToken = extractToken(req, ADMIN_COOKIE_NAME, 'x-admin-session', Boolean(options?.allowQueryToken));
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const rows = await query<RowDataPacket[]>(
    `SELECT a.id, a.admin_uid, a.full_name, a.email, a.role_id, a.status,
            r.slug AS role_slug, r.name AS role_name, r.permissions_json
     FROM sessions s
     INNER JOIN admins a ON a.id = s.actor_id
     INNER JOIN admin_roles r ON r.id = a.role_id
     WHERE s.token_hash = ?
       AND s.actor_type = 'admin'
       AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) return null;
  const row = rows[0];
  req.sessionTokenHash = tokenHash;
  return {
    id: row.id,
    admin_uid: row.admin_uid,
    full_name: row.full_name,
    email: row.email,
    role_id: Number(row.role_id),
    role_slug: row.role_slug,
    role_name: row.role_name,
    permissions: parsePermissions(row.permissions_json),
    status: row.status,
  };
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
      return;
    }
    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact GO PAY BD support.',
      });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = await resolveAdminFromRequest(req);
    if (!admin) {
      res.status(401).json({ success: false, message: 'Administrator authentication required.' });
      return;
    }
    if (admin.status !== 'active') {
      res.status(403).json({ success: false, message: 'This administrator account is suspended.' });
      return;
    }
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;
    if (!admin) {
      res.status(401).json({ success: false, message: 'Administrator authentication required.' });
      return;
    }
    if (admin.permissions.includes('*') || admin.permissions.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      message: `Permission denied: requires "${permission}" capability.`,
    });
  };
}

export function isTrustedOrigin(rawOriginOrReferer: string | undefined, req?: Request): boolean {
  if (!rawOriginOrReferer) return false;
  try {
    const parsed = new URL(rawOriginOrReferer);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (env.allowedOrigins.has(parsed.origin)) {
      return true;
    }

    if (!env.isProd) {
      const hostName = parsed.hostname.toLowerCase();
      if (hostName === 'localhost' || hostName === '127.0.0.1' || hostName === '::1' || hostName === '0.0.0.0') {
        return true;
      }
      const reqHost = req?.headers?.host;
      if (reqHost && parsed.host === reqHost) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * CSRF protection for cookie-authenticated mutating API requests.
 * 1. If Origin or Referer is present, it MUST match our strict trusted origin allowlist
 *    even when X-Requested-With is supplied.
 * 2. Requires either a verified trusted Origin or a custom X-Requested-With header so
 *    header-stripped cross-site HTML forms cannot mutate state.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const referer = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';

  if (origin) {
    if (!isTrustedOrigin(origin, req)) {
      res.status(403).json({
        success: false,
        message: 'Cross-site request blocked: untrusted Origin.',
      });
      return;
    }
    next();
    return;
  }

  if (referer) {
    if (!isTrustedOrigin(referer, req)) {
      res.status(403).json({
        success: false,
        message: 'Cross-site request blocked: untrusted Referer.',
      });
      return;
    }
    const xrw = req.headers['x-requested-with'];
    if (xrw === 'XMLHttpRequest' || xrw === 'GoPayBD') {
      next();
      return;
    }
  }

  const xrw = req.headers['x-requested-with'];
  if (!origin && !referer && (xrw === 'XMLHttpRequest' || xrw === 'GoPayBD')) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Cross-site request blocked for your protection.',
  });
}

// Rate limiters
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down briefly.' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login or registration attempts. Please try again in 15 minutes.' },
});

export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin unlock attempts. Please wait 15 minutes before retrying.' },
});

export async function recordLoginLog(
  req: Request,
  actorType: 'user' | 'admin',
  actorId: string | null,
  identifier: string,
  success: boolean
): Promise<void> {
  try {
    await execute(
      `INSERT INTO login_logs (id, actor_type, actor_id, identifier, success, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        genId('llog'),
        actorType,
        actorId,
        identifier.slice(0, 190),
        success ? 1 : 0,
        getClientIp(req),
        String(req.headers['user-agent'] || '').slice(0, 250),
      ]
    );
  } catch {
    // non-fatal logging failure
  }
}

export async function recordAuditLog(params: {
  req: Request;
  actorType: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs
         (id, actor_type, actor_id, actor_name, action, entity_type, entity_id, old_values, new_values, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        genId('aud'),
        params.actorType,
        params.actorId,
        params.actorName.slice(0, 160),
        params.action.slice(0, 128),
        params.entityType.slice(0, 64),
        params.entityId || null,
        params.oldValues !== undefined ? JSON.stringify(params.oldValues) : null,
        params.newValues !== undefined ? JSON.stringify(params.newValues) : null,
        getClientIp(params.req),
      ]
    );
  } catch {
    // non-fatal audit logging failure
  }
}
