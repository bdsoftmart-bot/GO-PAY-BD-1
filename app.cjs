/**
 * cPanel Phusion Passenger Startup File (CommonJS wrapper)
 * Point cPanel "Application startup file" to: app.cjs
 * Make sure you have run "npm run build" before starting the app.
 */
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import('./dist-server/server.mjs').catch((err) => {
  console.error('[GO PAY BD] Failed to boot dist-server/server.mjs:', err);
  process.exit(1);
});
