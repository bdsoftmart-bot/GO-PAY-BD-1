import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './server/config/env';
import { query, DatabaseUnavailableError, closeDatabasePool, initializeDatabase } from './server/database/pool';
import {
  csrfProtection,
  generalApiLimiter,
  isTrustedOrigin,
  resolveAdminFromRequest,
  resolveUserFromRequest,
} from './server/middleware/auth';
import { resolveSafeUploadPath } from './server/middleware/upload';
import type { RowDataPacket } from 'mysql2/promise';
import publicRoutes from './server/routes/publicRoutes';
import authRoutes, { handleGoogleOAuthCallback } from './server/routes/authRoutes';
import userRoutes from './server/routes/userRoutes';
import adminRoutes from './server/routes/adminRoutes';

async function startServer() {
  const app = express();

  // Behind cPanel/Apache/Nginx/Cloudflare reverse proxy
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers (compatible with SPA assets and preview iframes)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  if (env.isProd && env.allowedOrigins.size === 0) {
    console.warn('[GO PAY BD] Warning: APP_URL / FRONTEND_URL / ALLOWED_ORIGINS not set; cross-origin CORS and Origin checks will reject untrusted origins.');
  }

  // Strict CORS allowlist (never reflect arbitrary origins in production)
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (isTrustedOrigin(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Ensure uploads directory exists and serve uploaded files with path confinement + auth on sensitive folders
  fs.mkdirSync(env.uploadDir, { recursive: true });
  app.get('/uploads/:subdir/:filename', async (req, res, next) => {
    try {
      const subdir = String(req.params.subdir || '').toLowerCase();
      if (subdir !== 'avatars' && subdir !== 'deposits' && subdir !== 'support') {
        res.status(404).json({ success: false, message: 'File not found.' });
        return;
      }

      const safePath = resolveSafeUploadPath(subdir, req.params.filename);
      if (!safePath) {
        res.status(404).json({ success: false, message: 'File not found.' });
        return;
      }

      if (subdir === 'avatars') {
        if (!fs.existsSync(safePath)) {
          res.status(404).json({ success: false, message: 'File not found.' });
          return;
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=604800');
        res.sendFile(safePath);
        return;
      }

      // Deposit receipts & support attachments require active Admin or owning User
      const [admin, user] = await Promise.all([
        resolveAdminFromRequest(req, { allowQueryToken: true }),
        resolveUserFromRequest(req, { allowQueryToken: true }),
      ]);

      const activeAdmin = admin && admin.status === 'active' ? admin : null;
      const activeUser = user && user.status !== 'suspended' ? user : null;

      if (!activeAdmin && !activeUser) {
        res.status(401).json({ success: false, message: 'Authentication required to view this file.' });
        return;
      }

      if (!activeAdmin && activeUser) {
        const publicUrl = `/uploads/${subdir}/${path.basename(safePath)}`;
        if (subdir === 'deposits') {
          const rows = await query<RowDataPacket[]>(
            `SELECT id FROM deposits WHERE user_id = ? AND screenshot_url = ? LIMIT 1`,
            [activeUser.id, publicUrl]
          );
          if (!rows.length) {
            res.status(403).json({ success: false, message: 'Access denied to this deposit receipt.' });
            return;
          }
        } else if (subdir === 'support') {
          const rows = await query<RowDataPacket[]>(
            `SELECT sm.id
             FROM support_messages sm
             INNER JOIN support_tickets st ON st.id = sm.ticket_id
             WHERE st.user_id = ? AND sm.attachment_url = ?
             LIMIT 1`,
            [activeUser.id, publicUrl]
          );
          if (!rows.length) {
            res.status(403).json({ success: false, message: 'Access denied to this support attachment.' });
            return;
          }
        }
      }

      if (!fs.existsSync(safePath)) {
        res.status(404).json({ success: false, message: 'File not found.' });
        return;
      }

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(safePath);
    } catch (err) {
      next(err);
    }
  });

  // Google OAuth callback routes (both with and without trailing slash)
  app.get('/auth/google/callback', handleGoogleOAuthCallback);
  app.get('/auth/google/callback/', handleGoogleOAuthCallback);

  // API rate limit & CSRF protection on mutating requests
  app.use('/api', generalApiLimiter);
  app.use('/api', csrfProtection);

  // Public & Health API routes
  app.use('/api', publicRoutes);

  // User Authentication routes
  app.use('/api/auth', authRoutes);

  // Admin Control Center routes (RBAC protected)
  app.use('/api/admin', adminRoutes);

  // Authenticated Member routes (mounted on /api/user and exact member prefixes under /api)
  const memberPrefixes = [
    '/dashboard',
    '/wallet',
    '/deposit-methods',
    '/deposits',
    '/payment-methods',
    '/withdrawal-rules',
    '/withdrawals',
    '/referrals',
    '/orders',
    '/invoices',
    '/notifications',
    '/support',
    '/profile',
  ];
  app.use('/api/user', userRoutes);
  app.use(
    memberPrefixes.map((p) => `/api${p}`),
    (req, res, next) => {
      req.url = req.baseUrl.replace(/^\/api/, '') + (req.url === '/' ? '' : req.url);
      userRoutes(req, res, next);
    }
  );

  // Strict JSON 404 for unknown /api/* endpoints (never return index.html for API 404s)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found.',
    });
  });

  // Centralized error handler (never leaks SQL or stack traces to clients)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof DatabaseUnavailableError || err?.status === 503) {
      res.status(503).json({
        success: false,
        message: err.message || 'Database service unavailable.',
      });
      return;
    }

    if (err?.name === 'MulterError') {
      res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large (max 5MB).' : err.message,
      });
      return;
    }

    const status = Number(err?.status) || 500;
    if (status >= 500) {
      console.error('[SERVER ERROR]', err?.message || err);
    }
    res.status(status).json({
      success: false,
      message: status >= 500 ? 'Internal server error. Please try again.' : err.message || 'Request failed.',
    });
  });

  // Frontend serving: Vite middleware in development, static dist/ + SPA fallback in production
  if (!env.isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false, maxAge: '7d' }));
    }
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(503).send('Frontend build not found. Run "npm run build" first.');
      }
    });
  }

  // Test MySQL connection & initialize idempotent schema/seed (fail fast in production)
  const dbInit = await initializeDatabase();
  if (env.isProd && !dbInit.connected) {
    console.error(
      `[GO PAY BD] FATAL STARTUP ERROR: MySQL database is required in production (${dbInit.error || 'CONNECTION_FAILED'}). Configure DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and retry.`
    );
    await closeDatabasePool();
    process.exit(1);
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[GO PAY BD] Server listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Graceful shutdown for cPanel Passenger / PM2 / SIGTERM
  const shutdown = async (signal: string) => {
    console.log(`[GO PAY BD] Received ${signal}. Shutting down cleanly...`);
    server.close(async () => {
      await closeDatabasePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[GO PAY BD] Fatal startup error:', err);
  process.exit(1);
});
