import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../database/pool';
import { DEFAULT_PUBLIC_SETTINGS, genCode, genId } from '../utils/helpers';

export async function getPlatformSettings(conn?: PoolConnection): Promise<Record<string, string>> {
  const merged = { ...DEFAULT_PUBLIC_SETTINGS };
  try {
    const rows = conn
      ? (await conn.execute<RowDataPacket[]>('SELECT setting_key, setting_value FROM platform_settings'))[0]
      : await query<RowDataPacket[]>('SELECT setting_key, setting_value FROM platform_settings');

    for (const row of rows) {
      if (row.setting_key) {
        merged[String(row.setting_key)] = String(row.setting_value ?? '');
      }
    }
  } catch {
    // Return defaults if DB is not initialized yet
  }
  return merged;
}

export async function createUserNotification(
  conn: PoolConnection | null,
  params: {
    userId: string;
    type?: string;
    title: string;
    message: string;
    link?: string | null;
  }
): Promise<void> {
  const sql = `
    INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, UTC_TIMESTAMP())
  `;
  const values = [
    genId('ntf'),
    params.userId,
    params.type || 'system',
    params.title.slice(0, 200),
    params.message,
    params.link || null,
  ];
  if (conn) {
    await conn.execute(sql, values);
  } else {
    await execute(sql, values);
  }
}

export async function createAdminNotification(
  conn: PoolConnection | null,
  params: {
    type?: string;
    title: string;
    message: string;
    link?: string | null;
  }
): Promise<void> {
  const sql = `
    INSERT INTO admin_notifications (id, type, title, message, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, UTC_TIMESTAMP())
  `;
  const values = [
    genId('antf'),
    params.type || 'system',
    params.title.slice(0, 200),
    params.message,
    params.link || null,
  ];
  if (conn) {
    await conn.execute(sql, values);
  } else {
    await execute(sql, values);
  }
}

export async function insertWalletTransaction(
  conn: PoolConnection,
  params: {
    userId: string;
    type: string;
    direction: 'credit' | 'debit';
    amountPaisa: number;
    balanceBeforePaisa: number;
    balanceAfterPaisa: number;
    referenceType?: string | null;
    referenceId?: string | null;
    paymentMethod?: string | null;
    senderNumber?: string | null;
    receiverNumber?: string | null;
    description?: string | null;
    status?: string;
    createdByAdminId?: string | null;
  }
): Promise<string> {
  const id = genId('tx');
  const txUid = genCode('TXN', 8);
  await conn.execute(
    `INSERT INTO wallet_transactions
       (id, tx_uid, user_id, type, direction, amount_paisa, balance_before_paisa, balance_after_paisa,
        reference_type, reference_id, payment_method, sender_number, receiver_number, description,
        status, created_by_admin_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      id,
      txUid,
      params.userId,
      params.type,
      params.direction,
      params.amountPaisa,
      params.balanceBeforePaisa,
      params.balanceAfterPaisa,
      params.referenceType || null,
      params.referenceId || null,
      params.paymentMethod || null,
      params.senderNumber || null,
      params.receiverNumber || null,
      params.description || '',
      params.status || 'completed',
      params.createdByAdminId || null,
    ]
  );
  return id;
}

export async function nextInvoiceNumber(conn: PoolConnection, prefix: string): Promise<string> {
  await conn.execute(
    `INSERT INTO counters (counter_key, current_value, updated_at)
     VALUES ('invoice_seq', 1000, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE counter_key = counter_key`
  );
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT current_value FROM counters WHERE counter_key = 'invoice_seq' FOR UPDATE`
  );
  const nextVal = Number(rows[0]?.current_value || 1000) + 1;
  await conn.execute(
    `UPDATE counters SET current_value = ?, updated_at = UTC_TIMESTAMP() WHERE counter_key = 'invoice_seq'`,
    [nextVal]
  );
  const cleanPrefix = (prefix || 'GPBD-INV').replace(/[^A-Za-z0-9-]/g, '').slice(0, 16) || 'GPBD-INV';
  const year = new Date().getUTCFullYear();
  return `${cleanPrefix}-${year}-${String(nextVal).padStart(5, '0')}`;
}
