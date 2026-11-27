import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { env } from '../config/env';

let pool: Pool | null = null;
let dbReady = false;
let lastDbError: string | null = null;

export class DatabaseUnavailableError extends Error {
  status = 503;
  constructor(message = 'Database service is currently unavailable. Please configure MySQL connection settings.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export function getPool(): Pool {
  if (!env.dbConfigured) {
    throw new DatabaseUnavailableError(
      'MySQL database is not configured yet. Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD in your environment.'
    );
  }
  if (!pool) {
    pool = mysql.createPool({
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      multipleStatements: false,
      timezone: 'Z',
      decimalNumbers: true,
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: any[] = []
): Promise<T> {
  const p = getPool();
  try {
    const [rows] = await p.execute<T>(sql, params);
    dbReady = true;
    lastDbError = null;
    return rows;
  } catch (err: any) {
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ER_ACCESS_DENIED_ERROR' || err?.code === 'ER_BAD_DB_ERROR') {
      dbReady = false;
      lastDbError = err.code;
      throw new DatabaseUnavailableError('Unable to reach MySQL database. Verify cPanel MySQL credentials and host.');
    }
    throw err;
  }
}

export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const p = getPool();
  try {
    const [result] = await p.execute<ResultSetHeader>(sql, params);
    dbReady = true;
    lastDbError = null;
    return result;
  } catch (err: any) {
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ER_ACCESS_DENIED_ERROR' || err?.code === 'ER_BAD_DB_ERROR') {
      dbReady = false;
      lastDbError = err.code;
      throw new DatabaseUnavailableError('Unable to reach MySQL database. Verify cPanel MySQL credentials and host.');
    }
    throw err;
  }
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const p = getPool();
  let conn: PoolConnection;
  try {
    conn = await p.getConnection();
  } catch (err: any) {
    dbReady = false;
    lastDbError = err?.code || 'CONN_ERROR';
    throw new DatabaseUnavailableError('Unable to open MySQL transaction connection.');
  }

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    dbReady = true;
    lastDbError = null;
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback error on broken socket
    }
    throw err;
  } finally {
    conn.release();
  }
}

function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const ch = sqlContent[i];
    const next = sqlContent[i + 1] || '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        current += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-' && (sqlContent[i + 2] === ' ' || sqlContent[i + 2] === '\t' || sqlContent[i + 2] === '\r' || sqlContent[i + 2] === '\n')) {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === '#') {
        inLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (ch === '\\' && (inSingle || inDouble)) {
      current += ch + next;
      i++;
      continue;
    }

    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !/^SET\s+/i.test(trimmed)) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0 && !/^SET\s+/i.test(tail)) {
    statements.push(tail);
  }
  return statements;
}

