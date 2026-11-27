import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const PLACEHOLDER_SECRET_RE = /replace_with|changeme|your_secret|your_long_random|example_secret|default_secret/i;

function resolveSessionSecret(): string {
  const raw = String(process.env.SESSION_SECRET || '').trim();
  if (isProd) {
    if (!raw || raw.length < 32 || PLACEHOLDER_SECRET_RE.test(raw)) {
      throw new Error(
        '[GO PAY BD] FATAL CONFIGURATION ERROR: A persistent, non-placeholder SESSION_SECRET (at least 32 characters) is required when NODE_ENV=production.'
      );
    }
    return raw;
  }
  if (raw && raw.length >= 16) {
    return raw;
  }
  // Ephemeral random secret for local development only when SESSION_SECRET is unset
  return crypto.randomBytes(32).toString('hex');
}

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const candidates = [
    process.env.APP_URL || '',
    process.env.FRONTEND_URL || '',
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ];

  for (const item of candidates) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin !== 'null') {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore invalid URL strings
    }
  }
  return origins;
}

function resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
  const val = String(process.env.COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
  if (val === 'strict' || val === 'none' || val === 'lax') {
    return val;
  }
  return 'lax';
}

const sessionSecret = resolveSessionSecret();
const allowedOrigins = buildAllowedOrigins();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Math.max(1, Number(process.env.PORT) || 3000),
  appUrl: (process.env.APP_URL || '').replace(/\/+$/, ''),
  frontendUrl: (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/+$/, ''),
  allowedOrigins,

  // MySQL Database
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbName: process.env.DB_NAME || '',
  dbUser: process.env.DB_USER || '',
  dbPassword: process.env.DB_PASSWORD || '',
  dbConfigured: Boolean(process.env.DB_NAME && process.env.DB_USER),

  // Sessions & Auth
  sessionSecret,
  sessionTtlDays: Math.max(1, Number(process.env.SESSION_TTL_DAYS) || 7),
  cookieSameSite: resolveCookieSameSite(),
  adminPassword: process.env.ADMIN_PASSWORD || '',

  // Uploads (always resolved outside src/)
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),

  // Optional Google OAuth (strictly server-side secret)
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  get googleOAuthConfigured(): boolean {
    return Boolean(this.googleClientId && this.googleClientSecret);
  },

  // Optional SMTP
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'no-reply@gopaybd.store',
};