async function ensureSchemaUpgrades(conn: PoolConnection): Promise<void> {
  const columnAdditions: Array<{ table: string; column: string; ddl: string }> = [
    {
      table: 'users',
      column: 'admin_note',
      ddl: 'ALTER TABLE `users` ADD COLUMN `admin_note` TEXT NULL AFTER `notification_inapp`',
    },
    {
      table: 'payment_settings',
      column: 'withdrawal_enabled',
      ddl: 'ALTER TABLE `payment_settings` ADD COLUMN `withdrawal_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_active`',
    },
    {
      table: 'deposits',
      column: 'processing_eta',
      ddl: 'ALTER TABLE `deposits` ADD COLUMN `processing_eta` VARCHAR(120) NULL AFTER `admin_note`',
    },
    {
      table: 'payment_methods',
      column: 'notes',
      ddl: 'ALTER TABLE `payment_methods` ADD COLUMN `notes` TEXT NULL AFTER `routing_number`',
    },
    {
      table: 'payment_methods',
      column: 'verification_status',
      ddl: "ALTER TABLE `payment_methods` ADD COLUMN `verification_status` VARCHAR(32) NOT NULL DEFAULT 'active' AFTER `is_default`",
    },
    {
      table: 'payment_methods',
      column: 'pin_hash',
      ddl: 'ALTER TABLE `payment_methods` ADD COLUMN `pin_hash` VARCHAR(255) NULL AFTER `verification_status`',
    },
    {
      table: 'withdrawals',
      column: 'paid_amount_paisa',
      ddl: 'ALTER TABLE `withdrawals` ADD COLUMN `paid_amount_paisa` BIGINT NULL AFTER `net_amount_paisa`',
    },
    {
      table: 'withdrawals',
      column: 'payment_date',
      ddl: 'ALTER TABLE `withdrawals` ADD COLUMN `payment_date` DATE NULL AFTER `paid_at`',
    },
    {
      table: 'invoices',
      column: 'due_date',
      ddl: 'ALTER TABLE `invoices` ADD COLUMN `due_date` DATE NULL AFTER `issued_at`',
    },
    {
      table: 'invoices',
      column: 'tax_paisa',
      ddl: 'ALTER TABLE `invoices` ADD COLUMN `tax_paisa` BIGINT NOT NULL DEFAULT 0 AFTER `fee_paisa`',
    },
    {
      table: 'invoices',
      column: 'invoice_status',
      ddl: "ALTER TABLE `invoices` ADD COLUMN `invoice_status` ENUM('draft', 'issued', 'paid', 'void') NOT NULL DEFAULT 'paid' AFTER `payment_status`",
    },
    {
      table: 'support_tickets',
      column: 'internal_note',
      ddl: 'ALTER TABLE `support_tickets` ADD COLUMN `internal_note` TEXT NULL AFTER `assigned_admin_id`',
    },
  ];

  for (const item of columnAdditions) {
    const [cols] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [item.table, item.column]
    );
    if (Number(cols[0]?.cnt || 0) === 0) {
      await conn.query(item.ddl);
    }
  }

  // Ensure expanded ENUM values exist on pre-existing databases
  const [wdCols] = await conn.execute<RowDataPacket[]>(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdrawals' AND COLUMN_NAME = 'status'`
  );
  if (wdCols.length && !String(wdCols[0].COLUMN_TYPE || '').includes("'processing'")) {
    await conn.query(
      "ALTER TABLE `withdrawals` MODIFY COLUMN `status` ENUM('pending', 'processing', 'approved', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending'"
    );
  }

  const [stCols] = await conn.execute<RowDataPacket[]>(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets' AND COLUMN_NAME = 'status'`
  );
  if (stCols.length && !String(stCols[0].COLUMN_TYPE || '').includes("'answered'")) {
    await conn.query(
      "ALTER TABLE `support_tickets` MODIFY COLUMN `status` ENUM('open', 'in_progress', 'answered', 'resolved', 'closed') NOT NULL DEFAULT 'open'"
    );
  }
}

export async function initializeDatabase(): Promise<{ connected: boolean; error?: string }> {
  if (!env.dbConfigured) {
    dbReady = false;
    lastDbError = 'DB_NOT_CONFIGURED';
    console.warn('[DB] MySQL environment variables (DB_NAME / DB_USER) are not set. Running in standby mode until configured.');
    return { connected: false, error: 'DB_NOT_CONFIGURED' };
  }

  try {
    const p = getPool();
    const conn = await p.getConnection();
    try {
      await conn.ping();

      // Run idempotent schema & seed files safely (CREATE TABLE IF NOT EXISTS + INSERT IGNORE)
      const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        for (const stmt of splitSqlStatements(schemaSql)) {
          await conn.query(stmt);
        }
      }

      // Upgrade pre-existing tables if newer columns/enum values are missing
      await ensureSchemaUpgrades(conn);

      const seedPath = path.resolve(process.cwd(), 'database', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        for (const stmt of splitSqlStatements(seedSql)) {
          await conn.query(stmt);
        }
      }

      // Clean expired sessions opportunistically on startup
      await conn.execute('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
    } finally {
      conn.release();
    }

    dbReady = true;
    lastDbError = null;
    console.log(`[DB] Connected to MySQL (${env.dbHost}:${env.dbPort}/${env.dbName}) and verified schema.`);
    return { connected: true };
  } catch (err: any) {
    dbReady = false;
    lastDbError = err?.code || 'CONNECTION_FAILED';
    console.error(`[DB] Startup connection failed (${lastDbError}). Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.`);
    return { connected: false, error: lastDbError || undefined };
  }
}

export async function checkDatabaseHealth(): Promise<{ connected: boolean; configured: boolean }> {
  if (!env.dbConfigured) {
    return { connected: false, configured: false };
  }
  try {
    const p = getPool();
    await p.query('SELECT 1');
    dbReady = true;
    lastDbError = null;
    return { connected: true, configured: true };
  } catch {
    dbReady = false;
    return { connected: false, configured: true };
  }
}

export function isDatabaseReady(): boolean {
  return dbReady;
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // ignore close errors during shutdown
    }
    pool = null;
    dbReady = false;
  }
}
